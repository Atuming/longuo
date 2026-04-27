# ESLint 错误修复 Bugfix Design

## Overview

项目运行 `npx eslint src/` 后报告 32 个 ESLint 错误，导致 CI/CD 流水线 lint 检查失败。错误分为三大类：`react-hooks/set-state-in-effect`（约 20 处）、`@typescript-eslint/no-unused-vars`（约 10 处）、以及其他零散问题（3 处）。修复策略是针对每类错误采用最小化、安全的重构手段，确保不改变运行时行为，同时使所有 ESLint 规则通过。

## Glossary

- **Bug_Condition (C)**: 代码中存在违反 ESLint 规则的模式，导致 `npx eslint src/` 报告错误
- **Property (P)**: 修复后 `npx eslint src/` 报告 0 错误 0 警告，退出码为零
- **Preservation**: 现有 287 个测试全部通过、TypeScript 编译无错误、所有组件运行时行为不变
- **set-state-in-effect**: `react-hooks/set-state-in-effect` 规则，禁止在 useEffect 回调中直接同步调用 setState
- **no-unused-vars**: `@typescript-eslint/no-unused-vars` 规则，禁止声明未使用的变量/导入

## Bug Details

### Bug Condition

当代码中存在以下任一模式时，ESLint 报告错误：
1. 在 `useEffect` 回调中直接同步调用 `setState`（`react-hooks/set-state-in-effect`）
2. 声明了变量/导入但未在后续代码中使用（`@typescript-eslint/no-unused-vars`）
3. 表达式语句无副作用（`no-unused-expressions`）
4. 使用 `any` 类型（`no-explicit-any`）
5. 文件同时导出组件和非组件函数（`react-refresh/only-export-components`）

**Formal Specification:**
```
FUNCTION isBugCondition(file)
  INPUT: file of type SourceFile
  OUTPUT: boolean
  
  RETURN eslintAnalyze(file).errorCount > 0
END FUNCTION
```

### Examples

- `PlotDialog.tsx`: useEffect 中调用 `setForm({...})` → ESLint 报告 set-state-in-effect
- `CharacterDialog.tsx`: 解构 `const { id: _id, projectId: _pid, ...rest } = initialData` 中 `_id`、`_pid` 未使用 → 报告 no-unused-vars
- `chapter-store.ts`: `oldSortOrder` 变量赋值后未使用 → 报告 no-unused-vars
- `Toast.tsx`: 同时导出 `showToast` 函数和 `ToastContainer` 组件 → 报告 react-refresh/only-export-components

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 所有 Dialog 组件（CharacterDialog、PlotDialog、WorldDialog、TimelineDialog、RelationshipDialog、ExportDialog、AIConfigDialog）打开时正确初始化表单状态，关闭后正确重置
- 所有 Sidebar Tab 组件（CharacterTab、PlotTab、WorldTab、TimelineTab、OutlineTab）的列表数据刷新和筛选行为
- 所有 Detail Panel 组件（CharacterDetailPanel、WorldDetailPanel、TimelineDetailPanel）的数据加载和展示
- AI 辅助引擎的流式响应错误处理逻辑
- 一致性引擎的角色名称匹配逻辑
- 章节 store 的 reorderChapter 排序逻辑
- Toast 组件的通知显示功能

**Scope:**
所有修改仅限于消除 ESLint 错误，不改变任何运行时逻辑。修改范围包括：
- 重构 useEffect 中的 setState 调用模式
- 移除或标记未使用的变量
- 修复表达式语句和类型注解
- 调整文件导出结构

## Hypothesized Root Cause

这些 ESLint 错误的根本原因是代码编写时未启用或未严格遵循当前 ESLint 配置中的规则：

1. **react-hooks/set-state-in-effect（约 20 处）**: 开发者在 useEffect 中直接调用 setState 来初始化/同步状态，这是 React 中常见但被新版 eslint-plugin-react-hooks 标记为反模式的写法。根据具体场景分为三种子类型：
   - **Dialog 表单初始化**（PlotDialog、WorldDialog、TimelineDialog、RelationshipDialog、CharacterDialog、ExportDialog）：在 `useEffect([open, initialData, ...])` 中调用 `setForm(...)` 来初始化表单
   - **AIConfigDialog 多状态同步**：在 `useEffect([open, aiStore])` 中调用多个 setState，以及在 `useEffect([selectedProviderId, providers])` 和 `useEffect([selectedTemplateId, templates])` 中同步表单字段
   - **Sidebar Tab 数据刷新**（CharacterTab、PlotTab、WorldTab、TimelineTab、OutlineTab）：在 `useEffect([refresh])` 中通过 `refresh()` 间接调用 setState
   - **Detail Panel 数据加载**（CharacterDetailPanel、WorldDetailPanel、TimelineDetailPanel）：在 useEffect 中调用 setState 加载数据

2. **@typescript-eslint/no-unused-vars（约 10 处）**: 变量声明后未使用，包括解构赋值中的占位变量、未使用的函数参数、未使用的导入等

3. **其他零散问题（3 处）**: 包括未使用的表达式、显式 any 类型、以及 react-refresh 导出限制

## Correctness Properties

Property 1: Bug Condition - ESLint 零错误

_For any_ 源文件在修复后的代码库中，运行 `npx eslint src/` SHALL 报告 0 个错误 0 个警告，退出码为零。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

Property 2: Preservation - 测试与编译不回归

_For any_ 修复后的代码库，运行 `npx vitest --run` SHALL 保持现有 287 个测试全部通过，运行 `tsc -b` SHALL 无编译错误，所有组件的运行时行为 SHALL 与修复前完全一致。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9**

## Fix Implementation

### Changes Required


#### 类别一：react-hooks/set-state-in-effect 修复策略

##### 1A. Dialog 表单初始化（6 个文件，约 8 处 setState）

**受影响文件**: `PlotDialog.tsx`、`WorldDialog.tsx`、`TimelineDialog.tsx`、`RelationshipDialog.tsx`、`CharacterDialog.tsx`、`ExportDialog.tsx`

**当前模式**:
```tsx
const [form, setForm] = useState<FormData>(defaultForm);
useEffect(() => {
  if (open) {
    if (initialData) setForm({ ...initialData });
    else setForm(defaultForm);
  }
}, [open, initialData, ...]);
```

**采用方案**：使用 React 官方推荐的 "adjusting state based on props" 模式 —— 将 `useEffect` + `setState` 替换为在渲染阶段直接比较 props 并调用 setState（React 18+ 支持在渲染阶段调用 setState，会立即触发重新渲染）：

```tsx
const [form, setForm] = useState<FormData>(defaultForm);
const [prevOpen, setPrevOpen] = useState(open);
if (open !== prevOpen) {
  setPrevOpen(open);
  if (open) {
    setForm(initialData ? { ...initialData } : defaultForm);
  }
}
```

这不需要 useEffect，在渲染阶段调用 setState 是合法的，且不会触发 `set-state-in-effect` 规则。移除 `useEffect` 导入（如果不再需要）。

##### 1B. AIConfigDialog 多状态同步（1 个文件，约 10 处 setState）

**受影响文件**: `AIConfigDialog.tsx`

**当前模式**: 三个 useEffect 分别处理：
1. `useEffect([open, aiStore])` → 设置 providers、templates、activeProviderId、activeTemplateId、selectedProviderId、selectedTemplateId（6 个 setState）
2. `useEffect([selectedProviderId, providers])` → 设置 pName、pApiKey、pModel、pEndpoint、pTimeout（5 个 setState）
3. `useEffect([selectedTemplateId, templates])` → 设置 tName、tSystem、tUser（3 个 setState）

**修复方案**: 同样使用"渲染阶段比较 props 并调用 setState"模式：
1. 第一个 useEffect → 用 `prevOpen` 状态追踪 open 变化，在渲染阶段同步
2. 第二个 useEffect → 用 `prevSelectedProviderId` 追踪变化
3. 第三个 useEffect → 用 `prevSelectedTemplateId` 追踪变化

##### 1C. Sidebar Tab 数据刷新（5 个文件，约 5 处 setState）

**受影响文件**: `CharacterTab.tsx`、`PlotTab.tsx`、`WorldTab.tsx`、`TimelineTab.tsx`、`OutlineTab.tsx`

**当前模式**:
```tsx
const refresh = useCallback(() => {
  setXxx(store.listXxx(projectId));
}, [store, projectId, ...]);
useEffect(() => { refresh(); }, [refresh]);
```

**修复方案**: 使用 `useMemo` 替代 `useCallback` + `useEffect` + `setState`：
```tsx
const items = useMemo(() => {
  return store.listXxx(projectId);
}, [store, projectId, ...]);
```
这样完全消除了 useEffect 和 setState，直接在渲染阶段派生数据。由于 store 方法都是同步的，这是完全安全的。

对于 `TimelineTab.tsx`，refresh 中还设置了 chapters 和 characters，同样改为 useMemo。

对于 `OutlineTab.tsx`，refresh 被其他事件处理函数调用（如 handleAdd、handleRename、handleDelete 等），需要保留 refresh 函数但改为直接调用 setState 的方式，同时移除 useEffect。改为：使用 `useMemo` 计算初始值 + 在事件处理函数中直接调用 `setChapters(chapterStore.listChapters(projectId))`。

##### 1D. Detail Panel 数据加载（3 个文件，约 5 处 setState）

**受影响文件**: `CharacterDetailPanel.tsx`、`WorldDetailPanel.tsx`、`TimelineDetailPanel.tsx`

**当前模式**:
```tsx
const [data, setData] = useState<T | undefined>();
useEffect(() => {
  setData(store.getData(id));
}, [id, store]);
```

**修复方案**: 使用 `useMemo` 替代：
```tsx
const data = useMemo(() => store.getData(id), [id, store]);
```
由于 store 方法是同步的，这是安全的替换。

对于 `CharacterDetailPanel.tsx`，有多个 setState（character、relationships、timelinePoints），全部改为 useMemo。

#### 类别二：@typescript-eslint/no-unused-vars 修复策略

##### 2A. CharacterDialog.tsx - 解构中的未使用变量

**当前代码**: `const { id: _id, projectId: _pid, ...rest } = initialData;`
**修复**: 虽然已用下划线前缀，但 ESLint 仍报错。改为直接使用 rest 运算符排除：
```tsx
const { id: _id, projectId: _pid, ...rest } = initialData;
```
如果 `_id` 和 `_pid` 仍被报告为未使用，需要在 ESLint 配置中允许下划线前缀变量，或改为：
```tsx
const rest: CharacterFormData = {
  name: initialData.name,
  aliases: [...initialData.aliases],
  appearance: initialData.appearance,
  personality: initialData.personality,
  backstory: initialData.backstory,
  customAttributes: { ...initialData.customAttributes },
};
```
或者更简洁地使用解构 + 忽略注释。实际上最简单的方案是保持解构但确保变量名以 `_` 开头（单下划线），因为 `@typescript-eslint/no-unused-vars` 默认配置通常允许 `_` 前缀。检查当前 ESLint 配置是否有 `argsIgnorePattern` / `varsIgnorePattern`。如果没有，需要在 eslint.config.js 中添加配置，或直接避免声明这些变量。

**最终方案**: 直接使用 rest 运算符排除不需要的属性，不声明中间变量：
```tsx
const { id: _, projectId: __, ...rest } = initialData;
```
或者如果 `_` 也被报告，则改为手动构造 rest 对象。

##### 2B. TimelineDetailPanel.tsx / WorldDetailPanel.tsx - 未使用的 projectId 参数

**当前代码**: 组件 props 中接收 `projectId` 但未在组件内使用
**修复**: 在解构 props 时使用 `_projectId` 或直接从 props 类型中移除（如果接口允许）。由于这是组件的公共接口，保留参数但在解构时忽略：
```tsx
export function TimelineDetailPanel({
  timelinePointId, projectId: _projectId, timelineStore, ...
}: TimelineDetailPanelProps) {
```
或者如果不想改接口，在解构时用 `_` 前缀标记。

##### 2C. ai-assistant-engine.ts - streamError 未使用

**当前代码**: `catch (streamError) { ... }` 中 `streamError` 未被使用
**修复**: 改为 `catch { ... }`（TypeScript 支持省略 catch 参数）或 `catch (_streamError) { ... }`

##### 2D. consistency-engine.test.ts - chars 未使用

**当前代码**: `const chars = [makeCharacter('张三')];` 后调用 `engine.checkChapter('', chars)` — 实际上 `chars` 是被使用的。需要重新检查具体行号。
**修复**: 如果确实未使用，移除该变量声明。

##### 2E. consistency-engine.ts - character 未使用

**当前代码**: 在 `checkChapter` 方法中，`nameMap` 数组存储了 `{ name, character }` 对象，但后续只使用了 `name`，`character` 字段未被使用。
**修复**: 从 nameMap 中移除 `character` 字段，或在解构时忽略。

##### 2F. chapter-store.test.ts - sec1、ch2、vol2、ch1 等未使用

**当前代码**: 在 `listChapters` 测试中创建了多个章节变量但只用了部分
**修复**: 移除未使用的变量赋值，直接调用 `store.createChapter(...)` 不赋值给变量

##### 2G. chapter-store.ts - oldSortOrder 未使用

**当前代码**: `const oldSortOrder = ch.sortOrder;` 在 `reorderChapter` 方法中声明但未使用
**修复**: 移除该变量声明

##### 2H. character-store.test.ts - TimelinePoint 类型导入未使用

**当前代码**: `import type { TimelinePoint } from '../types/timeline';`
**修复**: 移除该导入语句

#### 类别三：其他零散问题修复策略

##### 3A. OutlineTab.tsx:94 - no-unused-expressions

**当前代码**: 可能是 `next.has(id) ? next.delete(id) : next.add(id);` 三元表达式作为语句
**修复**: 改为 if-else 语句：
```tsx
if (next.has(id)) {
  next.delete(id);
} else {
  next.add(id);
}
```

##### 3B. export-engine.test.ts:321 - no-explicit-any

**当前代码**: `format: 'unknown' as any`
**修复**: 定义一个更具体的类型断言，或使用 `// eslint-disable-next-line @typescript-eslint/no-explicit-any` 注释（因为这是测试代码中故意传入无效值的场景）。或者改为：
```tsx
format: 'unknown' as ExportOptions['format']
```
但这会隐藏类型错误。最佳方案是使用类型断言 `as unknown as ExportOptions['format']` 来避免 any。

##### 3C. Toast.tsx:43 - react-refresh/only-export-components

**当前代码**: 文件同时导出 `showToast` 函数和 `ToastContainer` 组件
**修复方案选择**:
1. 添加 `// eslint-disable-next-line react-refresh/only-export-components` 注释
2. 将 `showToast` 移到单独文件

**采用方案**: 添加 eslint-disable 注释，因为 `showToast` 和 `ToastContainer` 紧密耦合（共享模块级状态 `toastListeners`），拆分文件会增加不必要的复杂度。

## Testing Strategy

### Validation Approach

测试策略分两阶段：首先在未修复代码上确认 ESLint 错误存在，然后验证修复后错误消除且不引入回归。

### Exploratory Bug Condition Checking

**Goal**: 在修复前确认所有 32 个 ESLint 错误的存在和位置。

**Test Plan**: 运行 `npx eslint src/` 并记录所有错误输出，确认错误数量和分布与需求文档一致。

**Test Cases**:
1. **ESLint 全量检查**: 运行 `npx eslint src/` 确认报告 32 个错误（将在未修复代码上失败）
2. **set-state-in-effect 验证**: 确认所有 13 个受影响文件中的 useEffect + setState 模式
3. **no-unused-vars 验证**: 确认所有 9 个文件中的未使用变量
4. **其他错误验证**: 确认 OutlineTab、export-engine.test、Toast 中的错误

**Expected Counterexamples**:
- `npx eslint src/` 退出码非零，报告 32 个错误
- 错误分布：约 20 个 set-state-in-effect、约 10 个 no-unused-vars、3 个其他

### Fix Checking

**Goal**: 验证修复后所有 ESLint 错误消除。

**Pseudocode:**
```
FOR ALL file IN src/**/*.{ts,tsx} DO
  result := eslintAnalyze(file)
  ASSERT result.errorCount == 0
  ASSERT result.warningCount == 0
END FOR
```

### Preservation Checking

**Goal**: 验证修复后所有现有功能不受影响。

**Pseudocode:**
```
FOR ALL testSuite IN src/**/*.test.{ts,tsx} DO
  result := vitestRun(testSuite)
  ASSERT result.allPassed == true
END FOR

result := tscBuild()
ASSERT result.errorCount == 0
```

**Testing Approach**: 使用现有测试套件作为回归检测手段，因为：
- 项目已有 287 个测试覆盖核心逻辑
- TypeScript 编译器提供类型安全保障
- 修改仅涉及代码模式重构，不改变逻辑

**Test Plan**: 修复后运行完整测试套件和 TypeScript 编译，确认无回归。

**Test Cases**:
1. **测试套件通过**: 运行 `npx vitest --run` 确认 287 个测试全部通过
2. **TypeScript 编译通过**: 运行 `tsc -b` 确认无编译错误
3. **ESLint 零错误**: 运行 `npx eslint src/` 确认 0 错误 0 警告

### Unit Tests

- 验证 Dialog 组件表单初始化在 open 变化时正确重置
- 验证 Sidebar Tab 组件数据刷新在筛选条件变化时正确更新
- 验证 Detail Panel 组件数据加载在 ID 变化时正确更新

### Property-Based Tests

- 生成随机 open/initialData 组合，验证 Dialog 表单初始化行为一致
- 生成随机 store 数据和筛选条件，验证 Sidebar Tab 列表结果一致
- 生成随机章节结构，验证 reorderChapter 行为不受 oldSortOrder 移除影响

### Integration Tests

- 完整 ESLint 检查流程：修复后运行 `npx eslint src/` 确认零错误
- 完整测试套件：修复后运行 `npx vitest --run` 确认全部通过
- TypeScript 编译：修复后运行 `tsc -b` 确认无错误

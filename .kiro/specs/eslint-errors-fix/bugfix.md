# Bugfix Requirements Document

## Introduction

项目运行 `npx eslint src/` 后报告 32 个 ESLint 错误（0 个警告），导致 CI/CD 流水线中 lint 检查无法通过。这些错误分为三大类：`react-hooks/set-state-in-effect`（约 20 处，在 useEffect 中直接同步调用 setState）、`@typescript-eslint/no-unused-vars`（约 10 处，未使用的变量）、以及其他零散问题（3 处，包括 `no-unused-expressions`、`no-explicit-any`、`react-refresh/only-export-components`）。现有 287 个测试全部通过，TypeScript 编译无错误，因此修复需确保不引入功能回归。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 运行 `npx eslint src/` THEN ESLint 报告 32 个错误，退出码非零

1.2 WHEN ESLint 检查以下组件中的 useEffect 时（`AIConfigDialog.tsx`、`CharacterDialog.tsx`、`ExportDialog.tsx`、`PlotDialog.tsx`、`RelationshipDialog.tsx`、`TimelineDialog.tsx`、`WorldDialog.tsx`、`CharacterDetailPanel.tsx`、`CharacterTab.tsx`、`OutlineTab.tsx`、`PlotTab.tsx`、`TimelineTab.tsx`、`WorldTab.tsx`）THEN 报告 `react-hooks/set-state-in-effect` 错误，因为在 useEffect 回调中直接同步调用了 setState（约 20 处）

1.3 WHEN ESLint 检查以下文件中的变量声明时 THEN 报告 `@typescript-eslint/no-unused-vars` 错误：
- `CharacterDialog.tsx` 中解构出的 `_id`、`_pid` 未被使用
- `TimelineDetailPanel.tsx` 中 `projectId` 参数未被使用
- `WorldDetailPanel.tsx` 中 `projectId` 参数未被使用
- `ai-assistant-engine.ts` 中 `streamError` 变量未被使用
- `consistency-engine.test.ts` 中 `chars` 变量未被使用
- `consistency-engine.ts` 中 `character` 变量未被使用
- `chapter-store.test.ts` 中 `sec1`、`ch2`、`vol2`、`ch1` 等变量未被使用
- `chapter-store.ts` 中 `oldSortOrder` 变量未被使用
- `character-store.test.ts` 中 `TimelinePoint` 类型导入未被使用

1.4 WHEN ESLint 检查 `OutlineTab.tsx:94` THEN 报告 `@typescript-eslint/no-unused-expressions` 错误

1.5 WHEN ESLint 检查 `export-engine.test.ts:321` THEN 报告 `@typescript-eslint/no-explicit-any` 错误

1.6 WHEN ESLint 检查 `Toast.tsx:43` THEN 报告 `react-refresh/only-export-components` 错误（文件同时导出了非组件函数 `showToast` 和组件 `ToastContainer`）

### Expected Behavior (Correct)

2.1 WHEN 运行 `npx eslint src/` THEN ESLint SHALL 报告 0 个错误 0 个警告，退出码为零

2.2 WHEN ESLint 检查上述组件中的 useEffect 时 THEN ESLint SHALL 不报告 `react-hooks/set-state-in-effect` 错误，因为 setState 调用已被重构为符合规则的模式（如使用初始化函数、将状态计算移到 effect 外部、或合并为单次状态更新）

2.3 WHEN ESLint 检查上述文件中的变量声明时 THEN ESLint SHALL 不报告 `@typescript-eslint/no-unused-vars` 错误，因为未使用的变量已被移除或以下划线前缀标记为有意忽略

2.4 WHEN ESLint 检查 `OutlineTab.tsx` THEN ESLint SHALL 不报告 `@typescript-eslint/no-unused-expressions` 错误

2.5 WHEN ESLint 检查 `export-engine.test.ts` THEN ESLint SHALL 不报告 `@typescript-eslint/no-explicit-any` 错误

2.6 WHEN ESLint 检查 `Toast.tsx` THEN ESLint SHALL 不报告 `react-refresh/only-export-components` 错误

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 运行 `npx vitest --run` THEN 现有 287 个测试 SHALL CONTINUE TO 全部通过

3.2 WHEN 运行 `tsc -b` THEN TypeScript 编译 SHALL CONTINUE TO 无错误完成

3.3 WHEN 用户在各 Dialog 组件中打开对话框并编辑表单 THEN 表单状态初始化和重置行为 SHALL CONTINUE TO 与修复前一致（对话框打开时正确加载 initialData 或重置为空表单）

3.4 WHEN 用户在各 Sidebar Tab 组件中切换筛选条件或搜索 THEN 列表数据刷新行为 SHALL CONTINUE TO 与修复前一致

3.5 WHEN 用户在 Detail Panel 组件中查看详情 THEN 数据加载和展示行为 SHALL CONTINUE TO 与修复前一致

3.6 WHEN AI 辅助引擎处理流式响应中断时 THEN 错误处理逻辑 SHALL CONTINUE TO 正确返回已接收内容或错误信息

3.7 WHEN 一致性引擎检查章节内容时 THEN 角色名称匹配和建议逻辑 SHALL CONTINUE TO 正确工作

3.8 WHEN 章节 store 执行 reorderChapter 操作时 THEN 排序逻辑 SHALL CONTINUE TO 正确重排序

3.9 WHEN Toast 组件显示通知消息时 THEN showToast 函数和 ToastContainer 组件 SHALL CONTINUE TO 正常工作

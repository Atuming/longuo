# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - ESLint 报告 32 个错误
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: 运行 `npx eslint src/ --format json` 并断言退出码为零且 errorCount 为 0
  - 编写一个测试脚本或 vitest 测试，执行 ESLint 检查并断言 0 错误 0 警告
  - 在未修复代码上运行，预期 FAIL（报告 32 个错误，退出码非零）
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - 记录 counterexample：ESLint 报告 32 个错误，分布在 react-hooks/set-state-in-effect (~20)、no-unused-vars (~10)、其他 (3)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - 测试套件与 TypeScript 编译不回归
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: 运行 `npx vitest --run` 确认现有 287 个测试全部通过
  - Observe: 运行 `tsc -b` 确认 TypeScript 编译无错误
  - 编写验证脚本确认现有测试套件通过且 TypeScript 编译成功
  - Verify test passes on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2_

- [x] 3. Fix react-hooks/set-state-in-effect errors - Dialog components

  - [x] 3.1 Fix PlotDialog.tsx - useEffect 中 setForm 改为渲染阶段 props 比较模式
    - 将 `useEffect([open, initialData, projectId])` 中的 `setForm(...)` 替换为 `prevOpen` 状态追踪 + 渲染阶段 setState
    - 移除不再需要的 useEffect 导入（如适用）
    - _Bug_Condition: useEffect 中直接同步调用 setForm_
    - _Expected_Behavior: 无 set-state-in-effect 错误_
    - _Preservation: 对话框打开时正确初始化表单，关闭后正确重置_
    - _Requirements: 1.2, 2.2, 3.3_

  - [x] 3.2 Fix WorldDialog.tsx - useEffect 中 setForm 改为渲染阶段 props 比较模式
    - 同 3.1 模式，将 `useEffect([open, initialData, projectId])` 重构
    - _Bug_Condition: useEffect 中直接同步调用 setForm_
    - _Expected_Behavior: 无 set-state-in-effect 错误_
    - _Preservation: 对话框打开时正确初始化表单_
    - _Requirements: 1.2, 2.2, 3.3_

  - [x] 3.3 Fix TimelineDialog.tsx - useEffect 中 setForm 改为渲染阶段 props 比较模式
    - 同 3.1 模式，将 `useEffect([open, initialData, projectId])` 重构
    - _Bug_Condition: useEffect 中直接同步调用 setForm_
    - _Expected_Behavior: 无 set-state-in-effect 错误_
    - _Preservation: 对话框打开时正确初始化表单_
    - _Requirements: 1.2, 2.2, 3.3_

  - [x] 3.4 Fix RelationshipDialog.tsx - useEffect 中 setForm 改为渲染阶段 props 比较模式
    - 同 3.1 模式，将 `useEffect([open, initialData, projectId, sourceCharacterId, timelinePoints])` 重构
    - _Bug_Condition: useEffect 中直接同步调用 setForm_
    - _Expected_Behavior: 无 set-state-in-effect 错误_
    - _Preservation: 对话框打开时正确初始化表单_
    - _Requirements: 1.2, 2.2, 3.3_

  - [x] 3.5 Fix CharacterDialog.tsx - useEffect 中 setForm/setAliasInput/setKvKey/setKvValue 改为渲染阶段 props 比较模式
    - 将 `useEffect([open, initialData])` 中的多个 setState 替换为 prevOpen 追踪模式
    - _Bug_Condition: useEffect 中直接同步调用 setForm、setAliasInput、setKvKey、setKvValue_
    - _Expected_Behavior: 无 set-state-in-effect 错误_
    - _Preservation: 对话框打开时正确初始化表单和辅助输入状态_
    - _Requirements: 1.2, 2.2, 3.3_

  - [x] 3.6 Fix ExportDialog.tsx - useEffect 中 setFormat/setAuthor 改为渲染阶段 props 比较模式
    - 将 `useEffect([open])` 中的 setState 替换为 prevOpen 追踪模式
    - _Bug_Condition: useEffect 中直接同步调用 setFormat、setAuthor_
    - _Expected_Behavior: 无 set-state-in-effect 错误_
    - _Preservation: 对话框打开时正确重置导出选项_
    - _Requirements: 1.2, 2.2, 3.3_

- [x] 4. Fix react-hooks/set-state-in-effect errors - AIConfigDialog

  - [x] 4.1 Fix AIConfigDialog.tsx - 三个 useEffect 全部改为渲染阶段 props 比较模式
    - useEffect([open, aiStore]) → prevOpen 追踪，渲染阶段同步 providers/templates/active/selected 状态
    - useEffect([selectedProviderId, providers]) → prevSelectedProviderId 追踪，渲染阶段同步 pName/pApiKey/pModel/pEndpoint/pTimeout
    - useEffect([selectedTemplateId, templates]) → prevSelectedTemplateId 追踪，渲染阶段同步 tName/tSystem/tUser
    - _Bug_Condition: 三个 useEffect 中共约 14 处 setState 调用_
    - _Expected_Behavior: 无 set-state-in-effect 错误_
    - _Preservation: AI 配置对话框打开时正确加载配置，切换选项时正确同步表单_
    - _Requirements: 1.2, 2.2, 3.3_

- [x] 5. Fix react-hooks/set-state-in-effect errors - Sidebar Tabs

  - [x] 5.1 Fix CharacterTab.tsx - useCallback+useEffect+setState 改为 useMemo
    - 将 `refresh` 回调 + `useEffect([refresh])` 替换为 `useMemo` 直接派生 characters 列表
    - 移除不再需要的 useCallback、useEffect 导入
    - _Bug_Condition: useEffect 中通过 refresh() 间接调用 setCharacters_
    - _Expected_Behavior: 无 set-state-in-effect 错误_
    - _Preservation: 搜索和列表刷新行为不变_
    - _Requirements: 1.2, 2.2, 3.4_

  - [x] 5.2 Fix PlotTab.tsx - useCallback+useEffect+setState 改为 useMemo
    - 同 5.1 模式，将 threads 列表改为 useMemo 派生
    - _Bug_Condition: useEffect 中通过 refresh() 间接调用 setThreads_
    - _Expected_Behavior: 无 set-state-in-effect 错误_
    - _Preservation: 筛选和列表刷新行为不变_
    - _Requirements: 1.2, 2.2, 3.4_

  - [x] 5.3 Fix WorldTab.tsx - useCallback+useEffect+setState 改为 useMemo
    - 同 5.1 模式，将 entries 列表改为 useMemo 派生
    - _Bug_Condition: useEffect 中通过 refresh() 间接调用 setEntries_
    - _Expected_Behavior: 无 set-state-in-effect 错误_
    - _Preservation: 搜索、筛选和列表刷新行为不变_
    - _Requirements: 1.2, 2.2, 3.4_

  - [x] 5.4 Fix TimelineTab.tsx - useCallback+useEffect+setState 改为 useMemo
    - 将 chapters、characters、points 三个状态全部改为 useMemo 派生
    - _Bug_Condition: useEffect 中通过 refresh() 间接调用 setChapters、setCharacters、setPoints_
    - _Expected_Behavior: 无 set-state-in-effect 错误_
    - _Preservation: 筛选和列表刷新行为不变_
    - _Requirements: 1.2, 2.2, 3.4_

  - [x] 5.5 Fix OutlineTab.tsx - useCallback+useEffect+setState 改为 useMemo + 事件处理函数直接 setState
    - 将初始数据加载改为 useMemo，保留 refresh 函数供事件处理函数（handleAdd、handleRename、handleDelete、handleAddChild、handleDrop）调用
    - 移除 `useEffect([refresh])` 中的数据加载逻辑
    - 注意：保留关闭 contextMenu 的 useEffect（该 useEffect 不涉及 setState 问题）
    - _Bug_Condition: useEffect 中通过 refresh() 间接调用 setChapters_
    - _Expected_Behavior: 无 set-state-in-effect 错误_
    - _Preservation: 大纲树形结构、拖拽排序、右键菜单行为不变_
    - _Requirements: 1.2, 2.2, 3.4_

- [x] 6. Fix react-hooks/set-state-in-effect errors - Detail Panels

  - [x] 6.1 Fix CharacterDetailPanel.tsx - useEffect+setState 改为 useMemo
    - 将 character、relationships、timelinePoints 三个状态改为 useMemo 派生
    - _Bug_Condition: useEffect 中调用 setCharacter、setRelationships、setTimelinePoints_
    - _Expected_Behavior: 无 set-state-in-effect 错误_
    - _Preservation: 角色详情数据加载和展示行为不变_
    - _Requirements: 1.2, 2.2, 3.5_

  - [x] 6.2 Fix WorldDetailPanel.tsx - useEffect+setState 改为 useMemo
    - 将 entry 状态改为 useMemo 派生
    - _Bug_Condition: useEffect 中调用 setEntry_
    - _Expected_Behavior: 无 set-state-in-effect 错误_
    - _Preservation: 世界观详情数据加载和展示行为不变_
    - _Requirements: 1.2, 2.2, 3.5_

  - [x] 6.3 Fix TimelineDetailPanel.tsx - useEffect+setState 改为 useMemo
    - 将 point 状态改为 useMemo 派生
    - _Bug_Condition: useEffect 中调用 setPoint_
    - _Expected_Behavior: 无 set-state-in-effect 错误_
    - _Preservation: 时间节点详情数据加载和展示行为不变_
    - _Requirements: 1.2, 2.2, 3.5_

- [x] 7. Fix @typescript-eslint/no-unused-vars errors

  - [x] 7.1 Fix CharacterDialog.tsx - 移除解构中未使用的 _id、_pid
    - 将 `const { id: _id, projectId: _pid, ...rest } = initialData` 改为不声明中间变量的方式
    - 可选方案：手动构造 rest 对象，或使用 `const { id: _, projectId: __, ...rest } = initialData` 并确保 ESLint 配置允许
    - _Requirements: 1.3, 2.3_

  - [x] 7.2 Fix TimelineDetailPanel.tsx - 标记未使用的 projectId 参数
    - 在 props 解构中将 `projectId` 改为 `projectId: _projectId` 或从接口中移除
    - _Requirements: 1.3, 2.3_

  - [x] 7.3 Fix WorldDetailPanel.tsx - 标记未使用的 projectId 参数
    - 同 7.2 模式
    - _Requirements: 1.3, 2.3_

  - [x] 7.4 Fix ai-assistant-engine.ts - 移除未使用的 streamError 变量
    - 将 `catch (streamError)` 改为 `catch` 或 `catch (_streamError)`
    - _Preservation: 流式响应中断时的错误处理逻辑不变_
    - _Requirements: 1.3, 2.3, 3.6_

  - [x] 7.5 Fix consistency-engine.ts - 移除 nameMap 中未使用的 character 字段
    - 从 `nameMap: { name: string; character: Character }[]` 中移除 `character` 字段，改为 `nameMap: { name: string }[]` 或直接使用 `string[]`
    - _Preservation: 角色名称匹配逻辑不变_
    - _Requirements: 1.3, 2.3, 3.7_

  - [x] 7.6 Fix chapter-store.ts - 移除未使用的 oldSortOrder 变量
    - 删除 `const oldSortOrder = ch.sortOrder;` 行
    - _Preservation: reorderChapter 排序逻辑不变_
    - _Requirements: 1.3, 2.3, 3.8_

  - [x] 7.7 Fix chapter-store.test.ts - 移除未使用的变量赋值
    - 将 `const sec1 = store.createChapter(...)` 等未使用的赋值改为直接调用 `store.createChapter(...)`
    - _Requirements: 1.3, 2.3_

  - [x] 7.8 Fix character-store.test.ts - 移除未使用的 TimelinePoint 类型导入
    - 删除 `import type { TimelinePoint } from '../types/timeline';`
    - _Requirements: 1.3, 2.3_

  - [x] 7.9 Fix consistency-engine.test.ts - 移除未使用的 chars 变量（如适用）
    - 检查具体报错行号，移除或使用该变量
    - _Requirements: 1.3, 2.3_

- [x] 8. Fix other miscellaneous ESLint errors

  - [x] 8.1 Fix OutlineTab.tsx - no-unused-expressions 错误
    - 将三元表达式语句 `next.has(id) ? next.delete(id) : next.add(id)` 改为 if-else 语句
    - _Requirements: 1.4, 2.4_

  - [x] 8.2 Fix export-engine.test.ts - no-explicit-any 错误
    - 将 `format: 'unknown' as any` 改为 `format: 'unknown' as unknown as ExportOptions['format']` 或添加 eslint-disable 注释
    - _Requirements: 1.5, 2.5_

  - [x] 8.3 Fix Toast.tsx - react-refresh/only-export-components 错误
    - 在 `showToast` 函数导出前添加 `// eslint-disable-next-line react-refresh/only-export-components` 注释
    - 不拆分文件，因为 showToast 和 ToastContainer 共享模块级状态
    - _Preservation: Toast 通知功能不变_
    - _Requirements: 1.6, 2.6, 3.9_

- [x] 9. Verify fixes

  - [x] 9.1 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - ESLint 零错误
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 9.2 Verify preservation tests still pass
    - **Property 2: Preservation** - 测试套件与 TypeScript 编译不回归
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 10. Checkpoint - Ensure all tests pass
  - 运行 `npx eslint src/` 确认 0 错误 0 警告
  - 运行 `npx vitest --run` 确认 287 个测试全部通过
  - 运行 `tsc -b` 确认 TypeScript 编译无错误
  - Ensure all tests pass, ask the user if questions arise.

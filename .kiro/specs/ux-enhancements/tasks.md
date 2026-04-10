# 实施计划：火龙果编辑器体验优化

## 概述

基于需求文档和设计文档，将 8 项 UX 优化功能拆分为增量式编码任务。每个任务构建在前一个任务之上，最终将所有功能集成到编辑器中。使用 TypeScript + React 技术栈，测试使用 Vitest + fast-check。

## 任务

- [x] 1. AI 生成内容插入到光标位置
  - [x] 1.1 修改 `WritingEditorHandle` 接口，新增 `insertAtCursor` 和 `getCursorPosition` 方法
    - 在 `src/components/editor/WritingEditor.tsx` 中扩展 `WritingEditorHandle` 接口
    - `insertAtCursor` 实现：获取 `state.selection.main`，有选区时替换选区，无选区时在光标位置插入，无光标时回退到 `appendContent`
    - 插入后将光标移动到插入内容末尾
    - _需求: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.2 修改 `EditorPage.handleAIAccept` 使用 `insertAtCursor`
    - 在 `src/pages/EditorPage.tsx` 中将 `appendContent` 调用改为 `insertAtCursor`
    - 保留 toast 提示"AI 生成内容已插入"
    - _需求: 1.1, 1.5_

  - [ ]* 1.3 编写光标插入属性测试
    - **Property 1: 光标插入保持周围文本不变**
    - **Property 2: 选区替换保持周围文本不变**
    - 在 `src/lib/cursor-insertion.test.ts` 中使用 fast-check 测试纯文本操作逻辑
    - **验证: 需求 1.1, 1.2, 1.3**

- [x] 2. 字数统计日更目标
  - [x] 2.1 新增 `DailyGoalConfig` 类型和 `DailyGoalStore`
    - 创建 `src/types/daily-goal.ts` 定义 `DailyGoalConfig` 接口
    - 创建 `src/stores/daily-goal-store.ts` 实现 `getConfig`、`setGoal`、`getTodayWritten`、`updateBaseline` 方法
    - 使用 localStorage key `novel-daily-goal-{projectId}` 持久化
    - 以自然日（YYYY-MM-DD）为单位统计，日期变更时重置基准
    - _需求: 2.3, 2.5, 2.6_

  - [x] 2.2 新增 `DailyGoalProgress` 组件并集成到 WritingEditor 状态栏
    - 创建 `src/components/editor/DailyGoalProgress.tsx`
    - 显示进度条、当日已写字数和目标字数
    - 点击弹出目标设置 popover，允许输入目标值
    - 目标为 0 时隐藏进度条
    - 达到目标时显示完成状态和祝贺提示
    - 在 `WritingEditor` 状态栏区域嵌入该组件
    - _需求: 2.1, 2.2, 2.4, 2.6_

  - [ ]* 2.3 编写日更目标属性测试
    - **Property 3: 日更字数差值计算与日期边界**
    - 在 `src/stores/daily-goal-store.test.ts` 中使用 fast-check 测试
    - **验证: 需求 2.3, 2.5**

- [x] 3. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 4. 大纲拖拽排序优化
  - [x] 4.1 重构 `OutlineTab` 拖拽逻辑，实现精确放置指示器
    - 修改 `src/components/sidebar/OutlineTab.tsx`
    - 新增 `DropPosition` 类型（'before' | 'inside' | 'after'）和 `dropInfo` 状态
    - 拖拽开始时设置半透明 `dragImage`
    - 拖拽经过时根据鼠标 Y 偏移计算放置位置（上 1/4 = before，中间 1/2 = inside，下 1/4 = after）
    - 显示水平线指示器（before/after）或高亮背景（inside）
    - 添加层级验证：卷不能拖入章内，章不能拖入节内
    - 释放后使用 CSS transition 实现平滑动画
    - 更新 `sortOrder` 和 `parentId`
    - _需求: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 4.2 编写拖拽位置计算和层级验证属性测试
    - **Property 4: 拖拽放置位置计算与层级验证**
    - **Property 5: 重排序正确更新 sortOrder 和 parentId**
    - 在 `src/components/sidebar/OutlineTab.test.ts` 中使用 fast-check 测试纯函数逻辑
    - **验证: 需求 3.3, 3.5, 3.6**

- [x] 5. 暗色模式
  - [x] 5.1 新增 `ThemeStore` 和暗色 CSS 变量
    - 创建 `src/types/theme.ts` 定义 `ThemeMode` 类型
    - 创建 `src/stores/theme-store.ts` 实现 `getTheme`、`setTheme`、`getEffectiveTheme` 方法
    - 使用 localStorage key `novel-theme-preference` 持久化
    - 支持 `matchMedia('(prefers-color-scheme: dark)')` 检测系统偏好
    - _需求: 4.5, 4.6, 4.7_

  - [x] 5.2 添加暗色模式 CSS 变量和 CodeMirror 暗色主题
    - 在 `src/styles/globals.css` 中添加 `[data-theme="dark"]` CSS 变量覆盖
    - 在 `WritingEditor` 中创建 `darkEditorTheme` 覆盖 CodeMirror 编辑区域颜色
    - 根据当前主题动态切换 CodeMirror 主题
    - _需求: 4.2, 4.3, 4.4_

  - [x] 5.3 在 EditorPage 工具栏添加主题切换按钮
    - 在 `src/pages/EditorPage.tsx` 工具栏添加 🌙/☀️ 切换按钮
    - 初始化时读取 ThemeStore 并设置 `document.documentElement.dataset.theme`
    - _需求: 4.1_

  - [ ]* 5.4 编写主题偏好持久化属性测试
    - **Property 6: 主题偏好持久化往返**
    - 在 `src/stores/theme-store.test.ts` 中使用 fast-check 测试
    - **验证: 需求 4.5, 4.6**

- [x] 6. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 7. 导出自定义排版选项
  - [x] 7.1 扩展 `ExportOptions` 类型，添加 `TypographyOptions`
    - 修改 `src/types/export.ts`，新增 `TypographyOptions` 接口和 `ExportOptions.typography` 可选字段
    - 默认值：字体 "宋体"、字号 12pt、行距 1.5、页边距 20mm
    - _需求: 5.2_

  - [x] 7.2 修改 `ExportDialog` 添加排版参数输入
    - 修改 `src/components/dialogs/ExportDialog.tsx`
    - 添加字体名称、字号、行距、页边距输入字段
    - 从 localStorage key `novel-export-typography` 读取上次使用的参数自动填充
    - 导出时保存当前排版参数到 localStorage
    - _需求: 5.1, 5.6_

  - [x] 7.3 修改 `ExportEngine` 应用排版参数到 PDF 和 EPUB
    - 修改 `src/lib/export-engine.ts`
    - PDF：将 `jsPDF` 的 `setFontSize`、margin、lineHeight 参数化
    - EPUB：在生成的 XHTML 中注入 `<style>` 标签应用排版参数
    - 未提供排版参数时使用默认值
    - _需求: 5.3, 5.4, 5.5_

  - [ ]* 7.4 编写导出排版属性测试
    - **Property 7: EPUB 排版 CSS 生成**
    - **Property 8: 排版参数持久化往返**
    - 在 `src/lib/export-engine.test.ts` 中扩展现有测试
    - **验证: 需求 5.4, 5.6**

- [x] 8. 角色/世界观交叉引用
  - [x] 8.1 实现 CodeMirror 角色名高亮和自动补全扩展
    - 创建 `src/lib/cross-reference.ts`
    - 使用 `ViewPlugin` + `Decoration.mark` 扫描文档匹配角色名和别名，添加高亮样式
    - 使用 `@codemirror/autocomplete` 监听 `@` 字符触发角色名补全
    - 实现过滤函数，根据用户输入实时过滤候选列表
    - 角色名包含正则特殊字符时进行转义
    - _需求: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 8.2 实现角色名悬停 Tooltip 和集成到 WritingEditor
    - 使用 `@codemirror/view` 的 `hoverTooltip` 扩展
    - 悬停显示角色简要信息（名称、外貌、性格）
    - 在 `WritingEditor` 中集成 `createCrossReferenceExtension`，传入 `characterStore.listCharacters`
    - _需求: 6.6_

  - [ ]* 8.3 编写交叉引用属性测试
    - **Property 9: 角色名匹配**
    - **Property 10: 自动补全过滤**
    - 在 `src/lib/cross-reference.test.ts` 中使用 fast-check 测试纯函数逻辑
    - **验证: 需求 6.1, 6.3**

- [x] 9. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 10. 版本历史/快照功能
  - [x] 10.1 新增 `Snapshot` 类型和 `SnapshotStore`
    - 创建 `src/types/snapshot.ts` 定义 `Snapshot` 接口
    - 创建 `src/stores/snapshot-store.ts` 实现 `createSnapshot`、`listSnapshots`、`getSnapshot`、`deleteSnapshot`、`restoreSnapshot` 方法
    - 使用 localStorage key `novel-snapshots-{projectId}` 持久化
    - `restoreSnapshot` 先自动创建当前状态快照（备注"恢复前自动备份"），再返回目标快照数据
    - 处理 `QuotaExceededError` 和数据反序列化失败
    - _需求: 7.1, 7.2, 7.4, 7.5, 7.6_

  - [x] 10.2 新增 `VersionHistoryPanel` 组件并集成到 EditorPage
    - 创建 `src/components/panels/VersionHistoryPanel.tsx`
    - 按时间倒序显示快照列表，包含时间戳、备注和字数统计
    - 支持查看详情和恢复操作
    - 在 `EditorPage` 工具栏添加"保存快照"按钮，弹出备注输入
    - 添加版本历史面板入口
    - _需求: 7.1, 7.3, 7.4_

  - [ ]* 10.3 编写快照属性测试
    - **Property 11: 快照数据往返**
    - **Property 12: 快照列表按项目隔离且按时间倒序**
    - **Property 13: 快照恢复自动备份**
    - 在 `src/stores/snapshot-store.test.ts` 中使用 fast-check 测试
    - **验证: 需求 7.1, 7.2, 7.3, 7.4, 7.6**

- [x] 11. AI 面板历史记录
  - [x] 11.1 扩展 `AIAssistantStore` 接口，添加历史记录方法
    - 修改 `src/types/ai.ts`，新增 `AIHistoryRecord` 接口
    - 修改 `src/types/stores.ts`，扩展 `AIAssistantStore` 接口添加 `addHistoryRecord`、`listHistory`、`getHistoryRecord`、`clearHistory` 方法
    - 修改 `src/stores/ai-assistant-store.ts` 实现历史记录功能
    - 使用 localStorage key `novel-ai-history-{projectId}` 持久化
    - 超过 50 条时自动删除最早的记录
    - _需求: 8.1, 8.5, 8.6_

  - [x] 11.2 修改 `AIAssistantPanel` 集成历史记录 UI
    - 修改 `src/components/ai/AIAssistantPanel.tsx`
    - 生成完成后调用 `addHistoryRecord` 保存记录
    - 面板底部添加"历史记录"折叠区域，按时间倒序显示
    - 每条记录显示技能类型、生成时间和内容摘要（前 50 字符）
    - 点击记录显示完整内容，提供"插入到编辑器"和"重新生成"按钮
    - _需求: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 11.3 编写 AI 历史记录属性测试
    - **Property 14: AI 历史记录往返**
    - **Property 15: AI 历史列表按项目隔离、时间倒序且上限 50 条**
    - 在 `src/stores/ai-assistant-store.test.ts` 中扩展现有测试
    - **验证: 需求 8.1, 8.2, 8.5, 8.6**

- [x] 12. 最终检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加快 MVP 进度
- 每个任务引用了具体的需求编号以确保可追溯性
- 检查点任务确保增量验证
- 属性测试验证设计文档中定义的正确性属性
- 单元测试验证具体示例和边界情况

# 实施计划：项目优化（project-optimization）

## 概述

按照设计文档，分六个阶段实施火龙果编辑器的前端优化：ErrorBoundary 组件 → 构建分包 → 路由懒加载 → EditorPage 组件拆分（Context + 子组件） → 对话框懒加载 → 内联样式优化。先建基础设施（ErrorBoundary、分包），再做路由懒加载，然后拆分组件并接入懒加载，最后优化样式。

## Tasks

- [x] 1. 创建通用 ErrorBoundary 组件
  - [x] 1.1 实现 ErrorBoundary 类组件
    - 新建 `src/components/ui/ErrorBoundary.tsx`
    - 实现 `getDerivedStateFromError` 设置 `hasError = true`
    - 实现 `componentDidCatch` 调用 `console.error(error, errorInfo)` 并触发可选的 `onError` 回调
    - 实现降级 UI：显示 `fallbackTitle`（默认"出错了"）、`error.message` 摘要、"重试"按钮
    - 重试按钮点击时重置 `hasError = false, error = null`，重新渲染子组件树
    - 导出 `ErrorBoundary` 组件，并在 `src/components/ui/index.ts` 中添加导出
    - _需求: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  - [ ]* 1.2 编写 ErrorBoundary 单元测试
    - 新建 `src/components/ui/ErrorBoundary.test.tsx`
    - 测试正常渲染：子组件无错误时正常展示
    - 测试错误捕获：子组件抛出错误时展示降级 UI（含错误摘要和重试按钮）
    - 测试重试功能：点击重试按钮后重新渲染子组件
    - 测试控制台输出：捕获错误时调用 `console.error`
    - 测试自定义标题：`fallbackTitle` prop 正确展示
    - _需求: 6.4, 6.5, 6.6_

- [x] 2. 配置 Vite 构建产物分包
  - [x] 2.1 修改 vite.config.ts 添加 manualChunks 配置
    - 在 `build.rollupOptions.output.manualChunks` 中配置四个分包：
      - `vendor-react`: `['react', 'react-dom']`
      - `vendor-router`: `['react-router-dom']`
      - `vendor-codemirror`: `['@codemirror/autocomplete', '@codemirror/commands', '@codemirror/lang-markdown', '@codemirror/language-data', '@codemirror/search', '@codemirror/state', '@codemirror/view']`
      - `vendor-export`: `['jspdf', 'jszip']`
    - _需求: 3.1, 3.2, 3.3, 3.4, 3.6_

- [x] 3. 实现路由懒加载
  - [x] 3.1 改造 App.tsx 使用 React.lazy 加载 EditorPage
    - 将 `import { EditorPage }` 替换为 `const LazyEditorPage = React.lazy(() => import('./pages/EditorPage'))`
    - 确保 `src/pages/EditorPage.tsx` 使用 `export default` 导出（或调整 lazy import 语法）
    - 用 `<Suspense fallback={<加载指示器 />}>` 包裹 EditorPage 路由
    - 在路由层级包裹顶层 `<ErrorBoundary>` 捕获页面级错误和懒加载失败
    - _需求: 1.1, 1.2, 1.3, 1.4, 1.5, 6.1_

- [x] 4. 检查点 - 验证基础设施
  - 运行 `npm run build` 验证构建成功且分包正确
  - 运行 `npm test` 确保所有现有测试通过

- [x] 5. 创建 EditorStoreContext 和 Provider
  - [x] 5.1 实现 EditorStoreContext
    - 新建 `src/pages/editor/EditorStoreContext.tsx`
    - 定义 `EditorStoreContextValue` 接口，包含所有 Store/Engine 实例和 projectId、projectName
    - 创建 `EditorStoreContext = React.createContext<EditorStoreContextValue | null>(null)`
    - 实现 `EditorStoreProvider` 组件
    - 实现 `useEditorStores()` 自定义 hook，内部 `useContext` + null 检查（Provider 外使用时抛出错误）
    - _需求: 4.1, 4.6_
  - [ ]* 5.2 编写 EditorStoreContext 单元测试
    - 新建 `src/pages/editor/EditorStoreContext.test.tsx`
    - 测试 `useEditorStores` 在 Provider 内正确返回所有 Store
    - 测试 `useEditorStores` 在 Provider 外抛出错误
    - _需求: 4.1_

- [x] 6. 拆分 EditorPage 子组件
  - [x] 6.1 创建 EditorToolbar 组件
    - 新建 `src/pages/editor/EditorToolbar.tsx`
    - 从 EditorPage 中提取工具栏渲染逻辑（返回、项目名、保存、视图切换、一致性检查、快照、导出、AI、专注模式、主题切换等按钮）
    - 通过 `useEditorStores()` 获取所需 Store，其余状态/回调通过 props 传入
    - 将工具栏相关的样式对象（`s.focusToolbar`, `s.projectName`, `s.toolBtn` 等）移入该文件模块顶层
    - _需求: 4.2, 4.7, 5.1_
  - [x] 6.2 创建 EditorContent 组件
    - 新建 `src/pages/editor/EditorContent.tsx`
    - 从 EditorPage 中提取 `renderCenter` 逻辑（WritingEditor、RelationshipGraphPage、AIAssistantPanel 等）
    - 通过 `useEditorStores()` 获取所需 Store
    - 用 `<ErrorBoundary fallbackTitle="编辑器区域出错了">` 包裹 WritingEditor 区域
    - 样式对象定义在模块顶层
    - _需求: 4.4, 4.7, 5.1, 6.2_
  - [x] 6.3 创建 EditorRightPanel 组件
    - 新建 `src/pages/editor/EditorRightPanel.tsx`
    - 从 EditorPage 中提取 `renderPanel` 逻辑（CharacterDetailPanel、WorldDetailPanel、TimelineDetailPanel、ConsistencyPanel、VersionHistoryPanel）
    - 通过 `useEditorStores()` 获取所需 Store
    - 样式对象定义在模块顶层
    - _需求: 4.3, 4.7, 5.1_
  - [x] 6.4 创建 DialogManager 组件（含对话框懒加载）
    - 新建 `src/pages/editor/DialogManager.tsx`
    - 使用 `React.lazy` 按需加载 6 个 Dialog 组件：CharacterDialog、WorldDialog、TimelineDialog、PlotDialog、ExportDialog、AIConfigDialog
    - 每个懒加载 Dialog 用 `<Suspense>` 包裹，提供加载指示器
    - 用 `<ErrorBoundary>` 包裹对话框区域，懒加载失败时展示错误提示而非页面崩溃
    - 通过 `useEditorStores()` 获取所需 Store，对话框状态/回调通过 props 传入
    - _需求: 2.1, 2.2, 2.3, 2.4, 4.5, 4.7_
  - [x] 6.5 重构 EditorPage 为组合层
    - 修改 `src/pages/EditorPage.tsx`，移除已提取到子组件的渲染逻辑
    - 用 `<EditorStoreProvider>` 包裹所有子组件，提供 Store/Engine 实例
    - EditorPage 仅负责：初始化 Store/Engine、管理 UI 状态、提供 Context、组合 EditorToolbar + EditorContent + EditorRightPanel + DialogManager
    - 在 EditorContent 外层包裹 `<ErrorBoundary fallbackTitle="编辑器区域出错了">`
    - 在 EditorRightPanel 外层包裹 `<ErrorBoundary fallbackTitle="面板区域出错了">`
    - 确保添加 `export default` 导出以支持 React.lazy
    - _需求: 4.1, 4.6, 4.7, 6.2, 6.3_

- [x] 7. 检查点 - 验证组件拆分
  - 运行 `npm test` 确保所有现有测试通过
  - 运行 `npm run build` 验证构建成功

- [x] 8. 内联样式优化
  - [x] 8.1 优化所有拆分后子组件的内联样式
    - 检查 EditorToolbar、EditorContent、EditorRightPanel、DialogManager 中的样式对象
    - 确保所有静态 `CSSProperties` 对象定义在组件函数外部（模块顶层），遵循 EditorLayout 中的 `const styles: Record<string, CSSProperties>` 模式
    - 对于依赖动态值（props/state）的样式对象，使用 `useMemo` 缓存
    - 检查 EditorPage 组合层中是否仍有内联样式对象，移至模块顶层
    - _需求: 5.1, 5.2, 5.3_

- [x] 9. 最终检查点 - 全面验证
  - 运行 `npm test` 确保所有测试通过
  - 运行 `npm run build` 验证构建成功且分包正确
  - 运行 `npm run lint` 确保无 lint 错误

## 备注

- 标记 `*` 的子任务为可选，可跳过以加速 MVP
- 每个任务引用了具体的需求编号以确保可追溯性
- 检查点确保增量验证，避免问题累积
- 本特性不包含属性基测试，测试策略基于单元测试和冒烟测试

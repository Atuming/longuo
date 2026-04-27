# 需求文档

## 简介

本文档定义火龙果编辑器（Pitaya Editor）的前端性能优化与架构改进需求。项目基于 React 19 + TypeScript 6 + Vite 8 技术栈，当前存在首屏加载过重、构建产物体积过大、EditorPage 组件臃肿、缺乏错误边界等问题。本优化计划涵盖路由懒加载、对话框懒加载、构建分包、组件拆分、内联样式优化和 Error Boundary 六个方面，不包含移动端响应式适配。

## 术语表

- **应用（App）**: 火龙果编辑器的顶层 React 应用组件，包含路由配置
- **路由器（Router）**: 基于 react-router-dom 的 HashRouter，管理 `/` 和 `/editor` 两条路由
- **编辑器页面（EditorPage）**: `/editor` 路由对应的页面组件，包含写作编辑器、侧边栏、工具栏、面板和对话框
- **首页（ProjectListPage）**: `/` 路由对应的项目列表页面
- **对话框组件（Dialog）**: 模态弹窗组件，包括 CharacterDialog、WorldDialog、TimelineDialog、PlotDialog、ExportDialog、AIConfigDialog
- **构建产物（Bundle）**: Vite 构建输出的 JavaScript 文件
- **主包（Main_Bundle）**: 构建产物中包含所有同步导入代码的主 JS 文件
- **分包（Chunk）**: 通过代码分割从主包中拆分出的独立 JS 文件
- **懒加载（Lazy_Loading）**: 使用 React.lazy + Suspense 实现的按需加载机制
- **Error_Boundary**: React 错误边界组件，用于捕获子组件树中的 JavaScript 错误并展示降级 UI
- **Store**: 项目中的自定义状态管理工厂函数（如 createChapterStore、createCharacterStore 等）
- **内联样式（Inline_Style）**: 通过 JSX style 属性传入的 CSSProperties 对象
- **CSS_Modules**: Vite 原生支持的 CSS 模块化方案，文件以 `.module.css` 命名
- **CodeMirror**: 项目使用的代码/文本编辑器库（@codemirror/* 系列包）
- **manualChunks**: Vite/Rollup 构建配置项，用于手动指定第三方库的分包策略

## 需求

### 需求 1：路由懒加载

**用户故事：** 作为用户，我希望打开首页时不加载编辑器页面的代码，以便首页能更快地呈现。

#### 验收标准

1. WHEN 用户访问首页路由 `/` 时，THE 路由器 SHALL 仅加载 ProjectListPage 组件代码，不加载 EditorPage 及其依赖（CodeMirror 等）
2. WHEN 用户导航到 `/editor` 路由时，THE 路由器 SHALL 通过 React.lazy 动态加载 EditorPage 组件
3. WHILE EditorPage 组件正在加载中，THE 应用 SHALL 展示一个加载指示器（Suspense fallback）
4. IF EditorPage 懒加载失败，THEN THE 应用 SHALL 展示错误提示信息，而非白屏
5. WHEN 构建完成后，THE 构建产物 SHALL 将 EditorPage 及其依赖输出为独立的分包文件，与首页代码分离

### 需求 2：对话框懒加载

**用户故事：** 作为用户，我希望编辑器页面初始加载时不包含对话框代码，以便编辑器能更快地进入可交互状态。

#### 验收标准

1. WHEN EditorPage 首次渲染时，THE 编辑器页面 SHALL 不加载 CharacterDialog、WorldDialog、TimelineDialog、PlotDialog、ExportDialog、AIConfigDialog 的代码
2. WHEN 用户触发打开某个对话框的操作时，THE 编辑器页面 SHALL 通过 React.lazy 按需加载对应的对话框组件
3. WHILE 对话框组件正在加载中，THE 编辑器页面 SHALL 展示加载指示器
4. IF 对话框懒加载失败，THEN THE 编辑器页面 SHALL 展示错误提示（如 Toast），而非导致页面崩溃

### 需求 3：构建产物分包

**用户故事：** 作为用户，我希望第三方库被拆分为独立的缓存友好的分包，以便在应用代码更新时浏览器能复用已缓存的第三方库。

#### 验收标准

1. THE 构建产物 SHALL 将 CodeMirror 相关包（@codemirror/*）打包为独立的分包
2. THE 构建产物 SHALL 将 react 和 react-dom 打包为独立的分包
3. THE 构建产物 SHALL 将 jspdf 和 jszip 打包为独立的分包
4. THE 构建产物 SHALL 将 react-router-dom 打包为独立的分包
5. WHEN 构建完成后，THE 主包 SHALL 体积小于 200KB（gzip 前）
6. THE 构建产物 SHALL 通过 Vite 的 build.rollupOptions.output.manualChunks 配置实现分包

### 需求 4：EditorPage 组件拆分

**用户故事：** 作为开发者，我希望 EditorPage 被拆分为职责清晰的子组件，以便代码更易维护和理解。

#### 验收标准

1. THE 编辑器页面 SHALL 将所有 Store 实例通过 React Context 提供给子组件，替代当前的逐层 props 传递
2. THE 编辑器页面 SHALL 将工具栏渲染逻辑拆分为独立的 EditorToolbar 组件
3. THE 编辑器页面 SHALL 将右侧面板渲染逻辑拆分为独立的 EditorRightPanel 组件
4. THE 编辑器页面 SHALL 将中心内容区域渲染逻辑拆分为独立的 EditorContent 组件
5. THE 编辑器页面 SHALL 将对话框管理逻辑拆分为独立的 DialogManager 组件
6. WHEN 拆分完成后，THE EditorPage 组件 SHALL 作为组合层，仅负责初始化 Store、提供 Context 和组合子组件
7. WHEN 拆分完成后，THE 编辑器页面 SHALL 保持与拆分前完全一致的功能行为和视觉表现

### 需求 5：内联样式优化

**用户故事：** 作为开发者，我希望组件样式不在每次渲染时重新创建对象，以便减少不必要的内存分配和潜在的重渲染。

#### 验收标准

1. THE 编辑器页面 SHALL 确保所有 CSSProperties 样式对象定义在组件函数外部（模块顶层），而非在渲染函数内部创建
2. WHEN 样式对象需要依赖动态值（如 props 或 state）时，THE 组件 SHALL 使用 useMemo 缓存该样式对象
3. THE 编辑器页面 SHALL 将 EditorLayout 组件中已有的模块顶层样式模式作为标准，推广到所有拆分后的子组件

### 需求 6：Error Boundary

**用户故事：** 作为用户，我希望单个组件的崩溃不会导致整个应用白屏，以便我能继续使用其他功能或恢复操作。

#### 验收标准

1. THE 应用 SHALL 在路由层级包裹一个顶层 Error_Boundary，捕获页面级组件的渲染错误
2. THE 编辑器页面 SHALL 在写作编辑器（WritingEditor）区域包裹一个 Error_Boundary，隔离编辑器崩溃
3. THE 编辑器页面 SHALL 在右侧面板区域包裹一个 Error_Boundary，隔离面板组件崩溃
4. WHEN Error_Boundary 捕获到错误时，THE Error_Boundary SHALL 展示降级 UI，包含错误摘要信息和"重试"按钮
5. WHEN 用户点击"重试"按钮时，THE Error_Boundary SHALL 重置错误状态并重新渲染子组件树
6. WHEN Error_Boundary 捕获到错误时，THE Error_Boundary SHALL 将错误信息输出到浏览器控制台（console.error）

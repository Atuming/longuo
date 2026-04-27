# 火龙果编辑器 — 技术设计文档

## 1. 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 框架 | React | 19.x |
| 语言 | TypeScript | 6.0 |
| 构建 | Vite | 8.x |
| 编辑器 | CodeMirror 6 | 6.x |
| 路由 | React Router | 7.x |
| PDF 导出 | jsPDF | 4.x |
| ZIP 处理 | JSZip | 3.x |
| YAML 解析 | yaml | 2.x |
| 测试 | Vitest + fast-check | 4.x / 4.6 |
| UI 测试 | Testing Library | 16.x |

## 2. 系统架构

```
┌─────────────────────────────────────────────────────┐
│                    App (HashRouter)                  │
├──────────────────┬──────────────────────────────────┤
│  ProjectListPage │         EditorPage (lazy)         │
│                  ├──────────────────────────────────┤
│                  │  EditorStoreProvider (Context)     │
│                  ├────────┬───────────┬─────────────┤
│                  │Sidebar │  Editor   │ Right Panel  │
│                  │ Tabs   │ Content   │  (Detail/AI) │
└──────────────────┴────────┴───────────┴─────────────┘
         ↕                      ↕              ↕
┌─────────────────────────────────────────────────────┐
│                   Stores (11 个)                     │
│  Project │ Chapter │ Character │ Relationship │ ...  │
└─────────────────────────┬───────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────┐
│                  Engines (4 个)                       │
│  FileManager │ Consistency │ Export │ AIAssistant    │
└─────────────────────────────────────────────────────┘
```

### 2.1 分层设计

- **Types 层** (`src/types/`)：所有接口和类型定义，零运行时依赖
- **Stores 层** (`src/stores/`)：状态管理，纯内存操作，持久化由 ProjectStore 统一处理
- **Engines 层** (`src/lib/`)：业务逻辑引擎，无 UI 依赖
- **Components 层** (`src/components/`)：UI 组件，分为 ui（基础）、sidebar、panels、dialogs、editor、ai、graph
- **Pages 层** (`src/pages/`)：页面级组件，负责组装和路由

### 2.2 依赖注入

通过 `EditorStoreProvider`（React Context）将所有 Store 和 Engine 实例注入组件树，避免 prop drilling。Store 和 Engine 在 `EditorPage` 中通过 `useMemo` 创建，生命周期与页面一致。

## 3. 数据模型

### 3.1 项目文件格式（.novel）

```json
{
  "version": 1,
  "project": { "id", "name", "description", "createdAt", "updatedAt" },
  "chapters": [{ "id", "projectId", "parentId", "title", "content", "level", "sortOrder", "wordCount" }],
  "characters": [{ "id", "projectId", "name", "aliases", "appearance", "personality", "backstory", "customAttributes" }],
  "characterSnapshots": [{ "id", "characterId", "timelinePointId", "appearance", "personality" }],
  "relationships": [{ "id", "projectId", "characterId1", "characterId2", "relationshipType", "description", "strength", "timelinePointId" }],
  "timelinePoints": [{ "id", "projectId", "label", "description", "sortOrder", "associatedChapterIds", "associatedCharacterIds" }],
  "worldEntries": [{ "id", "projectId", "type", "name", "description", "associatedCharacterIds" }],
  "plotThreads": [{ "id", "projectId", "title", "description", "status", "associatedChapterIds" }],
  "aiConfig": { "providers", "activeProviderId", "promptTemplates", "activeTemplateId" },
  "customWorldCategories": [{ "key", "label" }]
}
```

### 3.2 实体关系

```
NovelProject 1──* Chapter (parentId 自引用形成树)
NovelProject 1──* Character
Character    1──* CharacterTimelineSnapshot
Character    *──* Character (通过 CharacterRelationship)
NovelProject 1──* TimelinePoint
TimelinePoint *──* Chapter (associatedChapterIds)
TimelinePoint *──* Character (associatedCharacterIds)
NovelProject 1──* WorldEntry
NovelProject 1──* PlotThread
PlotThread   *──* Chapter (associatedChapterIds)
```

## 4. Store 设计

### 4.1 Store 列表

| Store | 职责 | 持久化 |
|-------|------|--------|
| ProjectStore | 项目文件 I/O、最近项目 | File System Access API + localStorage |
| ChapterStore | 章节 CRUD、树形排序、字数统计 | 内存（由 ProjectStore 序列化） |
| CharacterStore | 角色 CRUD、时间线快照 | 内存 |
| RelationshipStore | 角色关系 CRUD、时间线筛选 | 内存 |
| WorldStore | 世界观词条 CRUD、自定义分类 | 内存 |
| TimelineStore | 时间线节点 CRUD、级联删除 | 内存 |
| PlotStore | 情节线索 CRUD、状态筛选 | 内存 |
| AIAssistantStore | AI 配置、技能管理、生成历史 | 内存 + localStorage（历史） |
| SnapshotStore | 版本快照 CRUD | localStorage |
| ThemeStore | 主题偏好 | localStorage |
| DailyGoalStore | 日更目标配置和进度 | localStorage |

### 4.2 设计原则

- 所有 Store 返回数据的深拷贝（防御性复制），防止外部修改内部状态
- Store 之间通过 EventBus 通信（如时间线删除通知角色快照清理）
- 闭包模式创建 Store 实例，不使用 class

## 5. Engine 设计

### 5.1 FileManager

- 封装 File System Access API（`showSaveFilePicker` / `showOpenFilePicker`）
- 项目数据序列化为 JSON，反序列化时做版本兼容处理
- 不支持 File System Access API 时提供降级提示

### 5.2 ConsistencyEngine

- 基于 Levenshtein 编辑距离检测角色名拼写错误
- 编辑距离 ≤ 1 且归一化相似度 > 阈值时报告问题
- 支持一键应用修正建议

### 5.3 ExportEngine

- **PDF**：使用 jsPDF，支持自定义排版参数（字体、字号、行高、页边距）
- **EPUB**：生成完整 EPUB3 结构（mimetype、container.xml、content.opf、toc.ncx、章节 XHTML）
- **Markdown**：拼接所有章节为单个 Markdown 文件
- **TXT**：每章一个 TXT 文件，JSZip 打包为 ZIP
- 导出失败时支持部分恢复（已成功的章节仍可导出）

### 5.4 AIAssistantEngine

#### 上下文打包（packContext）
自动收集 6 类上下文信息：
1. 当前章节内容
2. 前一章节摘要（前 200 字）
3. 后一章节摘要（前 200 字）
4. 关联角色信息（通过时间线关联）
5. 世界观设定
6. 时间线上下文

#### Prompt 构建（buildPrompt）
使用 7 个占位符替换模板：`{chapter_content}`, `{prev_chapter_summary}`, `{next_chapter_summary}`, `{character_info}`, `{world_setting}`, `{timeline_context}`, `{user_input}`

#### 并发控制（generate）
- 每次调用生成唯一 `requestId`（`crypto.randomUUID()`）
- 新请求自动 abort 旧请求的 `AbortController`
- `onChunk` 守卫：仅当 `activeRequestId === requestId` 时传递数据
- 取消返回 `{ success: false, cancelled: true }`，与超时错误区分

#### 技能推荐（recommendSkills）
分析章节上下文信号（字数、对话、结尾、角色、世界观），与技能的 `contextHints` 匹配计算加权评分。

## 6. 写作技能系统

### 6.1 技能定义格式

```yaml
---
id: builtin-dialogue
name: 对话
icon: 💬
description: 生成符合角色性格的高质量对话
parameters:
  - key: character1
    label: 角色A
    type: select
    source: characters
contextHints:
  - signal: hasCharacters
    condition: "true"
    weight: 1.5
sortOrder: 2
enabled: true
---

请根据当前场景和在场角色，生成一段高质量的角色对话...
```

### 6.2 技能加载流程

1. 从 `public/skills/index.json` 读取清单
2. 支持 v1（单文件 `.md`）和 v2（目录结构 `SKILL.md` + `_meta.json` + `references/`）
3. 加载失败时回退到硬编码的 `BUILT_IN_SKILLS` 常量
4. 用户自定义技能通过 `AIAssistantStore` 管理

## 7. UI 组件结构

### 7.1 页面路由

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | ProjectListPage | 项目列表、创建/打开项目 |
| `/editor` | EditorPage（懒加载） | 编辑器主界面 |

### 7.2 编辑器布局

```
┌──────────────────────────────────────────────────┐
│                   EditorToolbar                   │
├──────────┬───────────────────────┬───────────────┤
│ Sidebar  │                      │  Right Panel   │
│ (260px)  │    EditorContent     │   (320px)      │
│          │   (WritingEditor)    │  Detail/AI/    │
│ Outline  │                      │  Consistency/  │
│ Character│                      │  History       │
│ World    │                      │                │
│ Timeline │                      │                │
│ Plot     │                      │                │
└──────────┴───────────────────────┴───────────────┘
```

### 7.3 视图模式

- **标准模式**：三栏布局
- **专注模式**：仅显示编辑器和精简工具栏
- **关系图谱**：全屏角色关系可视化

## 8. 构建与部署

### 8.1 代码分割

Vite `manualChunks` 配置将依赖拆分为：
- `vendor-react`：React + ReactDOM
- `vendor-router`：React Router
- `vendor-codemirror`：CodeMirror 全家桶
- `vendor-export`：jsPDF + JSZip

### 8.2 部署

- 构建产物为纯静态文件（`dist/` 目录）
- Base path 配置为 `/longuo/`
- 可部署到任何静态文件服务器（Nginx、GitHub Pages、Vercel 等）

## 9. 测试策略

| 类型 | 框架 | 覆盖范围 |
|------|------|----------|
| 单元测试 | Vitest | 所有 Store、Engine、工具函数 |
| 属性基测试 | fast-check | AI 并发控制、导出排版、日更目标、主题解析、世界观分类 |
| UI 测试 | Testing Library | AIAssistantPanel 交互测试 |
| ESLint | eslint | 全量代码静态检查 |

# 实施计划：章节标签与筛选

## 概述

按增量方式实现章节标签功能：先建立类型和数据层（Tag 类型、TagStore），再集成到持久化层（NovelFileData、FileManager），然后扩展 UI 层（OutlineTab 标签显示、筛选、编辑交互），最后完成整体集成和连线。

## 任务

- [x] 1. 创建 Tag 类型定义和 TagStore 接口
  - [x] 1.1 创建 `src/types/tag.ts`，定义 `Tag` 接口和 `TagData` 接口
    - 包含 `id`、`projectId`、`name`、`color` 字段
    - `TagData` 包含 `tags: Tag[]` 和 `chapterTagMap: Record<string, string[]>`
    - _需求: 1.6, 6.1_

  - [x] 1.2 在 `src/types/stores.ts` 中新增 `TagStore` 接口定义
    - 包含标签 CRUD 方法：`createTag`、`getTag`、`listTags`、`updateTag`、`deleteTag`
    - 包含关联方法：`addTagToChapter`、`removeTagFromChapter`、`getTagsForChapter`、`getChapterIdsForTag`
    - 包含 `ensurePresetTags`、`exportData`、`importData` 方法
    - _需求: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.6, 6.1, 6.2_

- [x] 2. 实现 TagStore 核心逻辑
  - [x] 2.1 创建 `src/stores/tag-store.ts`，实现 `createTagStore` 函数
    - 内部使用 `Map<string, Tag>` 存储标签，`Map<string, Set<string>>` 存储章节-标签关联
    - 实现预设标签常量 `PRESET_TAGS` 和默认颜色调色板 `DEFAULT_COLORS`
    - 实现 `ensurePresetTags`：首次加载时自动创建 6 个预设标签
    - 实现 `createTag`：名称去重校验、空名称校验、自动分配颜色
    - 实现 `deleteTag`：级联清除所有章节上该标签的关联
    - 实现所有关联管理方法，防御性拷贝返回
    - 实现 `exportData` / `importData` 序列化与反序列化
    - 订阅 EventBus 的 `chapter:deleted` 事件，级联清除被删除章节的标签关联
    - _需求: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 6.1, 6.2_

  - [ ]* 2.2 编写 TagStore 单元测试 `src/stores/tag-store.test.ts`
    - 测试预设标签初始化（6 个预设标签名称和颜色正确）
    - 测试标签 CRUD 基本操作
    - 测试空名称/纯空白名称拒绝
    - 测试重复名称拒绝
    - 测试删除标签级联清除关联
    - 测试章节删除事件级联清除关联
    - 测试 exportData / importData 往返一致性
    - _需求: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.5, 6.1, 6.2, 6.3_

  - [ ]* 2.3 编写属性测试：创建标签自动分配颜色
    - **Property 1: 创建标签自动分配颜色**
    - **验证: 需求 1.2**

  - [ ]* 2.4 编写属性测试：重复标签名称拒绝
    - **Property 2: 重复标签名称拒绝**
    - **验证: 需求 1.3**

  - [ ]* 2.5 编写属性测试：删除标签级联清除关联
    - **Property 3: 删除标签级联清除关联**
    - **验证: 需求 1.5**

  - [ ]* 2.6 编写属性测试：多对多关联完整性
    - **Property 4: 多对多关联完整性**
    - **验证: 需求 2.1, 2.3, 2.4, 2.6**

  - [ ]* 2.7 编写属性测试：移除关联后标签不再出现
    - **Property 5: 移除关联后标签不再出现**
    - **验证: 需求 2.2**

  - [ ]* 2.8 编写属性测试：章节删除级联清除关联
    - **Property 6: 章节删除级联清除关联**
    - **验证: 需求 2.5**

  - [ ]* 2.9 编写属性测试：标签数据序列化往返一致性
    - **Property 8: 标签数据序列化往返一致性**
    - **验证: 需求 6.1, 6.2, 6.3**

- [x] 3. 检查点 - 确保数据层测试通过
  - 确保所有测试通过，如有疑问请询问用户。

- [x] 4. 集成标签数据到持久化层
  - [x] 4.1 扩展 `src/types/project.ts` 中的 `NovelFileData`，新增可选字段 `tagData?: TagData`
    - 导入 `TagData` 类型
    - _需求: 6.1_

  - [x] 4.2 更新 `src/lib/file-manager.ts` 的序列化/反序列化逻辑
    - 确保 `serialize` 和 `deserialize` 正确处理 `tagData` 字段
    - 旧版项目文件无 `tagData` 时兼容处理
    - _需求: 6.1, 6.2_

  - [x] 4.3 更新 `src/pages/EditorPage.tsx` 中的项目数据收集和加载逻辑
    - 创建 TagStore 实例（`useMemo`），传入 EventBus
    - 在 `collectProjectData` 中调用 `tagStore.exportData` 写入 `tagData`
    - 在项目加载时调用 `tagStore.importData` 和 `tagStore.ensurePresetTags`
    - 将 `tagStore` 传递给 `OutlineTab` 组件
    - _需求: 1.1, 6.1, 6.2_

- [x] 5. 实现大纲面板标签显示
  - [x] 5.1 创建 `src/components/sidebar/TagBadges.tsx` 组件
    - 接收 `tags: Tag[]` 属性，渲染带颜色的小标记
    - 无标签时不渲染任何内容
    - _需求: 3.1, 3.2, 3.3_

  - [x] 5.2 扩展 `OutlineTab` 组件，接收 `tagStore` prop
    - 在 `OutlineTabProps` 中新增 `tagStore: TagStore`
    - 在每个章节节点的标题旁渲染 `TagBadges`
    - _需求: 3.1, 3.2, 3.3_

- [x] 6. 实现标签筛选功能
  - [x] 6.1 创建 `src/components/sidebar/TagFilter.tsx` 组件
    - 显示所有可用标签作为可点击的标签按钮
    - 支持多选，选中状态高亮
    - 提供清除筛选的操作入口
    - _需求: 4.1, 4.3, 4.5_

  - [x] 6.2 实现筛选逻辑纯函数 `filterChaptersByTags`
    - 在 `src/components/sidebar/OutlineTab.tsx` 或独立工具文件中实现
    - 输入：章节列表、选中的标签 ID 集合、章节-标签关联映射
    - 输出：可见章节 ID 集合（匹配章节 + 祖先章节）
    - 空筛选标签集合时返回所有章节
    - _需求: 4.2, 4.3, 4.4_

  - [x] 6.3 在 `OutlineTab` 中集成 `TagFilter` 和筛选逻辑
    - 在章节树上方渲染 `TagFilter`
    - 使用 `filterChaptersByTags` 过滤渲染的章节节点
    - 筛选激活时显示当前筛选条件
    - _需求: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 6.4 编写属性测试：标签筛选显示匹配章节及祖先
    - **Property 7: 标签筛选显示匹配章节及祖先**
    - **验证: 需求 4.2, 4.3, 4.4**

- [x] 7. 检查点 - 确保标签显示和筛选功能正常
  - 确保所有测试通过，如有疑问请询问用户。

- [x] 8. 实现章节标签编辑交互
  - [x] 8.1 创建 `src/components/sidebar/TagPopover.tsx` 标签选择弹出层组件
    - 列出当前项目所有可用标签，带勾选状态
    - 勾选/取消勾选立即更新关联关系
    - 提供快速创建新标签的输入框入口
    - _需求: 5.2, 5.3, 5.4_

  - [x] 8.2 扩展 `OutlineTab` 右键菜单，添加「管理标签」选项
    - 点击后显示 `TagPopover` 弹出层
    - 传入当前章节 ID 和 tagStore
    - _需求: 5.1, 5.2_

  - [ ]* 8.3 编写 OutlineTab 标签交互的 UI 测试
    - 测试右键菜单显示「管理标签」选项
    - 测试 TagFilter 控件渲染和交互
    - 测试 TagBadges 在章节节点旁正确显示
    - 测试 TagPopover 勾选/取消勾选交互
    - _需求: 3.1, 3.2, 3.3, 4.1, 5.1, 5.2, 5.3, 5.4_

- [x] 9. 最终检查点 - 确保所有测试通过
  - 确保所有测试通过，如有疑问请询问用户。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加快 MVP 进度
- 每个任务引用了具体的需求编号以确保可追溯性
- 检查点确保增量验证
- 属性测试验证设计文档中定义的通用正确性属性
- 单元测试验证具体示例和边界情况

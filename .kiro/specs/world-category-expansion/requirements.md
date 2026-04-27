# 需求文档：世界观分类体系扩展

## 简介

当前小说写作助手的世界观（World-Building）模块仅支持三种内置分类：地点（location）、势力（faction）、规则（rule）。这对于奇幻、科幻、修仙等多种题材的小说创作远远不够。本功能将扩展世界观分类体系，新增八种内置分类，并支持用户自定义分类，以满足不同题材的世界观构建需求。

## 术语表

- **World_System**：世界观模块，负责管理所有世界观条目的创建、编辑、筛选和展示
- **WorldEntry**：世界观条目，包含名称、描述、类型、关联角色等信息的数据实体
- **Built_In_Category**：内置分类，系统预定义的世界观条目类型，不可删除或重命名
- **Custom_Category**：自定义分类，用户创建的世界观条目类型，可编辑和删除
- **Category_Registry**：分类注册表，维护所有内置分类和自定义分类的集合
- **WorldDialog**：世界观对话框，用于创建和编辑世界观条目的 UI 组件
- **WorldTab**：世界观侧边栏标签页，展示世界观条目列表和筛选功能的 UI 组件
- **WorldDetailPanel**：世界观详情面板，展示单个世界观条目详细信息的 UI 组件
- **User**：使用小说写作助手的作者

## 需求

### 需求 1：扩展内置分类类型

**用户故事：** 作为小说作者，我希望世界观模块提供更丰富的内置分类，以便我能更系统地构建不同维度的世界观设定。

#### 验收标准

1. THE World_System SHALL 支持以下 11 种内置分类：地点（location）、势力（faction）、规则（rule）、物品/道具（item）、种族/物种（race）、魔法/能力体系（magic）、历史/事件（history）、文化/习俗（culture）、科技/技术（technology）、货币/经济（economy）、宗教/信仰（religion）
2. THE World_System SHALL 为每种内置分类分配唯一的英文标识符（key）和中文显示名称（label）
3. THE World_System SHALL 为每种内置分类分配可区分的标签颜色，用于在 UI 中视觉区分不同分类
4. WHEN 用户创建新的 WorldEntry 时，THE WorldDialog SHALL 展示所有 11 种内置分类供用户选择
5. THE World_System SHALL 保持与现有三种分类（location、faction、rule）数据的向后兼容性

### 需求 2：支持用户自定义分类

**用户故事：** 作为小说作者，我希望能创建自定义的世界观分类，以便我能根据特定题材的需要添加系统未预设的分类维度。

#### 验收标准

1. THE World_System SHALL 支持用户在项目级别创建自定义分类
2. WHEN 用户创建自定义分类时，THE World_System SHALL 要求用户提供分类名称，且名称不得为空
3. WHEN 用户创建自定义分类时，THE World_System SHALL 验证分类名称在该项目中的唯一性（不与内置分类名称或已有自定义分类名称重复）
4. IF 用户提交的自定义分类名称与已有分类名称重复，THEN THE World_System SHALL 显示错误提示并阻止创建
5. THE World_System SHALL 允许用户编辑自定义分类的名称
6. THE World_System SHALL 允许用户删除自定义分类
7. IF 用户删除一个已被 WorldEntry 引用的自定义分类，THEN THE World_System SHALL 提示用户确认，并在确认后将相关条目的分类回退为默认内置分类（rule）

### 需求 3：更新世界观对话框以支持扩展分类

**用户故事：** 作为小说作者，我希望在创建或编辑世界观条目时能方便地选择所有可用分类（包括内置和自定义），以便我能快速归类条目。

#### 验收标准

1. WHEN WorldDialog 打开时，THE WorldDialog SHALL 展示所有内置分类和当前项目的自定义分类作为可选类型
2. WHEN 可选分类数量超过一行可显示的范围时，THE WorldDialog SHALL 以可滚动或换行的方式展示所有分类选项，保证所有选项可访问
3. THE WorldDialog SHALL 提供一个"添加自定义分类"的入口，允许用户在选择类型时直接创建新的自定义分类
4. WHEN 用户选择自定义分类时，THE WorldDialog SHALL 将该自定义分类的标识符存储到 WorldEntry 的 type 字段中

### 需求 4：更新侧边栏筛选以支持扩展分类

**用户故事：** 作为小说作者，我希望在侧边栏中能按所有分类（包括新增内置分类和自定义分类）筛选世界观条目，以便我能快速定位特定类型的设定。

#### 验收标准

1. THE WorldTab SHALL 展示"全部"筛选按钮以及所有内置分类的筛选按钮
2. WHEN 当前项目存在自定义分类时，THE WorldTab SHALL 在内置分类筛选按钮之后展示自定义分类的筛选按钮
3. WHEN 筛选按钮数量超过一行可显示的范围时，THE WorldTab SHALL 以可滚动或换行的方式展示所有筛选按钮，保证所有按钮可访问
4. WHEN 用户点击某个分类筛选按钮时，THE WorldTab SHALL 仅展示该分类下的世界观条目

### 需求 5：更新详情面板以支持扩展分类

**用户故事：** 作为小说作者，我希望在查看世界观条目详情时能正确显示所有分类的标签和颜色，以便我能直观识别条目类型。

#### 验收标准

1. THE WorldDetailPanel SHALL 为所有 11 种内置分类显示对应的中文标签名称和分类颜色
2. WHEN 展示自定义分类的 WorldEntry 时，THE WorldDetailPanel SHALL 显示自定义分类的名称，并使用统一的默认颜色标识
3. IF 一个 WorldEntry 引用了已被删除的自定义分类，THEN THE WorldDetailPanel SHALL 显示该条目的 type 原始值作为标签文本，并使用默认颜色

### 需求 6：更新类型定义和数据存储

**用户故事：** 作为开发者，我希望类型系统和数据存储能正确支持扩展后的分类体系，以便代码保持类型安全和数据一致性。

#### 验收标准

1. THE WorldEntry 类型的 type 字段 SHALL 接受所有内置分类标识符以及任意字符串（用于自定义分类）
2. THE World_System SHALL 提供一个集中的分类注册表（Category_Registry），包含所有内置分类的 key、label 和 color 定义
3. THE WorldStore 的 filterByType 方法 SHALL 支持按任意分类标识符（包括自定义分类）筛选条目
4. THE World_System SHALL 在项目数据中持久化存储用户创建的自定义分类列表

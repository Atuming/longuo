# 实现计划：世界观分类体系扩展

## 概述

扩展世界观模块的分类体系，将内置分类从 3 种扩展到 11 种，并支持用户自定义分类。实现按照类型层 → 数据层 → UI 层的顺序推进。

## 任务

- [x] 1. 类型定义与分类注册表
  - [x] 1.1 扩展 WorldEntry 类型和新增分类注册表
    - 修改 `src/types/world.ts`：将 `WorldEntry.type` 从 `'location' | 'faction' | 'rule'` 改为 `string`
    - 新增 `BuiltInCategory` 接口和 `BUILT_IN_CATEGORIES` 常量数组（11 种内置分类，含 key、label、color）
    - 新增 `CustomWorldCategory` 接口（key: string, label: string）
    - 新增 `CUSTOM_CATEGORY_DEFAULT_COLOR` 常量
    - 导出辅助函数 `getCategoryInfo(type: string, customCategories: CustomWorldCategory[])`：根据 type 返回 label 和 color
    - _需求: 1.1, 1.2, 1.3, 6.1, 6.2_
  - [x] 1.2 更新 NovelFileData 类型
    - 修改 `src/types/project.ts`：在 `NovelFileData` 中新增可选字段 `customWorldCategories?: CustomWorldCategory[]`
    - _需求: 6.4_
  - [x] 1.3 扩展 WorldStore 接口
    - 修改 `src/types/stores.ts`：在 `WorldStore` 接口中新增自定义分类管理方法：`listCustomCategories`、`addCustomCategory`、`updateCustomCategory`、`deleteCustomCategory`、`getAllCategories`
    - 更新 `filterByType` 的 type 参数类型为 `string`
    - _需求: 2.1, 2.5, 2.6, 6.3_

- [x] 2. WorldStore 实现扩展
  - [x] 2.1 实现自定义分类 CRUD
    - 修改 `src/stores/world-store.ts`：新增内部 `customCategories` Map 存储
    - 实现 `listCustomCategories`：返回指定项目的自定义分类列表
    - 实现 `addCustomCategory`：验证名称非空、不与内置/已有自定义分类重复，生成 UUID key
    - 实现 `updateCustomCategory`：验证新名称有效性，更新 label
    - 实现 `deleteCustomCategory`：删除分类并将引用该分类的 WorldEntry 的 type 回退为 `'rule'`
    - 实现 `getAllCategories`：合并内置分类和自定义分类返回
    - _需求: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
  - [x] 2.2 属性测试：WorldEntry type 字段通用性
    - **属性 1: WorldEntry type 字段通用性**
    - **验证: 需求 1.5, 3.4, 6.1**
  - [x] 2.3 属性测试：自定义分类 CRUD 往返一致性
    - **属性 2: 自定义分类 CRUD 往返一致性**
    - **验证: 需求 2.1, 2.5, 2.6**
  - [x] 2.4 属性测试：自定义分类名称验证
    - **属性 3: 自定义分类名称验证**
    - **验证: 需求 2.2, 2.3, 2.4**
  - [x] 2.5 属性测试：删除自定义分类条目回退
    - **属性 4: 删除自定义分类条目回退**
    - **验证: 需求 2.7**
  - [x] 2.6 属性测试：按分类筛选正确性（扩展）
    - **属性 5: 按分类筛选正确性（扩展）**
    - **验证: 需求 4.4, 6.3**
  - [x] 2.7 属性测试：自定义分类持久化往返一致性
    - **属性 6: 自定义分类持久化往返一致性**
    - **验证: 需求 6.4**

- [x] 3. 更新现有单元测试
  - [x] 3.1 更新 world-store.test.ts
    - 更新 `makeEntryData` 辅助函数以适配 `type: string`
    - 新增自定义分类 CRUD 的单元测试用例
    - 新增删除分类回退逻辑的单元测试用例
    - 验证 BUILT_IN_CATEGORIES 包含 11 种分类且结构完整
    - _需求: 1.1, 1.5, 2.1, 2.7_

- [x] 4. 更新 WorldDialog 组件
  - [x] 4.1 扩展分类选择器
    - 修改 `src/components/dialogs/WorldDialog.tsx`：将硬编码的 3 种类型替换为从 `BUILT_IN_CATEGORIES` 和传入的 `customCategories` 动态渲染
    - 分类按钮区域使用 `flexWrap: 'wrap'` 支持换行显示
    - 新增"添加自定义分类"按钮，点击后显示内联输入框
    - 更新 Props 接口：新增 `customCategories` 和 `onAddCustomCategory` 属性
    - _需求: 1.4, 3.1, 3.2, 3.3, 3.4_

- [x] 5. 更新 WorldTab 组件
  - [x] 5.1 扩展筛选按钮
    - 修改 `src/components/sidebar/WorldTab.tsx`：将硬编码的 `FILTER_LABELS` 替换为从 `BUILT_IN_CATEGORIES` 动态生成
    - 在内置分类筛选按钮之后追加自定义分类的筛选按钮
    - 筛选按钮区域使用 `flexWrap: 'wrap'` 支持换行显示
    - 更新 `FilterType` 类型为 `'all' | string`
    - 更新 Props 接口：新增 `customCategories` 属性
    - _需求: 4.1, 4.2, 4.3, 4.4_

- [x] 6. 更新 WorldDetailPanel 组件
  - [x] 6.1 扩展分类标签显示
    - 修改 `src/components/panels/WorldDetailPanel.tsx`：将硬编码的 `TYPE_TAG_COLORS` 和 `TYPE_LABELS` 替换为使用 `getCategoryInfo` 辅助函数
    - 自定义分类使用默认灰色标签颜色
    - 未知分类（已删除的自定义分类）显示 type 原始值并使用默认颜色
    - _需求: 5.1, 5.2, 5.3_

- [x] 7. 验证检查点
  - [x] 7.1 运行全部测试确保通过
    - 运行 `vitest --run` 确保所有现有测试和新增测试通过
    - 验证无 TypeScript 编译错误
    - _需求: 1.5（向后兼容性）_

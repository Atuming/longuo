# 实施计划：火龙果编辑器全面质量自检

## 概述

按照设计文档的修复方案和测试策略，先修复级联删除代码缺陷（前置条件），再分层建立属性基测试和单元测试覆盖。已有测试完全覆盖的需求（4.1-4.3、5.4、10.1-10.4、11.4、12.1-12.2、16.1-16.6）不重复实现。

## 任务

- [x] 1. 扩展 EventBus 事件类型并实现角色级联删除
  - [x] 1.1 扩展 EventBus 事件类型定义
    - 修改 `src/types/event-bus.ts`，将事件联合类型从仅 `TimelineEvent` 扩展为 `AppEvent`，新增 `character:deleted` 和 `chapter:deleted` 事件类型
    - 修改 `src/lib/event-bus.ts`，将泛型从 `TimelineEvent` 更新为 `AppEvent`
    - 确保 `emit` 方法捕获监听器异常不中断事件传播
    - _需求: 2.5, 2.9_

  - [x] 1.2 实现角色删除级联清理
    - 修改 `src/stores/character-store.ts`：`deleteCharacter` 方法通过 EventBus 发出 `character:deleted` 事件
    - 修改 `src/stores/relationship-store.ts`：订阅 `character:deleted` 事件，删除 `sourceCharacterId` 或 `targetCharacterId` 匹配的关系记录
    - 修改 `src/stores/world-store.ts`：接受 EventBus 参数，订阅 `character:deleted` 事件，从所有 WorldEntry 的 `associatedCharacterIds` 中移除已删除角色 ID
    - 修改 `src/stores/timeline-store.ts`：订阅 `character:deleted` 事件，从所有 TimelinePoint 的 `associatedCharacterIds` 中移除已删除角色 ID
    - _需求: 2.1, 2.2, 2.3, 2.4_

  - [x] 1.3 实现章节删除级联清理
    - 修改 `src/stores/chapter-store.ts`：接受 EventBus 参数，`deleteChapter` 方法在删除章节及子章节后发出 `chapter:deleted` 事件（包含所有被删除的 ID 列表）
    - 修改 `src/stores/plot-store.ts`：接受 EventBus 参数，订阅 `chapter:deleted` 事件，从所有 PlotThread 的 `associatedChapterIds` 中移除已删除章节 ID
    - 修改 `src/stores/timeline-store.ts`：订阅 `chapter:deleted` 事件，从所有 TimelinePoint 的 `associatedChapterIds` 中移除已删除章节 ID
    - _需求: 2.6, 2.7_

  - [x] 1.4 更新 EditorPage 中的 Store 创建调用
    - 修改 `src/pages/EditorPage.tsx`：将 EventBus 传递给 `createWorldStore`、`createChapterStore`、`createPlotStore` 等新增支持 EventBus 的 Store
    - 确保所有 Store 在同一个 EventBus 实例上通信
    - _需求: 2.1-2.7_

- [x] 2. 检查点 - 确保代码修复编译通过
  - 确保所有修改后的文件无类型错误，运行测试确认无回归，如有问题请询问用户。

- [x] 3. Store 防御性拷贝属性基测试
  - [x]* 3.1 编写嵌套结构不可变性属性测试（属性 1）
    - 创建 `src/stores/defensive-copy.property.test.ts`
    - 使用 fast-check 生成随机实体数据，验证 CharacterStore、WorldStore、TimelineStore、PlotStore 的 get 方法返回值中嵌套数组/对象被外部修改后，再次 get 获取的值不受影响
    - **属性 1: Store 防御性拷贝——嵌套结构不可变性**
    - **验证: 需求 15.2, 15.4, 15.5, 15.6, 15.7, 15.8**

  - [x]* 3.2 编写简单字段不可变性属性测试（属性 2）
    - 在同一文件中添加测试，验证 ChapterStore、RelationshipStore 的 get 方法返回值的简单字段被外部修改后，再次 get 获取的值不受影响
    - **属性 2: Store 防御性拷贝——简单字段不可变性**
    - **验证: 需求 15.1, 15.3**

- [x] 4. 级联删除测试
  - [x] 4.1 编写级联删除单元测试
    - 创建 `src/stores/cascade-delete.test.ts`
    - 测试角色删除后关系、世界观条目、时间线引用的清理
    - 测试章节删除后情节线索、时间线引用的清理
    - 测试自定义分类删除后 WorldEntry type 重置为 'rule'
    - 测试级联删除过程中某一步失败不影响其他步骤
    - _需求: 2.1-2.9_

  - [x]* 4.2 编写角色删除级联完整性属性测试（属性 3）
    - 创建 `src/stores/cascade-delete.property.test.ts`
    - 使用 fast-check 生成随机角色、关系、世界观条目、时间线数据，验证删除角色后所有引用被清理
    - **属性 3: 角色删除级联完整性**
    - **验证: 需求 2.1, 2.2, 2.3, 2.4**

  - [x]* 4.3 编写时间线删除级联完整性属性测试（属性 4）
    - 在同一文件中添加测试，验证删除时间线节点后关系和快照被清理
    - **属性 4: 时间线删除级联完整性**
    - **验证: 需求 2.5**

  - [x]* 4.4 编写章节删除递归完整性属性测试（属性 5）
    - 在同一文件中添加测试，验证删除章节后该章节及所有后代不再存在
    - **属性 5: 章节删除递归完整性**
    - **验证: 需求 2.6**

  - [x]* 4.5 编写章节删除级联引用清理属性测试（属性 6）
    - 在同一文件中添加测试，验证删除章节后 PlotThread 和 TimelinePoint 的引用被清理
    - **属性 6: 章节删除级联引用清理**
    - **验证: 需求 2.7**

- [x] 5. 检查点 - 确保级联删除测试全部通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 6. 一致性引擎属性基测试
  - [x]* 6.1 编写精确匹配排除属性测试（属性 9）
    - 创建 `src/lib/consistency-engine.property.test.ts`
    - 使用 fast-check 生成随机角色名和包含精确匹配的章节内容，验证不报告精确匹配
    - **属性 9: 一致性引擎精确匹配排除**
    - **验证: 需求 9.4, 9.5**

  - [x]* 6.2 编写无重复报告属性测试（属性 10）
    - 在同一文件中添加测试，验证返回的问题列表中无重复 offset+length
    - **属性 10: 一致性引擎无重复报告**
    - **验证: 需求 9.6**

  - [x]* 6.3 编写 applySuggestion 精确替换属性测试（属性 11）
    - 在同一文件中添加测试，验证替换仅影响指定位置
    - **属性 11: applySuggestion 精确替换**
    - **验证: 需求 9.7**

- [x] 7. 导出引擎属性基测试
  - [x]* 7.1 编写 HTML 转义完整性属性测试（属性 12）
    - 创建或增强 `src/lib/export-engine.property.test.ts`
    - 使用 fast-check 生成包含 HTML 特殊字符的字符串，验证 escapeHtml 输出无未转义字符
    - **属性 12: HTML 转义完整性**
    - **验证: 需求 7.2**

  - [x]* 7.2 编写文件名清理完整性属性测试（属性 13）
    - 在同一文件中添加测试，验证 sanitizeFilename 输出无非法字符
    - **属性 13: 文件名清理完整性**
    - **验证: 需求 7.3**

  - [x]* 7.3 编写 Markdown 标记去除完整性属性测试（属性 14）
    - 在同一文件中添加测试，验证 stripMarkdown 输出无 Markdown 标记
    - **属性 14: Markdown 标记去除完整性**
    - **验证: 需求 7.4**

- [x] 8. 快照、AI 历史、文件管理属性基测试
  - [x]* 8.1 编写快照删除后列表一致性属性测试（属性 15）
    - 创建 `src/stores/snapshot-store.property.test.ts`
    - 使用 fast-check 生成随机快照数据，验证删除后 listSnapshots 不包含已删除快照
    - **属性 15: 快照删除后列表一致性**
    - **验证: 需求 8.5**

  - [x]* 8.2 编写 AI 历史记录上限约束属性测试（属性 16）
    - 创建 `src/stores/ai-history.property.test.ts`
    - 使用 fast-check 生成大量 addHistoryRecord 调用，验证 listHistory 不超过 50 条
    - **属性 16: AI 历史记录上限约束**
    - **验证: 需求 17.1**

  - [x]* 8.3 编写 AI 历史记录时间倒序属性测试（属性 17）
    - 在同一文件中添加测试，验证 listHistory 按 timestamp 降序排列
    - **属性 17: AI 历史记录时间倒序**
    - **验证: 需求 17.4**

  - [x]* 8.4 编写 Date 字段序列化往返属性测试（属性 18）
    - 创建 `src/lib/file-manager.property.test.ts`
    - 使用 fast-check 生成随机 NovelFileData，验证 serialize→deserialize 后 Date 字段正确恢复
    - **属性 18: Date 字段序列化往返**
    - **验证: 需求 13.5**

  - [x]* 8.5 编写章节拖拽后 sortOrder 连续无重复属性测试（属性 7）
    - 创建 `src/stores/chapter-reorder.property.test.ts`
    - 使用 fast-check 生成随机章节树和拖拽操作，验证 sortOrder 从 0 连续递增无重复
    - **属性 7: 章节拖拽后 sortOrder 连续无重复**
    - **验证: 需求 4.4, 4.5**

- [x] 9. 检查点 - 确保所有属性基测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 10. 边界场景单元测试增强
  - [x] 10.1 增强一致性引擎边界测试
    - 增强 `src/lib/consistency-engine.test.ts`
    - 添加空内容、无角色、单字符角色名的边界测试
    - _需求: 9.1, 9.2, 9.3_

  - [x] 10.2 编写 AI 历史记录单元测试
    - 创建 `src/stores/ai-history.test.ts`
    - 测试损坏数据处理（非数组）、localStorage 写入失败静默降级、clearHistory 清除数据
    - _需求: 17.2, 17.3, 17.5_

  - [x] 10.3 增强快照 Store 边界测试
    - 增强已有快照测试或在 `src/stores/snapshot-store.property.test.ts` 中添加
    - 测试 QuotaExceededError 处理、恢复快照自动备份、自动备份失败中止恢复、损坏数据跳过
    - _需求: 8.1, 8.2, 8.3, 8.4_

- [x] 11. 检查点 - 确保所有单元测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 12. UI 组件测试
  - [x]* 12.1 编写弹窗数据回填测试
    - 创建 `src/components/dialogs/__tests__/dialog-population.test.tsx`
    - 测试 CharacterDialog、WorldDialog、TimelineDialog、PlotDialog、RelationshipDialog 的 initialData 回填
    - 测试弹窗关闭后重新打开新建时表单重置为默认值
    - _需求: 1.1-1.7_

  - [x]* 12.2 增强空状态 UI 测试
    - 验证各 Tab 组件（OutlineTab、CharacterTab、WorldTab、TimelineTab、PlotTab）在数据为空时显示正确的提示文本
    - 验证详情面板在引用 ID 不存在时显示"未找到"提示
    - _需求: 18.1-18.6, 18.9-18.11_

- [x] 13. 最终检查点 - 确保所有测试通过
  - 运行完整测试套件，确保所有测试通过，如有问题请询问用户。

## 备注

- 标记 `*` 的子任务为可选，可跳过以加速 MVP 交付
- 任务 1（代码修复）是所有级联删除测试的前置条件，必须优先完成
- 已有测试完全覆盖的需求不重复实现：OutlineTab.test.ts（需求 4.1-4.3）、ai-assistant-engine.property.test.ts（需求 5.4）、world-category-expansion.property.test.ts（需求 10.1-10.4）、theme-store.property.test.ts（需求 11.4）、daily-goal-store.property.test.ts（需求 12.1-12.2）、skill-parser.test.ts（需求 16.1-16.6）
- 属性基测试使用 fast-check，每个属性最少 100 次迭代
- 每个检查点确保增量验证，避免问题累积

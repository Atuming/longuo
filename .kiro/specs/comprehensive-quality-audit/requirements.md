# 需求文档：火龙果编辑器全面质量自检

## 简介

火龙果编辑器（Pitaya Editor）是一款面向中文小说作者的 Web 端写作助手。客户在使用过程中反馈了多个交互问题（编辑弹窗不回填数据、关系图谱单节点抖动、AI 并发内容混乱等），暴露出系统在边界场景和异常处理方面的不足。本需求旨在对所有 14 个核心模块进行系统性质量审计，覆盖 CRUD 操作完整性、跨模块数据一致性、UI 状态管理和性能边界，建立测试覆盖防止回归。

## 术语表

- **编辑器（Editor）**：基于 CodeMirror 6 的 Markdown 写作编辑器组件
- **Store**：内存中的状态管理模块，负责各实体的 CRUD 操作
- **Engine**：业务逻辑引擎，包括 FileManager、ConsistencyEngine、ExportEngine、AIAssistantEngine
- **弹窗（Dialog）**：用于创建/编辑实体的模态对话框组件，通过 React.lazy 懒加载
- **级联删除（Cascade Delete）**：删除父实体时自动清理所有引用该实体的子数据
- **EventBus**：模块间事件通信总线，用于跨 Store 的级联操作
- **关系图谱（Relationship Graph）**：基于 SVG 力导向布局的角色关系可视化组件
- **快照（Snapshot）**：项目数据在某一时刻的完整副本，存储在 localStorage 中
- **技能（Skill）**：AI 写作辅助的预定义 Prompt 模板，支持参数化和上下文推荐
- **防御性拷贝（Defensive Copy）**：Store 返回数据时进行深拷贝，防止外部修改内部状态

## 需求

### 需求 1：弹窗数据回填完整性

**用户故事：** 作为小说作者，我希望编辑弹窗打开时能正确回填已有数据，以便我能在原有基础上修改而不是重新输入。

#### 验收标准

1. WHEN 用户点击编辑角色按钮且 CharacterDialog 组件尚未加载，THE 弹窗系统 SHALL 在 React.lazy 懒加载完成后使用 initialData 中的全部字段（name、aliases、appearance、personality、backstory、customAttributes）初始化表单状态
2. WHEN 用户点击编辑世界观按钮，THE WorldDialog SHALL 使用 initialData 中的 type、name、description、category、associatedCharacterIds 初始化表单，且类型按钮高亮状态与 initialData.type 一致
3. WHEN 用户点击编辑时间节点按钮，THE TimelineDialog SHALL 使用 initialData 中的 label、description、associatedChapterIds、associatedCharacterIds 初始化表单，且关联章节和角色的勾选状态正确
4. WHEN 用户点击编辑情节线索按钮，THE PlotDialog SHALL 使用 initialData 中的 name、description、status、associatedChapterIds 初始化表单，且状态按钮高亮与 initialData.status 一致
5. WHEN 用户点击编辑关系按钮，THE RelationshipDialog SHALL 使用 initialData 中的 targetCharacterId、relationshipType、customTypeName、description、startTimelinePointId、endTimelinePointId、strength 初始化表单
6. WHEN 弹窗关闭后再次打开进行新建操作（initialData 为 undefined），THE 弹窗系统 SHALL 将表单重置为默认空值，不保留上次编辑的残留数据
7. WHEN 弹窗在 open 状态下 initialData 属性发生变化，THE 弹窗系统 SHALL 使用新的 initialData 重新初始化表单状态

### 需求 2：跨模块级联删除一致性

**用户故事：** 作为小说作者，我希望删除某个实体时，所有引用该实体的数据都能被正确清理，避免出现悬空引用导致的显示异常。

#### 验收标准

1. WHEN 用户删除一个角色，THE CharacterStore SHALL 删除该角色的所有时间线快照（CharacterTimelineSnapshot）
2. WHEN 用户删除一个角色，THE 系统 SHALL 确保 RelationshipStore 中引用该角色的所有关系记录（sourceCharacterId 或 targetCharacterId 匹配）被清理或标记为无效
3. WHEN 用户删除一个角色，THE 系统 SHALL 确保 WorldEntry 的 associatedCharacterIds 中不再包含已删除角色的 ID
4. WHEN 用户删除一个角色，THE 系统 SHALL 确保 TimelinePoint 的 associatedCharacterIds 中不再包含已删除角色的 ID
5. WHEN 用户删除一个时间线节点，THE EventBus SHALL 发出 timeline:deleted 事件，且 RelationshipStore 删除引用该节点的关系记录，CharacterStore 删除引用该节点的快照
6. WHEN 用户删除一个章节，THE ChapterStore SHALL 递归删除所有子章节（volume → chapter → section）
7. WHEN 用户删除一个章节，THE 系统 SHALL 确保 PlotThread 的 associatedChapterIds 和 TimelinePoint 的 associatedChapterIds 中不再包含已删除章节及其子章节的 ID
8. WHEN 用户删除一个世界观自定义分类，THE WorldStore SHALL 将使用该分类的所有 WorldEntry 的 type 重置为 'rule'
9. IF 级联删除过程中某一步失败，THEN THE 系统 SHALL 记录错误并确保已完成的删除操作不会回滚，避免数据处于不一致的中间状态

### 需求 3：关系图谱边界场景

**用户故事：** 作为小说作者，我希望关系图谱在各种数据条件下都能稳定显示，不出现抖动、崩溃或布局异常。

#### 验收标准

1. WHILE 项目中只有一个角色且无关系记录，THE RelationshipGraphView SHALL 将该节点居中显示且不启动力模拟迭代，节点位置保持静止
2. WHILE 项目中没有任何角色，THE RelationshipGraphView SHALL 显示空状态，不渲染任何 SVG 节点或边
3. WHILE 项目中有两个角色但无关系记录，THE RelationshipGraphView SHALL 显示两个独立节点，力模拟正常收敛后节点位置稳定
4. WHEN 用户在关系图谱中拖拽节点，THE RelationshipGraphView SHALL 暂停被拖拽节点的力模拟更新，释放后恢复
5. WHEN 关系图谱中存在超过 50 个角色和 100 条关系，THE RelationshipGraphView SHALL 在 200 次迭代内完成力模拟收敛，且帧率保持流畅（无明显卡顿）
6. WHEN 用户通过时间线筛选器切换时间节点，THE RelationshipGraphView SHALL 仅显示在该时间节点有效的关系（startTimelinePointId.sortOrder ≤ 当前 ≤ endTimelinePointId.sortOrder）
7. IF 关系的 startTimelinePointId 或 endTimelinePointId 引用了不存在的时间节点，THEN THE RelationshipGraphView SHALL 跳过该关系的时间线筛选判断，默认显示该关系

### 需求 4：章节树拖拽排序边界

**用户故事：** 作为小说作者，我希望拖拽章节时层级约束被正确执行，不会出现非法的层级嵌套。

#### 验收标准

1. THE OutlineTab SHALL 禁止将卷（volume）拖入章（chapter）或节（section）内部
2. THE OutlineTab SHALL 禁止将章（chapter）拖入节（section）内部
3. THE OutlineTab SHALL 禁止将节点拖入自身或自身的后代节点内部（防止循环引用）
4. WHEN 用户将章节拖拽到新位置后释放，THE ChapterStore SHALL 重新计算所有受影响兄弟节点的 sortOrder，确保排序值连续且无重复
5. WHEN 用户将章节从一个父节点拖拽到另一个父节点，THE ChapterStore SHALL 同时更新源父节点和目标父节点下所有子节点的 sortOrder
6. WHEN 拖拽操作被取消（拖出窗口或按 Escape），THE OutlineTab SHALL 清除所有拖拽视觉指示器（dropInfo 和 dragSourceId 重置为 null）

### 需求 5：AI 辅助写作边界场景

**用户故事：** 作为小说作者，我希望 AI 辅助写作在各种异常情况下都能给出清晰的反馈，不会出现内容丢失或界面卡死。

#### 验收标准

1. WHEN 用户在未选择章节的情况下点击生成按钮，THE AIAssistantPanel SHALL 显示错误提示"请先在左侧大纲中选择一个章节"
2. WHEN 用户在输入框为空的情况下点击生成按钮，THE AIAssistantPanel SHALL 显示错误提示"请输入写作指令或选择一个写作技能"
3. WHEN AI 模型未配置（无 activeProvider）时用户点击生成，THE AIAssistantEngine SHALL 返回包含配置引导信息的错误结果
4. WHEN 用户在 AI 生成过程中发起新的生成请求，THE AIAssistantEngine SHALL 通过 AbortController 取消旧请求，旧请求的 onChunk 回调不再传递数据（activeRequestId 守卫）
5. WHEN AI 请求超时（超过 provider.timeoutMs），THE AIAssistantEngine SHALL 返回超时错误提示，且已接收的部分内容保留在结果区域
6. WHEN AI API 返回 HTTP 401/403 错误，THE AIAssistantEngine SHALL 返回"API Key 无效或已过期"的明确错误提示
7. WHEN AI API 返回 HTTP 429 错误，THE AIAssistantEngine SHALL 返回"请求过于频繁，请稍后重试"的错误提示
8. WHEN 流式响应中途中断（网络断开），THE AIAssistantEngine SHALL 保留已接收的部分内容并返回成功结果
9. WHEN 用户点击取消按钮，THE AIAssistantEngine SHALL 调用 abort() 终止请求，且 UI 状态正确恢复（isGenerating 设为 false）
10. WHEN 用户点击"接受"将 AI 内容插入编辑器，THE WritingEditor SHALL 在光标位置插入内容；如果没有活跃的编辑器实例，SHALL 追加到章节内容末尾

### 需求 6：技能参数与推荐系统边界

**用户故事：** 作为小说作者，我希望技能参数表单和推荐系统在各种数据条件下都能正常工作。

#### 验收标准

1. WHEN 用户选择带参数的技能（如"对话"技能的 character1、character2），THE AIAssistantPanel SHALL 显示参数表单，且 select 类型参数的选项列表从当前项目角色列表动态填充
2. WHEN 项目中没有角色且用户选择需要角色参数的技能，THE 参数表单 SHALL 显示空的下拉列表，用户可以跳过可选参数直接确认
3. WHEN 用户确认参数后，THE AIAssistantEngine.resolveSkillPrompt SHALL 将 {param:key} 占位符替换为用户输入值，可选参数为空时替换为空字符串
4. WHEN 章节内容为空，THE AIAssistantEngine.recommendSkills SHALL 为所有技能返回合理的评分（不抛出异常），wordCount 信号为 'low'
5. WHEN 技能的 contextHints 数组为空，THE AIAssistantEngine.recommendSkills SHALL 为该技能返回中性评分 0.5

### 需求 7：导出功能边界场景

**用户故事：** 作为小说作者，我希望导出功能在各种内容条件下都能正常工作，不会生成损坏的文件。

#### 验收标准

1. WHEN 项目没有任何章节时用户尝试导出，THE 系统 SHALL 显示"没有可导出的章节"的提示，不生成空文件
2. WHEN 章节内容包含特殊字符（HTML 实体字符 <、>、&、"、'），THE ExportEngine SHALL 在 EPUB 导出时正确转义这些字符
3. WHEN 章节标题包含文件系统非法字符（/ \ : * ? " < > |），THE ExportEngine SHALL 在 TXT 导出时将这些字符替换为下划线
4. WHEN 章节内容包含 Markdown 标记，THE ExportEngine SHALL 在 PDF 和 TXT 导出时正确去除所有 Markdown 标记（标题、粗体、斜体、代码块、链接、图片、引用、列表）
5. WHEN PDF 导出过程中某个章节处理失败，THE ExportEngine SHALL 尝试保留已成功处理的章节内容作为 partialData 返回
6. WHEN EPUB 导出过程中某个章节处理失败，THE ExportEngine SHALL 尝试保留已成功处理的章节内容作为 partialData 返回
7. WHEN 导出的小说包含超过 100 个章节，THE ExportEngine SHALL 在合理时间内完成导出，不出现内存溢出

### 需求 8：版本快照边界场景

**用户故事：** 作为小说作者，我希望版本快照功能在存储空间不足等异常情况下能给出明确提示，不会丢失数据。

#### 验收标准

1. WHEN localStorage 存储空间不足（QuotaExceededError），THE SnapshotStore SHALL 抛出"存储空间不足，请删除旧快照后重试"的错误
2. WHEN 用户恢复快照，THE SnapshotStore SHALL 先自动创建当前状态的备份快照（note 为"恢复前自动备份"），然后返回目标快照数据的深拷贝
3. IF 恢复快照时自动备份失败，THEN THE SnapshotStore SHALL 中止恢复操作并抛出错误，确保当前数据不被覆盖
4. WHEN localStorage 中的快照数据损坏（JSON 解析失败或缺少必要字段），THE SnapshotStore SHALL 跳过损坏的条目，返回有效的快照列表
5. WHEN 用户删除快照后立即查看快照列表，THE SnapshotStore SHALL 返回不包含已删除快照的更新列表

### 需求 9：一致性检查边界场景

**用户故事：** 作为小说作者，我希望一致性检查不会产生误报，且能正确处理各种文本边界情况。

#### 验收标准

1. WHEN 章节内容为空字符串，THE ConsistencyEngine SHALL 返回空的问题列表，不抛出异常
2. WHEN 项目中没有角色，THE ConsistencyEngine SHALL 返回空的问题列表
3. WHEN 角色名长度为 1 个字符，THE ConsistencyEngine SHALL 跳过该角色名的检测（仅处理长度 ≥ 2 的名称）
4. WHEN 章节内容中包含角色名的精确匹配，THE ConsistencyEngine SHALL 不将其报告为问题
5. WHEN 候选文本包含某个精确角色名作为子串（如"张三走"包含"张三"），THE ConsistencyEngine SHALL 跳过该候选文本
6. WHEN 同一位置（offset）已报告过问题，THE ConsistencyEngine SHALL 不重复报告
7. WHEN 用户点击"一键修正"，THE ConsistencyEngine.applySuggestion SHALL 精确替换指定 offset 和 length 的文本，不影响其他位置的内容

### 需求 10：世界观自定义分类边界

**用户故事：** 作为小说作者，我希望自定义分类功能能防止重复命名和非法输入。

#### 验收标准

1. WHEN 用户尝试添加名称为空字符串或纯空格的自定义分类，THE WorldStore SHALL 抛出"分类名称不能为空"的错误
2. WHEN 用户尝试添加与内置分类同名的自定义分类（如"地点"），THE WorldStore SHALL 抛出"分类名称与内置分类重复"的错误
3. WHEN 用户尝试添加与已有自定义分类同名的分类，THE WorldStore SHALL 抛出"分类名称已存在"的错误
4. WHEN 用户删除自定义分类，THE WorldStore SHALL 将使用该分类的所有 WorldEntry 的 type 重置为 'rule'
5. WHEN WorldEntry 的 type 引用了不存在的分类 key，THE getCategoryInfo 函数 SHALL 返回 type 原始值作为 label，使用默认颜色，不抛出异常

### 需求 11：主题系统边界场景

**用户故事：** 作为小说作者，我希望主题切换在各种环境下都能正常工作。

#### 验收标准

1. WHEN localStorage 不可用（隐私模式或已满），THE ThemeStore SHALL 回退到 'system' 模式，不抛出异常
2. WHEN localStorage 中存储了无效的主题值（非 'light'/'dark'/'system'），THE ThemeStore SHALL 忽略无效值并回退到 'system'
3. WHEN 主题模式为 'system' 且 window.matchMedia 不可用，THE ThemeStore SHALL 默认返回 'light' 作为有效主题
4. FOR ALL 有效的 ThemeMode 值（'light'、'dark'、'system'），resolveEffectiveTheme 函数 SHALL 返回 'light' 或 'dark'，不返回其他值

### 需求 12：日更目标边界场景

**用户故事：** 作为小说作者，我希望日更目标在跨日和异常数据情况下都能正确计算。

#### 验收标准

1. WHEN 当前日期与基准日期相同，THE DailyGoalStore.getTodayWritten SHALL 返回 max(0, 当前总字数 - 基准字数)，不返回负数
2. WHEN 当前日期与基准日期不同（跨日），THE DailyGoalStore SHALL 重置基准日期为当前日期、基准字数为当前总字数，返回今日已写 0
3. WHEN 用户设置目标字数为负数，THE DailyGoalStore.setGoal SHALL 将目标字数钳制为 0
4. WHEN localStorage 中的日更配置数据损坏，THE DailyGoalStore SHALL 返回默认配置（goalWordCount: 0, baselineDate: '', baselineWordCount: 0）

### 需求 13：文件管理边界场景

**用户故事：** 作为小说作者，我希望文件操作在各种异常情况下都能给出明确提示。

#### 验收标准

1. WHEN 用户打开的 .novel 文件内容不是有效 JSON，THE FileManager SHALL 抛出"文件格式错误：无法解析 .novel 文件内容"的错误
2. WHEN 用户尝试重新打开最近项目但文件句柄已失效（HANDLE_NOT_FOUND），THE ProjectListPage SHALL 显示提示并回退到文件选择器
3. WHEN 用户拒绝文件读写权限（PERMISSION_DENIED），THE ProjectListPage SHALL 显示提示并回退到文件选择器
4. WHEN 用户在没有打开项目的情况下尝试保存，THE ProjectStore SHALL 抛出"没有打开的项目，无法保存"的错误
5. WHEN .novel 文件中的 Date 字段以 ISO 字符串形式存储，THE FileManager.deserialize SHALL 正确将 createdAt 和 updatedAt 恢复为 Date 对象

### 需求 14：编辑器状态管理边界

**用户故事：** 作为小说作者，我希望编辑器在各种操作场景下都能正确管理状态。

#### 验收标准

1. WHEN 用户未选择任何章节，THE WritingEditor SHALL 显示"请从左侧大纲选择一个章节开始写作"的提示，不初始化 CodeMirror 实例
2. WHEN 用户切换到另一个章节，THE WritingEditor SHALL 销毁当前 CodeMirror 实例并创建新实例，加载新章节的内容
3. WHEN 自动保存连续失败 3 次，THE WritingEditor SHALL 切换到手动保存模式并显示 Toast 提示
4. WHEN 自动保存失败但未达到 3 次，THE WritingEditor SHALL 在 10 秒后自动重试
5. WHEN 用户按 Ctrl+S（或 Cmd+S），THE WritingEditor SHALL 立即触发保存操作
6. WHEN 用户通过 AI 面板接受生成内容，THE WritingEditor.insertAtCursor SHALL 在当前光标位置插入内容；如果有选中文本，SHALL 替换选中文本

### 需求 15：Store 防御性拷贝一致性

**用户故事：** 作为开发者，我希望所有 Store 的读取操作都返回深拷贝数据，防止外部代码意外修改内部状态导致数据损坏。

#### 验收标准

1. THE ChapterStore.getChapter SHALL 返回章节数据的浅拷贝
2. THE CharacterStore.getCharacter SHALL 返回角色数据的深拷贝，包括 aliases 数组和 customAttributes 对象的独立副本
3. THE RelationshipStore.getRelationship SHALL 返回关系数据的拷贝
4. THE WorldStore.getEntry SHALL 返回世界观条目的深拷贝，包括 associatedCharacterIds 数组的独立副本
5. THE TimelineStore.getTimelinePoint SHALL 返回时间节点的深拷贝，包括 associatedChapterIds 和 associatedCharacterIds 数组的独立副本
6. THE PlotStore.getThread SHALL 返回情节线索的深拷贝，包括 associatedChapterIds 数组的独立副本
7. THE AIAssistantStore.getConfig SHALL 返回 AI 配置的深拷贝，包括 providers 和 promptTemplates 数组的独立副本
8. FOR ALL Store 的 list 方法（listChapters、listCharacters、listRelationships、listEntries、listTimelinePoints、listThreads），返回的数组中每个元素 SHALL 为独立拷贝

### 需求 16：技能解析器往返一致性

**用户故事：** 作为开发者，我希望技能的序列化和反序列化是可逆的，不会在导入导出过程中丢失数据。

#### 验收标准

1. FOR ALL 有效的 WritingSkill 对象，parseSkillMarkdown(serializeSkillToMarkdown(skill)) SHALL 产生与原始 skill 语义等价的对象（id、name、icon、description、promptTemplate、parameters、contextHints、sortOrder、enabled 字段一致）
2. WHEN 技能 Markdown 文件缺少 YAML frontmatter 分隔符（---），THE parseSkillMarkdown SHALL 抛出包含"缺少 YAML frontmatter"描述的错误
3. WHEN YAML frontmatter 中 id 和 name 都为空，THE validateSkillFrontmatter SHALL 返回验证失败，errors 包含"id 和 name 至少需要一个非空字段"
4. WHEN parameters 中某个参数的 type 不是 'text'/'number'/'select'，THE validateSkillFrontmatter SHALL 返回验证失败
5. WHEN contextHints 中某个条件的 signal 不在有效信号列表中，THE validateSkillFrontmatter SHALL 返回验证失败
6. FOR ALL 有效的 WritingSkill 对象（含 references），parseSkillZip(serializeSkillToZip(skill)) SHALL 产生与原始 skill 语义等价的对象

### 需求 17：AI 历史记录边界

**用户故事：** 作为小说作者，我希望 AI 历史记录在存储异常情况下不会影响正常使用。

#### 验收标准

1. WHEN AI 历史记录超过 50 条，THE AIAssistantStore SHALL 删除最早的记录，保持总数不超过 50
2. WHEN localStorage 中的历史记录数据损坏（非数组），THE AIAssistantStore SHALL 清除损坏数据并返回空列表
3. WHEN localStorage 写入失败（空间不足），THE AIAssistantStore SHALL 静默降级，不影响 AI 生成功能
4. THE AIAssistantStore.listHistory SHALL 返回按时间倒序排列的记录（最新的在前）
5. WHEN 用户清除历史记录，THE AIAssistantStore.clearHistory SHALL 从 localStorage 中移除该项目的所有历史数据

### 需求 18：空状态与加载状态 UI 完整性

**用户故事：** 作为小说作者，我希望在数据为空或加载中时看到有意义的提示，而不是空白页面。

#### 验收标准

1. WHILE 项目中没有章节，THE OutlineTab SHALL 显示"暂无章节，点击下方按钮添加"的提示文本
2. WHILE 项目中没有角色，THE CharacterTab SHALL 显示"暂无角色，点击下方按钮添加"的提示文本
3. WHILE 项目中没有世界观条目，THE WorldTab SHALL 显示"暂无世界观条目，点击下方按钮添加"的提示文本
4. WHILE 项目中没有时间节点，THE TimelineTab SHALL 显示"暂无时间节点，点击下方按钮添加"的提示文本
5. WHILE 项目中没有情节线索，THE PlotTab SHALL 显示"暂无情节线索，点击下方按钮添加"的提示文本
6. WHILE 右侧面板未选择任何实体，THE EditorRightPanel SHALL 显示"请选择一个[角色/世界观条目/时间节点]"的提示
7. WHILE AI 正在生成内容且结果区域为空，THE AIAssistantPanel SHALL 显示"AI 正在生成内容..."的加载指示器
8. WHILE 项目列表为空（无最近项目），THE ProjectListPage SHALL 显示空状态插图和"暂无项目，点击新建开始写作"的提示
9. WHEN 角色详情面板引用的角色 ID 不存在，THE CharacterDetailPanel SHALL 显示"角色未找到"的提示
10. WHEN 世界观详情面板引用的条目 ID 不存在，THE WorldDetailPanel SHALL 显示"条目未找到"的提示
11. WHEN 时间线详情面板引用的节点 ID 不存在，THE TimelineDetailPanel SHALL 显示"时间节点未找到"的提示

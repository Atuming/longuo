# 需求文档：小说辅助编辑器（Novel Assistant Editor）

## 简介

小说辅助编辑器是一个面向小说作者的一站式写作工具。它提供章节管理、角色与世界观数据库、角色社会关系图谱、时间线管理、富文本写作编辑器、AI 辅助写作、智能辅助检查以及多格式导出功能，帮助作者高效地组织、撰写和发布小说作品。AI 辅助写作功能允许作者将草稿、大纲或想法结合小说上下文交由可配置的 AI 模型润色生成高质量段落。角色数据库支持社会关系属性和时间线关联，配合可视化关系图谱和独立的时间线管理模块，帮助作者把控复杂的人物关系网络和因果脉络。

## 术语表

- **Editor（编辑器）**: 小说辅助编辑器应用的核心系统
- **Chapter_Manager（章节管理器）**: 负责小说章节结构组织与排序的模块
- **Character_Database（角色数据库）**: 集中存储和管理小说角色设定信息的模块，包括角色属性、社会关系和时间线变化
- **Relationship_Graph（关系图谱）**: 以可视化图谱形式展示角色之间社会关系网络的模块，支持按时间线切换关系状态
- **Character_Relationship（角色关系）**: 描述两个角色之间社会关系的数据结构，包含关系类型、关系描述、起止时间和关系强度
- **Timeline_Point（时间节点）**: 小说故事中的一个特定时间点或时间段，用于标记角色属性和关系的变化
- **World_Database（世界观数据库）**: 集中存储和管理故事背景设定、地点、势力/组织等世界观规则的模块
- **Timeline_Manager（时间线管理器）**: 集中管理 Timeline_Point 定义和时间线事件的模块，维护统一的时间节点列表供 Character_Database 和 Relationship_Graph 共同引用
- **Writing_Editor（写作编辑器）**: 提供富文本或 Markdown 编辑能力的写作区域
- **Consistency_Checker（一致性检查器）**: 自动检测角色名称、设定等一致性问题的智能模块
- **Plot_Tracker（情节追踪器）**: 追踪和可视化小说情节线索的模块
- **Export_Engine（导出引擎）**: 将小说内容导出为多种格式的模块
- **Novel_Project（小说项目）**: 包含一部小说所有章节、角色、世界观数据的完整项目单元
- **Outline_View（大纲视图）**: 以树形结构展示小说章节层级的视图
- **AI_Assistant（AI 辅助助手）**: 根据作者提供的草稿、大纲或想法，结合小说上下文自动生成润色段落的模块，通过浏览器直接调用外部 AI 模型 API
- **AI_Config（AI 配置）**: 存储 AI 模型提供商、API Key、模型名称、API 端点和自定义 Prompt 模板等配置信息的数据结构
- **Context_Packer（上下文打包器）**: 负责收集当前章节内容、前后章节摘要、相关角色信息、世界观背景和时间线上下文，将其组装为结构化 Prompt 的子模块

## 需求

### 需求 1：小说项目管理

**用户故事：** 作为一名小说作者，我希望能够创建和管理小说项目，以便集中组织一部小说的所有内容。

#### 验收标准

1. WHEN 作者点击"新建项目"按钮, THE Editor SHALL 创建一个包含项目名称、简介和创建时间的 Novel_Project
2. WHEN 作者打开一个已有的 Novel_Project, THE Editor SHALL 加载该项目的所有章节、角色和世界观数据
3. THE Editor SHALL 在项目列表中显示所有已创建的 Novel_Project，包括项目名称、最后修改时间和总字数
4. WHEN 作者选择删除一个 Novel_Project, THE Editor SHALL 显示确认对话框，确认后永久删除该项目及其所有关联数据

### 需求 2：章节管理

**用户故事：** 作为一名小说作者，我希望能够像大纲一样组织小说的章节结构，以便清晰地规划和调整故事脉络。

#### 验收标准

1. WHEN 作者点击"添加章节"按钮, THE Chapter_Manager SHALL 在 Outline_View 中创建一个新章节节点，包含章节标题和排序位置
2. THE Chapter_Manager SHALL 支持多级章节层级结构（卷 > 章 > 节），在 Outline_View 中以树形结构展示
3. WHEN 作者拖拽一个章节节点到新位置, THE Chapter_Manager SHALL 更新该章节及受影响章节的排序位置
4. WHEN 作者双击章节标题, THE Chapter_Manager SHALL 进入标题编辑模式，允许作者修改章节标题
5. WHEN 作者选择删除一个章节, THE Chapter_Manager SHALL 显示确认对话框，确认后删除该章节及其所有子章节
6. THE Outline_View SHALL 在每个章节节点旁显示该章节的字数统计

### 需求 3：角色数据库

**用户故事：** 作为一名小说作者，我希望能够集中管理所有角色的设定信息，包括角色的社会关系和随时间变化的属性，以便写作时随时查阅，保持角色一致性和关系脉络的清晰。

#### 验收标准

1. WHEN 作者点击"添加角色"按钮, THE Character_Database SHALL 创建一个新角色条目，包含姓名、别名、外貌描述、性格特征、背景故事和社会关系列表字段
2. THE Character_Database SHALL 提供角色搜索功能，支持按姓名、别名或关系类型进行模糊匹配
3. WHEN 作者编辑角色信息并保存, THE Character_Database SHALL 持久化存储更新后的角色数据
4. WHILE 作者在 Writing_Editor 中编辑章节内容, THE Character_Database SHALL 以侧边栏形式提供角色信息的快速查阅面板
5. WHEN 作者选择删除一个角色, THE Character_Database SHALL 显示确认对话框，确认后删除该角色条目及其所有关联的 Character_Relationship 数据
6. THE Character_Database SHALL 支持为角色添加自定义属性字段，以适应不同类型小说的角色设定需求
7. WHEN 作者为角色添加社会关系, THE Character_Database SHALL 创建一条 Character_Relationship 记录，包含目标角色、关系类型（亲属、朋友、敌人、师徒、恋人、同盟、上下级等）、关系描述和关系起始 Timeline_Point
8. THE Character_Database SHALL 支持为同一对角色在不同 Timeline_Point 设定不同的关系类型和关系描述，以反映关系随时间的演变
9. WHEN 作者为角色指定一个 Timeline_Point, THE Character_Database SHALL 显示该角色在该时间节点的属性快照，包括当时的外貌描述、性格特征和所有社会关系状态
10. THE Character_Database SHALL 支持为角色的背景故事关联多个 Timeline_Point，以时间轴形式展示角色的成长经历和重要事件
11. WHEN 作者修改角色在某个 Timeline_Point 的属性, THE Character_Database SHALL 仅更新该时间节点的属性值，保留其他时间节点的属性不变

### 需求 3.1：角色社会关系图谱

**用户故事：** 作为一名小说作者，我希望能够以可视化图谱的形式查看所有角色之间的社会关系网络，并能按时间线切换查看不同时期的关系状态，以便把控复杂的人物因果关系。

#### 验收标准

1. THE Relationship_Graph SHALL 以节点-连线图的形式展示所有角色及其之间的 Character_Relationship，每个角色为一个节点，每条关系为一条连线
2. THE Relationship_Graph SHALL 在连线上标注关系类型和关系描述，使用不同颜色或线型区分不同关系类型（亲属、朋友、敌人、师徒、恋人、同盟、上下级等）
3. WHEN 作者选择一个 Timeline_Point, THE Relationship_Graph SHALL 仅展示在该时间节点有效的 Character_Relationship，隐藏尚未建立或已终止的关系
4. THE Relationship_Graph SHALL 提供时间线滑块控件，允许作者拖动滑块在不同 Timeline_Point 之间切换，实时更新图谱中的关系展示
5. WHEN 作者点击图谱中的角色节点, THE Relationship_Graph SHALL 高亮显示该角色的所有直接关系连线，并在侧边面板中显示该角色在当前 Timeline_Point 的详细信息
6. WHEN 作者点击图谱中的关系连线, THE Relationship_Graph SHALL 在侧边面板中显示该关系的完整时间演变历史，包括每个 Timeline_Point 的关系类型和描述变化
7. THE Relationship_Graph SHALL 支持按关系类型筛选显示，允许作者选择仅查看特定类型的关系（如仅查看"敌人"关系）
8. WHEN 作者在 Relationship_Graph 中直接连线两个角色节点, THE Relationship_Graph SHALL 弹出关系创建表单，创建的 Character_Relationship 同步写入 Character_Database
9. THE Relationship_Graph SHALL 支持缩放和拖拽操作，以便作者在角色数量较多时浏览完整的关系网络
10. THE Relationship_Graph SHALL 与 Timeline_Manager 中的时间线事件数据保持同步，使用相同的 Timeline_Point 定义确保时间线一致性

### 需求 4：世界观数据库

**用户故事：** 作为一名小说作者，我希望能够管理小说的世界观背景设定（地点、势力/组织、世界规则等），以便构建一致且丰富的故事世界。

#### 验收标准

1. WHEN 作者点击"添加设定"按钮, THE World_Database SHALL 创建一个新的世界观条目，支持"地点"、"势力/组织"和"背景设定/规则"三种类型
2. THE World_Database SHALL 为每种类型提供对应的结构化字段（地点：名称、描述、关联角色；势力/组织：名称、描述、成员角色；背景设定/规则：名称、类别、描述内容）
3. WHEN 作者编辑世界观条目并保存, THE World_Database SHALL 持久化存储更新后的数据
4. THE World_Database SHALL 提供按类型筛选和按名称搜索的功能
5. WHILE 作者在 Writing_Editor 中编辑章节内容, THE World_Database SHALL 以侧边栏形式提供世界观信息的快速查阅面板
6. THE World_Database SHALL 支持为世界观条目关联相关角色，以便作者查看角色与地点、势力之间的归属关系

### 需求 4.1：时间线管理

**用户故事：** 作为一名小说作者，我希望能够独立管理小说的时间线和事件节点，以便直观地把控故事的时间脉络，并与角色数据库和关系图谱保持时间一致性。

#### 验收标准

1. WHEN 作者点击"添加时间节点"按钮, THE Timeline_Manager SHALL 创建一个新的 Timeline_Point，包含时间标签、事件描述、关联章节和关联角色字段
2. THE Timeline_Manager SHALL 以时间轴可视化视图展示所有 Timeline_Point，按时间先后顺序排列，使作者能直观查看事件的先后关系
3. WHEN 作者编辑一个 Timeline_Point 并保存, THE Timeline_Manager SHALL 持久化存储更新后的时间节点数据
4. WHEN 作者选择删除一个 Timeline_Point, THE Timeline_Manager SHALL 显示确认对话框，列出该时间节点被 Character_Database 和 Relationship_Graph 引用的情况，确认后删除该时间节点
5. THE Timeline_Manager SHALL 提供时间线滑块控件，允许作者拖动滑块在不同 Timeline_Point 之间切换，联动更新 Character_Database 和 Relationship_Graph 的时间视图
6. THE Timeline_Manager SHALL 维护统一的 Timeline_Point 定义列表，供 Character_Database 和 Relationship_Graph 共同引用，确保全局时间线一致性
7. WHEN 作者在 Timeline_Manager 中创建或修改一个 Timeline_Point, THE Timeline_Manager SHALL 同步通知 Character_Database 和 Relationship_Graph 更新相关的时间节点引用
8. THE Timeline_Manager SHALL 支持按关联章节或关联角色筛选 Timeline_Point，方便作者查看特定角色或章节相关的时间线事件
9. WHEN 作者在时间轴视图中拖拽一个 Timeline_Point 到新位置, THE Timeline_Manager SHALL 更新该时间节点的时间顺序并刷新可视化视图

### 需求 5：写作编辑器

**用户故事：** 作为一名小说作者，我希望拥有一个专注、流畅的写作环境，以便高效地撰写小说内容。

#### 验收标准

1. WHEN 作者在 Outline_View 中点击一个章节, THE Writing_Editor SHALL 打开该章节的内容进行编辑
2. THE Writing_Editor SHALL 支持 Markdown 格式的文本编辑，包括标题、加粗、斜体、引用和分隔线
3. THE Writing_Editor SHALL 实时显示当前章节的字数统计
4. WHEN 作者激活专注模式, THE Writing_Editor SHALL 隐藏侧边栏和工具栏，仅显示编辑区域和字数统计
5. WHEN 作者编辑章节内容, THE Writing_Editor SHALL 每 30 秒自动保存一次编辑内容
6. IF 自动保存失败, THEN THE Writing_Editor SHALL 在编辑器顶部显示保存失败的提示信息，并在 10 秒后重试保存
7. THE Writing_Editor SHALL 支持撤销和重做操作，保留最近 50 步操作历史

### 需求 6：智能一致性检查

**用户故事：** 作为一名小说作者，我希望系统能自动检查角色名称和设定的一致性，以便减少写作中的疏漏和错误。

#### 验收标准

1. WHEN 作者触发一致性检查, THE Consistency_Checker SHALL 扫描当前章节内容，将文中出现的角色名称与 Character_Database 中的记录进行比对
2. WHEN Consistency_Checker 检测到文中出现与已有角色名称相似但不完全匹配的文本, THE Consistency_Checker SHALL 以高亮标注的形式提示作者，并提供已有角色名称作为修正建议
3. WHEN 作者接受一个修正建议, THE Consistency_Checker SHALL 将文中对应的文本替换为建议的角色名称
4. WHEN 作者忽略一个检查结果, THE Consistency_Checker SHALL 将该结果标记为"已忽略"，后续检查不再重复提示相同位置的相同问题
5. THE Consistency_Checker SHALL 在检查完成后显示检查结果摘要，包括发现的问题数量和已修正的数量

### 需求 7：情节线索追踪

**用户故事：** 作为一名小说作者，我希望能够追踪和管理小说中的情节线索，以便确保所有伏笔都得到回收，故事逻辑完整。

#### 验收标准

1. WHEN 作者点击"添加线索"按钮, THE Plot_Tracker SHALL 创建一个新的情节线索条目，包含线索名称、描述和状态（未展开/进行中/已回收）
2. THE Plot_Tracker SHALL 支持将情节线索关联到具体的章节，记录线索在哪些章节中被提及或推进
3. THE Plot_Tracker SHALL 以列表视图展示所有情节线索及其当前状态
4. WHEN 作者修改线索状态, THE Plot_Tracker SHALL 更新线索状态并持久化存储
5. THE Plot_Tracker SHALL 提供按状态筛选线索的功能，方便作者快速查看所有"未展开"或"进行中"的线索

### 需求 8：导出功能

**用户故事：** 作为一名小说作者，我希望能够将小说导出为多种常见格式，以便在不同平台上发布或分享作品。

#### 验收标准

1. WHEN 作者选择导出并指定 PDF 格式, THE Export_Engine SHALL 将 Novel_Project 的所有章节内容按章节顺序生成一个 PDF 文件
2. WHEN 作者选择导出并指定 EPUB 格式, THE Export_Engine SHALL 将 Novel_Project 的所有章节内容按章节顺序生成一个 EPUB 文件，包含目录导航
3. WHEN 作者选择导出并指定 Markdown 格式, THE Export_Engine SHALL 将 Novel_Project 的所有章节内容按章节顺序合并为一个 Markdown 文件
4. THE Export_Engine SHALL 在导出的文件中包含小说标题、作者名称和目录信息
5. IF 导出过程中发生错误, THEN THE Export_Engine SHALL 显示具体的错误信息，并保留已生成的部分内容供作者下载
6. FOR ALL 有效的 Novel_Project 数据, 导出为 Markdown 后再解析回结构化数据 SHALL 产生与原始章节内容等价的结果（往返一致性）
7. WHEN 作者选择导出并指定"按章节 TXT"格式, THE Export_Engine SHALL 为每个章节生成一个独立的 TXT 文件，文件名为该章节的标题，内容为去除 Markdown 标记后的纯文本
8. WHEN Export_Engine 完成所有章节的 TXT 文件生成, THE Export_Engine SHALL 将所有 TXT 文件打包为一个 ZIP 文件供作者下载
9. WHEN 章节标题包含文件系统非法字符（如 / \ : * ? " < > |）, THE Export_Engine SHALL 将非法字符替换为下划线后作为 TXT 文件名
10. THE Export_Engine SHALL 在按章节 TXT 导出时完整去除 Markdown 标记（包括标题符号、加粗、斜体、引用、分隔线等），输出纯文本内容


### 需求 9：AI 辅助写作

**用户故事：** 作为一名小说作者，我希望在文笔不足但有想法时，能够借助 AI 将我的草稿、大纲或想法润色为高质量的段落，并且能够自由配置所使用的 AI 模型，以便高效地将创意转化为优质文本。

#### 验收标准

1. WHEN 作者在 Writing_Editor 中选中文本或将光标置于段落中并触发"AI 辅助"功能, THE AI_Assistant SHALL 显示一个输入面板，允许作者输入草稿内容、写作意图或具体指令
2. WHEN 作者提交 AI 辅助请求, THE Context_Packer SHALL 自动收集当前章节内容、前后章节摘要、当前章节涉及的角色信息、相关世界观背景设定和时间线上下文，将其与作者输入组装为结构化的 Prompt
3. WHEN Context_Packer 完成 Prompt 组装, THE AI_Assistant SHALL 通过浏览器直接向配置的 AI 模型 API 端点发送 HTTP 请求，并以流式方式实时显示生成结果
4. WHEN AI 模型返回生成结果, THE AI_Assistant SHALL 在预览区域展示生成的段落，并提供"接受"、"修改"和"重新生成"三个操作选项
5. WHEN 作者点击"接受", THE AI_Assistant SHALL 将生成的段落插入到 Writing_Editor 中光标所在位置或替换选中的文本
6. WHEN 作者点击"重新生成", THE AI_Assistant SHALL 使用相同的上下文重新调用 AI 模型 API 生成新的段落
7. THE AI_Config SHALL 支持配置 AI 模型提供商名称、API Key、模型名称、API 端点 URL 和请求超时时间
8. THE AI_Config SHALL 支持配置多个 AI 模型提供商，并允许作者在提供商之间切换当前使用的模型
9. THE AI_Config SHALL 支持自定义 Prompt 模板，允许作者定义 Prompt 的结构和内容格式，模板中可使用占位符引用上下文变量（如 {chapter_content}、{character_info}、{world_setting}）
10. THE AI_Config SHALL 将所有配置信息持久化存储在 Novel_Project 的 `.novel` 文件中
11. IF AI 模型 API 调用失败（网络错误、认证失败、超时等）, THEN THE AI_Assistant SHALL 显示具体的错误信息，并保留作者的原始输入内容以便重试
12. IF AI 模型 API Key 未配置或为空, THEN THE AI_Assistant SHALL 提示作者前往设置页面配置 AI 模型信息，不发送任何请求

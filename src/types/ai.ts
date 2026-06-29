/** AI 模型提供商配置 */
export interface AIProvider {
  id: string;
  name: string;
  apiKey: string;
  modelName: string;
  apiEndpoint: string;
  timeoutMs: number;
  /** 温度参数 (0.0-2.0)，控制输出的随机性和创造性。创意写作建议 0.7-0.9 */
  temperature?: number;
  /** 最大输出 token 数，0 表示不限制 */
  maxTokens?: number;
  /** 核采样参数 (0.0-1.0)，与 temperature 二选一使用，通常保持 1.0 */
  topP?: number;
  /** 存在惩罚 (-2.0-2.0)，正值减少重复话题 */
  presencePenalty?: number;
  /** 频率惩罚 (-2.0-2.0)，正值减少用词重复 */
  frequencyPenalty?: number;
}

/** 写作风格配置 */
export interface WritingStyle {
  /** 是否启用写作风格注入 */
  enabled: boolean;
  /** 小说流派：xianxia/wuxia/xuanhuan/urban/scifi/history/fantasy/mystery/romance/other */
  genre: string;
  /** 自定义流派名称（当 genre 为 other 时使用） */
  genreCustom: string;
  /** 叙事人称：first/third-omniscient/third-limited */
  narrativePov: string;
  /** 语言风格：classical/modern/colloquial/literary/minimalist */
  languageStyle: string;
  /** 整体基调：serious/light/dark/tragic/warm/suspenseful */
  tone: string;
  /** 额外风格描述（自由文本，将原样注入 Prompt） */
  customNotes: string;
}

/** 默认写作风格 */
export const DEFAULT_WRITING_STYLE: WritingStyle = {
  enabled: false,
  genre: 'xuanhuan',
  genreCustom: '',
  narrativePov: 'third-limited',
  languageStyle: 'modern',
  tone: 'serious',
  customNotes: '',
};

/** 流派选项 */
export const GENRE_OPTIONS: { value: string; label: string }[] = [
  { value: 'xianxia', label: '仙侠' },
  { value: 'wuxia', label: '武侠' },
  { value: 'xuanhuan', label: '玄幻' },
  { value: 'urban', label: '都市' },
  { value: 'scifi', label: '科幻' },
  { value: 'history', label: '历史' },
  { value: 'fantasy', label: '奇幻' },
  { value: 'mystery', label: '悬疑' },
  { value: 'romance', label: '言情' },
  { value: 'other', label: '其他' },
];

/** 叙事人称选项 */
export const POV_OPTIONS: { value: string; label: string }[] = [
  { value: 'first', label: '第一人称' },
  { value: 'third-limited', label: '第三人称限知' },
  { value: 'third-omniscient', label: '第三人称全知' },
];

/** 语言风格选项 */
export const LANGUAGE_STYLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'classical', label: '古风典雅' },
  { value: 'modern', label: '现代流畅' },
  { value: 'colloquial', label: '口语化/接地气' },
  { value: 'literary', label: '文学性强' },
  { value: 'minimalist', label: '极简白描' },
];

/** 基调选项 */
export const TONE_OPTIONS: { value: string; label: string }[] = [
  { value: 'serious', label: '严肃正剧' },
  { value: 'light', label: '轻松诙谐' },
  { value: 'dark', label: '暗黑压抑' },
  { value: 'tragic', label: '悲壮感人' },
  { value: 'warm', label: '温馨治愈' },
  { value: 'suspenseful', label: '紧张悬疑' },
];

/** Prompt 模板 */
export interface PromptTemplate {
  id: string;
  name: string;
  systemPrompt: string;
  userPromptTemplate: string;
}

/** AI 配置（存储在 .novel 文件中） */
export interface AIConfig {
  providers: AIProvider[];
  activeProviderId: string | null;
  promptTemplates: PromptTemplate[];
  activeTemplateId: string | null;
  defaultTemplate: PromptTemplate;
  writingStyle: WritingStyle;
}

/** 上下文打包结果 */
export interface PackedContext {
  chapterContent: string;
  prevChapterSummary: string;
  nextChapterSummary: string;
  characterInfo: string;
  worldSetting: string;
  timelineContext: string;
  /** 用户当前选中的文本段落（用于聚焦改写/润色范围） */
  selectedText: string;
  /** 写作风格的文字摘要（用于 Prompt 注入） */
  writingStyleSummary: string;
}

/** AI 生成请求 */
export interface AIGenerateRequest {
  userInput: string;
  chapterId: string;
  selectionRange?: { start: number; end: number };
  /** 用户当前选中的文本（聚焦改写/润色范围） */
  selectedText?: string;
  /** 多轮对话历史消息（不含 system prompt） */
  conversationHistory?: ConversationMessage[];
}

/** 多轮对话消息 */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** AI 生成结果 */
export interface AIGenerateResult {
  success: boolean;
  content?: string;
  error?: string;
  cancelled?: boolean;
  /** 截断标记：流式中断但拿到部分内容 */
  truncated?: boolean;
  /** Token 用量统计 */
  tokenUsage?: TokenUsage;
}

/** Token 用量统计 */
export interface TokenUsage {
  /** 估计的输入 token 数 */
  estimatedInputTokens: number;
  /** 模型上下文限制 */
  contextLimit: number;
  /** 使用比例 */
  usageRatio: number;
}

/** AI 一致性检查报告 */
export interface ConsistencyReport {
  issues: ConsistencyReportIssue[];
  summary: string;
  checkedAt: string;
}

/** 一致性检查问题 */
export interface ConsistencyReportIssue {
  id: string;
  category: 'character' | 'timeline' | 'plot' | 'world' | 'naming';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  location?: string;
  suggestion: string;
}

/** AI 生成结果 */
export interface AIGenerateResult {
  success: boolean;
  content?: string;
  error?: string;
  cancelled?: boolean;
}

/** AI 历史记录 */
export interface AIHistoryRecord {
  id: string;
  projectId: string;
  timestamp: string;           // ISO 8601
  skillLabel: string;
  userInput: string;
  generatedContent: string;
  /** 多轮对话历史（如果有） */
  conversationHistory?: ConversationMessage[];
  /** Token 用量 */
  tokenUsage?: TokenUsage;
}

/** 技能参数定义 */
export interface SkillParameter {
  key: string;                 // 用于 {param:key} 占位符
  label: string;               // 显示名称（如 "角色A"）
  type: 'text' | 'number' | 'select';
  source?: 'characters';       // 从项目角色列表动态填充（仅 select 类型）
  options?: string[];          // 静态选项（仅 select 类型，source 未设置时）
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;          // 默认 false
}

/** 上下文推荐条件 */
export interface ContextHint {
  signal: 'wordCount' | 'hasDialogue' | 'isNearEnd' | 'hasCharacters' | 'hasWorldEntries';
  condition: 'low' | 'high' | 'true' | 'false';
  weight?: number;             // 评分权重，默认 1.0
}

/** 技能参考资料 */
export interface SkillReference {
  filename: string;            // 如 "platform-style-guide.md"
  content: string;             // 文件完整文本
}

/** 写作技能定义 */
export interface WritingSkill {
  id: string;                  // 内置技能使用稳定 ID，自定义使用 UUID
  name: string;                // 如 "续写"
  icon: string;                // emoji，如 "✍️"
  description: string;         // 简短描述
  promptTemplate: string;      // 可包含 {param:key} 占位符
  parameters: SkillParameter[];
  contextHints: ContextHint[];
  sortOrder: number;
  builtIn: boolean;
  enabled: boolean;
  license?: string;            // 许可证，如 "MIT"
  version?: string;            // 语义化版本号
  slug?: string;               // URL 友好的短标识
  references?: SkillReference[]; // 参考资料列表
}

/** 章节上下文分析信号 */
export interface ContextSignals {
  wordCount: number;
  hasDialogue: boolean;
  isNearEnd: boolean;
  hasCharacters: boolean;
  hasWorldEntries: boolean;
}

/** 评分后的技能（用于推荐） */
export interface ScoredSkill {
  skill: WritingSkill;
  score: number;               // 0.0 - 1.0
  matchedSignals: string[];
}

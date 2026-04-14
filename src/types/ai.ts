/** AI 模型提供商配置 */
export interface AIProvider {
  id: string;
  name: string;
  apiKey: string;
  modelName: string;
  apiEndpoint: string;
  timeoutMs: number;
}

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
}

/** 上下文打包结果 */
export interface PackedContext {
  chapterContent: string;
  prevChapterSummary: string;
  nextChapterSummary: string;
  characterInfo: string;
  worldSetting: string;
  timelineContext: string;
}

/** AI 生成请求 */
export interface AIGenerateRequest {
  userInput: string;
  chapterId: string;
  selectionRange?: { start: number; end: number };
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

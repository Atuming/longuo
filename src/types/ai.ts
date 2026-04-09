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
}

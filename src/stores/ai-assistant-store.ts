import type { AIAssistantStore } from '../types/stores';
import type { AIConfig, AIProvider, PromptTemplate } from '../types/ai';

/** 内置默认中文小说写作 Prompt 模板 */
export const DEFAULT_PROMPT_TEMPLATE: PromptTemplate = {
  id: 'default',
  name: '默认中文小说写作模板',
  systemPrompt:
    '你是一位资深的中文小说写作助手。请根据提供的小说上下文信息，帮助作者润色和扩展内容。' +
    '保持与已有章节风格一致，注意角色性格和世界观设定的连贯性。\n\n' +
    '当前章节内容：\n{chapter_content}\n\n' +
    '前一章摘要：\n{prev_chapter_summary}\n\n' +
    '后一章摘要：\n{next_chapter_summary}\n\n' +
    '相关角色信息：\n{character_info}\n\n' +
    '世界观背景：\n{world_setting}\n\n' +
    '时间线上下文：\n{timeline_context}',
  userPromptTemplate:
    '请根据以上小说上下文，按照以下要求生成或润色段落：\n\n{user_input}',
};

/** 创建默认 AIConfig */
function createDefaultConfig(overrides?: Partial<AIConfig>): AIConfig {
  return {
    providers: [],
    activeProviderId: null,
    promptTemplates: [],
    activeTemplateId: null,
    defaultTemplate: { ...DEFAULT_PROMPT_TEMPLATE },
    ...overrides,
  };
}

/** 深拷贝 AIProvider */
function cloneProvider(p: AIProvider): AIProvider {
  return { ...p };
}

/** 深拷贝 PromptTemplate */
function cloneTemplate(t: PromptTemplate): PromptTemplate {
  return { ...t };
}

/** 深拷贝 AIConfig */
function cloneConfig(config: AIConfig): AIConfig {
  return {
    providers: config.providers.map(cloneProvider),
    activeProviderId: config.activeProviderId,
    promptTemplates: config.promptTemplates.map(cloneTemplate),
    activeTemplateId: config.activeTemplateId,
    defaultTemplate: cloneTemplate(config.defaultTemplate),
  };
}

const STORAGE_KEY = 'novel-assistant-ai-config';

/** 将 AIConfig 保存到 localStorage（会话内覆盖） */
function persistToLocalStorage(config: AIConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cloneConfig(config)));
  } catch {
    // localStorage 不可用或已满，静默忽略
  }
}

/**
 * 从 public/ai-config.json 加载配置（始终作为权威数据源）
 */
export async function loadDefaultAIConfig(): Promise<Partial<AIConfig> | null> {
  try {
    const res = await fetch('./ai-config.json');
    if (!res.ok) return null;
    const data = await res.json();
    return data as Partial<AIConfig>;
  } catch {
    return null;
  }
}

/**
 * 创建 AIAssistantStore 实例。
 * 配置优先级：ai-config.json（通过 loadDefaultAIConfig 加载后 updateConfig 注入）
 * UI 修改存 localStorage 作为会话内覆盖，重启后以配置文件为准。
 */
export function createAIAssistantStore(initialConfig?: AIConfig): AIAssistantStore {
  const config: AIConfig = initialConfig
    ? cloneConfig(initialConfig)
    : createDefaultConfig();

  return {
    getConfig(): AIConfig {
      return cloneConfig(config);
    },

    updateConfig(updates: Partial<AIConfig>): void {
      if (updates.providers !== undefined) {
        config.providers = updates.providers.map(cloneProvider);
      }
      if (updates.activeProviderId !== undefined) {
        config.activeProviderId = updates.activeProviderId;
      }
      if (updates.promptTemplates !== undefined) {
        config.promptTemplates = updates.promptTemplates.map(cloneTemplate);
      }
      if (updates.activeTemplateId !== undefined) {
        config.activeTemplateId = updates.activeTemplateId;
      }
      if (updates.defaultTemplate !== undefined) {
        config.defaultTemplate = cloneTemplate(updates.defaultTemplate);
      }
      persistToLocalStorage(config);
    },

    addProvider(data: Omit<AIProvider, 'id'>): AIProvider {
      const provider: AIProvider = {
        id: crypto.randomUUID(),
        name: data.name,
        apiKey: data.apiKey,
        modelName: data.modelName,
        apiEndpoint: data.apiEndpoint,
        timeoutMs: data.timeoutMs,
      };
      config.providers.push(provider);
      persistToLocalStorage(config);
      return cloneProvider(provider);
    },

    updateProvider(id: string, updates: Partial<Omit<AIProvider, 'id'>>): void {
      const provider = config.providers.find((p) => p.id === id);
      if (!provider) return;
      if (updates.name !== undefined) provider.name = updates.name;
      if (updates.apiKey !== undefined) provider.apiKey = updates.apiKey;
      if (updates.modelName !== undefined) provider.modelName = updates.modelName;
      if (updates.apiEndpoint !== undefined) provider.apiEndpoint = updates.apiEndpoint;
      if (updates.timeoutMs !== undefined) provider.timeoutMs = updates.timeoutMs;
      persistToLocalStorage(config);
    },

    deleteProvider(id: string): void {
      config.providers = config.providers.filter((p) => p.id !== id);
      if (config.activeProviderId === id) {
        config.activeProviderId = null;
      }
      persistToLocalStorage(config);
    },

    setActiveProvider(id: string): void {
      const exists = config.providers.some((p) => p.id === id);
      if (exists) {
        config.activeProviderId = id;
        persistToLocalStorage(config);
      }
    },

    getActiveProvider(): AIProvider | null {
      if (!config.activeProviderId) return null;
      const provider = config.providers.find((p) => p.id === config.activeProviderId);
      return provider ? cloneProvider(provider) : null;
    },

    addTemplate(data: Omit<PromptTemplate, 'id'>): PromptTemplate {
      const template: PromptTemplate = {
        id: crypto.randomUUID(),
        name: data.name,
        systemPrompt: data.systemPrompt,
        userPromptTemplate: data.userPromptTemplate,
      };
      config.promptTemplates.push(template);
      persistToLocalStorage(config);
      return cloneTemplate(template);
    },

    updateTemplate(id: string, updates: Partial<Omit<PromptTemplate, 'id'>>): void {
      const template = config.promptTemplates.find((t) => t.id === id);
      if (!template) return;
      if (updates.name !== undefined) template.name = updates.name;
      if (updates.systemPrompt !== undefined) template.systemPrompt = updates.systemPrompt;
      if (updates.userPromptTemplate !== undefined) template.userPromptTemplate = updates.userPromptTemplate;
      persistToLocalStorage(config);
    },

    deleteTemplate(id: string): void {
      config.promptTemplates = config.promptTemplates.filter((t) => t.id !== id);
      if (config.activeTemplateId === id) {
        config.activeTemplateId = null;
      }
      persistToLocalStorage(config);
    },

    setActiveTemplate(id: string): void {
      const existsInCustom = config.promptTemplates.some((t) => t.id === id);
      const isDefault = config.defaultTemplate.id === id;
      if (existsInCustom || isDefault) {
        config.activeTemplateId = id;
        persistToLocalStorage(config);
      }
    },

    getActiveTemplate(): PromptTemplate {
      if (config.activeTemplateId) {
        const template = config.promptTemplates.find((t) => t.id === config.activeTemplateId);
        if (template) return cloneTemplate(template);
        if (config.defaultTemplate.id === config.activeTemplateId) {
          return cloneTemplate(config.defaultTemplate);
        }
      }
      return cloneTemplate(config.defaultTemplate);
    },
  };
}

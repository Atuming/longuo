import type { AIAssistantStore } from '../types/stores';
import type { AIConfig, AIProvider, PromptTemplate, AIHistoryRecord, WritingSkill, SkillParameter, ContextHint } from '../types/ai';
import { BUILT_IN_SKILLS } from '../types/skill-defaults';

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
const SKILLS_STORAGE_KEY = 'novel-assistant-skills';
const HISTORY_MAX_RECORDS = 50;

/** Get localStorage key for AI history of a project */
function historyStorageKey(projectId: string): string {
  return `novel-ai-history-${projectId}`;
}

/** Load history records from localStorage */
function loadHistory(projectId: string): AIHistoryRecord[] {
  try {
    const raw = localStorage.getItem(historyStorageKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      // Corrupted data — clear it
      localStorage.removeItem(historyStorageKey(projectId));
      return [];
    }
    return parsed as AIHistoryRecord[];
  } catch {
    // Corrupted or unreadable — clear and return empty
    try { localStorage.removeItem(historyStorageKey(projectId)); } catch { /* silent */ }
    return [];
  }
}

/** Persist history records to localStorage */
function saveHistory(projectId: string, records: AIHistoryRecord[]): void {
  try {
    localStorage.setItem(historyStorageKey(projectId), JSON.stringify(records));
  } catch {
    // localStorage not available or full — silent degradation
  }
}

/** 将 AIConfig 保存到 localStorage（会话内覆盖） */
function persistToLocalStorage(config: AIConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cloneConfig(config)));
  } catch {
    // localStorage 不可用或已满，静默忽略
  }
}

/** 深拷贝 SkillParameter */
function cloneParameter(p: SkillParameter): SkillParameter {
  return { ...p, options: p.options ? [...p.options] : undefined };
}

/** 深拷贝 ContextHint */
function cloneHint(h: ContextHint): ContextHint {
  return { ...h };
}

/** 深拷贝 WritingSkill */
function cloneSkill(s: WritingSkill): WritingSkill {
  return {
    ...s,
    parameters: s.parameters.map(cloneParameter),
    contextHints: s.contextHints.map(cloneHint),
    references: s.references?.map((r) => ({ ...r })),
  };
}

/** 技能持久化数据结构 */
interface PersistedSkillData {
  customSkills: WritingSkill[];
  builtInOverrides: Record<string, Partial<WritingSkill>>;
}

/** 从 localStorage 加载技能数据 */
function loadSkillData(): PersistedSkillData {
  try {
    const raw = localStorage.getItem(SKILLS_STORAGE_KEY);
    if (!raw) return { customSkills: [], builtInOverrides: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      localStorage.removeItem(SKILLS_STORAGE_KEY);
      return { customSkills: [], builtInOverrides: {} };
    }
    return {
      customSkills: Array.isArray(parsed.customSkills) ? parsed.customSkills : [],
      builtInOverrides: parsed.builtInOverrides && typeof parsed.builtInOverrides === 'object'
        ? parsed.builtInOverrides
        : {},
    };
  } catch {
    try { localStorage.removeItem(SKILLS_STORAGE_KEY); } catch { /* silent */ }
    return { customSkills: [], builtInOverrides: {} };
  }
}

/** 保存技能数据到 localStorage */
function saveSkillData(data: PersistedSkillData): void {
  try {
    localStorage.setItem(SKILLS_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // silent degradation
  }
}

/** 将内置默认值与覆盖数据合并 */
function mergeBuiltInSkills(
  defaults: WritingSkill[],
  overrides: Record<string, Partial<WritingSkill>>,
): WritingSkill[] {
  return defaults.map((skill) => {
    const override = overrides[skill.id];
    if (!override) return cloneSkill(skill);
    return cloneSkill({
      ...skill,
      ...override,
      id: skill.id,
      builtIn: true,
      parameters: override.parameters
        ? override.parameters.map(cloneParameter)
        : skill.parameters.map(cloneParameter),
      contextHints: override.contextHints
        ? override.contextHints.map(cloneHint)
        : skill.contextHints.map(cloneHint),
    });
  });
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

  // 技能状态
  const skillData = loadSkillData();
  const customSkills: WritingSkill[] = skillData.customSkills.map(cloneSkill);
  const builtInOverrides: Record<string, Partial<WritingSkill>> = { ...skillData.builtInOverrides };
  let builtInDefaults: WritingSkill[] = BUILT_IN_SKILLS;

  function persistSkills(): void {
    saveSkillData({ customSkills: customSkills.map(cloneSkill), builtInOverrides: { ...builtInOverrides } });
  }

  function getMergedSkills(): WritingSkill[] {
    const builtIn = mergeBuiltInSkills(builtInDefaults, builtInOverrides);
    const custom = customSkills.map(cloneSkill);
    return [...builtIn, ...custom].sort((a, b) => a.sortOrder - b.sortOrder);
  }

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

    addHistoryRecord(projectId: string, record: Omit<AIHistoryRecord, 'id' | 'timestamp'>): AIHistoryRecord {
      const records = loadHistory(projectId);
      const newRecord: AIHistoryRecord = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        projectId: record.projectId,
        skillLabel: record.skillLabel,
        userInput: record.userInput,
        generatedContent: record.generatedContent,
      };
      records.push(newRecord);
      // Enforce max 50 records — delete oldest first
      while (records.length > HISTORY_MAX_RECORDS) {
        records.shift();
      }
      saveHistory(projectId, records);
      return { ...newRecord };
    },

    listHistory(projectId: string): AIHistoryRecord[] {
      const records = loadHistory(projectId);
      // Return in reverse chronological order (newest first)
      return records.slice().reverse().map((r) => ({ ...r }));
    },

    getHistoryRecord(projectId: string, id: string): AIHistoryRecord | undefined {
      const records = loadHistory(projectId);
      const found = records.find((r) => r.id === id);
      return found ? { ...found } : undefined;
    },

    clearHistory(projectId: string): void {
      try {
        localStorage.removeItem(historyStorageKey(projectId));
      } catch {
        // silent degradation
      }
    },

    listSkills(): WritingSkill[] {
      return getMergedSkills();
    },

    getSkill(id: string): WritingSkill | undefined {
      const all = getMergedSkills();
      return all.find((s) => s.id === id);
    },

    addSkill(data: Omit<WritingSkill, 'id' | 'builtIn'>): WritingSkill {
      const maxOrder = getMergedSkills().reduce((max, s) => Math.max(max, s.sortOrder), -1);
      const skill: WritingSkill = {
        ...data,
        id: crypto.randomUUID(),
        builtIn: false,
        sortOrder: data.sortOrder ?? maxOrder + 1,
        parameters: data.parameters.map(cloneParameter),
        contextHints: data.contextHints.map(cloneHint),
      };
      customSkills.push(skill);
      persistSkills();
      return cloneSkill(skill);
    },

    updateSkill(id: string, updates: Partial<Omit<WritingSkill, 'id' | 'builtIn'>>): void {
      // 检查是否为内置技能
      const isBuiltIn = builtInDefaults.some((s) => s.id === id);
      if (isBuiltIn) {
        // 存储为覆盖
        const existing = builtInOverrides[id] ?? {};
        const merged = { ...existing, ...updates };
        // 深拷贝数组字段
        if (updates.parameters) merged.parameters = updates.parameters.map(cloneParameter);
        if (updates.contextHints) merged.contextHints = updates.contextHints.map(cloneHint);
        builtInOverrides[id] = merged;
      } else {
        const skill = customSkills.find((s) => s.id === id);
        if (!skill) return;
        if (updates.name !== undefined) skill.name = updates.name;
        if (updates.icon !== undefined) skill.icon = updates.icon;
        if (updates.description !== undefined) skill.description = updates.description;
        if (updates.promptTemplate !== undefined) skill.promptTemplate = updates.promptTemplate;
        if (updates.parameters !== undefined) skill.parameters = updates.parameters.map(cloneParameter);
        if (updates.contextHints !== undefined) skill.contextHints = updates.contextHints.map(cloneHint);
        if (updates.sortOrder !== undefined) skill.sortOrder = updates.sortOrder;
        if (updates.enabled !== undefined) skill.enabled = updates.enabled;
      }
      persistSkills();
    },

    deleteSkill(id: string): void {
      const isBuiltIn = builtInDefaults.some((s) => s.id === id);
      if (isBuiltIn) return; // 内置技能不可删除
      const idx = customSkills.findIndex((s) => s.id === id);
      if (idx >= 0) {
        customSkills.splice(idx, 1);
        persistSkills();
      }
    },

    resetSkill(id: string): void {
      const isBuiltIn = builtInDefaults.some((s) => s.id === id);
      if (!isBuiltIn) return; // 仅内置技能可恢复默认
      delete builtInOverrides[id];
      persistSkills();
    },

    reorderSkills(orderedIds: string[]): void {
      const all = getMergedSkills();
      for (let i = 0; i < orderedIds.length; i++) {
        const skill = all.find((s) => s.id === orderedIds[i]);
        if (!skill) continue;
        const newOrder = i;
        if (skill.builtIn) {
          const existing = builtInOverrides[skill.id] ?? {};
          builtInOverrides[skill.id] = { ...existing, sortOrder: newOrder };
        } else {
          const custom = customSkills.find((s) => s.id === skill.id);
          if (custom) custom.sortOrder = newOrder;
        }
      }
      persistSkills();
    },

    setBuiltInSkills(skills: WritingSkill[]): void {
      builtInDefaults = skills.map(cloneSkill);
    },
  };
}

import { describe, it, expect, beforeEach } from 'vitest';
import { createAIAssistantStore, DEFAULT_PROMPT_TEMPLATE } from './ai-assistant-store';
import type { AIConfig, AIProvider, PromptTemplate } from '../types/ai';

beforeEach(() => {
  localStorage.removeItem('novel-assistant-ai-config');
});

function makeProviderData(overrides?: Partial<Omit<AIProvider, 'id'>>): Omit<AIProvider, 'id'> {
  return {
    name: 'TestProvider',
    apiKey: 'sk-test-key',
    modelName: 'gpt-4o',
    apiEndpoint: 'https://api.openai.com/v1/chat/completions',
    timeoutMs: 30000,
    ...overrides,
  };
}

function makeTemplateData(overrides?: Partial<Omit<PromptTemplate, 'id'>>): Omit<PromptTemplate, 'id'> {
  return {
    name: '自定义模板',
    systemPrompt: '你是写作助手。{chapter_content}',
    userPromptTemplate: '请帮我写：{user_input}',
    ...overrides,
  };
}

describe('AIAssistantStore', () => {
  describe('createAIAssistantStore', () => {
    it('should create store with default config when no initial config provided', () => {
      const store = createAIAssistantStore();
      const config = store.getConfig();
      expect(config.providers).toEqual([]);
      expect(config.activeProviderId).toBeNull();
      expect(config.promptTemplates).toEqual([]);
      expect(config.activeTemplateId).toBeNull();
      expect(config.defaultTemplate.id).toBe('default');
      expect(config.defaultTemplate.name).toBe('默认中文小说写作模板');
    });

    it('should create store with provided initial config', () => {
      const initialConfig: AIConfig = {
        providers: [{ id: 'p1', name: 'OpenAI', apiKey: 'key', modelName: 'gpt-4', apiEndpoint: 'https://api.openai.com', timeoutMs: 5000 }],
        activeProviderId: 'p1',
        promptTemplates: [{ id: 't1', name: 'Custom', systemPrompt: 'sys', userPromptTemplate: 'usr' }],
        activeTemplateId: 't1',
        defaultTemplate: DEFAULT_PROMPT_TEMPLATE,
      };
      const store = createAIAssistantStore(initialConfig);
      const config = store.getConfig();
      expect(config.providers).toHaveLength(1);
      expect(config.providers[0].name).toBe('OpenAI');
      expect(config.activeProviderId).toBe('p1');
      expect(config.promptTemplates).toHaveLength(1);
      expect(config.activeTemplateId).toBe('t1');
    });

    it('should deep clone initial config (no shared references)', () => {
      const provider: AIProvider = { id: 'p1', name: 'A', apiKey: 'k', modelName: 'm', apiEndpoint: 'e', timeoutMs: 1000 };
      const initialConfig: AIConfig = {
        providers: [provider],
        activeProviderId: 'p1',
        promptTemplates: [],
        activeTemplateId: null,
        defaultTemplate: DEFAULT_PROMPT_TEMPLATE,
      };
      const store = createAIAssistantStore(initialConfig);
      // Mutate original
      provider.name = 'Mutated';
      initialConfig.providers.push({ id: 'p2', name: 'B', apiKey: '', modelName: '', apiEndpoint: '', timeoutMs: 0 });
      const config = store.getConfig();
      expect(config.providers).toHaveLength(1);
      expect(config.providers[0].name).toBe('A');
    });
  });

  describe('Provider CRUD', () => {
    it('should add a provider and return it with an id', () => {
      const store = createAIAssistantStore();
      const provider = store.addProvider(makeProviderData());
      expect(provider.id).toBeTruthy();
      expect(provider.name).toBe('TestProvider');
      expect(provider.apiKey).toBe('sk-test-key');
    });

    it('should get added provider via getConfig', () => {
      const store = createAIAssistantStore();
      const provider = store.addProvider(makeProviderData());
      const config = store.getConfig();
      expect(config.providers).toHaveLength(1);
      expect(config.providers[0].id).toBe(provider.id);
    });

    it('should update provider fields', () => {
      const store = createAIAssistantStore();
      const provider = store.addProvider(makeProviderData());
      store.updateProvider(provider.id, { name: 'Updated', apiKey: 'new-key' });
      const config = store.getConfig();
      expect(config.providers[0].name).toBe('Updated');
      expect(config.providers[0].apiKey).toBe('new-key');
      expect(config.providers[0].modelName).toBe('gpt-4o'); // unchanged
    });

    it('should ignore update for non-existent provider', () => {
      const store = createAIAssistantStore();
      store.updateProvider('non-existent', { name: 'X' });
      expect(store.getConfig().providers).toHaveLength(0);
    });

    it('should delete a provider', () => {
      const store = createAIAssistantStore();
      const p = store.addProvider(makeProviderData());
      store.deleteProvider(p.id);
      expect(store.getConfig().providers).toHaveLength(0);
    });

    it('should clear activeProviderId when active provider is deleted', () => {
      const store = createAIAssistantStore();
      const p = store.addProvider(makeProviderData());
      store.setActiveProvider(p.id);
      expect(store.getConfig().activeProviderId).toBe(p.id);
      store.deleteProvider(p.id);
      expect(store.getConfig().activeProviderId).toBeNull();
    });

    it('should not clear activeProviderId when a different provider is deleted', () => {
      const store = createAIAssistantStore();
      const p1 = store.addProvider(makeProviderData({ name: 'A' }));
      const p2 = store.addProvider(makeProviderData({ name: 'B' }));
      store.setActiveProvider(p1.id);
      store.deleteProvider(p2.id);
      expect(store.getConfig().activeProviderId).toBe(p1.id);
    });
  });

  describe('Active Provider', () => {
    it('should set and get active provider', () => {
      const store = createAIAssistantStore();
      const p = store.addProvider(makeProviderData());
      store.setActiveProvider(p.id);
      const active = store.getActiveProvider();
      expect(active).not.toBeNull();
      expect(active!.id).toBe(p.id);
    });

    it('should return null when no active provider set', () => {
      const store = createAIAssistantStore();
      expect(store.getActiveProvider()).toBeNull();
    });

    it('should not set active provider to non-existent id', () => {
      const store = createAIAssistantStore();
      store.setActiveProvider('non-existent');
      expect(store.getConfig().activeProviderId).toBeNull();
    });

    it('should return null if activeProviderId references deleted provider', () => {
      const store = createAIAssistantStore();
      const p = store.addProvider(makeProviderData());
      store.setActiveProvider(p.id);
      store.deleteProvider(p.id);
      expect(store.getActiveProvider()).toBeNull();
    });
  });

  describe('Template CRUD', () => {
    it('should add a template and return it with an id', () => {
      const store = createAIAssistantStore();
      const t = store.addTemplate(makeTemplateData());
      expect(t.id).toBeTruthy();
      expect(t.name).toBe('自定义模板');
    });

    it('should update template fields', () => {
      const store = createAIAssistantStore();
      const t = store.addTemplate(makeTemplateData());
      store.updateTemplate(t.id, { name: '新名称', systemPrompt: '新系统提示' });
      const config = store.getConfig();
      const updated = config.promptTemplates.find((x) => x.id === t.id);
      expect(updated!.name).toBe('新名称');
      expect(updated!.systemPrompt).toBe('新系统提示');
      expect(updated!.userPromptTemplate).toBe('请帮我写：{user_input}'); // unchanged
    });

    it('should ignore update for non-existent template', () => {
      const store = createAIAssistantStore();
      store.updateTemplate('non-existent', { name: 'X' });
      expect(store.getConfig().promptTemplates).toHaveLength(0);
    });

    it('should delete a template', () => {
      const store = createAIAssistantStore();
      const t = store.addTemplate(makeTemplateData());
      store.deleteTemplate(t.id);
      expect(store.getConfig().promptTemplates).toHaveLength(0);
    });

    it('should clear activeTemplateId when active template is deleted', () => {
      const store = createAIAssistantStore();
      const t = store.addTemplate(makeTemplateData());
      store.setActiveTemplate(t.id);
      expect(store.getConfig().activeTemplateId).toBe(t.id);
      store.deleteTemplate(t.id);
      expect(store.getConfig().activeTemplateId).toBeNull();
    });
  });

  describe('Active Template', () => {
    it('should return default template when no active template set', () => {
      const store = createAIAssistantStore();
      const active = store.getActiveTemplate();
      expect(active.id).toBe('default');
      expect(active.name).toBe('默认中文小说写作模板');
    });

    it('should return custom template when set as active', () => {
      const store = createAIAssistantStore();
      const t = store.addTemplate(makeTemplateData({ name: '我的模板' }));
      store.setActiveTemplate(t.id);
      const active = store.getActiveTemplate();
      expect(active.id).toBe(t.id);
      expect(active.name).toBe('我的模板');
    });

    it('should allow setting default template as active', () => {
      const store = createAIAssistantStore();
      store.addTemplate(makeTemplateData());
      store.setActiveTemplate('default');
      const active = store.getActiveTemplate();
      expect(active.id).toBe('default');
    });

    it('should fall back to default when active template id is invalid', () => {
      const store = createAIAssistantStore();
      store.setActiveTemplate('non-existent');
      // activeTemplateId should not have been set
      expect(store.getConfig().activeTemplateId).toBeNull();
      expect(store.getActiveTemplate().id).toBe('default');
    });
  });

  describe('updateConfig', () => {
    it('should update providers list', () => {
      const store = createAIAssistantStore();
      store.addProvider(makeProviderData());
      store.updateConfig({ providers: [] });
      expect(store.getConfig().providers).toHaveLength(0);
    });

    it('should update activeProviderId', () => {
      const store = createAIAssistantStore();
      store.updateConfig({ activeProviderId: 'some-id' });
      expect(store.getConfig().activeProviderId).toBe('some-id');
    });

    it('should update defaultTemplate', () => {
      const store = createAIAssistantStore();
      const newDefault: PromptTemplate = { id: 'new-default', name: 'New', systemPrompt: 's', userPromptTemplate: 'u' };
      store.updateConfig({ defaultTemplate: newDefault });
      expect(store.getConfig().defaultTemplate.id).toBe('new-default');
    });
  });

  describe('Default template content', () => {
    it('should contain Chinese novel writing context placeholders', () => {
      expect(DEFAULT_PROMPT_TEMPLATE.systemPrompt).toContain('{chapter_content}');
      expect(DEFAULT_PROMPT_TEMPLATE.systemPrompt).toContain('{prev_chapter_summary}');
      expect(DEFAULT_PROMPT_TEMPLATE.systemPrompt).toContain('{next_chapter_summary}');
      expect(DEFAULT_PROMPT_TEMPLATE.systemPrompt).toContain('{character_info}');
      expect(DEFAULT_PROMPT_TEMPLATE.systemPrompt).toContain('{world_setting}');
      expect(DEFAULT_PROMPT_TEMPLATE.systemPrompt).toContain('{timeline_context}');
      expect(DEFAULT_PROMPT_TEMPLATE.userPromptTemplate).toContain('{user_input}');
    });
  });
});

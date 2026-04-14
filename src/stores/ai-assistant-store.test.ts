import { describe, it, expect, beforeEach } from 'vitest';
import { createAIAssistantStore, DEFAULT_PROMPT_TEMPLATE } from './ai-assistant-store';
import type { AIConfig, AIProvider, PromptTemplate, WritingSkill } from '../types/ai';
import { BUILT_IN_SKILLS } from '../types/skill-defaults';

beforeEach(() => {
  localStorage.removeItem('novel-assistant-ai-config');
  localStorage.removeItem('novel-assistant-skills');
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


describe('AI History Records', () => {
  const projectId = 'test-project-1';
  const projectId2 = 'test-project-2';

  beforeEach(() => {
    localStorage.removeItem(`novel-ai-history-${projectId}`);
    localStorage.removeItem(`novel-ai-history-${projectId2}`);
  });

  function makeHistoryInput(overrides?: Partial<Omit<import('../types/ai').AIHistoryRecord, 'id' | 'timestamp'>>) {
    return {
      projectId,
      skillLabel: '续写',
      userInput: '请帮我续写这段话',
      generatedContent: '这是AI生成的内容',
      ...overrides,
    };
  }

  describe('addHistoryRecord', () => {
    it('should add a record and return it with id and timestamp', () => {
      const store = createAIAssistantStore();
      const record = store.addHistoryRecord(projectId, makeHistoryInput());
      expect(record.id).toBeTruthy();
      expect(record.timestamp).toBeTruthy();
      expect(record.skillLabel).toBe('续写');
      expect(record.userInput).toBe('请帮我续写这段话');
      expect(record.generatedContent).toBe('这是AI生成的内容');
      expect(record.projectId).toBe(projectId);
    });

    it('should persist to localStorage', () => {
      const store = createAIAssistantStore();
      store.addHistoryRecord(projectId, makeHistoryInput());
      const raw = localStorage.getItem(`novel-ai-history-${projectId}`);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(parsed).toHaveLength(1);
    });

    it('should auto-delete oldest records when exceeding 50', () => {
      const store = createAIAssistantStore();
      const ids: string[] = [];
      for (let i = 0; i < 52; i++) {
        const r = store.addHistoryRecord(projectId, makeHistoryInput({
          userInput: `input-${i}`,
        }));
        ids.push(r.id);
      }
      const list = store.listHistory(projectId);
      expect(list.length).toBe(50);
      // The first two (oldest) should have been removed
      expect(list.find((r) => r.id === ids[0])).toBeUndefined();
      expect(list.find((r) => r.id === ids[1])).toBeUndefined();
      // The last one should still be present
      expect(list.find((r) => r.id === ids[51])).toBeDefined();
    });
  });

  describe('listHistory', () => {
    it('should return empty array when no records exist', () => {
      const store = createAIAssistantStore();
      expect(store.listHistory(projectId)).toEqual([]);
    });

    it('should return records in reverse chronological order (newest first)', () => {
      const store = createAIAssistantStore();
      const r1 = store.addHistoryRecord(projectId, makeHistoryInput({ userInput: 'first' }));
      const r2 = store.addHistoryRecord(projectId, makeHistoryInput({ userInput: 'second' }));
      const r3 = store.addHistoryRecord(projectId, makeHistoryInput({ userInput: 'third' }));
      const list = store.listHistory(projectId);
      expect(list).toHaveLength(3);
      expect(list[0].id).toBe(r3.id);
      expect(list[1].id).toBe(r2.id);
      expect(list[2].id).toBe(r1.id);
    });

    it('should isolate records by project', () => {
      const store = createAIAssistantStore();
      store.addHistoryRecord(projectId, makeHistoryInput({ projectId }));
      store.addHistoryRecord(projectId2, makeHistoryInput({ projectId: projectId2 }));
      const list1 = store.listHistory(projectId);
      const list2 = store.listHistory(projectId2);
      expect(list1).toHaveLength(1);
      expect(list2).toHaveLength(1);
      expect(list1[0].projectId).toBe(projectId);
      expect(list2[0].projectId).toBe(projectId2);
    });
  });

  describe('getHistoryRecord', () => {
    it('should return a record by id', () => {
      const store = createAIAssistantStore();
      const added = store.addHistoryRecord(projectId, makeHistoryInput());
      const found = store.getHistoryRecord(projectId, added.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(added.id);
      expect(found!.skillLabel).toBe('续写');
    });

    it('should return undefined for non-existent id', () => {
      const store = createAIAssistantStore();
      expect(store.getHistoryRecord(projectId, 'non-existent')).toBeUndefined();
    });

    it('should return a clone (no shared references)', () => {
      const store = createAIAssistantStore();
      const added = store.addHistoryRecord(projectId, makeHistoryInput());
      const found1 = store.getHistoryRecord(projectId, added.id);
      const found2 = store.getHistoryRecord(projectId, added.id);
      expect(found1).not.toBe(found2);
    });
  });

  describe('clearHistory', () => {
    it('should remove all records for a project', () => {
      const store = createAIAssistantStore();
      store.addHistoryRecord(projectId, makeHistoryInput());
      store.addHistoryRecord(projectId, makeHistoryInput());
      store.clearHistory(projectId);
      expect(store.listHistory(projectId)).toEqual([]);
    });

    it('should not affect other projects', () => {
      const store = createAIAssistantStore();
      store.addHistoryRecord(projectId, makeHistoryInput({ projectId }));
      store.addHistoryRecord(projectId2, makeHistoryInput({ projectId: projectId2 }));
      store.clearHistory(projectId);
      expect(store.listHistory(projectId)).toEqual([]);
      expect(store.listHistory(projectId2)).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    it('should handle corrupted localStorage data gracefully', () => {
      localStorage.setItem(`novel-ai-history-${projectId}`, 'not-valid-json');
      const store = createAIAssistantStore();
      // Should clear corrupted data and return empty
      expect(store.listHistory(projectId)).toEqual([]);
      // Should be able to add new records after corruption
      const record = store.addHistoryRecord(projectId, makeHistoryInput());
      expect(record.id).toBeTruthy();
      expect(store.listHistory(projectId)).toHaveLength(1);
    });

    it('should handle non-array localStorage data gracefully', () => {
      localStorage.setItem(`novel-ai-history-${projectId}`, JSON.stringify({ not: 'an array' }));
      const store = createAIAssistantStore();
      expect(store.listHistory(projectId)).toEqual([]);
    });
  });
});

// ─── Skill CRUD Tests ───

function makeSkillData(overrides?: Partial<Omit<WritingSkill, 'id' | 'builtIn'>>): Omit<WritingSkill, 'id' | 'builtIn'> {
  return {
    name: '测试技能',
    icon: '🧪',
    description: '一个测试用的技能',
    promptTemplate: '请根据当前内容{param:style}写一段。',
    parameters: [
      { key: 'style', label: '风格', type: 'text', placeholder: '如：幽默', required: false },
    ],
    contextHints: [],
    sortOrder: 100,
    enabled: true,
    ...overrides,
  };
}

describe('AIAssistantStore — Skill Management', () => {
  describe('listSkills', () => {
    it('should return 8 built-in skills by default', () => {
      const store = createAIAssistantStore();
      const skills = store.listSkills();
      expect(skills).toHaveLength(BUILT_IN_SKILLS.length);
      expect(skills.every((s) => s.builtIn)).toBe(true);
    });

    it('should return skills sorted by sortOrder', () => {
      const store = createAIAssistantStore();
      const skills = store.listSkills();
      for (let i = 1; i < skills.length; i++) {
        expect(skills[i].sortOrder).toBeGreaterThanOrEqual(skills[i - 1].sortOrder);
      }
    });

    it('should return defensive copies', () => {
      const store = createAIAssistantStore();
      const skills = store.listSkills();
      skills[0].name = 'modified';
      skills[0].parameters.push({ key: 'x', label: 'x', type: 'text' });
      const fresh = store.listSkills();
      expect(fresh[0].name).not.toBe('modified');
      expect(fresh[0].parameters).toHaveLength(BUILT_IN_SKILLS[0].parameters.length);
    });
  });

  describe('getSkill', () => {
    it('should return a built-in skill by id', () => {
      const store = createAIAssistantStore();
      const skill = store.getSkill('builtin-continue');
      expect(skill).toBeDefined();
      expect(skill!.name).toBe('续写');
    });

    it('should return undefined for unknown id', () => {
      const store = createAIAssistantStore();
      expect(store.getSkill('nonexistent')).toBeUndefined();
    });
  });

  describe('addSkill', () => {
    it('should create a custom skill with generated id', () => {
      const store = createAIAssistantStore();
      const skill = store.addSkill(makeSkillData());
      expect(skill.id).toBeTruthy();
      expect(skill.builtIn).toBe(false);
      expect(skill.name).toBe('测试技能');
    });

    it('should include custom skill in listSkills', () => {
      const store = createAIAssistantStore();
      const skill = store.addSkill(makeSkillData());
      const all = store.listSkills();
      expect(all.find((s) => s.id === skill.id)).toBeDefined();
      expect(all).toHaveLength(BUILT_IN_SKILLS.length + 1);
    });

    it('should persist custom skill to localStorage', () => {
      const store1 = createAIAssistantStore();
      const skill = store1.addSkill(makeSkillData());
      // Create a new store instance to verify persistence
      const store2 = createAIAssistantStore();
      const found = store2.getSkill(skill.id);
      expect(found).toBeDefined();
      expect(found!.name).toBe('测试技能');
    });

    it('should auto-assign sortOrder when not set explicitly', () => {
      const store = createAIAssistantStore();
      const skill = store.addSkill(makeSkillData({ sortOrder: undefined as unknown as number }));
      // Should be greater than all built-in sortOrders
      const builtInMax = Math.max(...BUILT_IN_SKILLS.map((s) => s.sortOrder));
      expect(skill.sortOrder).toBeGreaterThan(builtInMax);
    });
  });

  describe('updateSkill', () => {
    it('should update a custom skill directly', () => {
      const store = createAIAssistantStore();
      const skill = store.addSkill(makeSkillData());
      store.updateSkill(skill.id, { name: '更新后的技能', enabled: false });
      const updated = store.getSkill(skill.id)!;
      expect(updated.name).toBe('更新后的技能');
      expect(updated.enabled).toBe(false);
      // Unchanged fields should be preserved
      expect(updated.icon).toBe('🧪');
    });

    it('should store override for built-in skill', () => {
      const store = createAIAssistantStore();
      store.updateSkill('builtin-continue', { name: '自定义续写' });
      const skill = store.getSkill('builtin-continue')!;
      expect(skill.name).toBe('自定义续写');
      // Other fields should stay as defaults
      expect(skill.icon).toBe('✍️');
      expect(skill.builtIn).toBe(true);
    });

    it('should persist built-in overrides', () => {
      const store1 = createAIAssistantStore();
      store1.updateSkill('builtin-continue', { name: '持久化测试' });
      const store2 = createAIAssistantStore();
      expect(store2.getSkill('builtin-continue')!.name).toBe('持久化测试');
    });

    it('should be no-op for unknown skill id', () => {
      const store = createAIAssistantStore();
      store.updateSkill('nonexistent', { name: 'nope' });
      expect(store.getSkill('nonexistent')).toBeUndefined();
    });
  });

  describe('deleteSkill', () => {
    it('should delete a custom skill', () => {
      const store = createAIAssistantStore();
      const skill = store.addSkill(makeSkillData());
      store.deleteSkill(skill.id);
      expect(store.getSkill(skill.id)).toBeUndefined();
      expect(store.listSkills()).toHaveLength(BUILT_IN_SKILLS.length);
    });

    it('should be no-op for built-in skill', () => {
      const store = createAIAssistantStore();
      store.deleteSkill('builtin-continue');
      expect(store.getSkill('builtin-continue')).toBeDefined();
      expect(store.listSkills()).toHaveLength(BUILT_IN_SKILLS.length);
    });
  });

  describe('resetSkill', () => {
    it('should restore built-in skill to defaults', () => {
      const store = createAIAssistantStore();
      store.updateSkill('builtin-continue', { name: '修改名', icon: '🔥' });
      expect(store.getSkill('builtin-continue')!.name).toBe('修改名');
      store.resetSkill('builtin-continue');
      const skill = store.getSkill('builtin-continue')!;
      expect(skill.name).toBe('续写');
      expect(skill.icon).toBe('✍️');
    });

    it('should be no-op for custom skill', () => {
      const store = createAIAssistantStore();
      const custom = store.addSkill(makeSkillData());
      store.updateSkill(custom.id, { name: '改了' });
      store.resetSkill(custom.id);
      // Should still have the update (resetSkill only works on built-in)
      expect(store.getSkill(custom.id)!.name).toBe('改了');
    });
  });

  describe('reorderSkills', () => {
    it('should update sortOrder based on array position', () => {
      const store = createAIAssistantStore();
      const ids = store.listSkills().map((s) => s.id);
      const reversed = [...ids].reverse();
      store.reorderSkills(reversed);
      const reordered = store.listSkills();
      // First skill after reorder should be what was last
      expect(reordered[0].id).toBe(reversed[0]);
    });
  });

  describe('error handling', () => {
    it('should handle corrupted skills localStorage gracefully', () => {
      localStorage.setItem('novel-assistant-skills', 'not-valid-json');
      const store = createAIAssistantStore();
      // Should still return built-in skills
      expect(store.listSkills()).toHaveLength(BUILT_IN_SKILLS.length);
    });

    it('should handle non-object skills localStorage gracefully', () => {
      localStorage.setItem('novel-assistant-skills', JSON.stringify('just a string'));
      const store = createAIAssistantStore();
      expect(store.listSkills()).toHaveLength(BUILT_IN_SKILLS.length);
    });
  });
});

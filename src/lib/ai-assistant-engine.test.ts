import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAIAssistantEngine } from './ai-assistant-engine';
import { createChapterStore } from '../stores/chapter-store';
import { createCharacterStore } from '../stores/character-store';
import { createWorldStore } from '../stores/world-store';
import { createTimelineStore } from '../stores/timeline-store';
import { createAIAssistantStore, DEFAULT_PROMPT_TEMPLATE } from '../stores/ai-assistant-store';
import type { AIAssistantEngine } from '../types/engines';
import type {
  ChapterStore,
  CharacterStore,
  WorldStore,
  TimelineStore,
  AIAssistantStore,
} from '../types/stores';

const PROJECT_ID = 'proj-1';

function setupStores() {
  const chapterStore = createChapterStore();
  const characterStore = createCharacterStore();
  const worldStore = createWorldStore();
  const timelineStore = createTimelineStore();
  const aiStore = createAIAssistantStore();
  return { chapterStore, characterStore, worldStore, timelineStore, aiStore };
}

function createEngine(stores: {
  chapterStore: ChapterStore;
  characterStore: CharacterStore;
  worldStore: WorldStore;
  timelineStore: TimelineStore;
  aiStore: AIAssistantStore;
}): AIAssistantEngine {
  return createAIAssistantEngine(stores);
}

describe('AIAssistantEngine', () => {
  let stores: ReturnType<typeof setupStores>;
  let engine: AIAssistantEngine;

  beforeEach(() => {
    stores = setupStores();
    engine = createEngine(stores);
  });

  describe('packContext', () => {
    it('should return empty context for non-existent chapter', () => {
      const ctx = engine.packContext('non-existent');
      expect(ctx.chapterContent).toBe('');
      expect(ctx.prevChapterSummary).toBe('');
      expect(ctx.nextChapterSummary).toBe('');
      expect(ctx.characterInfo).toBe('');
      expect(ctx.worldSetting).toBe('');
      expect(ctx.timelineContext).toBe('');
    });

    it('should pack current chapter content', () => {
      const ch = stores.chapterStore.createChapter(PROJECT_ID, null, '第一章', 'chapter');
      stores.chapterStore.updateChapter(ch.id, { content: '这是第一章的内容。' });
      const ctx = engine.packContext(ch.id);
      expect(ctx.chapterContent).toBe('这是第一章的内容。');
    });

    it('should pack prev and next chapter summaries', () => {
      const ch1 = stores.chapterStore.createChapter(PROJECT_ID, null, '第一章', 'chapter');
      const ch2 = stores.chapterStore.createChapter(PROJECT_ID, null, '第二章', 'chapter');
      const ch3 = stores.chapterStore.createChapter(PROJECT_ID, null, '第三章', 'chapter');
      stores.chapterStore.updateChapter(ch1.id, { content: '前一章内容' });
      stores.chapterStore.updateChapter(ch2.id, { content: '当前章节内容' });
      stores.chapterStore.updateChapter(ch3.id, { content: '后一章内容' });

      const ctx = engine.packContext(ch2.id);
      expect(ctx.prevChapterSummary).toBe('前一章内容');
      expect(ctx.nextChapterSummary).toBe('后一章内容');
    });

    it('should truncate long chapter summaries to 200 chars', () => {
      const ch1 = stores.chapterStore.createChapter(PROJECT_ID, null, '第一章', 'chapter');
      const ch2 = stores.chapterStore.createChapter(PROJECT_ID, null, '第二章', 'chapter');
      const longContent = '字'.repeat(300);
      stores.chapterStore.updateChapter(ch1.id, { content: longContent });
      stores.chapterStore.updateChapter(ch2.id, { content: '当前' });

      const ctx = engine.packContext(ch2.id);
      expect(ctx.prevChapterSummary.length).toBe(203); // 200 + '...'
      expect(ctx.prevChapterSummary.endsWith('...')).toBe(true);
    });

    it('should have empty prev summary for first chapter', () => {
      const ch = stores.chapterStore.createChapter(PROJECT_ID, null, '第一章', 'chapter');
      stores.chapterStore.updateChapter(ch.id, { content: '内容' });
      const ctx = engine.packContext(ch.id);
      expect(ctx.prevChapterSummary).toBe('');
    });

    it('should have empty next summary for last chapter', () => {
      const ch = stores.chapterStore.createChapter(PROJECT_ID, null, '最后一章', 'chapter');
      stores.chapterStore.updateChapter(ch.id, { content: '内容' });
      const ctx = engine.packContext(ch.id);
      expect(ctx.nextChapterSummary).toBe('');
    });

    it('should pack character info from timeline associations', () => {
      const ch = stores.chapterStore.createChapter(PROJECT_ID, null, '第一章', 'chapter');
      stores.chapterStore.updateChapter(ch.id, { content: '内容' });

      const char = stores.characterStore.createCharacter(PROJECT_ID, {
        name: '李白',
        aliases: ['太白', '诗仙'],
        appearance: '白衣飘飘',
        personality: '豪放不羁',
        backstory: '唐代诗人',
        customAttributes: {},
      });

      stores.timelineStore.createTimelinePoint({
        projectId: PROJECT_ID,
        label: '开篇',
        description: '故事开始',
        sortOrder: 0,
        associatedChapterIds: [ch.id],
        associatedCharacterIds: [char.id],
      });

      const ctx = engine.packContext(ch.id);
      expect(ctx.characterInfo).toContain('李白');
      expect(ctx.characterInfo).toContain('太白');
      expect(ctx.characterInfo).toContain('诗仙');
      expect(ctx.characterInfo).toContain('白衣飘飘');
      expect(ctx.characterInfo).toContain('豪放不羁');
    });

    it('should pack world setting entries', () => {
      const ch = stores.chapterStore.createChapter(PROJECT_ID, null, '第一章', 'chapter');
      stores.chapterStore.updateChapter(ch.id, { content: '内容' });

      stores.worldStore.createEntry({
        projectId: PROJECT_ID,
        type: 'location',
        name: '长安城',
        description: '唐朝首都',
        associatedCharacterIds: [],
      });

      stores.worldStore.createEntry({
        projectId: PROJECT_ID,
        type: 'faction',
        name: '天策府',
        description: '军事组织',
        associatedCharacterIds: [],
      });

      const ctx = engine.packContext(ch.id);
      expect(ctx.worldSetting).toContain('长安城');
      expect(ctx.worldSetting).toContain('唐朝首都');
      expect(ctx.worldSetting).toContain('天策府');
      expect(ctx.worldSetting).toContain('地点');
      expect(ctx.worldSetting).toContain('势力');
    });

    it('should pack timeline context for associated chapter', () => {
      const ch = stores.chapterStore.createChapter(PROJECT_ID, null, '第一章', 'chapter');
      stores.chapterStore.updateChapter(ch.id, { content: '内容' });

      stores.timelineStore.createTimelinePoint({
        projectId: PROJECT_ID,
        label: '天宝元年',
        description: '安史之乱前夕',
        sortOrder: 0,
        associatedChapterIds: [ch.id],
        associatedCharacterIds: [],
      });

      const ctx = engine.packContext(ch.id);
      expect(ctx.timelineContext).toContain('天宝元年');
      expect(ctx.timelineContext).toContain('安史之乱前夕');
    });
  });

  describe('buildPrompt', () => {
    it('should replace all placeholders in template', () => {
      const context = {
        chapterContent: '章节内容',
        prevChapterSummary: '前章摘要',
        nextChapterSummary: '后章摘要',
        characterInfo: '角色信息',
        worldSetting: '世界设定',
        timelineContext: '时间线',
      };

      const template = {
        id: 'test',
        name: 'Test',
        systemPrompt: 'SYS:{chapter_content}|{prev_chapter_summary}|{next_chapter_summary}|{character_info}|{world_setting}|{timeline_context}',
        userPromptTemplate: 'USR:{user_input}',
      };

      const result = engine.buildPrompt(context, '用户输入', template);
      expect(result.systemPrompt).toBe('SYS:章节内容|前章摘要|后章摘要|角色信息|世界设定|时间线');
      expect(result.userPrompt).toBe('USR:用户输入');
    });

    it('should replace missing placeholders with empty string', () => {
      const context = {
        chapterContent: '',
        prevChapterSummary: '',
        nextChapterSummary: '',
        characterInfo: '',
        worldSetting: '',
        timelineContext: '',
      };

      const template = {
        id: 'test',
        name: 'Test',
        systemPrompt: '{chapter_content}|{character_info}',
        userPromptTemplate: '{user_input}',
      };

      const result = engine.buildPrompt(context, '', template);
      expect(result.systemPrompt).toBe('|');
      expect(result.userPrompt).toBe('');
    });

    it('should not leave any unreplaced placeholders', () => {
      const context = {
        chapterContent: 'c',
        prevChapterSummary: 'p',
        nextChapterSummary: 'n',
        characterInfo: 'ch',
        worldSetting: 'w',
        timelineContext: 't',
      };

      const result = engine.buildPrompt(context, 'u', DEFAULT_PROMPT_TEMPLATE);
      expect(result.systemPrompt).not.toContain('{chapter_content}');
      expect(result.systemPrompt).not.toContain('{prev_chapter_summary}');
      expect(result.systemPrompt).not.toContain('{next_chapter_summary}');
      expect(result.systemPrompt).not.toContain('{character_info}');
      expect(result.systemPrompt).not.toContain('{world_setting}');
      expect(result.systemPrompt).not.toContain('{timeline_context}');
      expect(result.userPrompt).not.toContain('{user_input}');
    });
  });

  describe('validateConfig', () => {
    it('should return valid for complete config', () => {
      const result = engine.validateConfig({
        id: '1',
        name: 'Test',
        apiKey: 'sk-key',
        modelName: 'gpt-4',
        apiEndpoint: 'https://api.openai.com/v1/chat/completions',
        timeoutMs: 30000,
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid when apiKey is empty', () => {
      const result = engine.validateConfig({
        id: '1',
        name: 'Test',
        apiKey: '',
        modelName: 'gpt-4',
        apiEndpoint: 'https://api.openai.com',
        timeoutMs: 30000,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('API Key 不能为空');
    });

    it('should return invalid when apiEndpoint is empty', () => {
      const result = engine.validateConfig({
        id: '1',
        name: 'Test',
        apiKey: 'key',
        modelName: 'gpt-4',
        apiEndpoint: '',
        timeoutMs: 30000,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('API 端点 URL 不能为空');
    });

    it('should return invalid when modelName is empty', () => {
      const result = engine.validateConfig({
        id: '1',
        name: 'Test',
        apiKey: 'key',
        modelName: '',
        apiEndpoint: 'https://api.openai.com',
        timeoutMs: 30000,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('模型名称不能为空');
    });

    it('should return multiple errors when multiple fields are empty', () => {
      const result = engine.validateConfig({
        id: '1',
        name: 'Test',
        apiKey: '',
        modelName: '',
        apiEndpoint: '',
        timeoutMs: 30000,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
    });

    it('should treat whitespace-only strings as empty', () => {
      const result = engine.validateConfig({
        id: '1',
        name: 'Test',
        apiKey: '   ',
        modelName: '  ',
        apiEndpoint: ' ',
        timeoutMs: 30000,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
    });
  });

  describe('generate', () => {
    it('should return error when no active provider', async () => {
      const result = await engine.generate({ userInput: 'test', chapterId: 'ch1' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('未配置');
    });

    it('should return error when provider config is invalid', async () => {
      const p = stores.aiStore.addProvider({
        name: 'Bad',
        apiKey: '',
        modelName: '',
        apiEndpoint: '',
        timeoutMs: 5000,
      });
      stores.aiStore.setActiveProvider(p.id);
      const result = await engine.generate({ userInput: 'test', chapterId: 'ch1' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('配置无效');
    });

    it('should handle network errors', async () => {
      const p = stores.aiStore.addProvider({
        name: 'Test',
        apiKey: 'key',
        modelName: 'model',
        apiEndpoint: 'https://invalid.endpoint.test/v1/chat',
        timeoutMs: 5000,
      });
      stores.aiStore.setActiveProvider(p.id);

      // Mock fetch to throw TypeError (network error)
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      try {
        const result = await engine.generate({ userInput: 'test', chapterId: 'ch1' });
        expect(result.success).toBe(false);
        expect(result.error).toContain('网络错误');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should handle timeout errors', async () => {
      const p = stores.aiStore.addProvider({
        name: 'Test',
        apiKey: 'key',
        modelName: 'model',
        apiEndpoint: 'https://api.test.com/v1/chat',
        timeoutMs: 5000,
      });
      stores.aiStore.setActiveProvider(p.id);

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockRejectedValue(new DOMException('The operation was aborted', 'AbortError'));

      try {
        const result = await engine.generate({ userInput: 'test', chapterId: 'ch1' });
        expect(result.success).toBe(false);
        expect(result.error).toContain('超时');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should handle 401 auth errors', async () => {
      const p = stores.aiStore.addProvider({
        name: 'Test',
        apiKey: 'bad-key',
        modelName: 'model',
        apiEndpoint: 'https://api.test.com/v1/chat',
        timeoutMs: 5000,
      });
      stores.aiStore.setActiveProvider(p.id);

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue(new Response('Unauthorized', { status: 401 }));

      try {
        const result = await engine.generate({ userInput: 'test', chapterId: 'ch1' });
        expect(result.success).toBe(false);
        expect(result.error).toContain('API Key 无效');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should handle 429 rate limit errors', async () => {
      const p = stores.aiStore.addProvider({
        name: 'Test',
        apiKey: 'key',
        modelName: 'model',
        apiEndpoint: 'https://api.test.com/v1/chat',
        timeoutMs: 5000,
      });
      stores.aiStore.setActiveProvider(p.id);

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue(new Response('Too Many Requests', { status: 429 }));

      try {
        const result = await engine.generate({ userInput: 'test', chapterId: 'ch1' });
        expect(result.success).toBe(false);
        expect(result.error).toContain('频繁');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should handle 500 server errors', async () => {
      const p = stores.aiStore.addProvider({
        name: 'Test',
        apiKey: 'key',
        modelName: 'model',
        apiEndpoint: 'https://api.test.com/v1/chat',
        timeoutMs: 5000,
      });
      stores.aiStore.setActiveProvider(p.id);

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue(new Response('Internal Server Error', { status: 500 }));

      try {
        const result = await engine.generate({ userInput: 'test', chapterId: 'ch1' });
        expect(result.success).toBe(false);
        expect(result.error).toContain('不可用');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should handle non-streaming successful response', async () => {
      const p = stores.aiStore.addProvider({
        name: 'Test',
        apiKey: 'key',
        modelName: 'model',
        apiEndpoint: 'https://api.test.com/v1/chat',
        timeoutMs: 5000,
      });
      stores.aiStore.setActiveProvider(p.id);

      const ch = stores.chapterStore.createChapter(PROJECT_ID, null, '章节', 'chapter');
      stores.chapterStore.updateChapter(ch.id, { content: '内容' });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '生成的段落内容' } }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      try {
        const result = await engine.generate({ userInput: '写一段描写', chapterId: ch.id });
        expect(result.success).toBe(true);
        expect(result.content).toBe('生成的段落内容');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should handle empty content in response', async () => {
      const p = stores.aiStore.addProvider({
        name: 'Test',
        apiKey: 'key',
        modelName: 'model',
        apiEndpoint: 'https://api.test.com/v1/chat',
        timeoutMs: 5000,
      });
      stores.aiStore.setActiveProvider(p.id);

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: '' } }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      try {
        const result = await engine.generate({ userInput: 'test', chapterId: 'ch1' });
        expect(result.success).toBe(false);
        expect(result.error).toContain('未生成有效内容');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should handle streaming response with onChunk callback', async () => {
      const p = stores.aiStore.addProvider({
        name: 'Test',
        apiKey: 'key',
        modelName: 'model',
        apiEndpoint: 'https://api.test.com/v1/chat',
        timeoutMs: 5000,
      });
      stores.aiStore.setActiveProvider(p.id);

      const ch = stores.chapterStore.createChapter(PROJECT_ID, null, '章节', 'chapter');

      // Create a mock ReadableStream for SSE
      const sseData = [
        'data: {"choices":[{"delta":{"content":"你好"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"世界"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          for (const chunk of sseData) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        },
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(stream, { status: 200 }),
      );

      const chunks: string[] = [];
      try {
        const result = await engine.generate(
          { userInput: 'test', chapterId: ch.id },
          (chunk) => chunks.push(chunk),
        );
        expect(result.success).toBe(true);
        expect(result.content).toBe('你好世界');
        expect(chunks).toEqual(['你好', '世界']);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});

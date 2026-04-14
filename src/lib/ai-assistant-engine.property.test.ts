import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { createAIAssistantEngine } from './ai-assistant-engine';
import { createChapterStore } from '../stores/chapter-store';
import { createCharacterStore } from '../stores/character-store';
import { createWorldStore } from '../stores/world-store';
import { createTimelineStore } from '../stores/timeline-store';
import { createAIAssistantStore } from '../stores/ai-assistant-store';
import { BUILT_IN_SKILLS } from '../types/skill-defaults';
import type { WritingSkill } from '../types/ai';

// ── helpers ──────────────────────────────────────────────────────────

function setupStores() {
  const chapterStore = createChapterStore();
  const characterStore = createCharacterStore();
  const worldStore = createWorldStore();
  const timelineStore = createTimelineStore();
  const aiStore = createAIAssistantStore();
  return { chapterStore, characterStore, worldStore, timelineStore, aiStore };
}

/** Create an engine with a valid provider + chapter so generate() reaches fetch. */
function createReadyEngine() {
  const stores = setupStores();
  const p = stores.aiStore.addProvider({
    name: 'Test',
    apiKey: 'key',
    modelName: 'model',
    apiEndpoint: 'https://api.test.com/v1/chat',
    timeoutMs: 30_000,
  });
  stores.aiStore.setActiveProvider(p.id);
  const ch = stores.chapterStore.createChapter('proj-1', null, '章节', 'chapter');
  const engine = createAIAssistantEngine(stores);
  return { engine, chapterId: ch.id };
}

/** Build a ReadableStream that emits SSE-formatted chunks then closes. */
function sseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const text of chunks) {
        const line = `data: {"choices":[{"delta":{"content":"${text}"}}]}\n\n`;
        controller.enqueue(encoder.encode(line));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
}



// ── test suite ───────────────────────────────────────────────────────

describe('ai-assistant-engine property tests', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });


  // Feature: ai-concurrency-safety, Property 1: 自动取消与独立控制器
  // **Validates: Requirements 1.1, 1.4**
  describe('Property 1: 自动取消与独立控制器', () => {
    it('first call AbortController is aborted when second call starts, and they are distinct instances', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          async (input1, input2) => {
            const { engine, chapterId } = createReadyEngine();

            const signals: AbortSignal[] = [];
            globalThis.fetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
              signals.push(init.signal!);
              // Return a promise that never resolves (simulates long-running request)
              return new Promise(() => {});
            });

            // Fire two generate() calls without awaiting the first
            void engine.generate({ userInput: input1, chapterId });
            void engine.generate({ userInput: input2, chapterId });

            // Wait a tick for both calls to have registered their fetch
            await new Promise((r) => setTimeout(r, 0));

            // The first call's signal should be aborted
            expect(signals.length).toBe(2);
            expect(signals[0].aborted).toBe(true);
            // The second call's signal should NOT be aborted
            expect(signals[1].aborted).toBe(false);
            // They must be distinct AbortSignal instances
            expect(signals[0]).not.toBe(signals[1]);

            // Clean up: abort remaining to let promises settle
            engine.abort();
          },
        ),
        { numRuns: 100 },
      );
    });
  });


  // Feature: ai-concurrency-safety, Property 2: 取消结果标识
  // **Validates: Requirements 1.3**
  describe('Property 2: 取消结果标识', () => {
    it('cancelled generate() returns cancelled === true, success === false, and no error message', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          async (input1, input2) => {
            const { engine, chapterId } = createReadyEngine();

            // Mock fetch that respects abort signals — rejects with AbortError when aborted
            globalThis.fetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
              const signal = init.signal!;
              return new Promise<Response>((_resolve, reject) => {
                if (signal.aborted) {
                  reject(new DOMException('The operation was aborted', 'AbortError'));
                  return;
                }
                signal.addEventListener('abort', () => {
                  reject(new DOMException('The operation was aborted', 'AbortError'));
                });
                // Otherwise never resolves (simulates long-running request)
              });
            });

            // Fire two calls; the first will be auto-cancelled by the second
            const p1 = engine.generate({ userInput: input1, chapterId });
            // Small delay to ensure p1's fetch is registered before p2 aborts it
            await new Promise((r) => setTimeout(r, 0));
            void engine.generate({ userInput: input2, chapterId });

            const result1 = await p1;

            expect(result1.success).toBe(false);
            expect(result1.cancelled).toBe(true);
            // Should NOT contain an error-type message
            expect(result1.error).toBeUndefined();

            // Clean up
            engine.abort();
          },
        ),
        { numRuns: 100 },
      );
    });
  });


  // Feature: ai-concurrency-safety, Property 3: 请求标识唯一性
  // **Validates: Requirements 3.1**
  describe('Property 3: 请求标识唯一性', () => {
    it('each generate() call produces a unique requestId (captured via fetch body)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }),
          async (n) => {
            const { engine, chapterId } = createReadyEngine();

            // Spy on crypto.randomUUID to capture generated IDs
            const generatedIds: string[] = [];
            const origUUID = crypto.randomUUID.bind(crypto);
            const uuidSpy = vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
              const id = origUUID();
              generatedIds.push(id);
              return id;
            });

            globalThis.fetch = vi.fn().mockImplementation(() => {
              return new Promise(() => {});
            });

            // Fire N generate() calls
            const promises: Promise<unknown>[] = [];
            for (let i = 0; i < n; i++) {
              promises.push(engine.generate({ userInput: `input-${i}`, chapterId }));
            }

            await new Promise((r) => setTimeout(r, 0));

            // All IDs should be unique
            const uniqueIds = new Set(generatedIds);
            expect(uniqueIds.size).toBe(n);

            // Clean up
            uuidSpy.mockRestore();
            engine.abort();
          },
        ),
        { numRuns: 100 },
      );
    });
  });


  // Feature: ai-concurrency-safety, Property 4: 仅活跃请求的 onChunk 被传递
  // **Validates: Requirements 3.2, 3.3, 3.5**
  describe('Property 4: 仅活跃请求的 onChunk 被传递', () => {
    it('only the last (active) request onChunk callback receives data; previous request chunks are discarded', async () => {
      // Use alphanumeric strings to avoid JSON-breaking characters in SSE payloads
      const alphaNum = 'abcdefghijklmnopqrstuvwxyz0123456789';
      const safeChar = fc.constantFrom(...alphaNum.split(''));
      const safeString = fc.array(safeChar, { minLength: 1, maxLength: 10 }).map((arr) => arr.join(''));

      await fc.assert(
        fc.asyncProperty(
          fc.array(safeString, { minLength: 1, maxLength: 5 }),
          fc.array(safeString, { minLength: 1, maxLength: 5 }),
          async (_chunks1, chunks2) => {
            const { engine, chapterId } = createReadyEngine();

            let fetchCallCount = 0;
            globalThis.fetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
              fetchCallCount++;
              const signal = init.signal!;

              if (fetchCallCount === 1) {
                // First call: return a response whose stream we never feed,
                // but that rejects on abort so the engine's catch block fires.
                return new Promise<Response>((_resolve, reject) => {
                  if (signal.aborted) {
                    reject(new DOMException('The operation was aborted', 'AbortError'));
                    return;
                  }
                  signal.addEventListener('abort', () => {
                    reject(new DOMException('The operation was aborted', 'AbortError'));
                  });
                });
              }

              // Second call: return a pre-built SSE stream with all chunks2 data
              return Promise.resolve(new Response(sseStream(chunks2), { status: 200 }));
            });

            const received1: string[] = [];
            const received2: string[] = [];

            // Start first generate (streaming)
            const p1 = engine.generate(
              { userInput: 'first', chapterId },
              (chunk) => received1.push(chunk),
            );

            // Let the first fetch call register
            await new Promise((r) => setTimeout(r, 0));

            // Start second generate — this auto-cancels the first
            const p2 = engine.generate(
              { userInput: 'second', chapterId },
              (chunk) => received2.push(chunk),
            );

            // Wait for both promises to settle
            const [r1, r2] = await Promise.all([p1, p2]);

            // The first request should be cancelled — no chunks delivered
            expect(received1).toEqual([]);
            expect(r1.cancelled).toBe(true);

            // The second request should have received all its chunks
            expect(received2).toEqual(chunks2);
            expect(r2.success).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

});

// ─── Skill System Property Tests ───

describe('resolveSkillPrompt — property tests', () => {
  function makeNoParamSkill(prompt: string): WritingSkill {
    return {
      id: 'no-param', name: '无参', icon: '📝', description: '',
      promptTemplate: prompt, parameters: [], contextHints: [],
      sortOrder: 0, builtIn: false, enabled: true,
    };
  }

  it('should be idempotent: resolving twice with same params yields same result', () => {
    const stores = setupStores();
    const engine = createAIAssistantEngine(stores);

    const skill: WritingSkill = {
      id: 'idem', name: '测试', icon: '🧪', description: '',
      promptTemplate: '关于{param:a}和{param:b}的故事',
      parameters: [
        { key: 'a', label: 'A', type: 'text', required: false },
        { key: 'b', label: 'B', type: 'text', required: false },
      ],
      contextHints: [], sortOrder: 0, builtIn: false, enabled: true,
    };

    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 20 }),
        fc.string({ minLength: 0, maxLength: 20 }),
        (a, b) => {
          const params = { a, b };
          const r1 = engine.resolveSkillPrompt(skill, params);
          const r2 = engine.resolveSkillPrompt(skill, params);
          expect(r1).toBe(r2);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should preserve template text when no {param:*} placeholders exist', () => {
    const stores = setupStores();
    const engine = createAIAssistantEngine(stores);

    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }).filter((s) => !s.includes('{param:')),
        (prompt) => {
          const skill = makeNoParamSkill(prompt);
          const result = engine.resolveSkillPrompt(skill, {});
          expect(result).toBe(prompt.replace(/ {2,}/g, ' ').trim());
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('recommendSkills — property tests', () => {
  it('should produce scores bounded in [0, 1] for any chapter content', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 5000 }),
        (content) => {
          const stores = setupStores();
          const engine = createAIAssistantEngine(stores);
          const ch = stores.chapterStore.createChapter('prop-proj', null, '章', 'chapter');
          stores.chapterStore.updateChapter(ch.id, { content });
          const results = engine.recommendSkills(ch.id, BUILT_IN_SKILLS);
          for (const r of results) {
            expect(r.score).toBeGreaterThanOrEqual(0);
            expect(r.score).toBeLessThanOrEqual(1);
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it('should produce stable ordering for same input', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 500 }),
        (content) => {
          const stores = setupStores();
          const engine = createAIAssistantEngine(stores);
          const ch = stores.chapterStore.createChapter('prop-proj', null, '章', 'chapter');
          stores.chapterStore.updateChapter(ch.id, { content });
          const r1 = engine.recommendSkills(ch.id, BUILT_IN_SKILLS);
          const r2 = engine.recommendSkills(ch.id, BUILT_IN_SKILLS);
          expect(r1.map((r) => r.skill.id)).toEqual(r2.map((r) => r.skill.id));
          expect(r1.map((r) => r.score)).toEqual(r2.map((r) => r.score));
        },
      ),
      { numRuns: 50 },
    );
  });
});

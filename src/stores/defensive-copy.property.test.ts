import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createCharacterStore } from './character-store';
import { createWorldStore } from './world-store';
import { createTimelineStore } from './timeline-store';
import { createPlotStore } from './plot-store';
import { createChapterStore } from './chapter-store';
import { createRelationshipStore } from './relationship-store';
import { createAIAssistantStore } from './ai-assistant-store';

// ── Arbitraries ──────────────────────────────────────────────────────

const arbNonEmptyStr = fc.string({ minLength: 1, maxLength: 20 });
const arbStringArray = fc.array(arbNonEmptyStr, { minLength: 1, maxLength: 5 });
const arbRecord = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 8 }),
  fc.string({ maxLength: 20 }),
  { minKeys: 1, maxKeys: 4 },
);

const arbCharacterData = fc.record({
  name: arbNonEmptyStr,
  aliases: arbStringArray,
  appearance: fc.string(),
  personality: fc.string(),
  backstory: fc.string(),
  customAttributes: arbRecord,
});

const arbWorldEntryData = fc.record({
  projectId: arbNonEmptyStr,
  type: fc.constantFrom('location', 'faction', 'rule', 'item'),
  name: arbNonEmptyStr,
  description: fc.string(),
  associatedCharacterIds: arbStringArray,
});

const arbTimelinePointData = fc.record({
  projectId: arbNonEmptyStr,
  label: arbNonEmptyStr,
  description: fc.string(),
  sortOrder: fc.nat({ max: 100 }),
  associatedChapterIds: arbStringArray,
  associatedCharacterIds: arbStringArray,
});

const arbPlotThreadData = fc.record({
  projectId: arbNonEmptyStr,
  name: arbNonEmptyStr,
  description: fc.string(),
  status: fc.constantFrom('pending' as const, 'in_progress' as const, 'resolved' as const),
  associatedChapterIds: arbStringArray,
});

const arbRelationshipType = fc.constantFrom(
  'family' as const, 'friend' as const, 'enemy' as const,
  'mentor' as const, 'lover' as const, 'ally' as const,
  'superior' as const, 'custom' as const,
);

const arbRelationshipData = fc.record({
  projectId: arbNonEmptyStr,
  sourceCharacterId: arbNonEmptyStr,
  targetCharacterId: arbNonEmptyStr,
  relationshipType: arbRelationshipType,
  description: arbNonEmptyStr,
  startTimelinePointId: arbNonEmptyStr,
  strength: fc.integer({ min: 1, max: 10 }),
});

const arbProviderData = fc.record({
  name: arbNonEmptyStr,
  apiKey: arbNonEmptyStr,
  modelName: arbNonEmptyStr,
  apiEndpoint: fc.constant('https://api.test.com/v1/chat'),
  timeoutMs: fc.integer({ min: 1000, max: 60000 }),
});

const arbTemplateData = fc.record({
  name: arbNonEmptyStr,
  systemPrompt: arbNonEmptyStr,
  userPromptTemplate: arbNonEmptyStr,
});

// ── Property 1: Store 防御性拷贝——嵌套结构不可变性 ─────────────────

describe('Feature: comprehensive-quality-audit, Property 1: Store 防御性拷贝——嵌套結構不可变性', () => {
  /**
   * Validates: Requirements 15.2, 15.4, 15.5, 15.6, 15.7, 15.8
   *
   * For any Store (CharacterStore, WorldStore, TimelineStore, PlotStore, AIAssistantStore),
   * mutating nested arrays/objects on a returned value must not affect subsequent get calls.
   */

  it('CharacterStore.getCharacter: mutating aliases and customAttributes does not affect internal state', () => {
    fc.assert(
      fc.property(arbCharacterData, (data) => {
        const store = createCharacterStore();
        const created = store.createCharacter('proj', data);

        const first = store.getCharacter(created.id)!;
        // Mutate nested structures
        first.aliases.push('INJECTED');
        first.aliases.length = 0;
        first.customAttributes['INJECTED_KEY'] = 'INJECTED_VAL';
        delete first.customAttributes[Object.keys(first.customAttributes)[0]];

        const second = store.getCharacter(created.id)!;
        expect(second.aliases).toEqual(data.aliases);
        expect(second.customAttributes).toEqual(data.customAttributes);
      }),
      { numRuns: 100 },
    );
  });

  it('WorldStore.getEntry: mutating associatedCharacterIds does not affect internal state', () => {
    fc.assert(
      fc.property(arbWorldEntryData, (data) => {
        const store = createWorldStore();
        const created = store.createEntry(data);

        const first = store.getEntry(created.id)!;
        const originalIds = [...data.associatedCharacterIds];
        first.associatedCharacterIds.push('INJECTED');
        first.associatedCharacterIds.length = 0;

        const second = store.getEntry(created.id)!;
        expect(second.associatedCharacterIds).toEqual(originalIds);
      }),
      { numRuns: 100 },
    );
  });

  it('TimelineStore.getTimelinePoint: mutating associatedChapterIds and associatedCharacterIds does not affect internal state', () => {
    fc.assert(
      fc.property(arbTimelinePointData, (data) => {
        const store = createTimelineStore();
        const created = store.createTimelinePoint(data);

        const first = store.getTimelinePoint(created.id)!;
        const origChapterIds = [...data.associatedChapterIds];
        const origCharacterIds = [...data.associatedCharacterIds];
        first.associatedChapterIds.push('INJECTED');
        first.associatedCharacterIds.push('INJECTED');
        first.associatedChapterIds.length = 0;
        first.associatedCharacterIds.length = 0;

        const second = store.getTimelinePoint(created.id)!;
        expect(second.associatedChapterIds).toEqual(origChapterIds);
        expect(second.associatedCharacterIds).toEqual(origCharacterIds);
      }),
      { numRuns: 100 },
    );
  });

  it('PlotStore.getThread: mutating associatedChapterIds does not affect internal state', () => {
    fc.assert(
      fc.property(arbPlotThreadData, (data) => {
        const store = createPlotStore();
        const created = store.createThread(data);

        const first = store.getThread(created.id)!;
        const origIds = [...data.associatedChapterIds];
        first.associatedChapterIds.push('INJECTED');
        first.associatedChapterIds.length = 0;

        const second = store.getThread(created.id)!;
        expect(second.associatedChapterIds).toEqual(origIds);
      }),
      { numRuns: 100 },
    );
  });

  it('AIAssistantStore.getConfig: mutating providers and promptTemplates does not affect internal state', () => {
    fc.assert(
      fc.property(
        fc.array(arbProviderData, { minLength: 1, maxLength: 3 }),
        fc.array(arbTemplateData, { minLength: 1, maxLength: 3 }),
        (providerDatas, templateDatas) => {
          const store = createAIAssistantStore();

          // Add providers and templates
          for (const pd of providerDatas) store.addProvider(pd);
          for (const td of templateDatas) store.addTemplate(td);

          const first = store.getConfig();
          const origProviderCount = first.providers.length;
          const origTemplateCount = first.promptTemplates.length;

          // Mutate returned arrays
          first.providers.push({ id: 'x', name: 'x', apiKey: 'x', modelName: 'x', apiEndpoint: 'x', timeoutMs: 0 });
          first.providers.length = 0;
          first.promptTemplates.push({ id: 'x', name: 'x', systemPrompt: 'x', userPromptTemplate: 'x' });
          first.promptTemplates.length = 0;

          const second = store.getConfig();
          expect(second.providers.length).toBe(origProviderCount);
          expect(second.promptTemplates.length).toBe(origTemplateCount);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Req 15.8: list methods return independent copies
  it('CharacterStore.listCharacters: each element is an independent copy', () => {
    fc.assert(
      fc.property(arbCharacterData, (data) => {
        const store = createCharacterStore();
        store.createCharacter('proj', data);

        const list = store.listCharacters('proj');
        expect(list.length).toBe(1);
        list[0].aliases.push('INJECTED');
        list[0].customAttributes['INJECTED'] = 'val';

        const list2 = store.listCharacters('proj');
        expect(list2[0].aliases).toEqual(data.aliases);
        expect(list2[0].customAttributes).toEqual(data.customAttributes);
      }),
      { numRuns: 100 },
    );
  });

  it('WorldStore.listEntries: each element is an independent copy', () => {
    fc.assert(
      fc.property(arbWorldEntryData, (data) => {
        const store = createWorldStore();
        store.createEntry(data);

        const list = store.listEntries(data.projectId);
        expect(list.length).toBe(1);
        const origIds = [...data.associatedCharacterIds];
        list[0].associatedCharacterIds.push('INJECTED');

        const list2 = store.listEntries(data.projectId);
        expect(list2[0].associatedCharacterIds).toEqual(origIds);
      }),
      { numRuns: 100 },
    );
  });

  it('TimelineStore.listTimelinePoints: each element is an independent copy', () => {
    fc.assert(
      fc.property(arbTimelinePointData, (data) => {
        const store = createTimelineStore();
        store.createTimelinePoint(data);

        const list = store.listTimelinePoints(data.projectId);
        expect(list.length).toBe(1);
        const origChapterIds = [...data.associatedChapterIds];
        list[0].associatedChapterIds.push('INJECTED');

        const list2 = store.listTimelinePoints(data.projectId);
        expect(list2[0].associatedChapterIds).toEqual(origChapterIds);
      }),
      { numRuns: 100 },
    );
  });

  it('PlotStore.listThreads: each element is an independent copy', () => {
    fc.assert(
      fc.property(arbPlotThreadData, (data) => {
        const store = createPlotStore();
        store.createThread(data);

        const list = store.listThreads(data.projectId);
        expect(list.length).toBe(1);
        const origIds = [...data.associatedChapterIds];
        list[0].associatedChapterIds.push('INJECTED');

        const list2 = store.listThreads(data.projectId);
        expect(list2[0].associatedChapterIds).toEqual(origIds);
      }),
      { numRuns: 100 },
    );
  });
});

// ── Property 2: Store 防御性拷贝——简单字段不可变性 ─────────────────

describe('Feature: comprehensive-quality-audit, Property 2: Store 防御性拷贝——简单字段不可变性', () => {
  /**
   * Validates: Requirements 15.1, 15.3
   *
   * For ChapterStore and RelationshipStore, mutating simple fields on a returned
   * value must not affect subsequent get calls.
   */

  it('ChapterStore.getChapter: mutating title and content does not affect internal state', () => {
    fc.assert(
      fc.property(
        arbNonEmptyStr,
        fc.string({ maxLength: 200 }),
        (title, content) => {
          const store = createChapterStore();
          const created = store.createChapter('proj', null, title, 'chapter');
          store.updateChapter(created.id, { content });

          const first = store.getChapter(created.id)!;
          first.title = 'MUTATED_TITLE';
          first.content = 'MUTATED_CONTENT';

          const second = store.getChapter(created.id)!;
          expect(second.title).toBe(title);
          expect(second.content).toBe(content);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('RelationshipStore.getRelationship: mutating description and relationshipType does not affect internal state', () => {
    fc.assert(
      fc.property(arbRelationshipData, (data) => {
        const store = createRelationshipStore();
        const created = store.createRelationship(data);

        const first = store.getRelationship(created.id)!;
        const origDesc = data.description;
        const origType = data.relationshipType;
        first.description = 'MUTATED_DESC';
        (first as any).relationshipType = 'MUTATED_TYPE';

        const second = store.getRelationship(created.id)!;
        expect(second.description).toBe(origDesc);
        expect(second.relationshipType).toBe(origType);
      }),
      { numRuns: 100 },
    );
  });

  // Also verify list methods for simple-field stores (Req 15.8 overlap)
  it('ChapterStore.listChapters: each element is an independent copy', () => {
    fc.assert(
      fc.property(arbNonEmptyStr, (title) => {
        const store = createChapterStore();
        store.createChapter('proj', null, title, 'chapter');

        const list = store.listChapters('proj');
        expect(list.length).toBe(1);
        list[0].title = 'MUTATED';

        const list2 = store.listChapters('proj');
        expect(list2[0].title).toBe(title);
      }),
      { numRuns: 100 },
    );
  });

  it('RelationshipStore.listRelationships: each element is an independent copy', () => {
    fc.assert(
      fc.property(arbRelationshipData, (data) => {
        const store = createRelationshipStore();
        store.createRelationship(data);

        const list = store.listRelationships(data.projectId);
        expect(list.length).toBe(1);
        const origDesc = data.description;
        list[0].description = 'MUTATED';

        const list2 = store.listRelationships(data.projectId);
        expect(list2[0].description).toBe(origDesc);
      }),
      { numRuns: 100 },
    );
  });
});

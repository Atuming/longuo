import { describe, it, expect } from 'vitest';
import { createWorldStore } from './world-store';
import type { WorldEntry } from '../types/world';
import { BUILT_IN_CATEGORIES } from '../types/world';

const PROJECT_ID = 'project-1';

function makeEntryData(overrides?: Partial<Omit<WorldEntry, 'id'>>): Omit<WorldEntry, 'id'> {
  return {
    projectId: PROJECT_ID,
    type: 'location',
    name: 'Test Location',
    description: 'A test location',
    associatedCharacterIds: [],
    ...overrides,
  };
}

describe('WorldStore', () => {
  // --- createEntry & getEntry ---
  it('should create an entry and retrieve it by id', () => {
    const store = createWorldStore();
    const entry = store.createEntry(makeEntryData({ name: 'Winterfell' }));
    expect(entry.id).toBeDefined();
    expect(entry.name).toBe('Winterfell');
    expect(entry.type).toBe('location');

    const fetched = store.getEntry(entry.id);
    expect(fetched).toEqual(entry);
  });

  it('should return undefined for non-existent entry', () => {
    const store = createWorldStore();
    expect(store.getEntry('non-existent')).toBeUndefined();
  });

  it('should support all original types and new built-in types', () => {
    const store = createWorldStore();
    const loc = store.createEntry(makeEntryData({ type: 'location', name: 'City' }));
    const fac = store.createEntry(makeEntryData({ type: 'faction', name: 'Guild' }));
    const rule = store.createEntry(makeEntryData({ type: 'rule', name: 'Magic System', category: 'magic' }));
    const item = store.createEntry(makeEntryData({ type: 'item', name: 'Sword' }));
    const custom = store.createEntry(makeEntryData({ type: 'my-custom-type', name: 'Custom Entry' }));

    expect(loc.type).toBe('location');
    expect(fac.type).toBe('faction');
    expect(rule.type).toBe('rule');
    expect(rule.category).toBe('magic');
    expect(item.type).toBe('item');
    expect(custom.type).toBe('my-custom-type');
  });

  it('should preserve category field for rule type', () => {
    const store = createWorldStore();
    const entry = store.createEntry(makeEntryData({ type: 'rule', name: 'Law', category: 'governance' }));
    const fetched = store.getEntry(entry.id);
    expect(fetched?.category).toBe('governance');
  });

  // --- listEntries ---
  it('should list entries for a specific project', () => {
    const store = createWorldStore();
    store.createEntry(makeEntryData({ name: 'A' }));
    store.createEntry(makeEntryData({ name: 'B' }));
    store.createEntry(makeEntryData({ name: 'C', projectId: 'other-project' }));

    const list = store.listEntries(PROJECT_ID);
    expect(list).toHaveLength(2);
    expect(list.map((e) => e.name).sort()).toEqual(['A', 'B']);
  });

  // --- filterByType ---
  it('should filter entries by type', () => {
    const store = createWorldStore();
    store.createEntry(makeEntryData({ type: 'location', name: 'City' }));
    store.createEntry(makeEntryData({ type: 'faction', name: 'Guild' }));
    store.createEntry(makeEntryData({ type: 'rule', name: 'Law' }));
    store.createEntry(makeEntryData({ type: 'location', name: 'Forest' }));

    const locations = store.filterByType(PROJECT_ID, 'location');
    expect(locations).toHaveLength(2);
    expect(locations.every((e) => e.type === 'location')).toBe(true);

    const factions = store.filterByType(PROJECT_ID, 'faction');
    expect(factions).toHaveLength(1);
    expect(factions[0].name).toBe('Guild');
  });

  // --- searchEntries ---
  it('should search entries by name (case-insensitive, contains)', () => {
    const store = createWorldStore();
    store.createEntry(makeEntryData({ name: 'Dark Forest' }));
    store.createEntry(makeEntryData({ name: 'Bright City' }));
    store.createEntry(makeEntryData({ name: 'Darkwood Village' }));

    const results = store.searchEntries(PROJECT_ID, 'dark');
    expect(results).toHaveLength(2);
    expect(results.map((e) => e.name).sort()).toEqual(['Dark Forest', 'Darkwood Village']);
  });

  it('should return all entries when search query is empty', () => {
    const store = createWorldStore();
    store.createEntry(makeEntryData({ name: 'A' }));
    store.createEntry(makeEntryData({ name: 'B' }));

    const results = store.searchEntries(PROJECT_ID, '');
    expect(results).toHaveLength(2);
  });

  it('should only search within the specified project', () => {
    const store = createWorldStore();
    store.createEntry(makeEntryData({ name: 'Shared Name' }));
    store.createEntry(makeEntryData({ name: 'Shared Name', projectId: 'other' }));

    const results = store.searchEntries(PROJECT_ID, 'Shared');
    expect(results).toHaveLength(1);
  });

  // --- updateEntry ---
  it('should update entry fields', () => {
    const store = createWorldStore();
    const entry = store.createEntry(makeEntryData({ name: 'Old Name', description: 'Old desc' }));

    store.updateEntry(entry.id, { name: 'New Name', description: 'New desc' });
    const updated = store.getEntry(entry.id);
    expect(updated?.name).toBe('New Name');
    expect(updated?.description).toBe('New desc');
  });

  it('should update associatedCharacterIds', () => {
    const store = createWorldStore();
    const entry = store.createEntry(makeEntryData({ associatedCharacterIds: ['c1'] }));

    store.updateEntry(entry.id, { associatedCharacterIds: ['c1', 'c2', 'c3'] });
    const updated = store.getEntry(entry.id);
    expect(updated?.associatedCharacterIds).toEqual(['c1', 'c2', 'c3']);
  });

  it('should not throw when updating non-existent entry', () => {
    const store = createWorldStore();
    expect(() => store.updateEntry('non-existent', { name: 'X' })).not.toThrow();
  });

  // --- deleteEntry ---
  it('should delete an entry', () => {
    const store = createWorldStore();
    const entry = store.createEntry(makeEntryData({ name: 'ToDelete' }));
    expect(store.getEntry(entry.id)).toBeDefined();

    store.deleteEntry(entry.id);
    expect(store.getEntry(entry.id)).toBeUndefined();
  });

  it('should not throw when deleting non-existent entry', () => {
    const store = createWorldStore();
    expect(() => store.deleteEntry('non-existent')).not.toThrow();
  });

  // --- Defensive copy ---
  it('should return defensive copies (mutations do not affect store)', () => {
    const store = createWorldStore();
    const entry = store.createEntry(makeEntryData({ name: 'Original', associatedCharacterIds: ['c1'] }));

    // Mutate the returned object
    entry.name = 'Mutated';
    entry.associatedCharacterIds.push('c99');

    const fetched = store.getEntry(entry.id);
    expect(fetched?.name).toBe('Original');
    expect(fetched?.associatedCharacterIds).toEqual(['c1']);
  });

  it('should return defensive copies from listEntries', () => {
    const store = createWorldStore();
    const entry = store.createEntry(makeEntryData({ name: 'Listed' }));

    const list = store.listEntries(PROJECT_ID);
    list[0].name = 'Mutated';

    const fetched = store.getEntry(entry.id);
    expect(fetched?.name).toBe('Listed');
  });

  // --- BUILT_IN_CATEGORIES ---
  describe('BUILT_IN_CATEGORIES', () => {
    it('should contain exactly 11 built-in categories', () => {
      expect(BUILT_IN_CATEGORIES).toHaveLength(11);
    });

    it('should have key, label, and color for every category', () => {
      for (const cat of BUILT_IN_CATEGORIES) {
        expect(cat.key).toBeTruthy();
        expect(typeof cat.key).toBe('string');
        expect(cat.label).toBeTruthy();
        expect(typeof cat.label).toBe('string');
        expect(cat.color).toBeDefined();
        expect(typeof cat.color.bg).toBe('string');
        expect(typeof cat.color.text).toBe('string');
      }
    });

    it('should have unique keys', () => {
      const keys = BUILT_IN_CATEGORIES.map((c) => c.key);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });

  // --- Custom Category CRUD ---
  describe('Custom Category CRUD', () => {
    it('should add a custom category and list it', () => {
      const store = createWorldStore();
      const cat = store.addCustomCategory(PROJECT_ID, '灵兽');
      expect(cat.key).toBeTruthy();
      expect(cat.label).toBe('灵兽');

      const list = store.listCustomCategories(PROJECT_ID);
      expect(list).toHaveLength(1);
      expect(list[0].label).toBe('灵兽');
    });

    it('should reject empty category names', () => {
      const store = createWorldStore();
      expect(() => store.addCustomCategory(PROJECT_ID, '')).toThrow();
      expect(() => store.addCustomCategory(PROJECT_ID, '   ')).toThrow();
    });

    it('should reject duplicate names with built-in categories', () => {
      const store = createWorldStore();
      const builtInLabel = BUILT_IN_CATEGORIES[0].label;
      expect(() => store.addCustomCategory(PROJECT_ID, builtInLabel)).toThrow();
    });

    it('should reject duplicate names with existing custom categories', () => {
      const store = createWorldStore();
      store.addCustomCategory(PROJECT_ID, '灵兽');
      expect(() => store.addCustomCategory(PROJECT_ID, '灵兽')).toThrow();
    });

    it('should update a custom category label', () => {
      const store = createWorldStore();
      const cat = store.addCustomCategory(PROJECT_ID, '灵兽');
      store.updateCustomCategory(PROJECT_ID, cat.key, '神兽');

      const list = store.listCustomCategories(PROJECT_ID);
      expect(list).toHaveLength(1);
      expect(list[0].label).toBe('神兽');
    });

    it('should delete a custom category', () => {
      const store = createWorldStore();
      const cat = store.addCustomCategory(PROJECT_ID, '灵兽');
      expect(store.listCustomCategories(PROJECT_ID)).toHaveLength(1);

      store.deleteCustomCategory(PROJECT_ID, cat.key);
      expect(store.listCustomCategories(PROJECT_ID)).toHaveLength(0);
    });
  });

  // --- Delete category fallback ---
  describe('Delete category fallback', () => {
    it('should reset referencing entries to rule when custom category is deleted', () => {
      const store = createWorldStore();
      const cat = store.addCustomCategory(PROJECT_ID, '灵兽');

      // Create entries referencing the custom category
      const entry1 = store.createEntry(makeEntryData({ type: cat.key, name: 'Phoenix' }));
      const entry2 = store.createEntry(makeEntryData({ type: cat.key, name: 'Dragon' }));
      // Create an entry with a different type that should not be affected
      const entry3 = store.createEntry(makeEntryData({ type: 'location', name: 'Mountain' }));

      store.deleteCustomCategory(PROJECT_ID, cat.key);

      expect(store.getEntry(entry1.id)?.type).toBe('rule');
      expect(store.getEntry(entry2.id)?.type).toBe('rule');
      expect(store.getEntry(entry3.id)?.type).toBe('location');
    });
  });

  // --- getAllCategories ---
  describe('getAllCategories', () => {
    it('should return built-in categories plus custom categories', () => {
      const store = createWorldStore();
      store.addCustomCategory(PROJECT_ID, '灵兽');
      store.addCustomCategory(PROJECT_ID, '阵法');

      const all = store.getAllCategories(PROJECT_ID);
      expect(all).toHaveLength(BUILT_IN_CATEGORIES.length + 2);

      const builtInResults = all.filter((c) => c.isBuiltIn);
      expect(builtInResults).toHaveLength(BUILT_IN_CATEGORIES.length);

      const customResults = all.filter((c) => !c.isBuiltIn);
      expect(customResults).toHaveLength(2);
      expect(customResults.map((c) => c.label).sort()).toEqual(['灵兽', '阵法'].sort());
    });
  });
});

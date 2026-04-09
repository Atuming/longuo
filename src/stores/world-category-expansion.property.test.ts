import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createWorldStore } from './world-store';
import type { CustomWorldCategory } from '../types/world';

// Feature: world-category-expansion, Property 1: WorldEntry type 字段通用性
// **Validates: Requirements 1.5, 3.4, 6.1**

const PROJECT_ID = 'prop-test-project';

/**
 * Arbitrary: non-empty string for WorldEntry type values.
 * Includes built-in category keys and arbitrary custom strings.
 */
const arbNonEmptyType = fc.string({ minLength: 1 });

/**
 * Arbitrary: a simple non-empty name for entries.
 */
const arbEntryName = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);

describe('Property 1: WorldEntry type 字段通用性', () => {
  it('any non-empty string type should round-trip through all store operations', () => {
    fc.assert(
      fc.property(arbNonEmptyType, arbEntryName, (type, name) => {
        const store = createWorldStore();

        // 1. Create a WorldEntry with the arbitrary type
        const created = store.createEntry({
          projectId: PROJECT_ID,
          type,
          name,
          description: 'property test entry',
          associatedCharacterIds: [],
        });

        expect(created.type).toBe(type);
        expect(created.name).toBe(name);
        expect(created.id).toBeDefined();

        // 2. getEntry returns the same type
        const fetched = store.getEntry(created.id);
        expect(fetched).toBeDefined();
        expect(fetched!.type).toBe(type);

        // 3. listEntries includes it
        const listed = store.listEntries(PROJECT_ID);
        const found = listed.find((e) => e.id === created.id);
        expect(found).toBeDefined();
        expect(found!.type).toBe(type);

        // 4. filterByType with that type returns it
        const filtered = store.filterByType(PROJECT_ID, type);
        const filteredEntry = filtered.find((e) => e.id === created.id);
        expect(filteredEntry).toBeDefined();
        expect(filteredEntry!.type).toBe(type);

        // 5. searchEntries finds it by name
        const searched = store.searchEntries(PROJECT_ID, name);
        const searchedEntry = searched.find((e) => e.id === created.id);
        expect(searchedEntry).toBeDefined();
        expect(searchedEntry!.type).toBe(type);

        // 6. updateEntry works — update description, type should remain
        store.updateEntry(created.id, { description: 'updated description' });
        const afterUpdate = store.getEntry(created.id);
        expect(afterUpdate).toBeDefined();
        expect(afterUpdate!.type).toBe(type);
        expect(afterUpdate!.description).toBe('updated description');

        // 7. deleteEntry works
        store.deleteEntry(created.id);
        const afterDelete = store.getEntry(created.id);
        expect(afterDelete).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });
});


// Feature: world-category-expansion, Property 2: 自定义分类 CRUD 往返一致性
// **Validates: Requirements 2.1, 2.5, 2.6**

const BUILT_IN_LABELS = [
  '地点', '势力', '规则', '物品/道具', '种族/物种',
  '魔法/能力', '历史/事件', '文化/习俗', '科技/技术',
  '货币/经济', '宗教/信仰',
];

/**
 * Arbitrary: valid custom category label.
 * Non-empty, non-whitespace-only, and not matching any built-in category label.
 */
const arbCustomLabel = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => s.trim().length > 0 && !BUILT_IN_LABELS.includes(s.trim()));

/**
 * Arbitrary: a pair of distinct valid custom category labels for create + update.
 */
const arbDistinctLabels = fc
  .tuple(arbCustomLabel, arbCustomLabel)
  .filter(([a, b]) => a.trim() !== b.trim());

describe('Property 2: 自定义分类 CRUD 往返一致性', () => {
  it('addCustomCategory → listCustomCategories should contain the created category with correct label', () => {
    fc.assert(
      fc.property(arbCustomLabel, (label) => {
        const store = createWorldStore();

        const created = store.addCustomCategory(PROJECT_ID, label);

        expect(created.key).toBeDefined();
        expect(created.label).toBe(label.trim());

        const list = store.listCustomCategories(PROJECT_ID);
        const found = list.find((c) => c.key === created.key);
        expect(found).toBeDefined();
        expect(found!.label).toBe(label.trim());
      }),
      { numRuns: 100 },
    );
  });

  it('updateCustomCategory should reflect the new label in listCustomCategories', () => {
    fc.assert(
      fc.property(arbDistinctLabels, ([originalLabel, newLabel]) => {
        const store = createWorldStore();

        const created = store.addCustomCategory(PROJECT_ID, originalLabel);

        store.updateCustomCategory(PROJECT_ID, created.key, newLabel);

        const list = store.listCustomCategories(PROJECT_ID);
        const found = list.find((c) => c.key === created.key);
        expect(found).toBeDefined();
        expect(found!.label).toBe(newLabel.trim());
      }),
      { numRuns: 100 },
    );
  });

  it('deleteCustomCategory should remove the category from listCustomCategories', () => {
    fc.assert(
      fc.property(arbCustomLabel, (label) => {
        const store = createWorldStore();

        const created = store.addCustomCategory(PROJECT_ID, label);

        // Verify it exists
        expect(store.listCustomCategories(PROJECT_ID).some((c) => c.key === created.key)).toBe(true);

        store.deleteCustomCategory(PROJECT_ID, created.key);

        // Verify it's gone
        expect(store.listCustomCategories(PROJECT_ID).some((c) => c.key === created.key)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('full CRUD round-trip: create → read → update → read → delete → read', () => {
    fc.assert(
      fc.property(arbDistinctLabels, ([originalLabel, updatedLabel]) => {
        const store = createWorldStore();

        // Create
        const created = store.addCustomCategory(PROJECT_ID, originalLabel);
        expect(created.label).toBe(originalLabel.trim());

        // Read after create
        const afterCreate = store.listCustomCategories(PROJECT_ID);
        expect(afterCreate.find((c) => c.key === created.key)?.label).toBe(originalLabel.trim());

        // Update
        store.updateCustomCategory(PROJECT_ID, created.key, updatedLabel);

        // Read after update
        const afterUpdate = store.listCustomCategories(PROJECT_ID);
        expect(afterUpdate.find((c) => c.key === created.key)?.label).toBe(updatedLabel.trim());

        // Delete
        store.deleteCustomCategory(PROJECT_ID, created.key);

        // Read after delete
        const afterDelete = store.listCustomCategories(PROJECT_ID);
        expect(afterDelete.find((c) => c.key === created.key)).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });
});


// Feature: world-category-expansion, Property 3: 自定义分类名称验证
// **Validates: Requirements 2.2, 2.3, 2.4**

/**
 * Arbitrary: empty or whitespace-only strings.
 */
const arbEmptyOrWhitespace = fc.oneof(
  fc.constant(''),
  fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 20 }).map((chars) => chars.join('')),
);

describe('Property 3: 自定义分类名称验证', () => {
  it('empty or whitespace-only strings should be rejected by addCustomCategory', () => {
    fc.assert(
      fc.property(arbEmptyOrWhitespace, (label) => {
        const store = createWorldStore();

        expect(() => store.addCustomCategory(PROJECT_ID, label)).toThrow();

        // List should remain empty
        expect(store.listCustomCategories(PROJECT_ID)).toHaveLength(0);
      }),
      { numRuns: 100 },
    );
  });

  it('built-in category labels should be rejected and list should be unchanged', () => {
    fc.assert(
      fc.property(fc.constantFrom(...BUILT_IN_LABELS), (builtInLabel) => {
        const store = createWorldStore();

        // Snapshot list before attempt
        const listBefore = store.listCustomCategories(PROJECT_ID);

        expect(() => store.addCustomCategory(PROJECT_ID, builtInLabel)).toThrow();

        // List should be unchanged
        const listAfter = store.listCustomCategories(PROJECT_ID);
        expect(listAfter).toEqual(listBefore);
      }),
      { numRuns: 100 },
    );
  });

  it('duplicate custom category labels should be rejected and list should be unchanged', () => {
    fc.assert(
      fc.property(arbCustomLabel, (label) => {
        const store = createWorldStore();

        // First creation should succeed
        const created = store.addCustomCategory(PROJECT_ID, label);
        const listAfterFirst = store.listCustomCategories(PROJECT_ID);
        expect(listAfterFirst).toHaveLength(1);
        expect(listAfterFirst[0].label).toBe(label.trim());

        // Second creation with same label should be rejected
        expect(() => store.addCustomCategory(PROJECT_ID, label)).toThrow();

        // List should be unchanged (still only the first one)
        const listAfterSecond = store.listCustomCategories(PROJECT_ID);
        expect(listAfterSecond).toHaveLength(1);
        expect(listAfterSecond[0].key).toBe(created.key);
        expect(listAfterSecond[0].label).toBe(label.trim());
      }),
      { numRuns: 100 },
    );
  });
});


// Feature: world-category-expansion, Property 4: 删除自定义分类条目回退
// **Validates: Requirements 2.7**

describe('Property 4: 删除自定义分类条目回退', () => {
  /**
   * Arbitrary: a non-empty array of booleans indicating whether each entry
   * should reference the custom category (true) or use a different type (false).
   * At least one entry must reference the custom category.
   */
  const arbEntryAssignments = fc
    .array(fc.boolean(), { minLength: 1, maxLength: 20 })
    .filter((arr) => arr.some((v) => v) && arr.some((v) => !v));

  it('deleting a custom category should reset referencing entries to rule and leave others unchanged', () => {
    fc.assert(
      fc.property(arbCustomLabel, arbEntryAssignments, (label, assignments) => {
        const store = createWorldStore();

        // 1. Create a custom category
        const category = store.addCustomCategory(PROJECT_ID, label);

        // 2. Create WorldEntries — some with the custom category key, some with 'location'
        const otherType = 'location';
        const createdEntries = assignments.map((useCustom, i) => {
          return store.createEntry({
            projectId: PROJECT_ID,
            type: useCustom ? category.key : otherType,
            name: `entry-${i}`,
            description: `desc-${i}`,
            associatedCharacterIds: [],
          });
        });

        // 3. Delete the custom category
        store.deleteCustomCategory(PROJECT_ID, category.key);

        // 4 & 5. Verify each entry
        for (let i = 0; i < createdEntries.length; i++) {
          const entry = store.getEntry(createdEntries[i].id);
          expect(entry).toBeDefined();

          if (assignments[i]) {
            // Referenced the deleted category → should now be 'rule'
            expect(entry!.type).toBe('rule');
          } else {
            // Used a different type → should be unchanged
            expect(entry!.type).toBe(otherType);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});


// Feature: world-category-expansion, Property 5: 按分类筛选正确性（扩展）
// **Validates: Requirements 4.4, 6.3**

describe('Property 5: 按分类筛选正确性（扩展）', () => {
  /**
   * Arbitrary: a type string drawn from a mix of built-in keys and arbitrary custom strings.
   */
  const arbMixedType = fc.oneof(
    fc.constantFrom('location', 'faction', 'rule', 'item', 'race', 'magic', 'history', 'culture', 'technology', 'economy', 'religion'),
    arbNonEmptyType,
  );

  /**
   * Arbitrary: a non-empty array of WorldEntry-like objects with mixed types.
   */
  const arbEntryList = fc.array(
    fc.record({
      type: arbMixedType,
      name: arbEntryName,
    }),
    { minLength: 1, maxLength: 30 },
  );

  it('filterByType should return exactly the entries matching the given type', () => {
    fc.assert(
      fc.property(arbEntryList, arbMixedType, (entrySpecs, filterType) => {
        const store = createWorldStore();

        // Create all entries
        const created = entrySpecs.map((spec) =>
          store.createEntry({
            projectId: PROJECT_ID,
            type: spec.type,
            name: spec.name,
            description: 'test',
            associatedCharacterIds: [],
          }),
        );

        // Filter by the chosen type
        const filtered = store.filterByType(PROJECT_ID, filterType);

        // Property A: every returned entry has the correct type
        for (const entry of filtered) {
          expect(entry.type).toBe(filterType);
        }

        // Property B: no matching entries were missed (count matches)
        const expectedCount = created.filter((e) => e.type === filterType).length;
        expect(filtered).toHaveLength(expectedCount);
      }),
      { numRuns: 100 },
    );
  });
});


// Feature: world-category-expansion, Property 6: 自定义分类持久化往返一致性
// **Validates: Requirements 6.4**

/**
 * Arbitrary: a UUID-like string key for custom categories.
 */
const arbUuidKey = fc
  .tuple(
    fc.array(fc.constantFrom(...'0123456789abcdef'.split('')), { minLength: 8, maxLength: 8 }),
    fc.array(fc.constantFrom(...'0123456789abcdef'.split('')), { minLength: 4, maxLength: 4 }),
    fc.array(fc.constantFrom(...'0123456789abcdef'.split('')), { minLength: 4, maxLength: 4 }),
    fc.array(fc.constantFrom(...'0123456789abcdef'.split('')), { minLength: 4, maxLength: 4 }),
    fc.array(fc.constantFrom(...'0123456789abcdef'.split('')), { minLength: 12, maxLength: 12 }),
  )
  .map(([a, b, c, d, e]) => `${a.join('')}-${b.join('')}-${c.join('')}-${d.join('')}-${e.join('')}`);

/**
 * Arbitrary: a non-empty label string for custom categories.
 */
const arbCategoryLabel = fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0);

/**
 * Arbitrary: a single CustomWorldCategory object.
 */
const arbCustomWorldCategory: fc.Arbitrary<CustomWorldCategory> = fc.record({
  key: arbUuidKey,
  label: arbCategoryLabel,
});

/**
 * Arbitrary: an array of CustomWorldCategory objects.
 */
const arbCustomWorldCategoryList = fc.array(arbCustomWorldCategory, { minLength: 0, maxLength: 20 });

describe('Property 6: 自定义分类持久化往返一致性', () => {
  it('serializing customWorldCategories to JSON and deserializing should produce a deeply equal result', () => {
    fc.assert(
      fc.property(arbCustomWorldCategoryList, (categories) => {
        const data = { customWorldCategories: categories };

        // Serialize to JSON
        const json = JSON.stringify(data);

        // Deserialize from JSON
        const parsed = JSON.parse(json);

        // The round-tripped customWorldCategories should be deeply equal to the original
        expect(parsed.customWorldCategories).toEqual(categories);
      }),
      { numRuns: 100 },
    );
  });
});

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createChapterStore } from './chapter-store';
import type { Chapter } from '../types/chapter';

// ── Helpers ──────────────────────────────────────────────────────────

const PROJECT_ID = 'proj-reorder-pbt';

/**
 * Verify that for a given parentId, all children have sortOrder
 * values from 0 to N-1 (consecutive, no duplicates).
 */
function verifySortOrderConsecutive(
  chapters: Chapter[],
  parentId: string | null,
): { valid: boolean; details: string } {
  const children = chapters
    .filter((ch) => ch.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (children.length === 0) return { valid: true, details: 'no children' };

  const sortOrders = children.map((ch) => ch.sortOrder);

  for (let i = 0; i < sortOrders.length; i++) {
    if (sortOrders[i] !== i) {
      return {
        valid: false,
        details: `parentId=${parentId}, expected sortOrder ${i} at index ${i}, got ${sortOrders[i]}. All sortOrders: [${sortOrders.join(', ')}]`,
      };
    }
  }

  // Check for duplicates
  const unique = new Set(sortOrders);
  if (unique.size !== sortOrders.length) {
    return {
      valid: false,
      details: `parentId=${parentId}, duplicate sortOrders found: [${sortOrders.join(', ')}]`,
    };
  }

  return { valid: true, details: 'ok' };
}

/**
 * Verify sortOrder consecutive for ALL parent groups in the chapter list.
 */
function verifyAllParentGroups(chapters: Chapter[]): { valid: boolean; details: string } {
  // Collect all unique parentIds
  const parentIds = new Set<string | null>();
  for (const ch of chapters) {
    parentIds.add(ch.parentId);
  }

  for (const parentId of parentIds) {
    const result = verifySortOrderConsecutive(chapters, parentId);
    if (!result.valid) return result;
  }

  return { valid: true, details: 'all groups ok' };
}

// ── Arbitraries ──────────────────────────────────────────────────────

/** Generate a number of root-level chapters (volumes) */
const arbRootCount = fc.integer({ min: 2, max: 5 });

/** Generate a number of child chapters per parent */
const arbChildCount = fc.integer({ min: 0, max: 3 });

/** Arbitrary for chapter level */
const arbLevel = fc.constantFrom('volume' as const, 'chapter' as const, 'section' as const);

// ── Property 7: 章节拖拽后 sortOrder 连续无重复 ─────────────────────

describe('Feature: comprehensive-quality-audit, Property 7: 章节拖拽后 sortOrder 连续无重复', () => {
  /**
   * **Validates: Requirements 4.4, 4.5**
   *
   * For any chapter tree and any legal reorder operation (reorderChapter),
   * after the operation, all children under each parent have sortOrder
   * values from 0 to N-1 (consecutive, no duplicates).
   */

  it('same-parent reorder preserves consecutive sortOrder', () => {
    fc.assert(
      fc.property(
        arbRootCount,
        fc.integer({ min: 0, max: 20 }),
        (rootCount, reorderSeed) => {
          const store = createChapterStore();

          // Create root-level chapters
          const roots: Chapter[] = [];
          for (let i = 0; i < rootCount; i++) {
            const ch = store.createChapter(PROJECT_ID, null, `Root ${i}`, 'volume');
            roots.push(ch);
          }

          // Pick a chapter to reorder (within same parent)
          const pickIndex = reorderSeed % roots.length;
          const picked = roots[Math.abs(pickIndex)];
          const newSortOrder = Math.abs(reorderSeed) % (rootCount + 1);

          store.reorderChapter(picked.id, newSortOrder);

          // Verify
          const allChapters = store.listChapters(PROJECT_ID);
          const result = verifyAllParentGroups(allChapters);
          expect(result.valid, result.details).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('cross-parent reorder preserves consecutive sortOrder for both parents', () => {
    fc.assert(
      fc.property(
        arbRootCount,
        arbChildCount,
        arbChildCount,
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (rootCount, childCountA, childCountB, pickSeed, orderSeed) => {
          const store = createChapterStore();

          // Create two root-level volumes
          const parentA = store.createChapter(PROJECT_ID, null, 'Parent A', 'volume');
          const parentB = store.createChapter(PROJECT_ID, null, 'Parent B', 'volume');

          // Create additional roots to make it more interesting
          for (let i = 2; i < rootCount; i++) {
            store.createChapter(PROJECT_ID, null, `Root ${i}`, 'volume');
          }

          // Create children under parentA
          const childrenA: Chapter[] = [];
          for (let i = 0; i < Math.max(1, childCountA); i++) {
            const ch = store.createChapter(PROJECT_ID, parentA.id, `A-child-${i}`, 'chapter');
            childrenA.push(ch);
          }

          // Create children under parentB
          for (let i = 0; i < childCountB; i++) {
            store.createChapter(PROJECT_ID, parentB.id, `B-child-${i}`, 'chapter');
          }

          // Pick a child from parentA to move to parentB
          const pickIndex = Math.abs(pickSeed) % childrenA.length;
          const picked = childrenA[pickIndex];
          const newSortOrder = Math.abs(orderSeed) % (childCountB + 2);

          store.reorderChapter(picked.id, newSortOrder, parentB.id);

          // Verify all parent groups
          const allChapters = store.listChapters(PROJECT_ID);
          const result = verifyAllParentGroups(allChapters);
          expect(result.valid, result.details).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('reorder to root (null parent) preserves consecutive sortOrder', () => {
    fc.assert(
      fc.property(
        arbRootCount,
        arbChildCount,
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (rootCount, childCount, pickSeed, orderSeed) => {
          const store = createChapterStore();

          // Create root-level volumes
          const roots: Chapter[] = [];
          for (let i = 0; i < rootCount; i++) {
            const ch = store.createChapter(PROJECT_ID, null, `Root ${i}`, 'volume');
            roots.push(ch);
          }

          // Create children under first root
          const children: Chapter[] = [];
          const actualChildCount = Math.max(1, childCount);
          for (let i = 0; i < actualChildCount; i++) {
            const ch = store.createChapter(PROJECT_ID, roots[0].id, `Child ${i}`, 'chapter');
            children.push(ch);
          }

          // Move a child to root level
          const pickIndex = Math.abs(pickSeed) % children.length;
          const picked = children[pickIndex];
          const newSortOrder = Math.abs(orderSeed) % (rootCount + 2);

          store.reorderChapter(picked.id, newSortOrder, null);

          // Verify all parent groups
          const allChapters = store.listChapters(PROJECT_ID);
          const result = verifyAllParentGroups(allChapters);
          expect(result.valid, result.details).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('multiple sequential reorders preserve consecutive sortOrder', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 5 }),
        fc.array(
          fc.record({
            pickSeed: fc.integer({ min: 0, max: 100 }),
            orderSeed: fc.integer({ min: 0, max: 100 }),
            crossParent: fc.boolean(),
          }),
          { minLength: 2, maxLength: 5 },
        ),
        (rootCount, operations) => {
          const store = createChapterStore();

          // Create a tree: roots with some children
          const roots: Chapter[] = [];
          for (let i = 0; i < rootCount; i++) {
            const root = store.createChapter(PROJECT_ID, null, `Root ${i}`, 'volume');
            roots.push(root);
            // Add 1-2 children per root
            const numChildren = (i % 2) + 1;
            for (let j = 0; j < numChildren; j++) {
              store.createChapter(PROJECT_ID, root.id, `Child ${i}-${j}`, 'chapter');
            }
          }

          // Apply each operation
          for (const op of operations) {
            const allChapters = store.listChapters(PROJECT_ID);
            if (allChapters.length === 0) break;

            const pickIndex = Math.abs(op.pickSeed) % allChapters.length;
            const picked = allChapters[pickIndex];

            if (op.crossParent && roots.length > 1) {
              // Cross-parent move: pick a different parent
              const availableParents = [null, ...roots.map((r) => r.id)].filter(
                (pid) => pid !== picked.parentId,
              );
              if (availableParents.length > 0) {
                const targetParent = availableParents[Math.abs(op.orderSeed) % availableParents.length];
                const siblings = allChapters.filter((ch) => ch.parentId === targetParent);
                const newOrder = Math.abs(op.orderSeed) % (siblings.length + 1);
                store.reorderChapter(picked.id, newOrder, targetParent);
              }
            } else {
              // Same-parent reorder
              const siblings = allChapters.filter((ch) => ch.parentId === picked.parentId);
              const newOrder = Math.abs(op.orderSeed) % Math.max(1, siblings.length);
              store.reorderChapter(picked.id, newOrder);
            }
          }

          // Verify all parent groups after all operations
          const finalChapters = store.listChapters(PROJECT_ID);
          const result = verifyAllParentGroups(finalChapters);
          expect(result.valid, result.details).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

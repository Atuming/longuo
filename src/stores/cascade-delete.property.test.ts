import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createEventBus } from '../lib/event-bus';
import { createCharacterStore } from './character-store';
import { createRelationshipStore } from './relationship-store';
import { createWorldStore } from './world-store';
import { createTimelineStore } from './timeline-store';
import { createChapterStore } from './chapter-store';
import { createPlotStore } from './plot-store';

// ── Shared helpers ───────────────────────────────────────────────────

const PROJECT_ID = 'proj-pbt';

const arbNonEmptyStr = fc.string({ minLength: 1, maxLength: 20 });

const arbRelationshipType = fc.constantFrom(
  'family' as const, 'friend' as const, 'enemy' as const,
  'mentor' as const, 'lover' as const, 'ally' as const,
  'superior' as const, 'custom' as const,
);

const arbPlotStatus = fc.constantFrom(
  'pending' as const, 'in_progress' as const, 'resolved' as const,
);

/** Create all stores sharing a single EventBus */
function createStores() {
  const eventBus = createEventBus();
  const characterStore = createCharacterStore(eventBus);
  const relationshipStore = createRelationshipStore({ eventBus });
  const worldStore = createWorldStore({ eventBus });
  const timelineStore = createTimelineStore({ eventBus });
  const chapterStore = createChapterStore({ eventBus });
  const plotStore = createPlotStore({ eventBus });
  return { eventBus, characterStore, relationshipStore, worldStore, timelineStore, chapterStore, plotStore };
}

// ── Property 3: 角色删除级联完整性 ──────────────────────────────────

describe('Feature: comprehensive-quality-audit, Property 3: 角色删除级联完整性', () => {
  /**
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
   *
   * For any character in a project, after deleting that character:
   * (a) CharacterStore has no timeline snapshots for that character
   * (b) RelationshipStore has no relationships referencing that character
   * (c) No WorldEntry.associatedCharacterIds contains that character ID
   * (d) No TimelinePoint.associatedCharacterIds contains that character ID
   */

  // Arbitrary: number of "other" characters (0..3), relationships (0..3), world entries (0..3), timeline points (0..3)
  const arbScenario = fc.record({
    otherCharCount: fc.integer({ min: 0, max: 3 }),
    relCount: fc.integer({ min: 1, max: 3 }),
    worldEntryCount: fc.integer({ min: 1, max: 3 }),
    timelinePointCount: fc.integer({ min: 1, max: 3 }),
    snapshotCount: fc.integer({ min: 1, max: 2 }),
    targetName: arbNonEmptyStr,
    relType: arbRelationshipType,
    strength: fc.integer({ min: 1, max: 10 }),
  });

  it('deleting a character cleans up all references across stores', () => {
    fc.assert(
      fc.property(arbScenario, (scenario) => {
        const { characterStore, relationshipStore, worldStore, timelineStore } = createStores();

        // Create the target character to be deleted
        const target = characterStore.createCharacter(PROJECT_ID, {
          name: scenario.targetName,
          aliases: [],
          appearance: '',
          personality: '',
          backstory: '',
          customAttributes: {},
        });

        // Create other characters
        const others: string[] = [];
        for (let i = 0; i < scenario.otherCharCount; i++) {
          const c = characterStore.createCharacter(PROJECT_ID, {
            name: `other-${i}`,
            aliases: [],
            appearance: '',
            personality: '',
            backstory: '',
            customAttributes: {},
          });
          others.push(c.id);
        }

        // Create timeline points that reference the target character
        const timelineIds: string[] = [];
        for (let i = 0; i < scenario.timelinePointCount; i++) {
          const tp = timelineStore.createTimelinePoint({
            projectId: PROJECT_ID,
            label: `tp-${i}`,
            description: '',
            sortOrder: i,
            associatedChapterIds: [],
            associatedCharacterIds: [target.id, ...(others.length > 0 ? [others[0]] : [])],
          });
          timelineIds.push(tp.id);
        }

        // Create snapshots for the target character
        for (let i = 0; i < Math.min(scenario.snapshotCount, timelineIds.length); i++) {
          characterStore.setSnapshotAtTimeline(target.id, timelineIds[i], {
            appearance: 'snapshot-appearance',
          });
        }

        // Create relationships referencing the target character
        if (others.length > 0 && timelineIds.length > 0) {
          for (let i = 0; i < scenario.relCount; i++) {
            relationshipStore.createRelationship({
              projectId: PROJECT_ID,
              sourceCharacterId: target.id,
              targetCharacterId: others[i % others.length],
              relationshipType: scenario.relType,
              description: `rel-${i}`,
              startTimelinePointId: timelineIds[0],
              strength: scenario.strength,
            });
          }
        }

        // Create world entries referencing the target character
        for (let i = 0; i < scenario.worldEntryCount; i++) {
          worldStore.createEntry({
            projectId: PROJECT_ID,
            type: 'location',
            name: `entry-${i}`,
            description: '',
            associatedCharacterIds: [target.id, ...(others.length > 0 ? [others[0]] : [])],
          });
        }

        // ── Delete the target character ──
        characterStore.deleteCharacter(target.id);

        // (a) No snapshots for the deleted character
        for (const tpId of timelineIds) {
          expect(characterStore.getSnapshotAtTimeline(target.id, tpId)).toBeUndefined();
        }

        // (b) No relationships referencing the deleted character
        const allRels = relationshipStore.listRelationships(PROJECT_ID);
        for (const rel of allRels) {
          expect(rel.sourceCharacterId).not.toBe(target.id);
          expect(rel.targetCharacterId).not.toBe(target.id);
        }

        // (c) No WorldEntry.associatedCharacterIds contains the deleted character
        const allEntries = worldStore.listEntries(PROJECT_ID);
        for (const entry of allEntries) {
          expect(entry.associatedCharacterIds).not.toContain(target.id);
        }

        // (d) No TimelinePoint.associatedCharacterIds contains the deleted character
        const allPoints = timelineStore.listTimelinePoints(PROJECT_ID);
        for (const point of allPoints) {
          expect(point.associatedCharacterIds).not.toContain(target.id);
        }
      }),
      { numRuns: 100 },
    );
  });
});


// ── Property 4: 时间线删除级联完整性 ────────────────────────────────

describe('Feature: comprehensive-quality-audit, Property 4: 时间线删除级联完整性', () => {
  /**
   * **Validates: Requirements 2.5**
   *
   * For any timeline point, after deleting it:
   * (a) RelationshipStore has no relationships referencing that timeline point
   * (b) CharacterStore has no snapshots referencing that timeline point
   */

  const arbScenario = fc.record({
    charCount: fc.integer({ min: 1, max: 3 }),
    relCount: fc.integer({ min: 1, max: 3 }),
    snapshotCount: fc.integer({ min: 1, max: 3 }),
    extraTimelineCount: fc.integer({ min: 0, max: 2 }),
    relType: arbRelationshipType,
    strength: fc.integer({ min: 1, max: 10 }),
  });

  it('deleting a timeline point cleans up relationships and snapshots', () => {
    fc.assert(
      fc.property(arbScenario, (scenario) => {
        const { characterStore, relationshipStore, timelineStore } = createStores();

        // Create characters
        const charIds: string[] = [];
        for (let i = 0; i < scenario.charCount; i++) {
          const c = characterStore.createCharacter(PROJECT_ID, {
            name: `char-${i}`,
            aliases: [],
            appearance: '',
            personality: '',
            backstory: '',
            customAttributes: {},
          });
          charIds.push(c.id);
        }

        // Create the target timeline point to be deleted
        const targetTp = timelineStore.createTimelinePoint({
          projectId: PROJECT_ID,
          label: 'target-tp',
          description: '',
          sortOrder: 0,
          associatedChapterIds: [],
          associatedCharacterIds: [],
        });

        // Create extra timeline points (should survive deletion)
        const extraTpIds: string[] = [];
        for (let i = 0; i < scenario.extraTimelineCount; i++) {
          const tp = timelineStore.createTimelinePoint({
            projectId: PROJECT_ID,
            label: `extra-tp-${i}`,
            description: '',
            sortOrder: i + 1,
            associatedChapterIds: [],
            associatedCharacterIds: [],
          });
          extraTpIds.push(tp.id);
        }

        // Create relationships referencing the target timeline point
        if (charIds.length >= 2) {
          for (let i = 0; i < scenario.relCount; i++) {
            relationshipStore.createRelationship({
              projectId: PROJECT_ID,
              sourceCharacterId: charIds[0],
              targetCharacterId: charIds[i % (charIds.length - 1) + 1],
              relationshipType: scenario.relType,
              description: `rel-${i}`,
              startTimelinePointId: targetTp.id,
              strength: scenario.strength,
            });
          }
        }

        // Create snapshots referencing the target timeline point
        for (let i = 0; i < Math.min(scenario.snapshotCount, charIds.length); i++) {
          characterStore.setSnapshotAtTimeline(charIds[i], targetTp.id, {
            appearance: `snapshot-${i}`,
          });
        }

        // ── Delete the target timeline point ──
        timelineStore.deleteTimelinePoint(targetTp.id);

        // (a) No relationships referencing the deleted timeline point
        const allRels = relationshipStore.listRelationships(PROJECT_ID);
        for (const rel of allRels) {
          expect(rel.startTimelinePointId).not.toBe(targetTp.id);
          if (rel.endTimelinePointId) {
            expect(rel.endTimelinePointId).not.toBe(targetTp.id);
          }
        }

        // (b) No snapshots referencing the deleted timeline point
        for (const charId of charIds) {
          expect(characterStore.getSnapshotAtTimeline(charId, targetTp.id)).toBeUndefined();
        }
      }),
      { numRuns: 100 },
    );
  });
});


// ── Property 5: 章节删除递归完整性 ──────────────────────────────────

describe('Feature: comprehensive-quality-audit, Property 5: 章节删除递归完整性', () => {
  /**
   * **Validates: Requirements 2.6**
   *
   * For any chapter tree, after deleting a chapter, that chapter and all its
   * descendants no longer exist in ChapterStore.
   */

  // Generate a random tree depth (1..3) and branching factor (1..3)
  const arbTreeShape = fc.record({
    childrenPerLevel: fc.array(fc.integer({ min: 1, max: 3 }), { minLength: 1, maxLength: 3 }),
  });

  it('deleting a chapter removes it and all descendants', () => {
    fc.assert(
      fc.property(arbTreeShape, (shape) => {
        const { chapterStore } = createStores();

        // Build a tree: root volume, then chapters, then sections
        const levels: Array<'volume' | 'chapter' | 'section'> = ['volume', 'chapter', 'section'];
        const allIds: string[] = [];

        // Create root
        const root = chapterStore.createChapter(PROJECT_ID, null, 'root', levels[0]);
        allIds.push(root.id);

        // Build children level by level
        let currentLevelIds = [root.id];
        for (let lvl = 0; lvl < shape.childrenPerLevel.length && lvl < levels.length - 1; lvl++) {
          const nextLevelIds: string[] = [];
          const childLevel = levels[Math.min(lvl + 1, levels.length - 1)];
          for (const parentId of currentLevelIds) {
            for (let c = 0; c < shape.childrenPerLevel[lvl]; c++) {
              const child = chapterStore.createChapter(PROJECT_ID, parentId, `child-${lvl}-${c}`, childLevel);
              allIds.push(child.id);
              nextLevelIds.push(child.id);
            }
          }
          currentLevelIds = nextLevelIds;
        }

        // Also create a sibling tree that should survive
        const survivor = chapterStore.createChapter(PROJECT_ID, null, 'survivor', 'volume');

        // ── Delete the root ──
        chapterStore.deleteChapter(root.id);

        // All IDs in the tree should be gone
        for (const id of allIds) {
          expect(chapterStore.getChapter(id)).toBeUndefined();
        }

        // Survivor should still exist
        expect(chapterStore.getChapter(survivor.id)).toBeDefined();
      }),
      { numRuns: 100 },
    );
  });
});


// ── Property 6: 章节删除级联引用清理 ────────────────────────────────

describe('Feature: comprehensive-quality-audit, Property 6: 章节删除级联引用清理', () => {
  /**
   * **Validates: Requirements 2.7**
   *
   * For any chapter (and its sub-chapters), after deletion:
   * (a) No PlotThread.associatedChapterIds contains any deleted chapter ID
   * (b) No TimelinePoint.associatedChapterIds contains any deleted chapter ID
   */

  const arbScenario = fc.record({
    childCount: fc.integer({ min: 0, max: 3 }),
    plotThreadCount: fc.integer({ min: 1, max: 3 }),
    timelinePointCount: fc.integer({ min: 1, max: 3 }),
    plotStatus: arbPlotStatus,
  });

  it('deleting a chapter cleans up PlotThread and TimelinePoint references', () => {
    fc.assert(
      fc.property(arbScenario, (scenario) => {
        const { chapterStore, plotStore, timelineStore } = createStores();

        // Create the target chapter (volume) and its children
        const target = chapterStore.createChapter(PROJECT_ID, null, 'target-vol', 'volume');
        const deletedIds = [target.id];
        for (let i = 0; i < scenario.childCount; i++) {
          const child = chapterStore.createChapter(PROJECT_ID, target.id, `child-${i}`, 'chapter');
          deletedIds.push(child.id);
        }

        // Create a survivor chapter (should not be affected)
        const survivor = chapterStore.createChapter(PROJECT_ID, null, 'survivor', 'chapter');

        // Create plot threads referencing both deleted and survivor chapters
        for (let i = 0; i < scenario.plotThreadCount; i++) {
          plotStore.createThread({
            projectId: PROJECT_ID,
            name: `thread-${i}`,
            description: '',
            status: scenario.plotStatus,
            associatedChapterIds: [...deletedIds, survivor.id],
          });
        }

        // Create timeline points referencing both deleted and survivor chapters
        for (let i = 0; i < scenario.timelinePointCount; i++) {
          timelineStore.createTimelinePoint({
            projectId: PROJECT_ID,
            label: `tp-${i}`,
            description: '',
            sortOrder: i,
            associatedChapterIds: [...deletedIds, survivor.id],
            associatedCharacterIds: [],
          });
        }

        // ── Delete the target chapter (cascades to children) ──
        chapterStore.deleteChapter(target.id);

        // (a) No PlotThread references any deleted chapter
        const allThreads = plotStore.listThreads(PROJECT_ID);
        for (const thread of allThreads) {
          for (const deletedId of deletedIds) {
            expect(thread.associatedChapterIds).not.toContain(deletedId);
          }
          // Survivor should still be referenced
          expect(thread.associatedChapterIds).toContain(survivor.id);
        }

        // (b) No TimelinePoint references any deleted chapter
        const allPoints = timelineStore.listTimelinePoints(PROJECT_ID);
        for (const point of allPoints) {
          for (const deletedId of deletedIds) {
            expect(point.associatedChapterIds).not.toContain(deletedId);
          }
          // Survivor should still be referenced
          expect(point.associatedChapterIds).toContain(survivor.id);
        }
      }),
      { numRuns: 100 },
    );
  });
});

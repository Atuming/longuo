import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { createSnapshotStore, readSnapshots } from './snapshot-store';
import type { NovelFileData } from '../types/project';

/** Helper: create a minimal valid NovelFileData */
function makeData(overrides?: Partial<NovelFileData>): NovelFileData {
  return {
    version: 1,
    project: {
      id: 'proj-1',
      name: 'Test Novel',
      description: '',
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
    },
    chapters: [],
    characters: [],
    characterSnapshots: [],
    relationships: [],
    timelinePoints: [],
    worldEntries: [],
    plotThreads: [],
    ...overrides,
  };
}

/** fast-check arbitrary for a chapter */
const chapterArb = fc.record({
  id: fc.uuid(),
  projectId: fc.constant('proj-1'),
  parentId: fc.constant(null),
  title: fc.string({ minLength: 0, maxLength: 20 }),
  content: fc.string({ minLength: 0, maxLength: 100 }),
  sortOrder: fc.nat({ max: 100 }),
  level: fc.constant('chapter' as const),
  wordCount: fc.nat({ max: 10000 }),
});

/** fast-check arbitrary for NovelFileData with random chapters */
const novelDataArb = fc.array(chapterArb, { minLength: 0, maxLength: 5 }).map(
  (chapters) => makeData({ chapters }),
);

describe('SnapshotStore boundary tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Validates: Requirements 8.1
   * QuotaExceededError handling — any write operation that triggers QuotaExceededError
   * should throw the user-friendly Chinese error message.
   */
  describe('Req 8.1: QuotaExceededError handling', () => {
    it('createSnapshot throws user-friendly error on QuotaExceededError', () => {
      fc.assert(
        fc.property(novelDataArb, fc.string({ minLength: 1, maxLength: 30 }), (data, note) => {
          localStorage.clear();
          const store = createSnapshotStore();

          const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('quota exceeded', 'QuotaExceededError');
          });

          try {
            expect(() => store.createSnapshot('proj-1', data, note)).toThrow(
              '存储空间不足，请删除旧快照后重试',
            );
          } finally {
            spy.mockRestore();
          }
        }),
        { numRuns: 100 },
      );
    });

    it('deleteSnapshot followed by createSnapshot succeeds when quota was previously full', () => {
      const store = createSnapshotStore();
      const data = makeData();

      // Create a snapshot first
      const snap = store.createSnapshot('proj-1', data, '占位快照');

      // Simulate quota full on next write
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota exceeded', 'QuotaExceededError');
      });

      expect(() => store.createSnapshot('proj-1', data, '超出配额')).toThrow('存储空间不足');
      spy.mockRestore();

      // After deleting old snapshot, new creation should succeed
      store.deleteSnapshot('proj-1', snap.id);
      const newSnap = store.createSnapshot('proj-1', data, '新快照');
      expect(newSnap.note).toBe('新快照');
    });

    it('re-throws non-QuotaExceededError DOMExceptions as-is', () => {
      const store = createSnapshotStore();
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('security error', 'SecurityError');
      });

      expect(() => store.createSnapshot('proj-1', makeData(), 'test')).toThrow('security error');
      spy.mockRestore();
    });
  });

  /**
   * Validates: Requirements 8.2
   * Restore snapshot auto-backup — restoring a snapshot should first create
   * an auto-backup with note "恢复前自动备份", then return a deep copy of target data.
   */
  describe('Req 8.2: restore snapshot auto-backup', () => {
    it('auto-backup is created with correct note and data before restore', () => {
      fc.assert(
        fc.property(novelDataArb, novelDataArb, (targetData, currentData) => {
          localStorage.clear();
          const store = createSnapshotStore();

          const targetSnap = store.createSnapshot('proj-1', targetData, '目标快照');
          const countBefore = store.listSnapshots('proj-1').length;

          store.restoreSnapshot('proj-1', targetSnap.id, currentData);

          const list = store.listSnapshots('proj-1');
          // One more snapshot (the auto-backup)
          expect(list.length).toBe(countBefore + 1);

          const backup = list.find((s) => s.note === '恢复前自动备份');
          expect(backup).toBeDefined();
          // Backup data should match currentData chapters length
          expect(backup!.data.chapters.length).toBe(currentData.chapters.length);
        }),
        { numRuns: 100 },
      );
    });

    it('returns a deep copy of target snapshot data', () => {
      fc.assert(
        fc.property(novelDataArb, (targetData) => {
          localStorage.clear();
          const store = createSnapshotStore();

          const snap = store.createSnapshot('proj-1', targetData, 'target');
          const restored = store.restoreSnapshot('proj-1', snap.id, makeData());

          // Mutate restored data
          if (restored.chapters.length > 0) {
            restored.chapters[0].content = 'MUTATED_CONTENT';
          }
          restored.chapters.push({
            id: 'injected',
            projectId: 'proj-1',
            parentId: null,
            title: 'injected',
            content: '',
            sortOrder: 999,
            level: 'chapter',
            wordCount: 0,
          });

          // Original snapshot data should be unaffected
          const original = store.getSnapshot('proj-1', snap.id);
          expect(original!.data.chapters.length).toBe(targetData.chapters.length);
          if (targetData.chapters.length > 0) {
            expect(original!.data.chapters[0].content).toBe(targetData.chapters[0].content);
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Validates: Requirements 8.3
   * Auto-backup failure aborts restore — if the auto-backup write fails,
   * the restore operation should be aborted and current data should not be overwritten.
   */
  describe('Req 8.3: auto-backup failure aborts restore', () => {
    it('aborts restore when auto-backup fails due to QuotaExceededError', () => {
      const store = createSnapshotStore();
      const targetData = makeData({
        chapters: [
          { id: 'ch-t', projectId: 'proj-1', parentId: null, title: '目标', content: '目标内容', sortOrder: 0, level: 'chapter', wordCount: 100 },
        ],
      });
      const currentData = makeData({
        chapters: [
          { id: 'ch-c', projectId: 'proj-1', parentId: null, title: '当前', content: '当前内容', sortOrder: 0, level: 'chapter', wordCount: 50 },
        ],
      });

      const snap = store.createSnapshot('proj-1', targetData, '目标快照');
      const snapshotsBefore = store.listSnapshots('proj-1').length;

      // Make setItem fail (simulating quota exceeded during backup write)
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota exceeded', 'QuotaExceededError');
      });

      expect(() => store.restoreSnapshot('proj-1', snap.id, currentData)).toThrow(
        '自动备份失败，恢复操作已中止，当前数据保持不变',
      );

      spy.mockRestore();

      // No new backup should have been created — snapshot count unchanged
      const snapshotsAfter = store.listSnapshots('proj-1').length;
      expect(snapshotsAfter).toBe(snapshotsBefore);
    });

    it('aborts restore when auto-backup fails due to generic error', () => {
      const store = createSnapshotStore();
      const data = makeData();
      const snap = store.createSnapshot('proj-1', data, 'target');

      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('disk full');
      });

      expect(() => store.restoreSnapshot('proj-1', snap.id, makeData())).toThrow(
        '自动备份失败',
      );

      spy.mockRestore();
    });

    it('throws when target snapshot does not exist', () => {
      const store = createSnapshotStore();
      expect(() =>
        store.restoreSnapshot('proj-1', 'non-existent-id', makeData()),
      ).toThrow('不存在');
    });
  });

  /**
   * Validates: Requirements 8.4
   * Corrupted data skip — when localStorage contains corrupted snapshot data
   * (JSON parse failure or missing required fields), readSnapshots should skip
   * corrupted entries and return only valid snapshots.
   */
  describe('Req 8.4: corrupted data skip', () => {
    it('skips entries missing required fields', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              // Valid snapshot shape
              fc.record({
                id: fc.uuid(),
                projectId: fc.constant('proj-1'),
                timestamp: fc.constant('2025-01-01T00:00:00Z'),
                note: fc.string({ minLength: 1, maxLength: 10 }),
                data: fc.constant({ version: 1 }),
                totalWordCount: fc.nat(),
              }),
              // Missing 'id'
              fc.record({
                projectId: fc.constant('proj-1'),
                timestamp: fc.constant('2025-01-01T00:00:00Z'),
                note: fc.string({ minLength: 1, maxLength: 10 }),
                data: fc.constant({ version: 1 }),
              }),
              // Missing 'data'
              fc.record({
                id: fc.uuid(),
                projectId: fc.constant('proj-1'),
                timestamp: fc.constant('2025-01-01T00:00:00Z'),
                note: fc.string({ minLength: 1, maxLength: 10 }),
              }),
              // note is not a string
              fc.record({
                id: fc.uuid(),
                projectId: fc.constant('proj-1'),
                timestamp: fc.constant('2025-01-01T00:00:00Z'),
                note: fc.nat(),
                data: fc.constant({ version: 1 }),
              }),
              // null entry
              fc.constant(null),
              // primitive entry
              fc.string(),
              // number entry
              fc.integer(),
            ),
            { minLength: 0, maxLength: 8 },
          ),
          (entries) => {
            localStorage.clear();
            localStorage.setItem('novel-snapshots-proj-1', JSON.stringify(entries));

            const snapshots = readSnapshots('proj-1');

            // Every returned snapshot must have all required fields
            for (const s of snapshots) {
              expect(typeof s.id).toBe('string');
              expect(typeof s.projectId).toBe('string');
              expect(typeof s.timestamp).toBe('string');
              expect(typeof s.note).toBe('string');
              expect(typeof s.data).toBe('object');
              expect(s.data).not.toBeNull();
            }

            // Count how many valid entries we expect
            const expectedValid = entries.filter(
              (e: unknown) =>
                typeof e === 'object' &&
                e !== null &&
                typeof (e as Record<string, unknown>).id === 'string' &&
                typeof (e as Record<string, unknown>).projectId === 'string' &&
                typeof (e as Record<string, unknown>).timestamp === 'string' &&
                typeof (e as Record<string, unknown>).note === 'string' &&
                typeof (e as Record<string, unknown>).data === 'object' &&
                (e as Record<string, unknown>).data !== null,
            );
            expect(snapshots.length).toBe(expectedValid.length);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('returns empty array for completely invalid JSON', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => {
            try { JSON.parse(s); return false; } catch { return true; }
          }),
          (invalidJson) => {
            localStorage.clear();
            localStorage.setItem('novel-snapshots-proj-1', invalidJson);
            expect(readSnapshots('proj-1')).toEqual([]);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('returns empty array for non-array valid JSON', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.object(),
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.constant(null),
          ).filter((v) => !Array.isArray(v)),
          (nonArray) => {
            localStorage.clear();
            localStorage.setItem('novel-snapshots-proj-1', JSON.stringify(nonArray));
            expect(readSnapshots('proj-1')).toEqual([]);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('data field set to null is treated as corrupted', () => {
      localStorage.clear();
      localStorage.setItem(
        'novel-snapshots-proj-1',
        JSON.stringify([
          { id: 'snap-1', projectId: 'proj-1', timestamp: '2025-01-01T00:00:00Z', note: 'ok', data: null, totalWordCount: 0 },
        ]),
      );
      expect(readSnapshots('proj-1')).toEqual([]);
    });
  });
});


/**
 * Feature: comprehensive-quality-audit, Property 15: 快照删除后列表一致性
 * Validates: Requirements 8.5
 *
 * 对于任意快照集合，删除某个快照后，listSnapshots 返回的列表不应包含已删除的快照，
 * 且所有其他快照仍然存在。
 */
describe('Property 15: 快照删除后列表一致性', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('删除快照后 listSnapshots 不包含已删除快照，且其他快照仍存在', () => {
    fc.assert(
      fc.property(
        // Generate 1-5 random NovelFileData items to create snapshots from
        fc.array(novelDataArb, { minLength: 1, maxLength: 5 }),
        // Pick a random index to delete
        fc.nat(),
        (dataList, deleteIndexSeed) => {
          localStorage.clear();
          const store = createSnapshotStore();

          // Create multiple snapshots
          const createdSnapshots = dataList.map((data, i) =>
            store.createSnapshot('proj-1', data, `快照-${i}`),
          );

          // Pick a random snapshot to delete
          const deleteIndex = deleteIndexSeed % createdSnapshots.length;
          const deletedSnapshot = createdSnapshots[deleteIndex];

          // Delete the chosen snapshot
          store.deleteSnapshot('proj-1', deletedSnapshot.id);

          // Get the updated list
          const remaining = store.listSnapshots('proj-1');
          const remainingIds = remaining.map((s) => s.id);

          // Verify: deleted snapshot is NOT in the list
          expect(remainingIds).not.toContain(deletedSnapshot.id);

          // Verify: all other snapshots are still present
          const expectedRemainingIds = createdSnapshots
            .filter((_, i) => i !== deleteIndex)
            .map((s) => s.id);

          for (const expectedId of expectedRemainingIds) {
            expect(remainingIds).toContain(expectedId);
          }

          // Verify: count is correct
          expect(remaining.length).toBe(createdSnapshots.length - 1);
        },
      ),
      { numRuns: 100 },
    );
  });
});

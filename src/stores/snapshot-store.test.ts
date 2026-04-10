import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSnapshotStore, computeTotalWordCount, readSnapshots } from './snapshot-store';
import type { NovelFileData } from '../types/project';

/** Helper: create a minimal valid NovelFileData */
function makeData(overrides?: Partial<NovelFileData>): NovelFileData {
  return {
    version: 1,
    project: {
      id: 'proj-1',
      name: 'Test Novel',
      description: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    chapters: [
      {
        id: 'ch-1',
        projectId: 'proj-1',
        parentId: null,
        title: '第一章',
        content: '你好世界',
        sortOrder: 0,
        level: 'chapter' as const,
        wordCount: 100,
      },
    ],
    characters: [],
    characterSnapshots: [],
    relationships: [],
    timelinePoints: [],
    worldEntries: [],
    plotThreads: [],
    ...overrides,
  };
}

describe('computeTotalWordCount', () => {
  it('sums wordCount from all chapters', () => {
    const data = makeData({
      chapters: [
        { id: '1', projectId: 'p', parentId: null, title: '', content: '', sortOrder: 0, level: 'chapter', wordCount: 100 },
        { id: '2', projectId: 'p', parentId: null, title: '', content: '', sortOrder: 1, level: 'chapter', wordCount: 250 },
      ],
    });
    expect(computeTotalWordCount(data)).toBe(350);
  });

  it('returns 0 for empty chapters', () => {
    const data = makeData({ chapters: [] });
    expect(computeTotalWordCount(data)).toBe(0);
  });
});

describe('SnapshotStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('createSnapshot', () => {
    it('creates a snapshot and persists it', () => {
      const store = createSnapshotStore();
      const data = makeData();
      const snap = store.createSnapshot('proj-1', data, '初稿完成');

      expect(snap.id).toBeTruthy();
      expect(snap.projectId).toBe('proj-1');
      expect(snap.note).toBe('初稿完成');
      expect(snap.timestamp).toBeTruthy();
      expect(snap.totalWordCount).toBe(100);
      expect(snap.data.chapters).toHaveLength(1);

      // Verify persisted
      const list = store.listSnapshots('proj-1');
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(snap.id);
    });

    it('stores a deep copy of data (mutations do not affect snapshot)', () => {
      const store = createSnapshotStore();
      const data = makeData();
      store.createSnapshot('proj-1', data, 'test');

      // Mutate original data
      data.chapters[0].content = 'MUTATED';

      const snap = store.listSnapshots('proj-1')[0];
      expect(snap.data.chapters[0].content).toBe('你好世界');
    });

    it('throws user-friendly error on QuotaExceededError', () => {
      const store = createSnapshotStore();
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota exceeded', 'QuotaExceededError');
      });

      expect(() => store.createSnapshot('proj-1', makeData(), 'test')).toThrow('存储空间不足');

      spy.mockRestore();
    });
  });

  describe('listSnapshots', () => {
    it('returns empty array when no snapshots exist', () => {
      const store = createSnapshotStore();
      expect(store.listSnapshots('proj-1')).toEqual([]);
    });

    it('returns snapshots in reverse chronological order', () => {
      const store = createSnapshotStore();
      const data = makeData();

      // Use fixed timestamps to ensure ordering
      vi.spyOn(Date.prototype, 'toISOString')
        .mockReturnValueOnce('2025-01-01T00:00:00.000Z')
        .mockReturnValueOnce('2025-01-02T00:00:00.000Z');

      const snap1 = store.createSnapshot('proj-1', data, '第一个');
      const snap2 = store.createSnapshot('proj-1', data, '第二个');

      const list = store.listSnapshots('proj-1');
      expect(list).toHaveLength(2);
      // Most recent first
      expect(list[0].id).toBe(snap2.id);
      expect(list[1].id).toBe(snap1.id);

      vi.restoreAllMocks();
    });

    it('isolates snapshots by project ID', () => {
      const store = createSnapshotStore();
      const data = makeData();

      store.createSnapshot('proj-a', data, 'A的快照');
      store.createSnapshot('proj-b', data, 'B的快照');

      expect(store.listSnapshots('proj-a')).toHaveLength(1);
      expect(store.listSnapshots('proj-a')[0].note).toBe('A的快照');
      expect(store.listSnapshots('proj-b')).toHaveLength(1);
      expect(store.listSnapshots('proj-b')[0].note).toBe('B的快照');
    });
  });

  describe('getSnapshot', () => {
    it('returns snapshot by id', () => {
      const store = createSnapshotStore();
      const snap = store.createSnapshot('proj-1', makeData(), '测试');
      const found = store.getSnapshot('proj-1', snap.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(snap.id);
      expect(found!.note).toBe('测试');
    });

    it('returns undefined for non-existent id', () => {
      const store = createSnapshotStore();
      expect(store.getSnapshot('proj-1', 'non-existent')).toBeUndefined();
    });
  });

  describe('deleteSnapshot', () => {
    it('removes snapshot by id', () => {
      const store = createSnapshotStore();
      const snap = store.createSnapshot('proj-1', makeData(), '要删除的');
      store.createSnapshot('proj-1', makeData(), '保留的');

      store.deleteSnapshot('proj-1', snap.id);

      const list = store.listSnapshots('proj-1');
      expect(list).toHaveLength(1);
      expect(list[0].note).toBe('保留的');
    });

    it('does nothing when deleting non-existent id', () => {
      const store = createSnapshotStore();
      store.createSnapshot('proj-1', makeData(), '保留');
      store.deleteSnapshot('proj-1', 'non-existent');
      expect(store.listSnapshots('proj-1')).toHaveLength(1);
    });
  });

  describe('restoreSnapshot', () => {
    it('creates auto-backup and returns target snapshot data', () => {
      const store = createSnapshotStore();
      const originalData = makeData({ chapters: [
        { id: 'ch-1', projectId: 'proj-1', parentId: null, title: '原始章节', content: '原始内容', sortOrder: 0, level: 'chapter', wordCount: 50 },
      ]});
      const targetData = makeData({ chapters: [
        { id: 'ch-2', projectId: 'proj-1', parentId: null, title: '目标章节', content: '目标内容', sortOrder: 0, level: 'chapter', wordCount: 200 },
      ]});

      const targetSnap = store.createSnapshot('proj-1', targetData, '目标快照');

      const restored = store.restoreSnapshot('proj-1', targetSnap.id, originalData);

      // Returned data should match target snapshot
      expect(restored.chapters[0].title).toBe('目标章节');
      expect(restored.chapters[0].content).toBe('目标内容');

      // Auto-backup should exist
      const list = store.listSnapshots('proj-1');
      const backup = list.find((s) => s.note === '恢复前自动备份');
      expect(backup).toBeDefined();
      expect(backup!.data.chapters[0].title).toBe('原始章节');
      expect(backup!.totalWordCount).toBe(50);
    });

    it('returns a deep copy of target data', () => {
      const store = createSnapshotStore();
      const data = makeData();
      const snap = store.createSnapshot('proj-1', data, 'test');

      const restored = store.restoreSnapshot('proj-1', snap.id, makeData());
      restored.chapters[0].content = 'MUTATED';

      // Original snapshot data should be unaffected
      const snapAgain = store.getSnapshot('proj-1', snap.id);
      expect(snapAgain!.data.chapters[0].content).toBe('你好世界');
    });

    it('throws when target snapshot does not exist', () => {
      const store = createSnapshotStore();
      expect(() => store.restoreSnapshot('proj-1', 'non-existent', makeData())).toThrow('不存在');
    });

    it('aborts restore when auto-backup fails (QuotaExceededError)', () => {
      const store = createSnapshotStore();
      const data = makeData();
      const snap = store.createSnapshot('proj-1', data, 'target');

      // Make localStorage.setItem throw on the backup write attempt
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota exceeded', 'QuotaExceededError');
      });

      expect(() => store.restoreSnapshot('proj-1', snap.id, makeData())).toThrow('自动备份失败');

      spy.mockRestore();
    });
  });

  describe('corrupted data handling', () => {
    it('skips corrupted snapshots in localStorage', () => {
      // Write invalid data directly
      localStorage.setItem('novel-snapshots-proj-1', JSON.stringify([
        { id: 'valid', projectId: 'proj-1', timestamp: '2025-01-01T00:00:00Z', note: 'ok', data: { version: 1 }, totalWordCount: 0 },
        { id: 'bad', note: 123 }, // corrupted: note is not a string
        'not-an-object',
        null,
      ]));

      const snapshots = readSnapshots('proj-1');
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].id).toBe('valid');
    });

    it('returns empty array for completely invalid JSON', () => {
      localStorage.setItem('novel-snapshots-proj-1', 'not-json-at-all');
      const snapshots = readSnapshots('proj-1');
      expect(snapshots).toEqual([]);
    });

    it('returns empty array for non-array JSON', () => {
      localStorage.setItem('novel-snapshots-proj-1', JSON.stringify({ not: 'array' }));
      const snapshots = readSnapshots('proj-1');
      expect(snapshots).toEqual([]);
    });
  });
});

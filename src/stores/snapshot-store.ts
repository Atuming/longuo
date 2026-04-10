import type { NovelFileData } from '../types/project';
import type { Snapshot, SnapshotStore } from '../types/snapshot';

function storageKey(projectId: string): string {
  return `novel-snapshots-${projectId}`;
}

/** 生成简单唯一 ID */
function generateId(): string {
  return `snap-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** 计算 NovelFileData 中所有章节的总字数 */
export function computeTotalWordCount(data: NovelFileData): number {
  if (!data.chapters || !Array.isArray(data.chapters)) return 0;
  return data.chapters.reduce((sum, ch) => sum + (ch.wordCount ?? 0), 0);
}

/** 从 localStorage 读取快照列表，跳过损坏的条目 */
export function readSnapshots(projectId: string): Snapshot[] {
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // 过滤掉损坏的快照（缺少必要字段）
    return parsed.filter(
      (s: unknown): s is Snapshot =>
        typeof s === 'object' &&
        s !== null &&
        typeof (s as Snapshot).id === 'string' &&
        typeof (s as Snapshot).projectId === 'string' &&
        typeof (s as Snapshot).timestamp === 'string' &&
        typeof (s as Snapshot).note === 'string' &&
        typeof (s as Snapshot).data === 'object' &&
        (s as Snapshot).data !== null,
    );
  } catch {
    // 反序列化失败：返回空列表
    return [];
  }
}

/** 将快照列表写入 localStorage，处理 QuotaExceededError */
function writeSnapshots(projectId: string, snapshots: Snapshot[]): void {
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(snapshots));
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      throw new Error('存储空间不足，请删除旧快照后重试');
    }
    throw err;
  }
}

/**
 * 创建 SnapshotStore 实例。
 * 使用 localStorage key `novel-snapshots-{projectId}` 持久化。
 */
export function createSnapshotStore(): SnapshotStore {
  return {
    createSnapshot(projectId: string, data: NovelFileData, note: string): Snapshot {
      const snapshots = readSnapshots(projectId);
      const snapshot: Snapshot = {
        id: generateId(),
        projectId,
        timestamp: new Date().toISOString(),
        note,
        data: structuredClone(data),
        totalWordCount: computeTotalWordCount(data),
      };
      snapshots.push(snapshot);
      writeSnapshots(projectId, snapshots);
      return snapshot;
    },

    listSnapshots(projectId: string): Snapshot[] {
      const snapshots = readSnapshots(projectId);
      // 按时间戳降序排列
      return snapshots.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    },

    getSnapshot(projectId: string, id: string): Snapshot | undefined {
      const snapshots = readSnapshots(projectId);
      return snapshots.find((s) => s.id === id);
    },

    deleteSnapshot(projectId: string, id: string): void {
      const snapshots = readSnapshots(projectId);
      const filtered = snapshots.filter((s) => s.id !== id);
      writeSnapshots(projectId, filtered);
    },

    restoreSnapshot(projectId: string, id: string, currentData: NovelFileData): NovelFileData {
      const snapshots = readSnapshots(projectId);
      const target = snapshots.find((s) => s.id === id);
      if (!target) {
        throw new Error(`快照 ${id} 不存在`);
      }

      // 先自动创建当前状态的备份快照
      // 如果自动备份失败，中止恢复操作，保持当前数据不变
      try {
        const backup: Snapshot = {
          id: generateId(),
          projectId,
          timestamp: new Date().toISOString(),
          note: '恢复前自动备份',
          data: structuredClone(currentData),
          totalWordCount: computeTotalWordCount(currentData),
        };
        const freshSnapshots = readSnapshots(projectId);
        freshSnapshots.push(backup);
        writeSnapshots(projectId, freshSnapshots);
      } catch {
        throw new Error('自动备份失败，恢复操作已中止，当前数据保持不变');
      }

      // 返回目标快照数据的深拷贝
      return structuredClone(target.data);
    },
  };
}

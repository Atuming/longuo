import type { NovelFileData } from './project';

/** 版本快照 */
export interface Snapshot {
  id: string;
  projectId: string;
  timestamp: string;           // ISO 8601
  note: string;
  data: NovelFileData;
  totalWordCount: number;
}

/** 快照 Store 接口 */
export interface SnapshotStore {
  createSnapshot(projectId: string, data: NovelFileData, note: string): Snapshot;
  listSnapshots(projectId: string): Snapshot[];  // 按时间倒序
  getSnapshot(projectId: string, id: string): Snapshot | undefined;
  deleteSnapshot(projectId: string, id: string): void;
  restoreSnapshot(projectId: string, id: string, currentData: NovelFileData): NovelFileData;  // 返回恢复后的数据
}

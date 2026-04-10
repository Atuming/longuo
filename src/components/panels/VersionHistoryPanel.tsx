import { useState, type CSSProperties } from 'react';
import type { Snapshot, SnapshotStore } from '../../types/snapshot';
import type { NovelFileData } from '../../types/project';
import { Button } from '../ui/Button';

const styles: Record<string, CSSProperties> = {
  wrapper: { padding: 'var(--spacing-sm)', display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflow: 'auto' },
  header: { fontSize: 15, fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  item: {
    padding: '10px 12px', borderRadius: 'var(--radius)',
    border: '1px solid var(--color-border)', cursor: 'pointer',
    transition: 'background 0.15s',
  },
  itemExpanded: {
    background: 'var(--color-card, #F7FAFC)',
  },
  note: { fontSize: 14, fontWeight: 500, color: 'var(--color-text)' },
  meta: { fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4, display: 'flex', gap: 12 },
  details: { marginTop: 8, padding: '8px 0', borderTop: '1px solid var(--color-border)', fontSize: 13, color: 'var(--color-text-secondary)' },
  actions: { display: 'flex', gap: 6, marginTop: 8 },
  empty: { fontSize: 13, color: 'var(--color-text-secondary)', fontStyle: 'italic', textAlign: 'center' as const, padding: 24 },
};

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

interface VersionHistoryPanelProps {
  projectId: string;
  snapshotStore: SnapshotStore;
  onRestore: (data: NovelFileData) => void;
}

export function VersionHistoryPanel({ projectId, snapshotStore, onRestore }: VersionHistoryPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [, setRefresh] = useState(0);

  const snapshots: Snapshot[] = snapshotStore.listSnapshots(projectId);

  const handleRestore = (snapshot: Snapshot) => {
    // The caller (EditorPage) will handle collecting currentData and calling restoreSnapshot
    onRestore(snapshot.data);
  };

  const handleDelete = (id: string) => {
    snapshotStore.deleteSnapshot(projectId, id);
    setExpandedId(null);
    setRefresh((n) => n + 1);
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>版本历史</div>

      <div style={styles.list}>
        {snapshots.length === 0 && (
          <div style={styles.empty}>暂无快照记录，点击工具栏"保存快照"创建</div>
        )}
        {snapshots.map((snap) => {
          const isExpanded = expandedId === snap.id;
          return (
            <div
              key={snap.id}
              style={{ ...styles.item, ...(isExpanded ? styles.itemExpanded : {}) }}
              onClick={() => setExpandedId(isExpanded ? null : snap.id)}
            >
              <div style={styles.note}>{snap.note || '（无备注）'}</div>
              <div style={styles.meta}>
                <span>🕐 {formatTimestamp(snap.timestamp)}</span>
                <span>📝 {snap.totalWordCount.toLocaleString()} 字</span>
              </div>

              {isExpanded && (
                <div style={styles.details}>
                  <div>快照 ID: {snap.id}</div>
                  <div>章节数: {snap.data?.chapters?.length ?? 0}</div>
                  <div>角色数: {snap.data?.characters?.length ?? 0}</div>
                  <div style={styles.actions}>
                    <Button
                      variant="primary"
                      style={{ height: 28, fontSize: 12, padding: '0 12px' }}
                      onClick={(e) => { e.stopPropagation(); handleRestore(snap); }}
                    >
                      恢复此版本
                    </Button>
                    <Button
                      variant="secondary"
                      style={{ height: 28, fontSize: 12, padding: '0 12px' }}
                      onClick={(e) => { e.stopPropagation(); handleDelete(snap.id); }}
                    >
                      删除
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useMemo, useCallback, type CSSProperties } from 'react';
import type { PlotStore, ChapterStore } from '../../types/stores';
import type { PlotThread } from '../../types/plot';
import { Button } from '../ui/Button';

const COLUMNS: { key: PlotThread['status']; label: string; color: string; bg: string }[] = [
  { key: 'pending', label: '未展开', color: '#E53E3E', bg: '#FFF5F5' },
  { key: 'in_progress', label: '进行中', color: '#3182CE', bg: '#EBF8FF' },
  { key: 'resolved', label: '已回收', color: '#38A169', bg: '#F0FFF4' },
];

function nextStatus(current: PlotThread['status']): PlotThread['status'] {
  const keys: PlotThread['status'][] = ['pending', 'in_progress', 'resolved'];
  const idx = keys.indexOf(current);
  return keys[(idx + 1) % keys.length];
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    display: 'flex', gap: 12, padding: '16px 24px',
    height: '100%', overflowX: 'auto',
  },
  column: {
    flex: 1, minWidth: 200, maxWidth: 340,
    display: 'flex', flexDirection: 'column',
    background: 'var(--color-bg, #f7fafc)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--color-border)',
    overflow: 'hidden',
  },
  colHeader: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 12px',
    borderBottom: '1px solid var(--color-border)',
    flexShrink: 0,
  },
  colDot: {
    width: 10, height: 10, borderRadius: '50%',
    flexShrink: 0,
  },
  colTitle: {
    fontSize: 13, fontWeight: 600,
    color: 'var(--color-text)',
    flex: 1,
  },
  colCount: {
    fontSize: 11, color: 'var(--color-text-secondary)',
    background: 'var(--color-card)',
    padding: '1px 8px', borderRadius: 10,
  },
  colBody: {
    flex: 1, overflowY: 'auto',
    padding: 8,
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  card: {
    background: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius)',
    padding: '10px 12px',
    cursor: 'pointer',
    transition: 'box-shadow 0.1s',
  },
  cardName: {
    fontSize: 14, fontWeight: 600, color: 'var(--color-text)',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12, color: 'var(--color-text-secondary)',
    lineHeight: '1.4', marginBottom: 6,
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  cardMeta: {
    fontSize: 11, color: 'var(--color-text-secondary)',
    display: 'flex', alignItems: 'center', gap: 8,
    marginTop: 6, paddingTop: 6,
    borderTop: '1px solid var(--color-border)',
  },
  cardStatusBtn: {
    fontSize: 11, padding: '2px 8px', borderRadius: 4,
    border: 'none', cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  emptyCol: {
    padding: 16, textAlign: 'center' as const,
    fontSize: 12, color: 'var(--color-text-secondary)',
  },
  emptyPage: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '100%',
    color: 'var(--color-text-secondary)', fontSize: 14, gap: 12,
  },
};

interface PlotBoardProps {
  projectId: string;
  plotStore: PlotStore;
  chapterStore: ChapterStore;
  onSelectThread: (id: string) => void;
  onEdit: (thread: PlotThread) => void;
  onDelete: (id: string) => void;
}

export function PlotBoard({
  projectId,
  plotStore,
  chapterStore,
  onSelectThread,
  onEdit,
  onDelete,
}: PlotBoardProps) {
  const threads = useMemo(() => plotStore.listThreads(projectId), [plotStore, projectId]);
  const chapters = useMemo(() => chapterStore.listChapters(projectId), [chapterStore, projectId]);

  const chapterMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const ch of chapters) m.set(ch.id, ch.title);
    return m;
  }, [chapters]);

  const grouped = useMemo(() => {
    const g: Record<string, PlotThread[]> = { pending: [], in_progress: [], resolved: [] };
    for (const t of threads) {
      g[t.status] = g[t.status] || [];
      g[t.status].push(t);
    }
    // Sort each column by name
    for (const key of Object.keys(g)) {
      g[key].sort((a, b) => a.name.localeCompare(b.name));
    }
    return g;
  }, [threads]);

  const handleCycleStatus = useCallback((e: React.MouseEvent, thread: PlotThread) => {
    e.stopPropagation();
    const next = nextStatus(thread.status);
    plotStore.updateThread(thread.id, { status: next });
  }, [plotStore]);

  if (threads.length === 0) {
    return (
      <div style={styles.emptyPage}>
        <span>🧩</span>
        <span>暂无情节线索</span>
        <span style={{ fontSize: 12 }}>在左侧「情节」Tab 中添加线索，这里将展示看板视图</span>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      {COLUMNS.map((col) => {
        const items = grouped[col.key] || [];
        return (
          <div key={col.key} style={styles.column}>
            <div style={styles.colHeader}>
              <div style={{ ...styles.colDot, background: col.color }} />
              <span style={styles.colTitle}>{col.label}</span>
              <span style={styles.colCount}>{items.length}</span>
            </div>
            <div style={styles.colBody}>
              {items.length === 0 && (
                <div style={styles.emptyCol}>拖拽线索到此处</div>
              )}
              {items.map((thread) => (
                <div
                  key={thread.id}
                  style={styles.card}
                  onClick={() => onSelectThread(thread.id)}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
                >
                  <div style={styles.cardName}>{thread.name}</div>
                  {thread.description && (
                    <div style={styles.cardDesc}>{thread.description}</div>
                  )}
                  {thread.associatedChapterIds.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: 4 }}>
                      {thread.associatedChapterIds.map((cid) => (
                        <span key={cid} style={{ fontSize: 10, padding: '1px 4px', borderRadius: 3, background: '#EDF2F7', color: '#4A5568' }}>
                          {chapterMap.get(cid) || cid}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={styles.cardMeta}>
                    <button
                      style={{ ...styles.cardStatusBtn, background: col.bg, color: col.color }}
                      onClick={(e) => handleCycleStatus(e, thread)}
                    >
                      {col.label} →
                    </button>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 10 }}>{thread.associatedChapterIds.length}章</span>
                    <Button
                      variant="secondary"
                      style={{ fontSize: 10, height: 20, padding: '0 6px' }}
                      onClick={(e) => { e.stopPropagation(); onEdit(thread); }}
                    >
                      编辑
                    </Button>
                    <Button
                      variant="secondary"
                      style={{ fontSize: 10, height: 20, padding: '0 6px', color: '#E53E3E' }}
                      onClick={(e) => { e.stopPropagation(); onDelete(thread.id); }}
                    >
                      删除
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

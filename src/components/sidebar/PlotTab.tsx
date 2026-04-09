import { useState, useMemo, type CSSProperties } from 'react';
import type { PlotStore } from '../../types/stores';
import { Button } from '../ui/Button';

const styles: Record<string, CSSProperties> = {
  wrapper: { display: 'flex', flexDirection: 'column', height: '100%' },
  filters: { display: 'flex', gap: 4, padding: 'var(--spacing-xs)', paddingBottom: 0 },
  filterBtn: {
    flex: 1, height: 28, fontSize: 12, padding: '0 4px',
    borderRadius: 'var(--radius)', border: '1px solid var(--color-border)',
    background: '#fff', cursor: 'pointer', color: 'var(--color-text-secondary)',
    transition: 'all 0.15s',
  },
  filterActive: { background: 'var(--color-accent)', color: '#fff', borderColor: 'var(--color-accent)' },
  list: { flex: 1, overflow: 'auto', padding: 'var(--spacing-xs)' },
  item: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 8px', cursor: 'pointer', borderRadius: 'var(--radius)',
    fontSize: 14, transition: 'background 0.1s',
  },
  name: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  statusTag: { fontSize: 11, padding: '1px 6px', borderRadius: 10, whiteSpace: 'nowrap' as const },
  count: { fontSize: 11, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' as const },
  empty: {
    padding: 16, color: 'var(--color-text-secondary)', fontSize: 13, textAlign: 'center' as const,
  },
  footer: {
    display: 'flex', padding: 'var(--spacing-xs)', borderTop: '1px solid var(--color-border)',
  },
};

type FilterStatus = 'all' | 'pending' | 'in_progress' | 'resolved';

const FILTER_LABELS: { key: FilterStatus; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '未展开' },
  { key: 'in_progress', label: '进行中' },
  { key: 'resolved', label: '已回收' },
];

const STATUS_TAG_STYLES: Record<string, { bg: string; color: string }> = {
  pending: { bg: '#FFF5F5', color: '#E53E3E' },
  in_progress: { bg: '#EBF8FF', color: '#3182CE' },
  resolved: { bg: '#F0FFF4', color: '#38A169' },
};

const STATUS_LABELS: Record<string, string> = {
  pending: '未展开', in_progress: '进行中', resolved: '已回收',
};

interface PlotTabProps {
  projectId: string;
  plotStore: PlotStore;
  onSelectThread?: (id: string) => void;
  onAddThread?: () => void;
}

export function PlotTab({ projectId, plotStore, onSelectThread, onAddThread }: PlotTabProps) {
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const threads = useMemo(() => {
    if (filter === 'all') {
      return plotStore.listThreads(projectId);
    }
    return plotStore.filterByStatus(projectId, filter);
  }, [plotStore, projectId, filter]);

  return (
    <div style={styles.wrapper}>
      <div style={styles.filters}>
        {FILTER_LABELS.map(({ key, label }) => (
          <button
            key={key}
            style={{ ...styles.filterBtn, ...(filter === key ? styles.filterActive : {}) }}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={styles.list}>
        {threads.length === 0 && (
          <div style={styles.empty}>暂无情节线索，点击下方按钮添加</div>
        )}
        {threads.map((thread) => {
          const tagStyle = STATUS_TAG_STYLES[thread.status] || { bg: '#EDF2F7', color: '#4A5568' };
          return (
            <div
              key={thread.id}
              style={{
                ...styles.item,
                background: hoveredId === thread.id ? '#EDF2F7' : 'transparent',
              }}
              onClick={() => onSelectThread?.(thread.id)}
              onMouseEnter={() => setHoveredId(thread.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <span style={styles.name}>{thread.name}</span>
              <span style={{ ...styles.statusTag, background: tagStyle.bg, color: tagStyle.color }}>
                {STATUS_LABELS[thread.status] || thread.status}
              </span>
              <span style={styles.count}>{thread.associatedChapterIds.length}章</span>
            </div>
          );
        })}
      </div>
      <div style={styles.footer}>
        <Button
          variant="secondary"
          style={{ flex: 1, fontSize: 12, height: 30 }}
          onClick={onAddThread}
        >
          添加线索
        </Button>
      </div>
    </div>
  );
}

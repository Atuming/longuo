import { useState, useMemo, type CSSProperties } from 'react';
import type { WorldStore } from '../../types/stores';
import { BUILT_IN_CATEGORIES, getCategoryInfo } from '../../types/world';
import type { CustomWorldCategory } from '../../types/world';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

const styles: Record<string, CSSProperties> = {
  wrapper: { display: 'flex', flexDirection: 'column', height: '100%' },
  filters: {
    display: 'flex', flexWrap: 'wrap', gap: 4, padding: 'var(--spacing-xs)',
    paddingBottom: 0,
  },
  filterBtn: {
    height: 28, fontSize: 12, padding: '0 6px',
    borderRadius: 'var(--radius)', border: '1px solid var(--color-border)',
    background: '#fff', cursor: 'pointer', color: 'var(--color-text-secondary)',
    transition: 'all 0.15s',
  },
  filterActive: {
    background: 'var(--color-accent)', color: '#fff', borderColor: 'var(--color-accent)',
  },
  search: { padding: 'var(--spacing-xs)' },
  list: { flex: 1, overflow: 'auto', padding: '0 var(--spacing-xs)' },
  item: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 8px', cursor: 'pointer', borderRadius: 'var(--radius)',
    fontSize: 14, transition: 'background 0.1s',
  },
  name: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  tag: {
    fontSize: 11, padding: '1px 6px', borderRadius: 10,
    whiteSpace: 'nowrap' as const,
  },
  count: { fontSize: 11, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' as const },
  empty: {
    padding: 16, color: 'var(--color-text-secondary)', fontSize: 13, textAlign: 'center' as const,
  },
  footer: {
    display: 'flex', padding: 'var(--spacing-xs)', borderTop: '1px solid var(--color-border)',
  },
};

type FilterType = 'all' | string;

interface WorldTabProps {
  projectId: string;
  worldStore: WorldStore;
  customCategories?: CustomWorldCategory[];
  onSelectEntry?: (id: string) => void;
  onAddEntry?: () => void;
}

export function WorldTab({ projectId, worldStore, customCategories, onSelectEntry, onAddEntry }: WorldTabProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [query, setQuery] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const resolvedCustomCategories = useMemo(() => customCategories ?? [], [customCategories]);

  const filterButtons = useMemo(() => {
    const buttons: { key: string; label: string }[] = [{ key: 'all', label: '全部' }];
    for (const cat of BUILT_IN_CATEGORIES) {
      buttons.push({ key: cat.key, label: cat.label });
    }
    for (const cat of resolvedCustomCategories) {
      buttons.push({ key: cat.key, label: cat.label });
    }
    return buttons;
  }, [resolvedCustomCategories]);

  const entries = useMemo(() => {
    if (query.trim()) {
      return worldStore.searchEntries(projectId, query.trim());
    } else if (filter !== 'all') {
      return worldStore.filterByType(projectId, filter);
    }
    return worldStore.listEntries(projectId);
  }, [worldStore, projectId, filter, query]);

  return (
    <div style={styles.wrapper}>
      <div style={styles.filters}>
        {filterButtons.map(({ key, label }) => (
          <button
            key={key}
            style={{ ...styles.filterBtn, ...(filter === key ? styles.filterActive : {}) }}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={styles.search}>
        <Input
          placeholder="搜索世界观条目"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
      </div>
      <div style={styles.list}>
        {entries.length === 0 && (
          <div style={styles.empty}>暂无世界观条目，点击下方按钮添加</div>
        )}
        {entries.map((entry) => {
          const info = getCategoryInfo(entry.type, resolvedCustomCategories);
          return (
            <div
              key={entry.id}
              style={{
                ...styles.item,
                background: hoveredId === entry.id ? '#EDF2F7' : 'transparent',
              }}
              onClick={() => onSelectEntry?.(entry.id)}
              onMouseEnter={() => setHoveredId(entry.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <span style={styles.name}>{entry.name}</span>
              <span style={{ ...styles.tag, background: info.color.bg, color: info.color.text }}>
                {info.label}
              </span>
              <span style={styles.count}>{entry.associatedCharacterIds.length}人</span>
            </div>
          );
        })}
      </div>
      <div style={styles.footer}>
        <Button
          variant="secondary"
          style={{ flex: 1, fontSize: 12, height: 30 }}
          onClick={onAddEntry}
        >
          添加设定
        </Button>
      </div>
    </div>
  );
}

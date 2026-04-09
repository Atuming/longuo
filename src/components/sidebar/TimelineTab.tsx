import { useState, useMemo, type CSSProperties } from 'react';
import type { TimelineStore, ChapterStore, CharacterStore } from '../../types/stores';
import { Button } from '../ui/Button';

const styles: Record<string, CSSProperties> = {
  wrapper: { display: 'flex', flexDirection: 'column', height: '100%' },
  filters: { padding: 'var(--spacing-xs)', display: 'flex', gap: 6 },
  select: {
    flex: 1, height: 28, borderRadius: 'var(--radius)',
    border: '1px solid var(--color-border)', fontSize: 12, padding: '0 6px',
  },
  list: { flex: 1, overflow: 'auto', padding: '0 var(--spacing-xs)' },
  item: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 8px', cursor: 'pointer', borderRadius: 'var(--radius)',
    fontSize: 14, transition: 'background 0.1s',
  },
  dot: {
    width: 10, height: 10, borderRadius: '50%',
    background: 'var(--color-accent)', flexShrink: 0,
  },
  label: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  empty: {
    padding: 16, color: 'var(--color-text-secondary)', fontSize: 13, textAlign: 'center' as const,
  },
  footer: {
    display: 'flex', padding: 'var(--spacing-xs)', borderTop: '1px solid var(--color-border)',
  },
};

interface TimelineTabProps {
  projectId: string;
  timelineStore: TimelineStore;
  chapterStore: ChapterStore;
  characterStore: CharacterStore;
  onSelectTimelinePoint?: (id: string) => void;
  onAddTimelinePoint?: () => void;
}

export function TimelineTab({
  projectId, timelineStore, chapterStore, characterStore,
  onSelectTimelinePoint, onAddTimelinePoint,
}: TimelineTabProps) {
  const [filterChapter, setFilterChapter] = useState('');
  const [filterCharacter, setFilterCharacter] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const chapters = useMemo(() => chapterStore.listChapters(projectId), [chapterStore, projectId]);
  const characters = useMemo(() => characterStore.listCharacters(projectId), [characterStore, projectId]);
  const points = useMemo(() => {
    if (filterChapter) {
      return timelineStore.filterByChapter(projectId, filterChapter);
    } else if (filterCharacter) {
      return timelineStore.filterByCharacter(projectId, filterCharacter);
    }
    return timelineStore.listTimelinePoints(projectId);
  }, [timelineStore, projectId, filterChapter, filterCharacter]);

  return (
    <div style={styles.wrapper}>
      <div style={styles.filters}>
        <select
          style={styles.select}
          value={filterChapter}
          onChange={(e) => { setFilterChapter(e.target.value); setFilterCharacter(''); }}
        >
          <option value="">按章节筛选</option>
          {chapters.map((ch) => (
            <option key={ch.id} value={ch.id}>{ch.title}</option>
          ))}
        </select>
        <select
          style={styles.select}
          value={filterCharacter}
          onChange={(e) => { setFilterCharacter(e.target.value); setFilterChapter(''); }}
        >
          <option value="">按角色筛选</option>
          {characters.map((ch) => (
            <option key={ch.id} value={ch.id}>{ch.name}</option>
          ))}
        </select>
      </div>
      <div style={styles.list}>
        {points.length === 0 && (
          <div style={styles.empty}>暂无时间节点，点击下方按钮添加</div>
        )}
        {points.map((pt) => (
          <div
            key={pt.id}
            style={{
              ...styles.item,
              background: hoveredId === pt.id ? '#EDF2F7' : 'transparent',
            }}
            onClick={() => onSelectTimelinePoint?.(pt.id)}
            onMouseEnter={() => setHoveredId(pt.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <div style={styles.dot} />
            <span style={styles.label}>{pt.label}</span>
          </div>
        ))}
      </div>
      <div style={styles.footer}>
        <Button
          variant="secondary"
          style={{ flex: 1, fontSize: 12, height: 30 }}
          onClick={onAddTimelinePoint}
        >
          添加时间节点
        </Button>
      </div>
    </div>
  );
}

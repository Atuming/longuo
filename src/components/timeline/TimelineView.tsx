import { useMemo, type CSSProperties } from 'react';
import type { TimelineStore, ChapterStore, CharacterStore } from '../../types/stores';
import type { TimelinePoint } from '../../types/timeline';
import { Button } from '../ui/Button';

const DOT_COLORS = ['#3182CE', '#805AD5', '#DD6B20', '#38A169', '#E53E3E', '#D69E2E', '#319795', '#D53F8C'];
const LINE_COLOR = 'var(--color-border)';

const styles: Record<string, CSSProperties> = {
  wrapper: {
    padding: '16px 24px', height: '100%', overflowY: 'auto',
    display: 'flex', flexDirection: 'column',
  },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '100%',
    color: 'var(--color-text-secondary)', fontSize: 14, gap: 12,
  },
  timeline: {
    position: 'relative' as const,
    paddingLeft: 32,
  },
  line: {
    position: 'absolute' as const,
    left: 13, top: 0, bottom: 0,
    width: 2,
    background: LINE_COLOR,
  },
  node: {
    position: 'relative' as const,
    marginBottom: 20,
    paddingBottom: 4,
  },
  dot: {
    position: 'absolute' as const,
    left: -24, top: 8,
    width: 12, height: 12, borderRadius: '50%',
    border: '3px solid var(--color-card)',
    boxShadow: '0 0 0 1px var(--color-border)',
    zIndex: 1,
  },
  card: {
    background: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius)',
    padding: '12px 16px',
    transition: 'box-shadow 0.15s',
  },
  label: {
    fontSize: 15, fontWeight: 600, color: 'var(--color-text)',
    marginBottom: 6,
  },
  desc: {
    fontSize: 13, color: 'var(--color-text-secondary)',
    lineHeight: '1.5', marginBottom: 8,
    whiteSpace: 'pre-wrap' as const,
  },
  tags: {
    display: 'flex', flexWrap: 'wrap', gap: 4,
  },
  tag: {
    fontSize: 11, padding: '2px 6px', borderRadius: 4,
    whiteSpace: 'nowrap' as const,
  },
  chapterTag: { background: '#EBF8FF', color: '#3182CE' },
  charTag: { background: '#F0FFF4', color: '#38A169' },
  actions: {
    display: 'flex', gap: 6, marginTop: 8,
  },
  sortBadge: {
    position: 'absolute' as const,
    right: 8, top: 8,
    fontSize: 11, color: 'var(--color-text-secondary)',
    background: 'var(--color-bg, #f7fafc)',
    padding: '1px 6px', borderRadius: 10,
  },
};

interface TimelineViewProps {
  projectId: string;
  timelineStore: TimelineStore;
  chapterStore: ChapterStore;
  characterStore: CharacterStore;
  onSelectPoint: (id: string) => void;
  onEdit: (point: TimelinePoint) => void;
  onDelete: (id: string) => void;
}

export function TimelineView({
  projectId,
  timelineStore,
  chapterStore,
  characterStore,
  onSelectPoint,
  onEdit,
  onDelete,
}: TimelineViewProps) {
  const points = useMemo(
    () => timelineStore.listTimelinePoints(projectId),
    [timelineStore, projectId],
  );
  const chapters = useMemo(
    () => chapterStore.listChapters(projectId),
    [chapterStore, projectId],
  );
  const characters = useMemo(
    () => characterStore.listCharacters(projectId),
    [characterStore, projectId],
  );

  const chapterMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const ch of chapters) m.set(ch.id, ch.title);
    return m;
  }, [chapters]);

  const charMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of characters) m.set(c.id, c.name);
    return m;
  }, [characters]);

  if (points.length === 0) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.empty}>
          <span>📅</span>
          <span>暂无时间节点</span>
          <span style={{ fontSize: 12 }}>在左侧「时间线」Tab 中添加节点，这里将展示时间轴视图</span>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.timeline}>
        <div style={styles.line} />
        {points.map((pt, i) => (
          <div
            key={pt.id}
            style={styles.node}
            onClick={() => onSelectPoint(pt.id)}
          >
            <div style={{ ...styles.dot, background: DOT_COLORS[i % DOT_COLORS.length] }} />
            <div style={styles.card}>
              <div style={styles.label}>{pt.label}</div>
              {pt.description && <div style={styles.desc}>{pt.description}</div>}
              <div style={styles.tags}>
                {pt.associatedChapterIds.map((cid) => (
                  <span key={cid} style={{ ...styles.tag, ...styles.chapterTag }}>
                    {chapterMap.get(cid) || cid}
                  </span>
                ))}
                {pt.associatedCharacterIds.map((cid) => (
                  <span key={cid} style={{ ...styles.tag, ...styles.charTag }}>
                    {charMap.get(cid) || cid}
                  </span>
                ))}
              </div>
              <div style={styles.actions}>
                <Button
                  variant="secondary"
                  style={{ fontSize: 11, height: 24, padding: '0 8px' }}
                  onClick={(e) => { e.stopPropagation(); onEdit(pt); }}
                >
                  编辑
                </Button>
                <Button
                  variant="secondary"
                  style={{ fontSize: 11, height: 24, padding: '0 8px', color: '#E53E3E' }}
                  onClick={(e) => { e.stopPropagation(); onDelete(pt.id); }}
                >
                  删除
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

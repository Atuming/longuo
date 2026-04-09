import { useMemo, type CSSProperties } from 'react';
import type { TimelinePoint } from '../../types/timeline';
import type { TimelineStore, ChapterStore, CharacterStore } from '../../types/stores';
import { Button } from '../ui/Button';

const styles: Record<string, CSSProperties> = {
  wrapper: { padding: 'var(--spacing-sm)', display: 'flex', flexDirection: 'column', gap: 12 },
  name: { fontSize: 20, fontWeight: 600, color: 'var(--color-text)' },
  section: { marginBottom: 4 },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 },
  value: { fontSize: 14, color: 'var(--color-text)', lineHeight: '1.5' },
  listItem: {
    padding: '4px 0', fontSize: 13, borderBottom: '1px solid var(--color-border)',
    color: 'var(--color-text)',
  },
  footer: { display: 'flex', gap: 8, marginTop: 8 },
  empty: { fontSize: 13, color: 'var(--color-text-secondary)', fontStyle: 'italic' },
};

interface TimelineDetailPanelProps {
  timelinePointId: string;
  projectId: string;
  timelineStore: TimelineStore;
  chapterStore: ChapterStore;
  characterStore: CharacterStore;
  onEdit?: (point: TimelinePoint) => void;
  onDelete?: (pointId: string) => void;
}

export function TimelineDetailPanel({
  timelinePointId, timelineStore, chapterStore, characterStore,
  onEdit, onDelete,
}: TimelineDetailPanelProps) {
  const point = useMemo(() => timelineStore.getTimelinePoint(timelinePointId), [timelinePointId, timelineStore]);

  if (!point) {
    return <div style={styles.wrapper}><div style={styles.empty}>时间节点未找到</div></div>;
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.name}>{point.label}</div>

      {point.description && (
        <div style={styles.section}>
          <div style={styles.label}>描述</div>
          <div style={styles.value}>{point.description}</div>
        </div>
      )}

      <div style={styles.section}>
        <div style={styles.label}>关联章节</div>
        {point.associatedChapterIds.length === 0 ? (
          <div style={styles.empty}>暂无关联章节</div>
        ) : (
          point.associatedChapterIds.map((cid) => {
            const ch = chapterStore.getChapter(cid);
            return <div key={cid} style={styles.listItem}>{ch?.title || '未知章节'}</div>;
          })
        )}
      </div>

      <div style={styles.section}>
        <div style={styles.label}>关联角色</div>
        {point.associatedCharacterIds.length === 0 ? (
          <div style={styles.empty}>暂无关联角色</div>
        ) : (
          point.associatedCharacterIds.map((cid) => {
            const ch = characterStore.getCharacter(cid);
            return <div key={cid} style={styles.listItem}>{ch?.name || '未知角色'}</div>;
          })
        )}
      </div>

      <div style={styles.footer}>
        <Button variant="secondary" style={{ flex: 1, height: 30, fontSize: 12 }} onClick={() => onEdit?.(point)}>
          编辑
        </Button>
        <Button
          variant="secondary"
          style={{ flex: 1, height: 30, fontSize: 12, color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
          onClick={() => onDelete?.(timelinePointId)}
        >
          删除
        </Button>
      </div>
    </div>
  );
}

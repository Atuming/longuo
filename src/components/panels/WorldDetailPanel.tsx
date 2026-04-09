import { useMemo, type CSSProperties } from 'react';
import type { WorldEntry, CustomWorldCategory } from '../../types/world';
import { getCategoryInfo } from '../../types/world';
import type { WorldStore, CharacterStore } from '../../types/stores';
import { Button } from '../ui/Button';

const styles: Record<string, CSSProperties> = {
  wrapper: { padding: 'var(--spacing-sm)', display: 'flex', flexDirection: 'column', gap: 12 },
  header: { display: 'flex', alignItems: 'center', gap: 8 },
  name: { fontSize: 20, fontWeight: 600, color: 'var(--color-text)', flex: 1 },
  typeTag: { fontSize: 11, padding: '2px 8px', borderRadius: 10 },
  section: { marginBottom: 4 },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 },
  value: { fontSize: 14, color: 'var(--color-text)', lineHeight: '1.5' },
  charItem: {
    padding: '4px 0', fontSize: 13, borderBottom: '1px solid var(--color-border)',
    color: 'var(--color-text)',
  },
  footer: { display: 'flex', gap: 8, marginTop: 8 },
  empty: { fontSize: 13, color: 'var(--color-text-secondary)', fontStyle: 'italic' },
};



interface WorldDetailPanelProps {
  entryId: string;
  projectId: string;
  worldStore: WorldStore;
  characterStore: CharacterStore;
  customCategories?: CustomWorldCategory[];
  onEdit?: (entry: WorldEntry) => void;
  onDelete?: (entryId: string) => void;
}

export function WorldDetailPanel({
  entryId, worldStore, characterStore, customCategories, onEdit, onDelete,
}: WorldDetailPanelProps) {
  const entry = useMemo(() => worldStore.getEntry(entryId), [entryId, worldStore]);

  if (!entry) {
    return <div style={styles.wrapper}><div style={styles.empty}>条目未找到</div></div>;
  }

  const categoryInfo = getCategoryInfo(entry.type, customCategories ?? []);
  const tagColor = { bg: categoryInfo.color.bg, color: categoryInfo.color.text };

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div style={styles.name}>{entry.name}</div>
        <span style={{ ...styles.typeTag, background: tagColor.bg, color: tagColor.color }}>
          {categoryInfo.label}
        </span>
      </div>

      {entry.description && (
        <div style={styles.section}>
          <div style={styles.label}>描述</div>
          <div style={styles.value}>{entry.description}</div>
        </div>
      )}

      <div style={styles.section}>
        <div style={styles.label}>关联角色</div>
        {entry.associatedCharacterIds.length === 0 ? (
          <div style={styles.empty}>暂无关联角色</div>
        ) : (
          entry.associatedCharacterIds.map((cid) => {
            const ch = characterStore.getCharacter(cid);
            return (
              <div key={cid} style={styles.charItem}>{ch?.name || '未知角色'}</div>
            );
          })
        )}
      </div>

      <div style={styles.footer}>
        <Button variant="secondary" style={{ flex: 1, height: 30, fontSize: 12 }} onClick={() => onEdit?.(entry)}>
          编辑
        </Button>
        <Button
          variant="secondary"
          style={{ flex: 1, height: 30, fontSize: 12, color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
          onClick={() => onDelete?.(entryId)}
        >
          删除
        </Button>
      </div>
    </div>
  );
}

import { useState, useMemo, type CSSProperties } from 'react';
import type { Character } from '../../types/character';
import type { CharacterStore, RelationshipStore, TimelineStore } from '../../types/stores';
import { Button } from '../ui/Button';

const styles: Record<string, CSSProperties> = {
  wrapper: { padding: 'var(--spacing-sm)', display: 'flex', flexDirection: 'column', gap: 12 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 20, fontWeight: 600, color: 'var(--color-text)' },
  section: { marginBottom: 4 },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 },
  value: { fontSize: 14, color: 'var(--color-text)', lineHeight: '1.5' },
  aliases: { display: 'flex', gap: 4, flexWrap: 'wrap' as const },
  aliasTag: {
    fontSize: 11, padding: '1px 8px', borderRadius: 10,
    background: '#EDF2F7', color: 'var(--color-text-secondary)',
  },
  kvList: { display: 'flex', flexDirection: 'column', gap: 4 },
  kvRow: { display: 'flex', gap: 8, fontSize: 13 },
  kvKey: { fontWeight: 500, color: 'var(--color-text-secondary)', minWidth: 60 },
  kvValue: { color: 'var(--color-text)', flex: 1 },
  relItem: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '4px 0', fontSize: 13, borderBottom: '1px solid var(--color-border)',
  },
  relType: {
    fontSize: 11, padding: '1px 6px', borderRadius: 10,
    background: '#EBF8FF', color: '#3182CE',
  },
  snapshotSelect: {
    width: '100%', height: 32, borderRadius: 'var(--radius)',
    border: '1px solid var(--color-border)', fontSize: 13, padding: '0 8px',
  },
  footer: { display: 'flex', gap: 8, marginTop: 8 },
  empty: { fontSize: 13, color: 'var(--color-text-secondary)', fontStyle: 'italic' },
};

interface CharacterDetailPanelProps {
  characterId: string;
  projectId: string;
  characterStore: CharacterStore;
  relationshipStore: RelationshipStore;
  timelineStore: TimelineStore;
  onEdit?: (character: Character) => void;
  onDelete?: (characterId: string) => void;
}

export function CharacterDetailPanel({
  characterId, projectId, characterStore, relationshipStore, timelineStore,
  onEdit, onDelete,
}: CharacterDetailPanelProps) {
  const character = useMemo(() => characterStore.getCharacter(characterId), [characterId, characterStore]);
  const relationships = useMemo(() => relationshipStore.listRelationshipsForCharacter(characterId), [characterId, relationshipStore]);
  const timelinePoints = useMemo(() => timelineStore.listTimelinePoints(projectId), [projectId, timelineStore]);
  const [selectedTimeline, setSelectedTimeline] = useState<string>('');

  const snapshot = selectedTimeline
    ? characterStore.getSnapshotAtTimeline(characterId, selectedTimeline)
    : undefined;

  if (!character) {
    return <div style={styles.wrapper}><div style={styles.empty}>角色未找到</div></div>;
  }

  const displayAppearance = snapshot?.appearance || character.appearance;
  const displayPersonality = snapshot?.personality || character.personality;
  const displayCustom = snapshot?.customAttributes || character.customAttributes;

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div style={styles.name}>{character.name}</div>
      </div>

      {character.aliases.length > 0 && (
        <div style={styles.section}>
          <div style={styles.label}>别名</div>
          <div style={styles.aliases}>
            {character.aliases.map((a, i) => (
              <span key={i} style={styles.aliasTag}>{a}</span>
            ))}
          </div>
        </div>
      )}

      {displayAppearance && (
        <div style={styles.section}>
          <div style={styles.label}>外貌</div>
          <div style={styles.value}>{displayAppearance}</div>
        </div>
      )}

      {displayPersonality && (
        <div style={styles.section}>
          <div style={styles.label}>性格</div>
          <div style={styles.value}>{displayPersonality}</div>
        </div>
      )}

      {character.backstory && (
        <div style={styles.section}>
          <div style={styles.label}>背景故事</div>
          <div style={styles.value}>{character.backstory}</div>
        </div>
      )}

      {Object.keys(displayCustom).length > 0 && (
        <div style={styles.section}>
          <div style={styles.label}>自定义属性</div>
          <div style={styles.kvList}>
            {Object.entries(displayCustom).map(([k, v]) => (
              <div key={k} style={styles.kvRow}>
                <span style={styles.kvKey}>{k}</span>
                <span style={styles.kvValue}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={styles.section}>
        <div style={styles.label}>社会关系</div>
        {relationships.length === 0 ? (
          <div style={styles.empty}>暂无关系</div>
        ) : (
          relationships.map((rel) => {
            const targetId = rel.sourceCharacterId === characterId
              ? rel.targetCharacterId : rel.sourceCharacterId;
            const target = characterStore.getCharacter(targetId);
            return (
              <div key={rel.id} style={styles.relItem}>
                <span>{target?.name || '未知'}</span>
                <span style={styles.relType}>{rel.customTypeName || rel.relationshipType}</span>
              </div>
            );
          })
        )}
      </div>

      <div style={styles.section}>
        <div style={styles.label}>时间快照</div>
        <select
          style={styles.snapshotSelect}
          value={selectedTimeline}
          onChange={(e) => setSelectedTimeline(e.target.value)}
        >
          <option value="">当前（默认）</option>
          {timelinePoints.map((tp) => (
            <option key={tp.id} value={tp.id}>{tp.label}</option>
          ))}
        </select>
      </div>

      <div style={styles.footer}>
        <Button variant="secondary" style={{ flex: 1, height: 30, fontSize: 12 }} onClick={() => onEdit?.(character)}>
          编辑
        </Button>
        <Button
          variant="secondary"
          style={{ flex: 1, height: 30, fontSize: 12, color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
          onClick={() => onDelete?.(characterId)}
        >
          删除
        </Button>
      </div>
    </div>
  );
}

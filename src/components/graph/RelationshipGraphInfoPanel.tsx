import { type CSSProperties } from 'react';
import type { Character } from '../../types/character';
import type { CharacterRelationship } from '../../types/relationship';
import type { CharacterStore, RelationshipStore, TimelineStore } from '../../types/stores';
import { CharacterDetailPanel } from '../panels/CharacterDetailPanel';

const REL_LABELS: Record<string, string> = {
  family: '亲属', friend: '朋友', enemy: '敌人', lover: '恋人',
  mentor: '师徒', superior: '上下级', ally: '盟友', custom: '自定义',
};

const REL_COLORS: Record<string, string> = {
  family: '#38A169', friend: '#3182CE', enemy: '#E53E3E', lover: '#ED64A6',
  mentor: '#9F7AEA', superior: '#718096', ally: '#3182CE', custom: '#718096',
};

const s: Record<string, CSSProperties> = {
  wrapper: { padding: 'var(--spacing-sm)', display: 'flex', flexDirection: 'column', gap: 12 },
  title: { fontSize: 16, fontWeight: 600, color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)', paddingBottom: 8 },
  empty: { fontSize: 13, color: 'var(--color-text-secondary)', fontStyle: 'italic', textAlign: 'center', padding: 24 },
  relDetail: { display: 'flex', flexDirection: 'column', gap: 8 },
  relRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 },
  relLabel: { fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', minWidth: 60 },
  relValue: { fontSize: 13, color: 'var(--color-text)' },
  relTypeTag: { fontSize: 11, padding: '2px 8px', borderRadius: 10, color: 'white', fontWeight: 500 },
  historyTitle: { fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginTop: 8 },
  historyItem: {
    padding: '6px 8px', borderRadius: 'var(--radius)',
    border: '1px solid var(--color-border)', fontSize: 12,
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  historyTime: { fontSize: 11, color: 'var(--color-text-secondary)' },
  historyType: { fontSize: 12, fontWeight: 500 },
  historyDesc: { fontSize: 12, color: 'var(--color-text)' },
  strengthBar: { height: 6, borderRadius: 3, background: '#E2E8F0', flex: 1 },
  strengthFill: { height: '100%', borderRadius: 3 },
};

interface RelHistoryItem extends CharacterRelationship {
  startLabel: string;
  endLabel: string;
}

interface RelationshipGraphInfoPanelProps {
  selectedCharacterId: string | null;
  selectedRelationship: CharacterRelationship | null;
  relationshipHistory: RelHistoryItem[];
  projectId: string;
  characterStore: CharacterStore;
  relationshipStore: RelationshipStore;
  timelineStore: TimelineStore;
  onEditCharacter?: (character: Character) => void;
  onDeleteCharacter?: (characterId: string) => void;
}

export function RelationshipGraphInfoPanel({
  selectedCharacterId, selectedRelationship, relationshipHistory,
  projectId, characterStore, relationshipStore, timelineStore,
  onEditCharacter, onDeleteCharacter,
}: RelationshipGraphInfoPanelProps) {
  // Show character detail
  if (selectedCharacterId) {
    return (
      <div>
        <div style={{ ...s.title, padding: '8px 12px' }}>角色详情</div>
        <CharacterDetailPanel
          characterId={selectedCharacterId}
          projectId={projectId}
          characterStore={characterStore}
          relationshipStore={relationshipStore}
          timelineStore={timelineStore}
          onEdit={onEditCharacter}
          onDelete={onDeleteCharacter}
        />
      </div>
    );
  }

  // Show relationship detail
  if (selectedRelationship) {
    const srcChar = characterStore.getCharacter(selectedRelationship.sourceCharacterId);
    const tgtChar = characterStore.getCharacter(selectedRelationship.targetCharacterId);
    const typeLabel = selectedRelationship.customTypeName || REL_LABELS[selectedRelationship.relationshipType] || selectedRelationship.relationshipType;
    const typeColor = REL_COLORS[selectedRelationship.relationshipType] || '#718096';

    return (
      <div style={s.wrapper}>
        <div style={s.title}>关系详情</div>
        <div style={s.relDetail}>
          <div style={s.relRow}>
            <span style={s.relLabel}>角色</span>
            <span style={s.relValue}>{srcChar?.name ?? '未知'} ↔ {tgtChar?.name ?? '未知'}</span>
          </div>
          <div style={s.relRow}>
            <span style={s.relLabel}>类型</span>
            <span style={{ ...s.relTypeTag, background: typeColor }}>{typeLabel}</span>
          </div>
          <div style={s.relRow}>
            <span style={s.relLabel}>描述</span>
            <span style={s.relValue}>{selectedRelationship.description || '无描述'}</span>
          </div>
          <div style={s.relRow}>
            <span style={s.relLabel}>强度</span>
            <div style={s.strengthBar}>
              <div style={{ ...s.strengthFill, width: `${selectedRelationship.strength * 10}%`, background: typeColor }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: typeColor }}>{selectedRelationship.strength}/10</span>
          </div>
        </div>

        {/* Relationship history */}
        {relationshipHistory.length > 0 && (
          <>
            <div style={s.historyTitle}>关系历史演变</div>
            {relationshipHistory.map((item) => {
              const itemColor = REL_COLORS[item.relationshipType] || '#718096';
              const itemLabel = item.customTypeName || REL_LABELS[item.relationshipType] || item.relationshipType;
              return (
                <div key={item.id} style={s.historyItem}>
                  <div style={s.historyTime}>{item.startLabel} → {item.endLabel}</div>
                  <div style={{ ...s.historyType, color: itemColor }}>{itemLabel}（强度 {item.strength}/10）</div>
                  {item.description && <div style={s.historyDesc}>{item.description}</div>}
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  }

  return (
    <div style={s.wrapper}>
      <div style={s.title}>关系图谱</div>
      <div style={s.empty}>点击节点查看角色详情，点击连线查看关系详情。<br />选中两个节点可快速创建关系。</div>
    </div>
  );
}

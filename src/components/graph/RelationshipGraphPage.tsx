import { useState, useMemo, type CSSProperties } from 'react';
import type { Character } from '../../types/character';
import type { CharacterRelationship } from '../../types/relationship';
import type { TimelinePoint } from '../../types/timeline';
import type { CharacterStore, RelationshipStore, TimelineStore } from '../../types/stores';
import { RelationshipGraphView } from './RelationshipGraphView';
import { RelationshipGraphInfoPanel } from './RelationshipGraphInfoPanel';
import { RelationshipDialog } from '../dialogs/RelationshipDialog';

const REL_TYPE_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: 'family', label: '亲属', color: '#38A169' },
  { value: 'friend', label: '朋友', color: '#3182CE' },
  { value: 'enemy', label: '敌人', color: '#E53E3E' },
  { value: 'lover', label: '恋人', color: '#ED64A6' },
  { value: 'mentor', label: '师徒', color: '#9F7AEA' },
  { value: 'superior', label: '上下级', color: '#718096' },
  { value: 'ally', label: '盟友', color: '#3182CE' },
  { value: 'custom', label: '自定义', color: '#718096' },
];

const s: Record<string, CSSProperties> = {
  wrapper: { display: 'flex', flexDirection: 'column', height: '100%', background: '#F7FAFC' },
  controls: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px',
    borderBottom: '1px solid var(--color-border)', background: 'white', flexShrink: 0,
    flexWrap: 'wrap',
  },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' },
  slider: { width: 200 },
  sliderLabel: { fontSize: 12, color: 'var(--color-text)', minWidth: 60 },
  filterGroup: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  checkbox: { display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, cursor: 'pointer' },
  colorDot: { width: 8, height: 8, borderRadius: '50%', display: 'inline-block' },
  body: { display: 'flex', flex: 1, overflow: 'hidden' },
  canvas: { flex: 1, position: 'relative' },
  panel: { width: 320, borderLeft: '1px solid var(--color-border)', background: 'white', overflowY: 'auto' },
};

interface RelationshipGraphPageProps {
  projectId: string;
  characters: Character[];
  relationships: CharacterRelationship[];
  timelinePoints: TimelinePoint[];
  characterStore: CharacterStore;
  relationshipStore: RelationshipStore;
  timelineStore: TimelineStore;
  onEditCharacter?: (character: Character) => void;
  onDeleteCharacter?: (characterId: string) => void;
}

export function RelationshipGraphPage({
  projectId, characters, relationships, timelinePoints,
  characterStore, relationshipStore, timelineStore,
  onEditCharacter, onDeleteCharacter,
}: RelationshipGraphPageProps) {
  const [timelineIdx, setTimelineIdx] = useState(timelinePoints.length > 0 ? timelinePoints.length - 1 : 0);
  const [filterTypes, setFilterTypes] = useState<Set<string>>(new Set());
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [selectedRel, setSelectedRel] = useState<CharacterRelationship | null>(null);
  const [showRelDialog, setShowRelDialog] = useState(false);
  const [relDialogSource, setRelDialogSource] = useState<string>('');

  const selectedTimelineId = timelinePoints.length > 0 ? timelinePoints[timelineIdx]?.id ?? null : null;
  const currentTimelineLabel = timelinePoints[timelineIdx]?.label ?? '无时间节点';

  const toggleFilter = (type: string) => {
    setFilterTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  // Two-node selection for quick relationship creation
  const [firstSelectedNode, setFirstSelectedNode] = useState<string | null>(null);

  const handleSelectCharacter = (charId: string) => {
    setSelectedCharId(charId);
    setSelectedRel(null);
    if (firstSelectedNode && firstSelectedNode !== charId) {
      // Two nodes selected - open relationship dialog
      setRelDialogSource(firstSelectedNode);
      setShowRelDialog(true);
      setFirstSelectedNode(null);
    } else {
      setFirstSelectedNode(charId);
    }
  };

  const handleSelectRelationship = (rel: CharacterRelationship) => {
    setSelectedRel(rel);
    setSelectedCharId(null);
    setFirstSelectedNode(null);
  };

  const handleCreateRelationship = (data: Omit<CharacterRelationship, 'id'>) => {
    relationshipStore.createRelationship(data);
    setShowRelDialog(false);
  };

  // Relationship history for selected relationship
  const relHistory = useMemo(() => {
    if (!selectedRel) return [];
    const allRels = relationships.filter(
      (r) =>
        (r.sourceCharacterId === selectedRel.sourceCharacterId && r.targetCharacterId === selectedRel.targetCharacterId) ||
        (r.sourceCharacterId === selectedRel.targetCharacterId && r.targetCharacterId === selectedRel.sourceCharacterId)
    );
    return allRels.map((r) => {
      const startTp = timelinePoints.find((tp) => tp.id === r.startTimelinePointId);
      const endTp = r.endTimelinePointId ? timelinePoints.find((tp) => tp.id === r.endTimelinePointId) : null;
      return { ...r, startLabel: startTp?.label ?? '未知', endLabel: endTp?.label ?? '至今' };
    }).sort((a, b) => {
      const aOrder = timelinePoints.find((tp) => tp.id === a.startTimelinePointId)?.sortOrder ?? 0;
      const bOrder = timelinePoints.find((tp) => tp.id === b.startTimelinePointId)?.sortOrder ?? 0;
      return aOrder - bOrder;
    });
  }, [selectedRel, relationships, timelinePoints]);

  return (
    <div style={s.wrapper}>
      {/* Top controls */}
      <div style={s.controls}>
        <span style={s.label}>时间线：</span>
        {timelinePoints.length > 0 ? (
          <>
            <input
              type="range" min={0} max={timelinePoints.length - 1} step={1}
              value={timelineIdx}
              onChange={(e) => setTimelineIdx(Number(e.target.value))}
              style={s.slider}
            />
            <span style={s.sliderLabel}>{currentTimelineLabel}</span>
          </>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>无时间节点</span>
        )}
        <span style={{ ...s.label, marginLeft: 16 }}>筛选：</span>
        <div style={s.filterGroup}>
          {REL_TYPE_OPTIONS.map((opt) => (
            <label key={opt.value} style={s.checkbox}>
              <input
                type="checkbox"
                checked={filterTypes.size === 0 || filterTypes.has(opt.value)}
                onChange={() => toggleFilter(opt.value)}
              />
              <span style={{ ...s.colorDot, background: opt.color }} />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {/* Body: canvas + info panel */}
      <div style={s.body}>
        <div style={s.canvas}>
          <RelationshipGraphView
            characters={characters}
            relationships={relationships}
            timelinePoints={timelinePoints}
            selectedTimelineId={selectedTimelineId}
            filterTypes={filterTypes.size > 0 ? filterTypes : undefined}
            onSelectCharacter={handleSelectCharacter}
            onSelectRelationship={handleSelectRelationship}
            highlightCharacterId={selectedCharId}
          />
        </div>
        <div style={s.panel}>
          <RelationshipGraphInfoPanel
            selectedCharacterId={selectedCharId}
            selectedRelationship={selectedRel}
            relationshipHistory={relHistory}
            projectId={projectId}
            characterStore={characterStore}
            relationshipStore={relationshipStore}
            timelineStore={timelineStore}
            onEditCharacter={onEditCharacter}
            onDeleteCharacter={onDeleteCharacter}
          />
        </div>
      </div>

      {/* Quick create relationship dialog */}
      <RelationshipDialog
        open={showRelDialog}
        projectId={projectId}
        sourceCharacterId={relDialogSource}
        characters={characters}
        timelinePoints={timelinePoints}
        onConfirm={handleCreateRelationship}
        onCancel={() => setShowRelDialog(false)}
      />
    </div>
  );
}

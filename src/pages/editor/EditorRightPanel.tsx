import type { CSSProperties } from 'react';
import { CharacterDetailPanel } from '../../components/panels/CharacterDetailPanel';
import { WorldDetailPanel } from '../../components/panels/WorldDetailPanel';
import { TimelineDetailPanel } from '../../components/panels/TimelineDetailPanel';
import { ConsistencyPanel } from '../../components/panels/ConsistencyPanel';
import { VersionHistoryPanel } from '../../components/panels/VersionHistoryPanel';
import { useEditorStores } from './EditorStoreContext';
import type { PanelMode } from './EditorToolbar';
import type { ConsistencyIssue } from '../../types/consistency';
import type { Character } from '../../types/character';
import type { WorldEntry } from '../../types/world';
import type { TimelinePoint } from '../../types/timeline';
import type { NovelFileData } from '../../types/project';

/* ── styles (module-level, no re-creation per render) ── */
const s: Record<string, CSSProperties> = {
  tabPlaceholder: {
    padding: 'var(--spacing-sm)',
    color: 'var(--color-text-secondary)',
    fontSize: 13,
    textAlign: 'center' as const,
  },
  defaultHint: {
    padding: 'var(--spacing-sm)',
    color: 'var(--color-text-secondary)',
    fontSize: 13,
  },
};

export interface EditorRightPanelProps {
  panelMode: PanelMode;
  selectedCharId: string | null;
  selectedWorldId: string | null;
  selectedTimelineId: string | null;
  consistencyIssues: ConsistencyIssue[];
  consistencyFixedCount: number;
  onEditCharacter: (character: Character) => void;
  onDeleteCharacter: (characterId: string) => void;
  onEditWorld: (entry: WorldEntry) => void;
  onDeleteWorld: (entryId: string) => void;
  onEditTimeline: (point: TimelinePoint) => void;
  onDeleteTimeline: (pointId: string) => void;
  onApplyConsistency: (issue: ConsistencyIssue) => void;
  onIgnoreConsistency: (issue: ConsistencyIssue) => void;
  onRestoreSnapshot: (data: NovelFileData) => void;
}

export function EditorRightPanel({
  panelMode,
  selectedCharId,
  selectedWorldId,
  selectedTimelineId,
  consistencyIssues,
  consistencyFixedCount,
  onEditCharacter,
  onDeleteCharacter,
  onEditWorld,
  onDeleteWorld,
  onEditTimeline,
  onDeleteTimeline,
  onApplyConsistency,
  onIgnoreConsistency,
  onRestoreSnapshot,
}: EditorRightPanelProps) {
  const {
    projectId,
    characterStore,
    relationshipStore,
    worldStore,
    timelineStore,
    chapterStore,
    snapshotStore,
  } = useEditorStores();

  switch (panelMode) {
    case 'character':
      if (!selectedCharId) return <div style={s.tabPlaceholder}>请选择一个角色</div>;
      return (
        <CharacterDetailPanel
          characterId={selectedCharId}
          projectId={projectId}
          characterStore={characterStore}
          relationshipStore={relationshipStore}
          timelineStore={timelineStore}
          onEdit={onEditCharacter}
          onDelete={onDeleteCharacter}
        />
      );
    case 'world':
      if (!selectedWorldId) return <div style={s.tabPlaceholder}>请选择一个世界观条目</div>;
      return (
        <WorldDetailPanel
          entryId={selectedWorldId}
          projectId={projectId}
          worldStore={worldStore}
          characterStore={characterStore}
          customCategories={worldStore.listCustomCategories(projectId)}
          onEdit={onEditWorld}
          onDelete={onDeleteWorld}
        />
      );
    case 'timeline':
      if (!selectedTimelineId) return <div style={s.tabPlaceholder}>请选择一个时间节点</div>;
      return (
        <TimelineDetailPanel
          timelinePointId={selectedTimelineId}
          projectId={projectId}
          timelineStore={timelineStore}
          chapterStore={chapterStore}
          characterStore={characterStore}
          onEdit={onEditTimeline}
          onDelete={onDeleteTimeline}
        />
      );
    case 'consistency':
      return (
        <ConsistencyPanel
          issues={consistencyIssues}
          fixedCount={consistencyFixedCount}
          onApply={onApplyConsistency}
          onIgnore={onIgnoreConsistency}
        />
      );
    case 'version-history':
      return (
        <VersionHistoryPanel
          projectId={projectId}
          snapshotStore={snapshotStore}
          onRestore={onRestoreSnapshot}
        />
      );
    default:
      return <div style={s.defaultHint}>选择侧边栏项目查看详情</div>;
  }
}

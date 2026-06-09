import { useCallback, type CSSProperties, type RefObject } from 'react';
import { WritingEditor } from '../../components/editor/WritingEditor';
import type { WritingEditorHandle } from '../../components/editor/WritingEditor';
import { RelationshipGraphPage } from '../../components/graph/RelationshipGraphPage';
import { AIAssistantPanel } from '../../components/ai/AIAssistantPanel';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';
import { TimelineView } from '../../components/timeline/TimelineView';
import { PlotBoard } from '../../components/plot/PlotBoard';
import { useEditorStores } from './EditorStoreContext';
import type { ViewMode } from './EditorToolbar';
import type { Character } from '../../types/character';
import type { TimelinePoint } from '../../types/timeline';
import type { PlotThread } from '../../types/plot';

/* ── styles (module-level, no re-creation per render) ── */
const s: Record<string, CSSProperties> = {
  tabPlaceholder: {
    padding: 'var(--spacing-sm)',
    color: 'var(--color-text-secondary)',
    fontSize: 13,
    textAlign: 'center' as const,
  },
  writingContainer: {
    position: 'relative' as const,
    width: '100%',
    height: '100%',
  },
};

export interface EditorContentProps {
  viewMode: ViewMode;
  selectedChapterId: string | null;
  editorRef: RefObject<WritingEditorHandle | null>;
  showAIPanel: boolean;
  onCloseAIPanel: () => void;
  onOpenAIConfig: () => void;
  onAIAccept: (content: string) => void;
  effectiveTheme: 'light' | 'dark';
  onEditCharacter: (character: Character) => void;
  onDeleteCharacter: (characterId: string) => void;
  onEditTimeline: (point: TimelinePoint) => void;
  onDeleteTimeline: (pointId: string) => void;
  onEditPlot: (thread: PlotThread) => void;
  onDeletePlot: (threadId: string) => void;
  onSelectTimeline: (pointId: string) => void;
  onSelectPlot: (threadId: string) => void;
}

export function EditorContent({
  viewMode,
  selectedChapterId,
  editorRef,
  showAIPanel,
  onCloseAIPanel,
  onOpenAIConfig,
  onAIAccept,
  effectiveTheme,
  onEditCharacter,
  onDeleteCharacter,
  onEditTimeline,
  onDeleteTimeline,
  onEditPlot,
  onDeletePlot,
  onSelectTimeline,
  onSelectPlot,
}: EditorContentProps) {
  const {
    projectId,
    projectStore,
    chapterStore,
    characterStore,
    relationshipStore,
    timelineStore,
    plotStore,
    aiStore,
    aiEngine,
  } = useEditorStores();

  const getCharacters = useCallback(
    () => characterStore.listCharacters(projectId),
    [characterStore, projectId],
  );

  const selectedText = editorRef.current?.getSelectedText() ?? '';

  switch (viewMode) {
    case 'graph':
      return (
        <RelationshipGraphPage
          projectId={projectId}
          characters={characterStore.listCharacters(projectId)}
          relationships={relationshipStore.listRelationships(projectId)}
          timelinePoints={timelineStore.listTimelinePoints(projectId)}
          characterStore={characterStore}
          relationshipStore={relationshipStore}
          timelineStore={timelineStore}
          onEditCharacter={onEditCharacter}
          onDeleteCharacter={onDeleteCharacter}
        />
      );
    case 'timeline':
      return (
        <TimelineView
          projectId={projectId}
          timelineStore={timelineStore}
          chapterStore={chapterStore}
          characterStore={characterStore}
          onSelectPoint={onSelectTimeline}
          onEdit={onEditTimeline}
          onDelete={onDeleteTimeline}
        />
      );
    case 'plot':
      return (
        <PlotBoard
          projectId={projectId}
          plotStore={plotStore}
          chapterStore={chapterStore}
          onSelectThread={onSelectPlot}
          onEdit={onEditPlot}
          onDelete={onDeletePlot}
        />
      );
    case 'writing':
    default:
      return (
        <div style={s.writingContainer}>
          <ErrorBoundary fallbackTitle="编辑器区域出错了">
            <WritingEditor
              ref={editorRef}
              chapterId={selectedChapterId}
              chapterStore={chapterStore}
              projectStore={projectStore}
              projectId={projectId}
              isDark={effectiveTheme === 'dark'}
              getCharacters={getCharacters}
            />
          </ErrorBoundary>
          <AIAssistantPanel
            open={showAIPanel}
            onClose={onCloseAIPanel}
            chapterId={selectedChapterId}
            projectId={projectId}
            aiStore={aiStore}
            aiEngine={aiEngine}
            onAccept={onAIAccept}
            onOpenSettings={onOpenAIConfig}
            selectedText={selectedText}
          />
        </div>
      );
  }
}

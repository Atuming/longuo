import React, { Suspense } from 'react';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';
import { useEditorStores } from './EditorStoreContext';
import type { Character } from '../../types/character';
import type { WorldEntry } from '../../types/world';
import type { TimelinePoint } from '../../types/timeline';
import type { PlotThread } from '../../types/plot';
import type { ExportOptions } from '../../types/export';

const LazyCharacterDialog = React.lazy(() =>
  import('../../components/dialogs/CharacterDialog').then((m) => ({ default: m.CharacterDialog }))
);
const LazyWorldDialog = React.lazy(() =>
  import('../../components/dialogs/WorldDialog').then((m) => ({ default: m.WorldDialog }))
);
const LazyTimelineDialog = React.lazy(() =>
  import('../../components/dialogs/TimelineDialog').then((m) => ({ default: m.TimelineDialog }))
);
const LazyPlotDialog = React.lazy(() =>
  import('../../components/dialogs/PlotDialog').then((m) => ({ default: m.PlotDialog }))
);
const LazyExportDialog = React.lazy(() =>
  import('../../components/dialogs/ExportDialog').then((m) => ({ default: m.ExportDialog }))
);
const LazyAIConfigDialog = React.lazy(() =>
  import('../../components/ai/AIConfigDialog').then((m) => ({ default: m.AIConfigDialog }))
);

export interface DialogManagerProps {
  // Character dialog
  showCharDialog: boolean;
  editingCharacter: Character | null;
  onCharConfirm: (data: Omit<Character, 'id' | 'projectId'>) => void;
  onCharCancel: () => void;

  // World dialog
  showWorldDialog: boolean;
  editingWorld: WorldEntry | null;
  onWorldConfirm: (data: Omit<WorldEntry, 'id'>) => void;
  onWorldCancel: () => void;

  // Timeline dialog
  showTimelineDialog: boolean;
  editingTimeline: TimelinePoint | null;
  onTimelineConfirm: (data: Omit<TimelinePoint, 'id'>) => void;
  onTimelineCancel: () => void;

  // Plot dialog
  showPlotDialog: boolean;
  editingPlot: PlotThread | null;
  onPlotConfirm: (data: Omit<PlotThread, 'id'>) => void;
  onPlotCancel: () => void;

  // Export dialog
  showExportDialog: boolean;
  onExportConfirm: (options: ExportOptions) => void;
  onExportCancel: () => void;

  // AI Config dialog
  showAIConfig: boolean;
  onAIConfigClose: () => void;
}

export function DialogManager(props: DialogManagerProps) {
  const {
    projectId, projectName, characterStore, worldStore,
    chapterStore, aiStore,
  } = useEditorStores();

  const {
    showCharDialog, editingCharacter, onCharConfirm, onCharCancel,
    showWorldDialog, editingWorld, onWorldConfirm, onWorldCancel,
    showTimelineDialog, editingTimeline, onTimelineConfirm, onTimelineCancel,
    showPlotDialog, editingPlot, onPlotConfirm, onPlotCancel,
    showExportDialog, onExportConfirm, onExportCancel,
    showAIConfig, onAIConfigClose,
  } = props;

  return (
    <ErrorBoundary fallbackTitle="对话框区域出错了">
      {showExportDialog && (
        <Suspense fallback={null}>
          <LazyExportDialog
            open={showExportDialog}
            projectName={projectName}
            onConfirm={onExportConfirm}
            onCancel={onExportCancel}
          />
        </Suspense>
      )}

      {showAIConfig && (
        <Suspense fallback={null}>
          <LazyAIConfigDialog
            open={showAIConfig}
            aiStore={aiStore}
            onClose={onAIConfigClose}
          />
        </Suspense>
      )}

      {showCharDialog && (
        <Suspense fallback={null}>
          <LazyCharacterDialog
            open={showCharDialog}
            initialData={editingCharacter ?? undefined}
            onConfirm={onCharConfirm}
            onCancel={onCharCancel}
          />
        </Suspense>
      )}

      {showWorldDialog && (
        <Suspense fallback={null}>
          <LazyWorldDialog
            open={showWorldDialog}
            initialData={editingWorld ?? undefined}
            projectId={projectId}
            characters={characterStore.listCharacters(projectId)}
            customCategories={worldStore.listCustomCategories(projectId)}
            onConfirm={onWorldConfirm}
            onCancel={onWorldCancel}
            onAddCustomCategory={(label: string) => {
              worldStore.addCustomCategory(projectId, label);
            }}
          />
        </Suspense>
      )}

      {showTimelineDialog && (
        <Suspense fallback={null}>
          <LazyTimelineDialog
            open={showTimelineDialog}
            initialData={editingTimeline ?? undefined}
            projectId={projectId}
            chapters={chapterStore.listChapters(projectId)}
            characters={characterStore.listCharacters(projectId)}
            onConfirm={onTimelineConfirm}
            onCancel={onTimelineCancel}
          />
        </Suspense>
      )}

      {showPlotDialog && (
        <Suspense fallback={null}>
          <LazyPlotDialog
            open={showPlotDialog}
            initialData={editingPlot ?? undefined}
            projectId={projectId}
            chapters={chapterStore.listChapters(projectId)}
            onConfirm={onPlotConfirm}
            onCancel={onPlotCancel}
          />
        </Suspense>
      )}
    </ErrorBoundary>
  );
}

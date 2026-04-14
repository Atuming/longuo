/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from 'react';
import type { ProjectStore, ChapterStore, CharacterStore, WorldStore, TimelineStore, PlotStore, RelationshipStore, AIAssistantStore } from '../../types/stores';
import type { ThemeStore } from '../../types/theme';
import type { SnapshotStore } from '../../types/snapshot';
import type { ConsistencyEngine, ExportEngine, AIAssistantEngine } from '../../types/engines';
import type { EventBus } from '../../types/event-bus';

export interface EditorStoreContextValue {
  projectStore: ProjectStore;
  projectId: string;
  projectName: string;
  chapterStore: ChapterStore;
  characterStore: CharacterStore;
  worldStore: WorldStore;
  timelineStore: TimelineStore;
  plotStore: PlotStore;
  relationshipStore: RelationshipStore;
  aiStore: AIAssistantStore;
  themeStore: ThemeStore;
  snapshotStore: SnapshotStore;
  consistencyEngine: ConsistencyEngine;
  exportEngine: ExportEngine;
  aiEngine: AIAssistantEngine;
  eventBus: EventBus;
}

export const EditorStoreContext = createContext<EditorStoreContextValue | null>(null);

export function EditorStoreProvider({
  children,
  ...stores
}: EditorStoreContextValue & { children: ReactNode }) {
  return (
    <EditorStoreContext.Provider value={stores}>
      {children}
    </EditorStoreContext.Provider>
  );
}

export function useEditorStores(): EditorStoreContextValue {
  const ctx = useContext(EditorStoreContext);
  if (!ctx) {
    throw new Error('useEditorStores must be used within an EditorStoreProvider');
  }
  return ctx;
}

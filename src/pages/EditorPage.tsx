import { useState, useMemo, useCallback, useRef, useEffect, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { EditorLayout } from '../components/layout/EditorLayout';
import { SidebarTabs, type SidebarTabKey } from '../components/sidebar/SidebarTabs';
import { OutlineTab } from '../components/sidebar/OutlineTab';
import { CharacterTab } from '../components/sidebar/CharacterTab';
import { WorldTab } from '../components/sidebar/WorldTab';
import { TimelineTab } from '../components/sidebar/TimelineTab';
import { PlotTab } from '../components/sidebar/PlotTab';
import { WritingEditor } from '../components/editor/WritingEditor';
import type { WritingEditorHandle } from '../components/editor/WritingEditor';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { showToast } from '../components/ui/Toast';
import { EditorStoreProvider } from './editor/EditorStoreContext';
import { EditorToolbar, type ViewMode, type PanelMode } from './editor/EditorToolbar';
import { EditorContent } from './editor/EditorContent';
import { EditorRightPanel } from './editor/EditorRightPanel';
import { DialogManager } from './editor/DialogManager';
import type { ProjectStore } from '../types/stores';
import type { NovelFileData } from '../types/project';
import type { ConsistencyIssue } from '../types/consistency';
import type { Character } from '../types/character';
import type { WorldEntry } from '../types/world';
import type { TimelinePoint } from '../types/timeline';
import type { PlotThread } from '../types/plot';
import { createChapterStore } from '../stores/chapter-store';
import { createCharacterStore } from '../stores/character-store';
import { createWorldStore } from '../stores/world-store';
import { createTimelineStore } from '../stores/timeline-store';
import { createPlotStore } from '../stores/plot-store';
import { createRelationshipStore } from '../stores/relationship-store';
import { createAIAssistantStore, loadDefaultAIConfig } from '../stores/ai-assistant-store';
import { loadBuiltInSkills } from '../types/skill-defaults';
import { createThemeStore } from '../stores/theme-store';
import { createSnapshotStore } from '../stores/snapshot-store';
import { createEventBus } from '../lib/event-bus';
import { createConsistencyEngine } from '../lib/consistency-engine';
import { createExportEngine } from '../lib/export-engine';
import { createAIAssistantEngine } from '../lib/ai-assistant-engine';
import { createTagStore } from '../stores/tag-store';

/* ── focus-mode styles ── */
const s: Record<string, CSSProperties> = {
  focusWrapper: {
    display: 'flex', flexDirection: 'column', height: '100%',
  },
  focusToolbar: {
    height: 'var(--toolbar-height)', background: 'var(--color-primary)',
    display: 'flex', alignItems: 'center', padding: '0 var(--spacing-sm)',
    color: '#fff', fontSize: 14, flexShrink: 0,
  },
  projectName: { font: 'var(--font-h2)', color: '#fff', cursor: 'pointer' },
  spacer: { flex: 1 },
  toolBtn: {
    background: 'none', border: '1px solid rgba(255,255,255,0.3)', color: '#fff',
    cursor: 'pointer', fontSize: 12, height: 30, padding: '0 10px',
    borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: 4,
  },
  focusEditor: { flex: 1, overflow: 'hidden' },
};

interface EditorPageProps {
  projectStore: ProjectStore;
}

function EditorPage({ projectStore }: EditorPageProps) {
  const navigate = useNavigate();
  const project = projectStore.getCurrentProject();

  /* ── stores & engines (created once) ── */
  const eventBus = useMemo(() => createEventBus(), []);
  const chapterStore = useMemo(() => createChapterStore({ eventBus }), [eventBus]);
  const characterStore = useMemo(() => createCharacterStore(eventBus), [eventBus]);
  const worldStore = useMemo(() => createWorldStore({ eventBus }), [eventBus]);
  const timelineStore = useMemo(() => createTimelineStore({ eventBus }), [eventBus]);
  const plotStore = useMemo(() => createPlotStore({ eventBus }), [eventBus]);
  const relationshipStore = useMemo(() => createRelationshipStore({ eventBus }), [eventBus]);
  const aiStore = useMemo(() => createAIAssistantStore(), []);
  const themeStore = useMemo(() => createThemeStore(), []);
  const snapshotStore = useMemo(() => createSnapshotStore(), []);
  const tagStore = useMemo(() => createTagStore(eventBus), [eventBus]);
  const consistencyEngine = useMemo(() => createConsistencyEngine(), []);

  useEffect(() => {
    loadDefaultAIConfig().then((defaults) => {
      if (defaults) {
        aiStore.updateConfig(defaults);
      }
    });
    loadBuiltInSkills().then((skills) => {
      aiStore.setBuiltInSkills(skills);
    });
  }, [aiStore]);
  const exportEngine = useMemo(() => createExportEngine(), []);
  const aiEngine = useMemo(() => createAIAssistantEngine({
    chapterStore, characterStore, worldStore, timelineStore, aiStore,
  }), [chapterStore, characterStore, worldStore, timelineStore, aiStore]);

  /* ── state ── */
  const editorRef = useRef<WritingEditorHandle>(null);
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>(() => {
    return themeStore.getEffectiveTheme();
  });

  useEffect(() => {
    document.documentElement.dataset.theme = effectiveTheme;
  }, [effectiveTheme]);

  const handleThemeToggle = useCallback(() => {
    const next = effectiveTheme === 'light' ? 'dark' : 'light';
    themeStore.setTheme(next);
    setEffectiveTheme(next);
  }, [effectiveTheme, themeStore]);

  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('writing');
  const [panelMode, setPanelMode] = useState<PanelMode>('none');
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null);
  const [selectedTimelineId, setSelectedTimelineId] = useState<string | null>(null);

  // Consistency
  const [consistencyIssues, setConsistencyIssues] = useState<ConsistencyIssue[]>([]);
  const [consistencyFixedCount, setConsistencyFixedCount] = useState(0);

  // Export
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // AI
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showAIConfig, setShowAIConfig] = useState(false);

  // Character edit dialog
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [showCharDialog, setShowCharDialog] = useState(false);

  // World dialog
  const [editingWorld, setEditingWorld] = useState<WorldEntry | null>(null);
  const [showWorldDialog, setShowWorldDialog] = useState(false);

  // Timeline dialog
  const [editingTimeline, setEditingTimeline] = useState<TimelinePoint | null>(null);
  const [showTimelineDialog, setShowTimelineDialog] = useState(false);

  // Plot dialog
  const [editingPlot, setEditingPlot] = useState<PlotThread | null>(null);
  const [showPlotDialog, setShowPlotDialog] = useState(false);

  // Refresh key to force sidebar list re-render after CRUD operations
  const [refreshKey, setRefreshKey] = useState(0);

  const projectId = project?.id ?? '';
  const projectName = project?.name ?? '未命名项目';

  const handleBack = useCallback(() => navigate('/'), [navigate]);
  const toggleFocus = useCallback(() => setFocusMode((v) => !v), []);

  /* ── stable getCharacters callback for cross-reference ── */
  const getCharacters = useCallback(() => characterStore.listCharacters(projectId), [characterStore, projectId]);

  /* ── Consistency check ── */
  const handleConsistencyCheck = useCallback(() => {
    if (!selectedChapterId) {
      showToast('warning', '请先选择一个章节');
      return;
    }
    const chapter = chapterStore.getChapter(selectedChapterId);
    if (!chapter) return;
    const characters = characterStore.listCharacters(projectId);
    const issues = consistencyEngine.checkChapter(chapter.content, characters);
    issues.forEach((i) => { i.chapterId = selectedChapterId; });
    setConsistencyIssues(issues);
    setConsistencyFixedCount(0);
    setPanelMode('consistency');
  }, [selectedChapterId, chapterStore, characterStore, projectId, consistencyEngine]);

  const handleApplyConsistency = useCallback((issue: ConsistencyIssue) => {
    const chapter = chapterStore.getChapter(issue.chapterId);
    if (!chapter) return;
    const newContent = consistencyEngine.applySuggestion(chapter.content, issue);
    chapterStore.updateChapter(issue.chapterId, { content: newContent });
    setConsistencyFixedCount((c) => c + 1);
    setConsistencyIssues((prev) => prev.filter((i) => i !== issue));
    showToast('success', `已修正：${issue.foundText} → ${issue.suggestedName}`);
  }, [chapterStore, consistencyEngine]);

  const handleIgnoreConsistency = useCallback((issue: ConsistencyIssue) => {
    issue.ignored = true;
    setConsistencyIssues((prev) => [...prev]);
  }, []);

  /* ── Export ── */
  const handleExport = useCallback(async (options: import('../types/export').ExportOptions) => {
    setShowExportDialog(false);
    const chapters = chapterStore.listChapters(projectId);
    if (chapters.length === 0) {
      showToast('warning', '没有可导出的章节');
      return;
    }
    try {
      const result = await exportEngine.exportProject(chapters, options);
      if (result.success && result.data) {
        const url = URL.createObjectURL(result.data);
        const a = document.createElement('a');
        a.href = url;
        const ext = options.format === 'pdf' ? '.pdf'
          : options.format === 'epub' ? '.epub'
          : options.format === 'markdown' ? '.md'
          : '.zip';
        a.download = `${options.title || '导出'}${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('success', '导出成功');
      } else {
        showToast('error', result.error || '导出失败');
        if (result.partialData) {
          const url = URL.createObjectURL(result.partialData);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${options.title || '导出'}_partial`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      }
    } catch (err) {
      showToast('error', `导出失败：${err instanceof Error ? err.message : '未知错误'}`);
    }
  }, [chapterStore, projectId, exportEngine]);

  /* ── AI accept ── */
  const handleAIAccept = useCallback((content: string) => {
    if (!selectedChapterId) return;
    if (editorRef.current) {
      editorRef.current.insertAtCursor(content);
    } else {
      const chapter = chapterStore.getChapter(selectedChapterId);
      if (!chapter) return;
      const newContent = chapter.content ? chapter.content + '\n\n' + content : content;
      chapterStore.updateChapter(selectedChapterId, { content: newContent });
    }
    showToast('success', 'AI 生成内容已插入');
  }, [selectedChapterId, chapterStore]);

  /* ── Snapshot helpers ── */
  const collectProjectData = useCallback((): NovelFileData => {
    return {
      version: 1,
      project: project ?? { id: projectId, name: projectName, description: '', createdAt: new Date(), updatedAt: new Date() },
      chapters: chapterStore.listChapters(projectId),
      characters: characterStore.listCharacters(projectId),
      characterSnapshots: [],
      relationships: relationshipStore.listRelationships(projectId),
      timelinePoints: timelineStore.listTimelinePoints(projectId),
      worldEntries: worldStore.listEntries(projectId),
      plotThreads: plotStore.listThreads(projectId),
      tagData: tagStore.exportData(projectId),
    };
  }, [project, projectId, projectName, chapterStore, characterStore, relationshipStore, timelineStore, worldStore, plotStore, tagStore]);

  const handleSaveSnapshot = useCallback(() => {
    const note = window.prompt('请输入快照备注：', '');
    if (note === null) return;
    try {
      const data = collectProjectData();
      snapshotStore.createSnapshot(projectId, data, note || '手动快照');
      showToast('success', '快照已保存');
    } catch (err) {
      showToast('error', `保存快照失败：${err instanceof Error ? err.message : '未知错误'}`);
    }
  }, [collectProjectData, snapshotStore, projectId]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleRestoreSnapshot = useCallback((_restoredData: NovelFileData) => {
    try {
      const currentData = collectProjectData();
      snapshotStore.createSnapshot(projectId, currentData, '恢复前自动备份');
    } catch {
      // If auto-backup fails, still show the toast
    }
    showToast('success', '已恢复到快照，建议刷新页面以加载完整数据');
  }, [collectProjectData, snapshotStore, projectId]);

  /* ── Save handler ── */
  const handleSave = useCallback(async () => {
    try { await projectStore.saveProject(); showToast('success', '已保存'); } catch { showToast('error', '保存失败'); }
  }, [projectStore]);

  /* ── Dialog callbacks ── */
  const handleCharConfirm = useCallback((data: Omit<Character, 'id' | 'projectId'>) => {
    if (editingCharacter) {
      characterStore.updateCharacter(editingCharacter.id, data);
    } else {
      characterStore.createCharacter(projectId, data);
    }
    setShowCharDialog(false);
    setEditingCharacter(null);
    setRefreshKey((k) => k + 1);
  }, [editingCharacter, characterStore, projectId]);

  const handleCharCancel = useCallback(() => {
    setShowCharDialog(false);
    setEditingCharacter(null);
  }, []);

  const handleWorldConfirm = useCallback((data: Omit<WorldEntry, 'id'>) => {
    if (editingWorld) {
      worldStore.updateEntry(editingWorld.id, data);
    } else {
      worldStore.createEntry(data);
    }
    setShowWorldDialog(false);
    setEditingWorld(null);
    setRefreshKey((k) => k + 1);
  }, [editingWorld, worldStore]);

  const handleWorldCancel = useCallback(() => {
    setShowWorldDialog(false);
    setEditingWorld(null);
  }, []);

  const handleTimelineConfirm = useCallback((data: Omit<TimelinePoint, 'id'>) => {
    if (editingTimeline) {
      timelineStore.updateTimelinePoint(editingTimeline.id, data);
    } else {
      timelineStore.createTimelinePoint(data);
    }
    setShowTimelineDialog(false);
    setEditingTimeline(null);
    setRefreshKey((k) => k + 1);
  }, [editingTimeline, timelineStore]);

  const handleTimelineCancel = useCallback(() => {
    setShowTimelineDialog(false);
    setEditingTimeline(null);
  }, []);

  const handlePlotConfirm = useCallback((data: Omit<PlotThread, 'id'>) => {
    if (editingPlot) {
      plotStore.updateThread(editingPlot.id, data);
    } else {
      plotStore.createThread(data);
    }
    setShowPlotDialog(false);
    setEditingPlot(null);
    setRefreshKey((k) => k + 1);
  }, [editingPlot, plotStore]);

  const handlePlotCancel = useCallback(() => {
    setShowPlotDialog(false);
    setEditingPlot(null);
  }, []);

  /* ── Panel CRUD callbacks ── */
  const handleEditCharacter = useCallback((ch: Character) => {
    setEditingCharacter(ch);
    setShowCharDialog(true);
  }, []);

  const handleDeleteCharacter = useCallback((id: string) => {
    characterStore.deleteCharacter(id);
    setSelectedCharId(null);
    setPanelMode('none');
    setRefreshKey((k) => k + 1);
  }, [characterStore]);

  const handleEditWorld = useCallback((entry: WorldEntry) => {
    setEditingWorld(entry);
    setShowWorldDialog(true);
  }, []);

  const handleDeleteWorld = useCallback((id: string) => {
    worldStore.deleteEntry(id);
    setSelectedWorldId(null);
    setPanelMode('none');
    setRefreshKey((k) => k + 1);
  }, [worldStore]);

  const handleEditTimeline = useCallback((point: TimelinePoint) => {
    setEditingTimeline(point);
    setShowTimelineDialog(true);
  }, []);

  const handleDeleteTimeline = useCallback((id: string) => {
    timelineStore.deleteTimelinePoint(id);
    setSelectedTimelineId(null);
    setPanelMode('none');
    setRefreshKey((k) => k + 1);
  }, [timelineStore]);

  /* ── sidebar tab content ── */
  const renderTabContent = (tab: SidebarTabKey) => {
    switch (tab) {
      case 'outline':
        return (
          <OutlineTab
            projectId={projectId}
            chapterStore={chapterStore}
            tagStore={tagStore}
            selectedChapterId={selectedChapterId}
            onSelectChapter={setSelectedChapterId}
          />
        );
      case 'characters':
        return (
          <CharacterTab
            key={refreshKey}
            projectId={projectId}
            characterStore={characterStore}
            onSelectCharacter={(id) => { setSelectedCharId(id); setPanelMode('character'); }}
            onAddCharacter={() => { setEditingCharacter(null); setShowCharDialog(true); }}
          />
        );
      case 'world':
        return (
          <WorldTab
            key={refreshKey}
            projectId={projectId}
            worldStore={worldStore}
            customCategories={worldStore.listCustomCategories(projectId)}
            onSelectEntry={(id) => { setSelectedWorldId(id); setPanelMode('world'); }}
            onAddEntry={() => { setEditingWorld(null); setShowWorldDialog(true); }}
          />
        );
      case 'timeline':
        return (
          <TimelineTab
            key={refreshKey}
            projectId={projectId}
            timelineStore={timelineStore}
            characterStore={characterStore}
            chapterStore={chapterStore}
            onSelectTimelinePoint={(id) => { setSelectedTimelineId(id); setPanelMode('timeline'); }}
            onAddTimelinePoint={() => { setEditingTimeline(null); setShowTimelineDialog(true); }}
          />
        );
      case 'plot':
        return (
          <PlotTab
            key={refreshKey}
            projectId={projectId}
            plotStore={plotStore}
            onAddThread={() => { setEditingPlot(null); setShowPlotDialog(true); }}
          />
        );
      default:
        return null;
    }
  };

  /* ── focus mode ── */
  if (focusMode) {
    return (
      <EditorStoreProvider
        projectStore={projectStore}
        projectId={projectId}
        projectName={projectName}
        chapterStore={chapterStore}
        characterStore={characterStore}
        worldStore={worldStore}
        timelineStore={timelineStore}
        plotStore={plotStore}
        relationshipStore={relationshipStore}
        aiStore={aiStore}
        themeStore={themeStore}
        snapshotStore={snapshotStore}
        consistencyEngine={consistencyEngine}
        exportEngine={exportEngine}
        aiEngine={aiEngine}
        eventBus={eventBus}
      >
        <div style={s.focusWrapper}>
          <div style={s.focusToolbar}>
            <span style={s.projectName}>{projectName}</span>
            <span style={s.spacer} />
            <button style={s.toolBtn} onClick={toggleFocus}>退出专注模式</button>
          </div>
          <div style={s.focusEditor}>
            <WritingEditor ref={editorRef} chapterId={selectedChapterId} chapterStore={chapterStore} projectStore={projectStore} projectId={projectId} isDark={effectiveTheme === 'dark'} getCharacters={getCharacters} />
          </div>
        </div>
      </EditorStoreProvider>
    );
  }

  /* ── normal mode ── */
  return (
    <EditorStoreProvider
      projectStore={projectStore}
      projectId={projectId}
      projectName={projectName}
      chapterStore={chapterStore}
      characterStore={characterStore}
      worldStore={worldStore}
      timelineStore={timelineStore}
      plotStore={plotStore}
      relationshipStore={relationshipStore}
      aiStore={aiStore}
      themeStore={themeStore}
      snapshotStore={snapshotStore}
      consistencyEngine={consistencyEngine}
      exportEngine={exportEngine}
      aiEngine={aiEngine}
      eventBus={eventBus}
    >
      <EditorLayout
        toolbar={
          <EditorToolbar
            projectName={projectName}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            focusMode={focusMode}
            onToggleFocus={toggleFocus}
            effectiveTheme={effectiveTheme}
            onThemeToggle={handleThemeToggle}
            panelMode={panelMode}
            onPanelModeChange={setPanelMode}
            showAIPanel={showAIPanel}
            onToggleAIPanel={() => setShowAIPanel(!showAIPanel)}
            onOpenAIConfig={() => setShowAIConfig(true)}
            onConsistencyCheck={handleConsistencyCheck}
            onSaveSnapshot={handleSaveSnapshot}
            onSave={handleSave}
            showExportMenu={showExportMenu}
            onToggleExportMenu={() => setShowExportMenu(!showExportMenu)}
            onOpenExportDialog={() => setShowExportDialog(true)}
            onBack={handleBack}
          />
        }
        sidebar={
          <SidebarTabs>
            {(activeTab) => renderTabContent(activeTab)}
          </SidebarTabs>
        }
        panel={
          <ErrorBoundary fallbackTitle="面板区域出错了">
            <EditorRightPanel
              panelMode={panelMode}
              selectedCharId={selectedCharId}
              selectedWorldId={selectedWorldId}
              selectedTimelineId={selectedTimelineId}
              consistencyIssues={consistencyIssues}
              consistencyFixedCount={consistencyFixedCount}
              onEditCharacter={handleEditCharacter}
              onDeleteCharacter={handleDeleteCharacter}
              onEditWorld={handleEditWorld}
              onDeleteWorld={handleDeleteWorld}
              onEditTimeline={handleEditTimeline}
              onDeleteTimeline={handleDeleteTimeline}
              onApplyConsistency={handleApplyConsistency}
              onIgnoreConsistency={handleIgnoreConsistency}
              onRestoreSnapshot={handleRestoreSnapshot}
            />
          </ErrorBoundary>
        }
      >
        <ErrorBoundary fallbackTitle="编辑器区域出错了">
          <EditorContent
            viewMode={viewMode}
            selectedChapterId={selectedChapterId}
            editorRef={editorRef}
            showAIPanel={showAIPanel}
            onCloseAIPanel={() => setShowAIPanel(false)}
            onOpenAIConfig={() => { setShowAIPanel(false); setShowAIConfig(true); }}
            onAIAccept={handleAIAccept}
            effectiveTheme={effectiveTheme}
            onEditCharacter={handleEditCharacter}
            onDeleteCharacter={(id) => { characterStore.deleteCharacter(id); }}
          />
        </ErrorBoundary>
      </EditorLayout>

      {/* Dialogs */}
      <DialogManager
        showCharDialog={showCharDialog}
        editingCharacter={editingCharacter}
        onCharConfirm={handleCharConfirm}
        onCharCancel={handleCharCancel}
        showWorldDialog={showWorldDialog}
        editingWorld={editingWorld}
        onWorldConfirm={handleWorldConfirm}
        onWorldCancel={handleWorldCancel}
        showTimelineDialog={showTimelineDialog}
        editingTimeline={editingTimeline}
        onTimelineConfirm={handleTimelineConfirm}
        onTimelineCancel={handleTimelineCancel}
        showPlotDialog={showPlotDialog}
        editingPlot={editingPlot}
        onPlotConfirm={handlePlotConfirm}
        onPlotCancel={handlePlotCancel}
        showExportDialog={showExportDialog}
        onExportConfirm={handleExport}
        onExportCancel={() => setShowExportDialog(false)}
        showAIConfig={showAIConfig}
        onAIConfigClose={() => setShowAIConfig(false)}
      />
    </EditorStoreProvider>
  );
}

export { EditorPage };
export default EditorPage;

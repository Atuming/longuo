import { useState, useMemo, useCallback, useRef, useEffect, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { EditorLayout } from '../components/layout/EditorLayout';
import { Toolbar } from '../components/layout/Toolbar';
import { SidebarTabs, type SidebarTabKey } from '../components/sidebar/SidebarTabs';
import { OutlineTab } from '../components/sidebar/OutlineTab';
import { CharacterTab } from '../components/sidebar/CharacterTab';
import { WorldTab } from '../components/sidebar/WorldTab';
import { TimelineTab } from '../components/sidebar/TimelineTab';
import { PlotTab } from '../components/sidebar/PlotTab';
import { WritingEditor } from '../components/editor/WritingEditor';
import type { WritingEditorHandle } from '../components/editor/WritingEditor';
import { CharacterDetailPanel } from '../components/panels/CharacterDetailPanel';
import { WorldDetailPanel } from '../components/panels/WorldDetailPanel';
import { TimelineDetailPanel } from '../components/panels/TimelineDetailPanel';
import { ConsistencyPanel } from '../components/panels/ConsistencyPanel';
import { RelationshipGraphPage } from '../components/graph/RelationshipGraphPage';
import { AIAssistantPanel } from '../components/ai/AIAssistantPanel';
import { AIConfigDialog } from '../components/ai/AIConfigDialog';
import { ExportDialog } from '../components/dialogs/ExportDialog';
import { CharacterDialog } from '../components/dialogs/CharacterDialog';
import { WorldDialog } from '../components/dialogs/WorldDialog';
import { TimelineDialog } from '../components/dialogs/TimelineDialog';
import { PlotDialog } from '../components/dialogs/PlotDialog';
import { showToast } from '../components/ui/Toast';
import type { ProjectStore } from '../types/stores';
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
import { createEventBus } from '../lib/event-bus';
import { createConsistencyEngine } from '../lib/consistency-engine';
import { createExportEngine } from '../lib/export-engine';
import { createAIAssistantEngine } from '../lib/ai-assistant-engine';

type ViewMode = 'writing' | 'graph' | 'timeline' | 'plot';
type PanelMode = 'none' | 'character' | 'world' | 'timeline' | 'consistency';

/* ── styles ── */
const s: Record<string, CSSProperties> = {
  focusToolbar: {
    height: 'var(--toolbar-height)', background: 'var(--color-primary)',
    display: 'flex', alignItems: 'center', padding: '0 var(--spacing-sm)',
    color: '#fff', fontSize: 14, flexShrink: 0,
  },
  projectName: { font: 'var(--font-h2)', color: '#fff', cursor: 'pointer' },
  separator: { width: 1, height: 24, background: 'rgba(255,255,255,0.2)', margin: '0 8px' },
  autoSaveHint: { fontSize: 12, color: '#68D391', marginLeft: 8 },
  spacer: { flex: 1 },
  tabPlaceholder: {
    padding: 'var(--spacing-sm)', color: 'var(--color-text-secondary)', fontSize: 13,
    textAlign: 'center' as const,
  },
  toolBtn: {
    background: 'none', border: '1px solid rgba(255,255,255,0.3)', color: '#fff',
    cursor: 'pointer', fontSize: 12, height: 30, padding: '0 10px',
    borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: 4,
  },
  toolBtnActive: {
    background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.5)',
  },
  viewGroup: {
    display: 'flex', gap: 0, borderRadius: 'var(--radius)', overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.3)',
  },
  viewBtn: {
    background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)',
    cursor: 'pointer', fontSize: 12, height: 28, padding: '0 10px',
    borderRight: '1px solid rgba(255,255,255,0.2)',
  },
  viewBtnActive: {
    background: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 600,
  },
  viewBtnLast: { borderRight: 'none' },
  exportDropdown: { position: 'relative' as const },
  exportMenu: {
    position: 'absolute' as const, top: 34, right: 0, background: 'white',
    borderRadius: 'var(--radius)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    zIndex: 100, minWidth: 120, overflow: 'hidden',
  },
  exportMenuItem: {
    padding: '8px 16px', fontSize: 13, cursor: 'pointer', color: 'var(--color-text)',
    border: 'none', background: 'none', width: '100%', textAlign: 'left' as const,
    display: 'block',
  },
};

interface EditorPageProps {
  projectStore: ProjectStore;
}

export function EditorPage({ projectStore }: EditorPageProps) {
  const navigate = useNavigate();
  const project = projectStore.getCurrentProject();

  /* ── stores & engines (created once) ── */
  const eventBus = useMemo(() => createEventBus(), []);
  const chapterStore = useMemo(() => createChapterStore(), []);
  const characterStore = useMemo(() => createCharacterStore(eventBus), [eventBus]);
  const worldStore = useMemo(() => createWorldStore(), []);
  const timelineStore = useMemo(() => createTimelineStore({ eventBus }), [eventBus]);
  const plotStore = useMemo(() => createPlotStore(), []);
  const relationshipStore = useMemo(() => createRelationshipStore({ eventBus }), [eventBus]);
  const aiStore = useMemo(() => createAIAssistantStore(), []);
  const consistencyEngine = useMemo(() => createConsistencyEngine(), []);

  // 每次启动都从 ai-config.json 加载配置（配置文件始终优先）
  useEffect(() => {
    loadDefaultAIConfig().then((defaults) => {
      if (defaults) {
        aiStore.updateConfig(defaults);
      }
    });
  }, [aiStore]);
  const exportEngine = useMemo(() => createExportEngine(), []);
  const aiEngine = useMemo(() => createAIAssistantEngine({
    chapterStore, characterStore, worldStore, timelineStore, aiStore,
  }), [chapterStore, characterStore, worldStore, timelineStore, aiStore]);

  /* ── state ── */
  const editorRef = useRef<WritingEditorHandle>(null);
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
    // Remove applied issue
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
        // Trigger browser download
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
        // If partial data available, offer download
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
      editorRef.current.appendContent(content);
    } else {
      // fallback: write to store directly (editor will be out of sync until re-mount)
      const chapter = chapterStore.getChapter(selectedChapterId);
      if (!chapter) return;
      const newContent = chapter.content ? chapter.content + '\n\n' + content : content;
      chapterStore.updateChapter(selectedChapterId, { content: newContent });
    }
    showToast('success', 'AI 生成内容已插入');
  }, [selectedChapterId, chapterStore]);

  /* ── sidebar tab content ── */
  const renderTabContent = (tab: SidebarTabKey) => {
    switch (tab) {
      case 'outline':
        return (
          <OutlineTab
            projectId={projectId}
            chapterStore={chapterStore}
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

  /* ── right panel ── */
  const renderPanel = () => {
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
            onEdit={(ch) => { setEditingCharacter(ch); setShowCharDialog(true); }}
            onDelete={(id) => { characterStore.deleteCharacter(id); setSelectedCharId(null); setPanelMode('none'); setRefreshKey((k) => k + 1); }}
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
            onEdit={(entry) => { setEditingWorld(entry); setShowWorldDialog(true); }}
            onDelete={(id) => { worldStore.deleteEntry(id); setSelectedWorldId(null); setPanelMode('none'); setRefreshKey((k) => k + 1); }}
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
            onEdit={(point) => { setEditingTimeline(point); setShowTimelineDialog(true); }}
            onDelete={(id) => { timelineStore.deleteTimelinePoint(id); setSelectedTimelineId(null); setPanelMode('none'); setRefreshKey((k) => k + 1); }}
          />
        );
      case 'consistency':
        return (
          <ConsistencyPanel
            issues={consistencyIssues}
            fixedCount={consistencyFixedCount}
            onApply={handleApplyConsistency}
            onIgnore={handleIgnoreConsistency}
          />
        );
      default:
        return <div style={{ padding: 'var(--spacing-sm)', color: 'var(--color-text-secondary)', fontSize: 13 }}>选择侧边栏项目查看详情</div>;
    }
  };

  /* ── center content ── */
  const renderCenter = () => {
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
            onEditCharacter={(ch) => { setEditingCharacter(ch); setShowCharDialog(true); }}
            onDeleteCharacter={(id) => { characterStore.deleteCharacter(id); }}
          />
        );
      case 'timeline':
        return <div style={s.tabPlaceholder}>时间线视图（使用左侧时间线 Tab 管理）</div>;
      case 'plot':
        return <div style={s.tabPlaceholder}>情节视图（使用左侧情节线索 Tab 管理）</div>;
      case 'writing':
      default:
        return (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <WritingEditor ref={editorRef} chapterId={selectedChapterId} chapterStore={chapterStore} projectStore={projectStore} />
            <AIAssistantPanel
              open={showAIPanel}
              onClose={() => setShowAIPanel(false)}
              chapterId={selectedChapterId}
              aiStore={aiStore}
              aiEngine={aiEngine}
              onAccept={handleAIAccept}
              onOpenSettings={() => { setShowAIPanel(false); setShowAIConfig(true); }}
            />
          </div>
        );
    }
  };

  const viewButtons: { key: ViewMode; label: string }[] = [
    { key: 'writing', label: '写作' },
    { key: 'graph', label: '关系图谱' },
    { key: 'timeline', label: '时间线' },
    { key: 'plot', label: '情节' },
  ];

  /* ── focus mode ── */
  if (focusMode) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={s.focusToolbar}>
          <span style={s.projectName}>{projectName}</span>
          <span style={s.spacer} />
          <button style={s.toolBtn} onClick={toggleFocus}>退出专注模式</button>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <WritingEditor ref={editorRef} chapterId={selectedChapterId} chapterStore={chapterStore} projectStore={projectStore} />
        </div>
      </div>
    );
  }

  /* ── normal mode ── */
  return (
    <>
      <EditorLayout
        toolbar={
          <Toolbar>
            {/* Back */}
            <button onClick={handleBack}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16 }}
              title="返回项目列表">←</button>

            {/* Project name */}
            <span style={s.projectName}>{projectName}</span>
            <span style={s.separator} />

            {/* Save */}
            <button style={s.toolBtn}
              onClick={async () => { try { await projectStore.saveProject(); showToast('success', '已保存'); } catch { showToast('error', '保存失败'); } }}>
              保存
            </button>
            <span style={s.autoSaveHint}>已自动保存</span>

            <span style={s.separator} />

            {/* View switch */}
            <div style={s.viewGroup}>
              {viewButtons.map((v, i) => (
                <button key={v.key}
                  style={{
                    ...s.viewBtn,
                    ...(viewMode === v.key ? s.viewBtnActive : {}),
                    ...(i === viewButtons.length - 1 ? s.viewBtnLast : {}),
                  }}
                  onClick={() => setViewMode(v.key)}>
                  {v.label}
                </button>
              ))}
            </div>

            <span style={s.spacer} />

            {/* Consistency check */}
            <button style={s.toolBtn} onClick={handleConsistencyCheck}>一致性检查</button>

            {/* Export */}
            <div style={s.exportDropdown}>
              <button style={s.toolBtn} onClick={() => setShowExportMenu(!showExportMenu)}>
                导出 ▾
              </button>
              {showExportMenu && (
                <div style={s.exportMenu} onMouseLeave={() => setShowExportMenu(false)}>
                  <button style={s.exportMenuItem} onClick={() => { setShowExportMenu(false); setShowExportDialog(true); }}>
                    导出设置...
                  </button>
                </div>
              )}
            </div>

            {/* AI */}
            <button style={{ ...s.toolBtn, ...(showAIPanel ? s.toolBtnActive : {}) }}
              onClick={() => setShowAIPanel(!showAIPanel)}>
              AI 辅助
            </button>
            <button style={s.toolBtn} onClick={() => setShowAIConfig(true)} title="AI 设置">⚙</button>

            {/* Focus mode */}
            <button style={s.toolBtn} onClick={toggleFocus}>专注模式</button>
          </Toolbar>
        }
        sidebar={
          <SidebarTabs>
            {(activeTab) => renderTabContent(activeTab)}
          </SidebarTabs>
        }
        panel={renderPanel()}
      >
        {renderCenter()}
      </EditorLayout>

      {/* Dialogs */}
      <ExportDialog
        open={showExportDialog}
        projectName={projectName}
        onConfirm={handleExport}
        onCancel={() => setShowExportDialog(false)}
      />
      <AIConfigDialog
        open={showAIConfig}
        aiStore={aiStore}
        onClose={() => setShowAIConfig(false)}
      />
      {showCharDialog && (
        <CharacterDialog
          open={showCharDialog}
          initialData={editingCharacter ?? undefined}
          onConfirm={(data) => {
            if (editingCharacter) {
              characterStore.updateCharacter(editingCharacter.id, data);
            } else {
              characterStore.createCharacter(projectId, data);
            }
            setShowCharDialog(false);
            setEditingCharacter(null);
            setRefreshKey((k) => k + 1);
          }}
          onCancel={() => { setShowCharDialog(false); setEditingCharacter(null); }}
        />
      )}
      {showWorldDialog && (
        <WorldDialog
          open={showWorldDialog}
          initialData={editingWorld ?? undefined}
          projectId={projectId}
          characters={characterStore.listCharacters(projectId)}
          customCategories={worldStore.listCustomCategories(projectId)}
          onConfirm={(data) => {
            if (editingWorld) {
              worldStore.updateEntry(editingWorld.id, data);
            } else {
              worldStore.createEntry(data);
            }
            setShowWorldDialog(false);
            setEditingWorld(null);
            setRefreshKey((k) => k + 1);
          }}
          onCancel={() => { setShowWorldDialog(false); setEditingWorld(null); }}
          onAddCustomCategory={(label) => {
            worldStore.addCustomCategory(projectId, label);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
      {showTimelineDialog && (
        <TimelineDialog
          open={showTimelineDialog}
          initialData={editingTimeline ?? undefined}
          projectId={projectId}
          chapters={chapterStore.listChapters(projectId)}
          characters={characterStore.listCharacters(projectId)}
          onConfirm={(data) => {
            if (editingTimeline) {
              timelineStore.updateTimelinePoint(editingTimeline.id, data);
            } else {
              timelineStore.createTimelinePoint(data);
            }
            setShowTimelineDialog(false);
            setEditingTimeline(null);
            setRefreshKey((k) => k + 1);
          }}
          onCancel={() => { setShowTimelineDialog(false); setEditingTimeline(null); }}
        />
      )}
      {showPlotDialog && (
        <PlotDialog
          open={showPlotDialog}
          initialData={editingPlot ?? undefined}
          projectId={projectId}
          chapters={chapterStore.listChapters(projectId)}
          onConfirm={(data) => {
            if (editingPlot) {
              plotStore.updateThread(editingPlot.id, data);
            } else {
              plotStore.createThread(data);
            }
            setShowPlotDialog(false);
            setEditingPlot(null);
            setRefreshKey((k) => k + 1);
          }}
          onCancel={() => { setShowPlotDialog(false); setEditingPlot(null); }}
        />
      )}
    </>
  );
}

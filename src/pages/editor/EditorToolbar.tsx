import type { CSSProperties } from 'react';
import { Toolbar } from '../../components/layout/Toolbar';

export type ViewMode = 'writing' | 'graph' | 'timeline' | 'plot';
export type PanelMode = 'none' | 'character' | 'world' | 'timeline' | 'consistency' | 'version-history';

/* ── toolbar styles (module-level, no re-creation per render) ── */
const s: Record<string, CSSProperties> = {
  focusToolbar: {
    height: 'var(--toolbar-height)',
    background: 'var(--color-primary)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 var(--spacing-sm)',
    color: '#fff',
    fontSize: 14,
    flexShrink: 0,
  },
  projectName: { font: 'var(--font-h2)', color: '#fff', cursor: 'pointer' },
  separator: {
    width: 1,
    height: 24,
    background: 'rgba(255,255,255,0.2)',
    margin: '0 8px',
  },
  autoSaveHint: { fontSize: 12, color: '#68D391', marginLeft: 8 },
  spacer: { flex: 1 },
  toolBtn: {
    background: 'none',
    border: '1px solid rgba(255,255,255,0.3)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 12,
    height: 30,
    padding: '0 10px',
    borderRadius: 'var(--radius)',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  toolBtnActive: {
    background: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.5)',
  },
  viewGroup: {
    display: 'flex',
    gap: 0,
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.3)',
  },
  viewBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.7)',
    cursor: 'pointer',
    fontSize: 12,
    height: 28,
    padding: '0 10px',
    borderRight: '1px solid rgba(255,255,255,0.2)',
  },
  viewBtnActive: {
    background: 'rgba(255,255,255,0.2)',
    color: '#fff',
    fontWeight: 600,
  },
  viewBtnLast: { borderRight: 'none' },
  exportDropdown: { position: 'relative' as const },
  exportMenu: {
    position: 'absolute' as const,
    top: 34,
    right: 0,
    background: 'white',
    borderRadius: 'var(--radius)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    zIndex: 100,
    minWidth: 120,
    overflow: 'hidden',
  },
  exportMenuItem: {
    padding: '8px 16px',
    fontSize: 13,
    cursor: 'pointer',
    color: 'var(--color-text)',
    border: 'none',
    background: 'none',
    width: '100%',
    textAlign: 'left' as const,
    display: 'block',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 16,
  },
};

const viewButtons: { key: ViewMode; label: string }[] = [
  { key: 'writing', label: '写作' },
  { key: 'graph', label: '关系图谱' },
  { key: 'timeline', label: '时间线' },
  { key: 'plot', label: '情节' },
];

/* ── pre-merged view button style combinations (module-level) ── */
const viewBtnDefault: CSSProperties = s.viewBtn;
const viewBtnActiveMerged: CSSProperties = { ...s.viewBtn, ...s.viewBtnActive };
const viewBtnLastMerged: CSSProperties = { ...s.viewBtn, ...s.viewBtnLast };
const viewBtnActiveLastMerged: CSSProperties = { ...s.viewBtn, ...s.viewBtnActive, ...s.viewBtnLast };

/* ── pre-merged toolBtn + active (module-level) ── */
const toolBtnActiveMerged: CSSProperties = { ...s.toolBtn, ...s.toolBtnActive };

export interface EditorToolbarProps {
  projectName: string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  focusMode: boolean;
  onToggleFocus: () => void;
  effectiveTheme: 'light' | 'dark';
  onThemeToggle: () => void;
  panelMode: PanelMode;
  onPanelModeChange: (mode: PanelMode) => void;
  showAIPanel: boolean;
  onToggleAIPanel: () => void;
  onOpenAIConfig: () => void;
  onConsistencyCheck: () => void;
  onSaveSnapshot: () => void;
  onSave: () => void;
  showExportMenu: boolean;
  onToggleExportMenu: () => void;
  onOpenExportDialog: () => void;
  onBack: () => void;
}

export function EditorToolbar({
  projectName,
  viewMode,
  onViewModeChange,
  focusMode,
  onToggleFocus,
  effectiveTheme,
  onThemeToggle,
  panelMode,
  onPanelModeChange,
  showAIPanel,
  onToggleAIPanel,
  onOpenAIConfig,
  onConsistencyCheck,
  onSaveSnapshot,
  onSave,
  showExportMenu,
  onToggleExportMenu,
  onOpenExportDialog,
  onBack,
}: EditorToolbarProps) {
  /* ── focus mode toolbar ── */
  if (focusMode) {
    return (
      <div style={s.focusToolbar}>
        <span style={s.projectName}>{projectName}</span>
        <span style={s.spacer} />
        <button style={s.toolBtn} onClick={onToggleFocus}>
          退出专注模式
        </button>
      </div>
    );
  }

  /* ── normal mode toolbar ── */
  return (
    <Toolbar>
      {/* Back */}
      <button onClick={onBack} style={s.backBtn} title="返回项目列表">
        ←
      </button>

      {/* Project name */}
      <span style={s.projectName}>{projectName}</span>
      <span style={s.separator} />

      {/* Save */}
      <button style={s.toolBtn} onClick={onSave}>
        保存
      </button>
      <span style={s.autoSaveHint}>已自动保存</span>

      <span style={s.separator} />

      {/* View switch */}
      <div style={s.viewGroup}>
        {viewButtons.map((v, i) => {
          const isActive = viewMode === v.key;
          const isLast = i === viewButtons.length - 1;
          const btnStyle = isActive
            ? (isLast ? viewBtnActiveLastMerged : viewBtnActiveMerged)
            : (isLast ? viewBtnLastMerged : viewBtnDefault);
          return (
            <button
              key={v.key}
              style={btnStyle}
              onClick={() => onViewModeChange(v.key)}
            >
              {v.label}
            </button>
          );
        })}
      </div>

      <span style={s.spacer} />

      {/* Consistency check */}
      <button style={s.toolBtn} onClick={onConsistencyCheck}>
        一致性检查
      </button>

      {/* Snapshot */}
      <button style={s.toolBtn} onClick={onSaveSnapshot}>
        保存快照
      </button>
      <button
        style={panelMode === 'version-history' ? toolBtnActiveMerged : s.toolBtn}
        onClick={() =>
          onPanelModeChange(
            panelMode === 'version-history' ? 'none' : 'version-history',
          )
        }
      >
        版本历史
      </button>

      {/* Export */}
      <div style={s.exportDropdown}>
        <button style={s.toolBtn} onClick={onToggleExportMenu}>
          导出 ▾
        </button>
        {showExportMenu && (
          <div style={s.exportMenu} onMouseLeave={onToggleExportMenu}>
            <button
              style={s.exportMenuItem}
              onClick={() => {
                onToggleExportMenu();
                onOpenExportDialog();
              }}
            >
              导出设置...
            </button>
          </div>
        )}
      </div>

      {/* AI */}
      <button
        style={showAIPanel ? toolBtnActiveMerged : s.toolBtn}
        onClick={onToggleAIPanel}
      >
        AI 辅助
      </button>
      <button style={s.toolBtn} onClick={onOpenAIConfig} title="AI 设置">
        ⚙
      </button>

      {/* Focus mode */}
      <button style={s.toolBtn} onClick={onToggleFocus}>
        专注模式
      </button>

      {/* Theme toggle */}
      <button
        style={s.toolBtn}
        onClick={onThemeToggle}
        title={
          effectiveTheme === 'light' ? '切换到暗色模式' : '切换到亮色模式'
        }
      >
        {effectiveTheme === 'light' ? '🌙' : '☀️'}
      </button>
    </Toolbar>
  );
}

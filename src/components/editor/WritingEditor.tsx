import { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef, type CSSProperties } from 'react';
import { EditorView, keymap, lineNumbers, drawSelection, highlightActiveLine } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { defaultKeymap, history, historyKeymap, undo, redo } from '@codemirror/commands';
import { searchKeymap } from '@codemirror/search';
import type { ChapterStore, ProjectStore } from '../../types/stores';
import type { Character } from '../../types/character';
import { showToast } from '../ui/Toast';
import { DailyGoalProgress } from './DailyGoalProgress';
import { createCrossReferenceExtension } from '../../lib/cross-reference';

/* ── styles ── */
const styles: Record<string, CSSProperties> = {
  wrapper: { display: 'flex', flexDirection: 'column', height: '100%' },
  toolbar: {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '4px 8px', borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-card)', flexShrink: 0,
  },
  toolBtn: {
    background: 'none', border: '1px solid var(--color-border)', borderRadius: 4,
    padding: '4px 10px', cursor: 'pointer', fontSize: 13, color: 'var(--color-text)',
    lineHeight: 1,
  },
  editorContainer: { flex: 1, overflow: 'auto' },
  statusBar: {
    display: 'flex', alignItems: 'center', gap: 16,
    padding: '4px 12px', borderTop: '1px solid var(--color-border)',
    background: 'var(--color-card)', fontSize: 12, color: 'var(--color-text-secondary)',
    flexShrink: 0,
  },
  empty: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100%', color: 'var(--color-text-secondary)', fontSize: 14,
  },
};

/* ── toolbar items ── */
const TOOLBAR_ITEMS = [
  { label: 'H', prefix: '## ', suffix: '', title: '标题' },
  { label: 'B', prefix: '**', suffix: '**', title: '粗体' },
  { label: 'I', prefix: '*', suffix: '*', title: '斜体' },
  { label: '引', prefix: '> ', suffix: '', title: '引用' },
  { label: '—', prefix: '\n---\n', suffix: '', title: '分隔线' },
];

/* ── auto-save status ── */
export type SaveStatus = 'saved' | 'saving' | 'failed' | 'manual';

const STATUS_LABELS: Record<SaveStatus, { text: string; color: string }> = {
  saved: { text: '已自动保存', color: 'var(--color-success)' },
  saving: { text: '保存中...', color: 'var(--color-text-secondary)' },
  failed: { text: '保存失败', color: 'var(--color-error)' },
  manual: { text: '手动保存模式', color: 'var(--color-warning)' },
};

/* ── CodeMirror dark theme ── */
const darkEditorTheme = EditorView.theme({
  '&': { backgroundColor: '#1A202C', color: '#E2E8F0' },
  '.cm-content': { caretColor: '#63B3ED' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#63B3ED' },
  '.cm-selectionBackground, .cm-content ::selection': { backgroundColor: '#4A556844' },
  '.cm-activeLine': { backgroundColor: '#2D374880' },
  '.cm-gutters': { backgroundColor: '#2D3748', color: '#A0AEC0', borderRight: '1px solid #4A5568' },
  '.cm-activeLineGutter': { backgroundColor: '#4A556840' },
  '.cm-lineNumbers .cm-gutterElement': { color: '#A0AEC0' },
}, { dark: true });

/* ── component ── */
interface WritingEditorProps {
  chapterId: string | null;
  chapterStore: ChapterStore;
  projectStore: ProjectStore;
  projectId?: string;
  isDark?: boolean;
  getCharacters?: () => Character[];
}

/** 暴露给父组件的方法 */
export interface WritingEditorHandle {
  appendContent: (content: string) => void;
  insertAtCursor: (content: string) => void;
  getCursorPosition: () => number | null;
}

export const WritingEditor = forwardRef<WritingEditorHandle, WritingEditorProps>(function WritingEditor({ chapterId, chapterStore, projectStore, projectId, isDark = false, getCharacters }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [cursorInfo, setCursorInfo] = useState({ line: 1, col: 1 });
  const [wordCount, setWordCount] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const failCountRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── expose appendContent / insertAtCursor / getCursorPosition to parent ── */
  const appendContent = useCallback((content: string) => {
    const view = viewRef.current;
    if (!view) return;
    const docLength = view.state.doc.length;
    const separator = docLength > 0 ? '\n\n' : '';
    view.dispatch({
      changes: { from: docLength, insert: separator + content },
      selection: { anchor: docLength + separator.length + content.length },
    });
    view.focus();
  }, []);

  useImperativeHandle(ref, () => ({
    appendContent,
    insertAtCursor(content: string) {
      const view = viewRef.current;
      if (!view) {
        appendContent(content);
        return;
      }
      const { from, to, head } = view.state.selection.main;
      if (from !== to) {
        // Replace selected text
        view.dispatch({
          changes: { from, to, insert: content },
          selection: { anchor: from + content.length },
        });
      } else {
        // Insert at cursor position
        view.dispatch({
          changes: { from: head, insert: content },
          selection: { anchor: head + content.length },
        });
      }
      view.focus();
    },
    getCursorPosition(): number | null {
      const view = viewRef.current;
      if (!view) return null;
      return view.state.selection.main.head;
    },
  }));

  /* ── count words (simple) ── */
  const computeWordCount = useCallback((text: string) => {
    if (!text.trim()) return 0;
    const chinese = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g);
    const withoutChinese = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ');
    const english = withoutChinese.split(/\s+/).filter((w) => /[a-zA-Z0-9]/.test(w));
    return (chinese?.length || 0) + english.length;
  }, []);

  /* ── save logic ── */
  const doSave = useCallback(async () => {
    if (saveStatus === 'manual') return;
    setSaveStatus('saving');
    try {
      await projectStore.saveProject();
      setSaveStatus('saved');
      failCountRef.current = 0;
    } catch {
      failCountRef.current += 1;
      if (failCountRef.current >= 3) {
        setSaveStatus('manual');
        showToast('error', '连续保存失败，已切换为手动保存模式');
      } else {
        setSaveStatus('failed');
        showToast('error', '保存失败，10 秒后自动重试');
        retryTimerRef.current = setTimeout(() => doSave(), 10_000);
      }
    }
  }, [projectStore, saveStatus]);

  /* ── auto-save timer (30s) ── */
  useEffect(() => {
    saveTimerRef.current = setInterval(() => {
      if (chapterId && saveStatus !== 'manual') doSave();
    }, 30_000);
    return () => {
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [chapterId, doSave, saveStatus]);

  /* ── keyboard shortcut: Ctrl+S to save ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (chapterId) doSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [chapterId, doSave]);

  /* ── create / update editor ── */
  useEffect(() => {
    if (!containerRef.current) return;

    // destroy previous
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    if (!chapterId) return;

    const chapter = chapterStore.getChapter(chapterId);
    const initialContent = chapter?.content ?? '';

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const text = update.state.doc.toString();
        chapterStore.updateChapter(chapterId, { content: text });
        setWordCount(computeWordCount(text));
      }
      // cursor position
      const pos = update.state.selection.main.head;
      const line = update.state.doc.lineAt(pos);
      setCursorInfo({ line: line.number, col: pos - line.from + 1 });
    });

    const baseTheme = EditorView.theme({
      '&': { height: '100%', fontSize: '15px' },
      '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-family)' },
      '.cm-content': { padding: '16px 24px', minHeight: '300px' },
      '.cm-gutters': { background: 'var(--color-card)', borderRight: '1px solid var(--color-border)' },
    });

    const extensions = [
      lineNumbers(),
      drawSelection(),
      highlightActiveLine(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      updateListener,
      EditorView.lineWrapping,
      baseTheme,
      ...(isDark ? [darkEditorTheme] : []),
      ...(getCharacters ? createCrossReferenceExtension(getCharacters) : []),
    ];

    const state = EditorState.create({
      doc: initialContent,
      extensions,
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    setWordCount(computeWordCount(initialContent));

    return () => { view.destroy(); viewRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, isDark]);

  /* ── toolbar insert ── */
  const insertMark = (prefix: string, suffix: string) => {
    const view = viewRef.current;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    const selected = view.state.sliceDoc(from, to);
    const replacement = prefix + selected + suffix;
    view.dispatch({ changes: { from, to, insert: replacement } });
    view.focus();
  };

  /* ── undo / redo ── */
  const handleUndo = () => { if (viewRef.current) undo(viewRef.current); };
  const handleRedo = () => { if (viewRef.current) redo(viewRef.current); };

  if (!chapterId) {
    return <div style={styles.empty}>请从左侧大纲选择一个章节开始写作</div>;
  }

  /* ── breadcrumb: walk up parent chain ── */
  const breadcrumb = (() => {
    const parts: string[] = [];
    const levelLabels: Record<string, string> = { volume: '卷', chapter: '章', section: '节' };
    let current = chapterStore.getChapter(chapterId);
    while (current) {
      parts.unshift(`${levelLabels[current.level] || ''}·${current.title}`);
      current = current.parentId ? chapterStore.getChapter(current.parentId) : undefined;
    }
    return parts.join(' / ');
  })();

  const statusInfo = STATUS_LABELS[saveStatus];

  return (
    <div style={styles.wrapper}>
      {/* Markdown toolbar */}
      <div style={styles.toolbar}>
        {TOOLBAR_ITEMS.map((item) => (
          <button key={item.label} style={styles.toolBtn} title={item.title} onClick={() => insertMark(item.prefix, item.suffix)}>
            {item.label}
          </button>
        ))}
        <span style={{ width: 1, height: 20, background: 'var(--color-border)', margin: '0 4px' }} />
        <button style={styles.toolBtn} title="撤销" onClick={handleUndo}>↩</button>
        <button style={styles.toolBtn} title="重做" onClick={handleRedo}>↪</button>
        <span style={{ flex: 1 }} />
        <button style={styles.toolBtn} onClick={() => doSave()}>💾 保存</button>
      </div>

      {/* Breadcrumb */}
      <div style={{ padding: '4px 12px', fontSize: 12, color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)', background: 'var(--color-card)' }}>
        📍 {breadcrumb}
      </div>

      {/* Editor */}
      <div ref={containerRef} style={styles.editorContainer} />

      {/* Status bar */}
      <div style={styles.statusBar}>
        <span>字数: {wordCount}</span>
        <span>行 {cursorInfo.line} : 列 {cursorInfo.col}</span>
        {projectId && <DailyGoalProgress projectId={projectId} wordCount={wordCount} />}
        <span style={{ marginLeft: 'auto', color: statusInfo.color }}>{statusInfo.text}</span>
      </div>
    </div>
  );
});

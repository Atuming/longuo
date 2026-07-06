import { useRef, useEffect, useState, useCallback, useMemo, useImperativeHandle, forwardRef, type CSSProperties } from 'react';
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
import { SelectionToolbar, type AIQuickAction } from './SelectionToolbar';
import { createCrossReferenceExtension } from '../../lib/cross-reference';
import { typewriterMode } from '../../lib/typewriter-mode';

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
  /** Override the save logic (sync store data + save). If not provided, falls back to projectStore.saveProject() */
  onSave?: () => Promise<void>;
  /** Called whenever save status changes, so parent can display it in toolbar */
  onSaveStatusChange?: (status: SaveStatus) => void;
  /** Called when user triggers an AI quick action from the selection toolbar */
  onQuickAI?: (action: AIQuickAction, selectedText: string) => void;
}

/** 暴露给父组件的方法 */
export interface WritingEditorHandle {
  appendContent: (content: string) => void;
  insertAtCursor: (content: string) => void;
  getCursorPosition: () => number | null;
  getSelectedText: () => string;
}

export const WritingEditor = forwardRef<WritingEditorHandle, WritingEditorProps>(function WritingEditor({ chapterId, chapterStore, projectStore, projectId, isDark = false, getCharacters, onSave, onSaveStatusChange, onQuickAI }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [cursorInfo, setCursorInfo] = useState({ line: 1, col: 1 });
  const [wordCount, setWordCount] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [typewriterOn, setTypewriterOn] = useState(true);
  const typewriterRef = useMemo(() => ({ current: true }), []);
  const failCountRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Selection toolbar state ──
  const [selToolbarPos, setSelToolbarPos] = useState<{ top: number; left: number } | null>(null);
  const [selToolbarText, setSelToolbarText] = useState('');
  const editorWrapperRef = useRef<HTMLDivElement>(null);

  // ── Repeated word detection ──
  const [repeatedWords, setRepeatedWords] = useState<{ word: string; count: number }[]>([]);

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
    getSelectedText(): string {
      const view = viewRef.current;
      if (!view) return '';
      const { from, to } = view.state.selection.main;
      if (from === to) return '';
      return view.state.doc.sliceString(from, to);
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

  /* ── detect repeated words ── */
  const STOP_WORDS = useMemo(() => new Set([
    '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '他', '她', '它',
    '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
    '自己', '这', '那', '什么', '而', '以', '之', '与', '及', '为', '所', '其', '但', '被',
    '把', '从', '对', '向', '往', '时', '后', '前', '里', '外', '中', '来', '能', '可以',
    '已经', '正在', '将', '还', '又', '再', '才', '刚', '便', '却', '只', '仍', '并',
    '我们', '他们', '她们', '它们', '这个', '那个', '哪个', '怎么', '怎么样', '因为',
    '所以', '但是', '虽然', '如果', '然后', '不过', '于是', '接着', '忽然', '突然',
    '一下', '一些', '一点', '一种', '一阵', '一声', '一眼', '一边', '一会儿',
    '只是', '还是', '可是', '不是', '就是', '都是', '还有', '出来', '起来',
    '过来', '过去', '下来', '上去', '看来', '来说', '而言',
  ]), []);

  const computeRepeatedWords = useCallback((text: string) => {
    const cleaned = text.replace(/[，。！？、；：""''「」『』（）【】《》\s\n\r\d]/g, '');
    const freq = new Map<string, number>();
    for (let i = 0; i < cleaned.length - 1; i++) {
      const bigram = cleaned.slice(i, i + 2);
      if (/^[一-鿿]{2}$/.test(bigram) && !STOP_WORDS.has(bigram)) {
        freq.set(bigram, (freq.get(bigram) ?? 0) + 1);
      }
    }
    return Array.from(freq.entries())
      .filter(([, c]) => c > 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([word, count]) => ({ word, count }));
  }, [STOP_WORDS]);

  /* ── reading time estimate ── */
  const readingTimeMinutes = wordCount > 0 ? Math.max(1, Math.round(wordCount / 300)) : 0;

  /* ── selection change toolbar ── */
  const updateSelectionToolbar = useCallback((view: EditorView) => {
    const { from, to } = view.state.selection.main;
    if (from === to) {
      setSelToolbarPos(null);
      setSelToolbarText('');
      return;
    }
    const text = view.state.sliceDoc(from, to);
    if (!text.trim()) {
      setSelToolbarPos(null);
      setSelToolbarText('');
      return;
    }
    const endCoords = view.coordsAtPos(to);
    const editorRect = editorWrapperRef.current?.getBoundingClientRect();
    if (endCoords && editorRect) {
      // Clamp position to keep toolbar inside the editor container
      const toolbarEstWidth = 280; // approximate toolbar width in px
      const toolbarEstHeight = 40; // approximate toolbar height in px
      const top = Math.max(toolbarEstHeight + 8, endCoords.top - editorRect.top);
      const left = Math.max(toolbarEstWidth / 2, Math.min(
        editorRect.width - toolbarEstWidth / 2,
        endCoords.left - editorRect.left + (endCoords.right - endCoords.left) / 2,
      ));
      setSelToolbarPos({ top, left });
      setSelToolbarText(text);
    } else {
      // Selection end is scrolled out of viewport — hide toolbar
      setSelToolbarPos(null);
    }
  }, []);

  /* ── save logic ── */
  const doSave = useCallback(async () => {
    if (saveStatus === 'manual') return;
    setSaveStatus('saving');
    try {
      if (onSave) {
        await onSave();
      } else {
        await projectStore.saveProject();
      }
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
  }, [projectStore, saveStatus, onSave]);

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

  /* ── notify parent of save status changes ── */
  useEffect(() => {
    onSaveStatusChange?.(saveStatus);
  }, [saveStatus, onSaveStatusChange]);

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

  // Sync typewriter ref with state
  useEffect(() => {
    typewriterRef.current = typewriterOn;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- typewriterRef is stable useMemo
  }, [typewriterOn]);

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
        setRepeatedWords(computeRepeatedWords(text));
      }
      // cursor position
      const pos = update.state.selection.main.head;
      const line = update.state.doc.lineAt(pos);
      setCursorInfo({ line: line.number, col: pos - line.from + 1 });
      // selection toolbar
      if (update.selectionSet) {
        updateSelectionToolbar(update.view);
      }
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
      typewriterMode(typewriterRef),
    ];

    const state = EditorState.create({
      doc: initialContent,
      extensions,
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    setWordCount(computeWordCount(initialContent));
    setRepeatedWords(computeRepeatedWords(initialContent));

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

  /* ── selection toolbar handlers ── */
  const handleQuickFormat = useCallback((prefix: string, suffix: string) => {
    const view = viewRef.current;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    const selected = view.state.sliceDoc(from, to);
    view.dispatch({ changes: { from, to, insert: prefix + selected + suffix } });
    view.focus();
  }, []);

  const handleQuickAI = useCallback((action: AIQuickAction, text: string) => {
    onQuickAI?.(action, text);
  }, [onQuickAI]);

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

      {/* Editor + floating toolbar */}
      <div ref={editorWrapperRef} style={{ ...styles.editorContainer, position: 'relative' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        <SelectionToolbar
          position={selToolbarPos}
          selectedText={selToolbarText}
          onAction={handleQuickAI}
          onFormat={handleQuickFormat}
        />
      </div>

      {/* Status bar */}
      <div style={styles.statusBar}>
        <span>字数: {wordCount}</span>
        <span>行 {cursorInfo.line} : 列 {cursorInfo.col}</span>
        <span title="预计阅读时间">📖 ~{readingTimeMinutes} 分钟</span>
        {repeatedWords.length > 0 && (
          <span style={{ color: 'var(--color-warning, #F6AD55)' }} title={`高频词：${repeatedWords.map(w => `${w.word}(${w.count}次)`).join('、')}`}>
            ⚠️ 高频: {repeatedWords.map(w => w.word).join(' ')}
          </span>
        )}
        {projectId && <DailyGoalProgress projectId={projectId} wordCount={wordCount} />}
        <button
          style={{
            ...styles.toolBtn,
            fontSize: 11,
            padding: '1px 8px',
            height: 22,
            background: typewriterOn ? 'var(--color-accent)' : 'transparent',
            color: typewriterOn ? '#fff' : 'var(--color-text-secondary)',
            border: typewriterOn ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
          }}
          onClick={() => setTypewriterOn(!typewriterOn)}
          title={typewriterOn ? '打字机模式：已开启' : '打字机模式：已关闭'}
        >
          打字机
        </button>
        <span style={{ marginLeft: 'auto', color: statusInfo.color }}>{statusInfo.text}</span>
      </div>
    </div>
  );
});

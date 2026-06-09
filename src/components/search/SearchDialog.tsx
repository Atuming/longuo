import { useState, useMemo, useCallback, type CSSProperties, type ChangeEvent } from 'react';
import type { ChapterStore } from '../../types/stores';
import type { Chapter } from '../../types/chapter';
import { Button } from '../ui/Button';

const MAX_SNIPPET_LEN = 120;
const MAX_RESULTS = 50;

interface SearchMatch {
  chapter: Chapter;
  matches: { line: number; snippet: string }[];
}

function searchChapters(chapters: Chapter[], query: string): SearchMatch[] {
  const lower = query.toLowerCase();
  const results: SearchMatch[] = [];

  for (const chapter of chapters) {
    if (!chapter.content) continue;
    const lines = chapter.content.split('\n');
    const matches: { line: number; snippet: string }[] = [];

    for (let i = 0; i < lines.length; i++) {
      const lineLower = lines[i].toLowerCase();
      const idx = lineLower.indexOf(lower);
      if (idx === -1) continue;

      // Extract snippet around the match
      const start = Math.max(0, idx - 40);
      const end = Math.min(lines[i].length, idx + query.length + 40);
      let snippet = lines[i].slice(start, end);
      if (start > 0) snippet = '...' + snippet;
      if (end < lines[i].length) snippet = snippet + '...';
      if (snippet.length > MAX_SNIPPET_LEN) {
        snippet = snippet.slice(0, MAX_SNIPPET_LEN) + '...';
      }

      matches.push({ line: i + 1, snippet });
      if (matches.length >= 5) break; // Max 5 matches per chapter
    }

    if (matches.length > 0) {
      results.push({ chapter, matches });
    }
    if (results.length >= MAX_RESULTS) break;
  }

  return results;
}

const s: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.35)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    zIndex: 1100, paddingTop: '12vh',
  },
  dialog: {
    background: 'var(--color-card)', borderRadius: 'var(--radius)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
    width: 600, maxHeight: '70vh',
    display: 'flex', flexDirection: 'column',
    padding: 'var(--spacing-md)',
  },
  input: {
    width: '100%', height: 40,
    padding: '0 12px', fontSize: 15,
    borderRadius: 'var(--radius)',
    border: '2px solid var(--color-accent, #3182CE)',
    outline: 'none',
    background: 'var(--color-card)',
    color: 'var(--color-text)',
    boxSizing: 'border-box' as const,
  },
  meta: {
    fontSize: 12, color: 'var(--color-text-secondary)',
    padding: '8px 0 4px',
    flexShrink: 0,
  },
  list: {
    flex: 1, overflowY: 'auto', minHeight: 0,
  },
  resultItem: {
    padding: '10px 8px', cursor: 'pointer',
    borderBottom: '1px solid var(--color-border)',
    borderRadius: 'var(--radius)',
    transition: 'background 0.1s',
  },
  chapterTitle: {
    fontSize: 14, fontWeight: 600,
    color: 'var(--color-text)',
    marginBottom: 4,
  },
  matchLine: {
    fontSize: 13, color: 'var(--color-text-secondary)',
    fontFamily: 'var(--font-family)',
    lineHeight: '1.5',
    padding: '2px 0',
  },
  lineNum: {
    fontSize: 11, color: 'var(--color-text-secondary)',
    marginRight: 6, userSelect: 'none' as const,
  },
  highlight: {
    background: '#FEFCBF', color: '#744210',
    padding: '0 2px', borderRadius: 2,
    fontWeight: 600,
  },
  empty: {
    padding: 24, textAlign: 'center' as const,
    fontSize: 14, color: 'var(--color-text-secondary)',
  },
};

function highlightSnippet(snippet: string, query: string): React.ReactNode {
  const lower = snippet.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return snippet;
  return (
    <>
      {snippet.slice(0, idx)}
      <span style={s.highlight}>{snippet.slice(idx, idx + query.length)}</span>
      {snippet.slice(idx + query.length)}
    </>
  );
}

interface SearchDialogProps {
  open: boolean;
  chapterStore: ChapterStore;
  projectId: string;
  onSelectChapter: (chapterId: string) => void;
  onClose: () => void;
}

export function SearchDialog({
  open, chapterStore, projectId, onSelectChapter, onClose,
}: SearchDialogProps) {
  const [query, setQuery] = useState('');

  const chapters = useMemo(() => chapterStore.listChapters(projectId), [chapterStore, projectId]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return searchChapters(chapters, query.trim());
  }, [chapters, query]);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.currentTarget.value);
  }, []);

  const handleSelect = useCallback((chapterId: string) => {
    onSelectChapter(chapterId);
    onClose();
  }, [onSelectChapter, onClose]);

  const handleClose = useCallback(() => {
    setQuery('');
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <div style={s.overlay} onClick={handleClose}>
      <div style={s.dialog} onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          type="text"
          style={s.input}
          placeholder="输入关键词搜索所有章节内容..."
          value={query}
          onChange={handleChange}
          onKeyDown={(e) => {
            if (e.key === 'Escape') handleClose();
          }}
        />
        {query.trim() && (
          <div style={s.meta}>
            找到 {results.length} 个章节{results.length > 0 ? `，共 ${results.reduce((sum, r) => sum + r.matches.length, 0)} 处匹配` : ''}
          </div>
        )}
        <div style={s.list}>
          {query.trim() && results.length === 0 && (
            <div style={s.empty}>未找到匹配的章节内容</div>
          )}
          {results.map(({ chapter, matches }) => (
            <div
              key={chapter.id}
              style={s.resultItem}
              onClick={() => handleSelect(chapter.id)}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--color-bg, #f7fafc)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
            >
              <div style={s.chapterTitle}>{chapter.title}</div>
              {matches.map((m, i) => (
                <div key={i} style={s.matchLine}>
                  <span style={s.lineNum}>L{m.line}</span>
                  {highlightSnippet(m.snippet, query)}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
          <Button variant="secondary" onClick={handleClose}>关闭 (Esc)</Button>
        </div>
      </div>
    </div>
  );
}

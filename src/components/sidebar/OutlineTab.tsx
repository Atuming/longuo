import { useState, useRef, useEffect, useMemo, useCallback, type CSSProperties } from 'react';
import type { Chapter } from '../../types/chapter';
import type { ChapterStore } from '../../types/stores';
import { Button } from '../ui/Button';
import { calculateDropPosition, isValidDrop, type DropInfo } from './outline-drag-utils';

/* ── styles ── */
const styles: Record<string, CSSProperties> = {
  wrapper: { display: 'flex', flexDirection: 'column', height: '100%' },
  tree: { flex: 1, overflow: 'auto', padding: 'var(--spacing-xs)' },
  node: {
    display: 'flex',
    alignItems: 'center',
    padding: '4px 6px',
    cursor: 'pointer',
    borderRadius: 'var(--radius)',
    fontSize: 14,
    userSelect: 'none',
    position: 'relative' as const,
    transition: 'transform 0.2s ease, background 0.15s ease',
  },
  nodeHover: { background: '#EDF2F7' },
  nodeSelected: { background: '#EBF8FF' },
  toggle: {
    width: 16, minWidth: 16, fontSize: 10, cursor: 'pointer',
    background: 'none', border: 'none', padding: 0, color: 'var(--color-text-secondary)',
  },
  title: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  wordCount: { fontSize: 11, color: '#4A5568', marginLeft: 8, whiteSpace: 'nowrap' as const },
  editInput: {
    flex: 1, fontSize: 14, border: '1px solid var(--color-accent)',
    borderRadius: 4, padding: '0 4px', outline: 'none',
  },
  contextMenu: {
    position: 'fixed' as const, background: '#fff', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    zIndex: 1000, padding: '4px 0', minWidth: 140,
  },
  menuItem: {
    padding: '6px 16px', fontSize: 13, cursor: 'pointer', background: 'none',
    border: 'none', width: '100%', textAlign: 'left' as const, display: 'block',
  },
  footer: {
    display: 'flex', gap: 6, padding: 'var(--spacing-xs)',
    borderTop: '1px solid var(--color-border)',
  },
  dropLineBefore: {
    position: 'absolute' as const,
    top: -1,
    left: 0,
    right: 0,
    height: 2,
    background: 'var(--color-accent, #3182CE)',
    borderRadius: 1,
    pointerEvents: 'none' as const,
    zIndex: 10,
  },
  dropLineAfter: {
    position: 'absolute' as const,
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    background: 'var(--color-accent, #3182CE)',
    borderRadius: 1,
    pointerEvents: 'none' as const,
    zIndex: 10,
  },
  dropInside: {
    background: 'rgba(49, 130, 206, 0.12)',
  },
};

/* ── tree builder ── */
function buildTree(chapters: Chapter[]): Map<string | null, Chapter[]> {
  const map = new Map<string | null, Chapter[]>();
  for (const ch of chapters) {
    const key = ch.parentId;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ch);
  }
  for (const arr of map.values()) arr.sort((a, b) => a.sortOrder - b.sortOrder);
  return map;
}

/* ── component ── */
interface OutlineTabProps {
  projectId: string;
  chapterStore: ChapterStore;
  selectedChapterId?: string | null;
  onSelectChapter?: (id: string) => void;
}

export function OutlineTab({ projectId, chapterStore, selectedChapterId, onSelectChapter }: OutlineTabProps) {
  const derivedChapters = useMemo(() => chapterStore.listChapters(projectId), [chapterStore, projectId]);
  const [chapters, setChapters] = useState(derivedChapters);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; chapterId: string } | null>(null);
  const [dropInfo, setDropInfo] = useState<DropInfo | null>(null);
  const [dragSourceId, setDragSourceId] = useState<string | null>(null);
  const editRef = useRef<HTMLInputElement>(null);

  // Sync chapters when chapterStore or projectId changes (render-phase update)
  const [prevDerived, setPrevDerived] = useState(derivedChapters);
  if (derivedChapters !== prevDerived) {
    setPrevDerived(derivedChapters);
    setChapters(derivedChapters);
  }

  const refreshChapters = () => {
    const updated = chapterStore.listChapters(projectId);
    setChapters(updated);
  };

  /* close context menu on outside click */
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [contextMenu]);

  const tree = buildTree(chapters);

  /** Collect all descendant IDs of a given chapter */
  const getDescendantIds = useCallback((id: string): string[] => {
    const result: string[] = [];
    const collect = (parentId: string) => {
      for (const ch of chapters) {
        if (ch.parentId === parentId) {
          result.push(ch.id);
          collect(ch.id);
        }
      }
    };
    collect(id);
    return result;
  }, [chapters]);

  /* ── actions ── */
  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const CHINESE_NUMBERS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];

  const getNextName = (level: Chapter['level'], parentId: string | null) => {
    const siblings = chapters.filter((c) => c.parentId === parentId && c.level === level);
    const num = siblings.length + 1;
    const cn = num <= 20 ? CHINESE_NUMBERS[num - 1] : String(num);
    const prefix = { volume: '卷', chapter: '章', section: '节' }[level];
    return `第${cn}${prefix}`;
  };

  const handleAdd = (level: Chapter['level']) => {
    let parentId: string | null = null;
    if (level === 'chapter' && selectedChapterId) {
      const sel = chapterStore.getChapter(selectedChapterId);
      if (sel?.level === 'volume') parentId = sel.id;
      else if (sel?.parentId) parentId = sel.parentId;
    } else if (level === 'section' && selectedChapterId) {
      const sel = chapterStore.getChapter(selectedChapterId);
      if (sel?.level === 'chapter') parentId = sel.id;
      else if (sel?.level === 'section') parentId = sel.parentId;
    }
    chapterStore.createChapter(projectId, parentId, getNextName(level, parentId), level);
    refreshChapters();
  };

  const handleRename = (id: string, newTitle: string) => {
    if (newTitle.trim()) chapterStore.updateChapter(id, { title: newTitle.trim() });
    setEditingId(null);
    refreshChapters();
  };

  const handleDelete = (id: string) => {
    chapterStore.deleteChapter(id);
    refreshChapters();
  };

  const handleAddChild = (parentId: string) => {
    const parent = chapterStore.getChapter(parentId);
    if (!parent) return;
    const childLevel: Chapter['level'] = parent.level === 'volume' ? 'chapter' : 'section';
    chapterStore.createChapter(projectId, parentId, getNextName(childLevel, parentId), childLevel);
    collapsed.delete(parentId);
    setCollapsed(new Set(collapsed));
    refreshChapters();
  };

  /* ── drag & drop ── */
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDragSourceId(id);

    // Create semi-transparent drag image
    const target = e.currentTarget as HTMLElement;
    const clone = target.cloneNode(true) as HTMLElement;
    clone.style.opacity = '0.6';
    clone.style.position = 'absolute';
    clone.style.top = '-9999px';
    clone.style.left = '-9999px';
    clone.style.background = '#fff';
    clone.style.borderRadius = '4px';
    clone.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    document.body.appendChild(clone);
    e.dataTransfer.setDragImage(clone, 20, 12);
    // Clean up clone after drag starts
    requestAnimationFrame(() => {
      document.body.removeChild(clone);
    });
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragSourceId || dragSourceId === targetId) {
      setDropInfo(null);
      return;
    }

    const source = chapterStore.getChapter(dragSourceId);
    const target = chapterStore.getChapter(targetId);
    if (!source || !target) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const position = calculateDropPosition(e.clientY, rect.top, rect.height);

    // Validate the drop
    if (!isValidDrop(source.level, target.level, position, dragSourceId, targetId, getDescendantIds)) {
      e.dataTransfer.dropEffect = 'none';
      setDropInfo(null);
      return;
    }

    e.dataTransfer.dropEffect = 'move';
    setDropInfo({ targetId, position });
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if we're actually leaving the element (not entering a child)
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (!relatedTarget || !(e.currentTarget as HTMLElement).contains(relatedTarget)) {
      setDropInfo(null);
    }
  };

  const handleDragEnd = () => {
    setDropInfo(null);
    setDragSourceId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetId || !dropInfo) {
      setDropInfo(null);
      setDragSourceId(null);
      return;
    }

    const source = chapterStore.getChapter(sourceId);
    const target = chapterStore.getChapter(targetId);
    if (!source || !target) {
      setDropInfo(null);
      setDragSourceId(null);
      return;
    }

    const { position } = dropInfo;

    // Final validation
    if (!isValidDrop(source.level, target.level, position, sourceId, targetId, getDescendantIds)) {
      setDropInfo(null);
      setDragSourceId(null);
      return;
    }

    if (position === 'inside') {
      // Insert as child of target, at the end
      const children = chapters.filter((c) => c.parentId === targetId);
      chapterStore.reorderChapter(sourceId, children.length, targetId);
    } else if (position === 'before') {
      // Insert as sibling before target
      chapterStore.reorderChapter(sourceId, target.sortOrder, target.parentId);
    } else {
      // 'after' - Insert as sibling after target
      chapterStore.reorderChapter(sourceId, target.sortOrder + 1, target.parentId);
    }

    setDropInfo(null);
    setDragSourceId(null);
    refreshChapters();
  };

  /* ── render tree node ── */
  const renderNode = (ch: Chapter, depth: number) => {
    const children = tree.get(ch.id);
    const hasChildren = children && children.length > 0;
    const isCollapsed = collapsed.has(ch.id);
    const isSelected = ch.id === selectedChapterId;
    const isEditing = ch.id === editingId;
    const isDragSource = ch.id === dragSourceId;

    const isDropTarget = dropInfo?.targetId === ch.id;
    const dropPosition = isDropTarget ? dropInfo.position : null;

    return (
      <div key={ch.id} style={{ transition: 'transform 0.2s ease' }}>
        <div
          style={{
            ...styles.node,
            paddingLeft: 6 + depth * 16,
            ...(isSelected ? styles.nodeSelected : {}),
            ...(isDragSource ? { opacity: 0.4 } : {}),
            ...(isDropTarget && dropPosition === 'inside' ? styles.dropInside : {}),
          }}
          draggable
          onDragStart={(e) => handleDragStart(e, ch.id)}
          onDragOver={(e) => handleDragOver(e, ch.id)}
          onDragLeave={handleDragLeave}
          onDragEnd={handleDragEnd}
          onDrop={(e) => handleDrop(e, ch.id)}
          onClick={() => onSelectChapter?.(ch.id)}
          onDoubleClick={() => setEditingId(ch.id)}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, chapterId: ch.id }); }}
        >
          {/* Drop indicator lines */}
          {isDropTarget && dropPosition === 'before' && <div style={styles.dropLineBefore} />}
          {isDropTarget && dropPosition === 'after' && <div style={styles.dropLineAfter} />}

          <button
            style={{ ...styles.toggle, visibility: hasChildren ? 'visible' : 'hidden' }}
            onClick={(e) => { e.stopPropagation(); toggleCollapse(ch.id); }}
          >
            {isCollapsed ? '▶' : '▼'}
          </button>

          {isEditing ? (
            <input
              ref={editRef}
              style={styles.editInput}
              defaultValue={ch.title}
              autoFocus
              onBlur={(e) => handleRename(ch.id, e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename(ch.id, e.currentTarget.value);
                if (e.key === 'Escape') setEditingId(null);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span style={styles.title}>{ch.title}</span>
          )}

          <span style={styles.wordCount}>{ch.wordCount}</span>
        </div>

        {hasChildren && !isCollapsed && children!.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  const roots = tree.get(null) || [];

  return (
    <div style={styles.wrapper}>
      <div style={styles.tree}>
        {roots.length === 0 && (
          <div style={{ padding: 16, color: 'var(--color-text-secondary)', fontSize: 13, textAlign: 'center' }}>
            暂无章节，点击下方按钮添加
          </div>
        )}
        {roots.map((ch) => renderNode(ch, 0))}
      </div>

      {/* context menu */}
      {contextMenu && (
        <div style={{ ...styles.contextMenu, left: contextMenu.x, top: contextMenu.y }}>
          <button style={styles.menuItem} onClick={() => { handleAddChild(contextMenu.chapterId); setContextMenu(null); }}>
            添加子章节
          </button>
          <button style={styles.menuItem} onClick={() => { setEditingId(contextMenu.chapterId); setContextMenu(null); }}>
            重命名
          </button>
          <button style={{ ...styles.menuItem, color: 'var(--color-error)' }} onClick={() => { handleDelete(contextMenu.chapterId); setContextMenu(null); }}>
            删除
          </button>
        </div>
      )}

      {/* footer buttons */}
      <div style={styles.footer}>
        <Button variant="secondary" style={{ flex: 1, fontSize: 12, height: 30, padding: '0 8px' }} onClick={() => handleAdd('volume')}>添加卷</Button>
        <Button variant="secondary" style={{ flex: 1, fontSize: 12, height: 30, padding: '0 8px' }} onClick={() => handleAdd('chapter')}>添加章</Button>
        <Button variant="secondary" style={{ flex: 1, fontSize: 12, height: 30, padding: '0 8px' }} onClick={() => handleAdd('section')}>添加节</Button>
      </div>
    </div>
  );
}

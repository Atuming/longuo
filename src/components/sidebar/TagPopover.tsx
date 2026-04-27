import { useState, useEffect, useRef, type CSSProperties } from 'react';
import type { Tag } from '../../types/tag';
import type { TagStore } from '../../types/stores';

export interface TagPopoverProps {
  projectId: string;
  chapterId: string;
  tagStore: TagStore;
  position: { x: number; y: number };
  onClose: () => void;
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    zIndex: 999,
  },
  popover: {
    position: 'fixed' as const,
    background: '#fff',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    zIndex: 1000,
    padding: '4px 0',
    minWidth: 180,
    maxHeight: 320,
    display: 'flex',
    flexDirection: 'column' as const,
  },
  header: {
    padding: '6px 12px',
    fontSize: 12,
    color: '#718096',
    borderBottom: '1px solid var(--color-border)',
  },
  list: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '4px 0',
  },
  tagRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '5px 12px',
    fontSize: 13,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    width: '100%',
    textAlign: 'left' as const,
  },
  checkbox: {
    width: 14,
    height: 14,
    borderRadius: 3,
    border: '2px solid #CBD5E0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    flexShrink: 0,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
  tagName: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  divider: {
    height: 1,
    background: 'var(--color-border)',
    margin: '4px 0',
  },
  createRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
  },
  createInput: {
    flex: 1,
    fontSize: 12,
    border: '1px solid var(--color-border)',
    borderRadius: 4,
    padding: '3px 6px',
    outline: 'none',
  },
  createButton: {
    fontSize: 12,
    padding: '3px 8px',
    borderRadius: 4,
    border: 'none',
    background: 'var(--color-accent, #3182CE)',
    color: '#fff',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  error: {
    padding: '2px 12px',
    fontSize: 11,
    color: '#E53E3E',
  },
};

export function TagPopover({ projectId, chapterId, tagStore, position, onClose }: TagPopoverProps) {
  const [allTags, setAllTags] = useState<Tag[]>(() => tagStore.listTags(projectId));
  const [chapterTagIds, setChapterTagIds] = useState<Set<string>>(() =>
    new Set(tagStore.getTagsForChapter(chapterId).map(t => t.id))
  );
  const [newTagName, setNewTagName] = useState('');
  const [error, setError] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid the triggering click from immediately closing
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handler);
    }, 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousedown', handler);
    };
  }, [onClose]);

  const handleToggleTag = (tagId: string) => {
    if (chapterTagIds.has(tagId)) {
      tagStore.removeTagFromChapter(chapterId, tagId);
      setChapterTagIds(prev => {
        const next = new Set(prev);
        next.delete(tagId);
        return next;
      });
    } else {
      tagStore.addTagToChapter(chapterId, tagId);
      setChapterTagIds(prev => new Set(prev).add(tagId));
    }
  };

  const handleCreateTag = () => {
    const trimmed = newTagName.trim();
    if (!trimmed) return;
    setError('');
    try {
      tagStore.createTag(projectId, trimmed);
      setNewTagName('');
      setAllTags(tagStore.listTags(projectId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '创建失败');
    }
  };

  return (
    <>
      {/* invisible overlay to capture outside clicks */}
      <div style={styles.overlay} />
      <div
        ref={popoverRef}
        style={{ ...styles.popover, left: position.x, top: position.y }}
      >
        <div style={styles.header}>管理标签</div>

        <div style={styles.list}>
          {allTags.length === 0 && (
            <div style={{ padding: '8px 12px', fontSize: 12, color: '#A0AEC0' }}>暂无标签</div>
          )}
          {allTags.map(tag => {
            const checked = chapterTagIds.has(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                style={styles.tagRow}
                onClick={() => handleToggleTag(tag.id)}
              >
                <span
                  style={{
                    ...styles.checkbox,
                    borderColor: checked ? tag.color : '#CBD5E0',
                    background: checked ? tag.color : 'transparent',
                    color: '#fff',
                  }}
                >
                  {checked ? '✓' : ''}
                </span>
                <span style={{ ...styles.colorDot, background: tag.color }} />
                <span style={styles.tagName}>{tag.name}</span>
              </button>
            );
          })}
        </div>

        <div style={styles.divider} />

        <div style={styles.createRow}>
          <input
            style={styles.createInput}
            placeholder="新标签名称"
            value={newTagName}
            onChange={e => { setNewTagName(e.target.value); setError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') handleCreateTag(); }}
          />
          <button
            type="button"
            style={styles.createButton}
            onClick={handleCreateTag}
          >
            创建
          </button>
        </div>

        {error && <div style={styles.error}>{error}</div>}
      </div>
    </>
  );
}

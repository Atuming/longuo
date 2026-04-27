import type { CSSProperties } from 'react';
import type { Tag } from '../../types/tag';

export interface TagFilterProps {
  tags: Tag[];
  selectedTagIds: Set<string>;
  onToggleTag: (tagId: string) => void;
  onClearFilter: () => void;
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    padding: '6px 0',
    alignItems: 'center',
  },
  tagButton: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 11,
    lineHeight: '20px',
    padding: '0 8px',
    borderRadius: 4,
    cursor: 'pointer',
    border: '1px solid transparent',
    transition: 'opacity 0.15s, border-color 0.15s',
    whiteSpace: 'nowrap' as const,
    userSelect: 'none' as const,
  },
  clearButton: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 11,
    lineHeight: '20px',
    padding: '0 6px',
    borderRadius: 4,
    cursor: 'pointer',
    border: '1px solid #666',
    background: 'transparent',
    color: '#aaa',
    whiteSpace: 'nowrap' as const,
    userSelect: 'none' as const,
  },
};

export function TagFilter({ tags, selectedTagIds, onToggleTag, onClearFilter }: TagFilterProps) {
  if (!tags || tags.length === 0) return null;

  const hasSelection = selectedTagIds.size > 0;

  return (
    <div style={styles.container}>
      {tags.map((tag) => {
        const selected = selectedTagIds.has(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            style={{
              ...styles.tagButton,
              backgroundColor: selected ? tag.color : 'transparent',
              color: selected ? '#fff' : tag.color,
              borderColor: selected ? tag.color : tag.color + '66',
              opacity: selected || !hasSelection ? 1 : 0.5,
            }}
            title={tag.name}
            onClick={() => onToggleTag(tag.id)}
          >
            {tag.name}
          </button>
        );
      })}
      {hasSelection && (
        <button
          type="button"
          style={styles.clearButton}
          onClick={onClearFilter}
        >
          清除筛选
        </button>
      )}
    </div>
  );
}

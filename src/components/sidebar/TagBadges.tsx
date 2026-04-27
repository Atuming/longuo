import type { CSSProperties } from 'react';
import type { Tag } from '../../types/tag';

export interface TagBadgesProps {
  tags: Tag[];
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'inline-flex',
    gap: 4,
    marginLeft: 6,
    flexShrink: 0,
  },
  badge: {
    display: 'inline-block',
    fontSize: 10,
    lineHeight: '16px',
    padding: '0 5px',
    borderRadius: 3,
    color: '#fff',
    whiteSpace: 'nowrap' as const,
    maxWidth: 60,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
};

export function TagBadges({ tags }: TagBadgesProps) {
  if (!tags || tags.length === 0) return null;

  return (
    <span style={styles.container}>
      {tags.map((tag) => (
        <span
          key={tag.id}
          style={{ ...styles.badge, backgroundColor: tag.color }}
          title={tag.name}
        >
          {tag.name}
        </span>
      ))}
    </span>
  );
}

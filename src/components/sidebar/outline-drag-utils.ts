import type { Chapter } from '../../types/chapter';

/* ── types ── */
export type DropPosition = 'before' | 'inside' | 'after';

export interface DropInfo {
  targetId: string;
  position: DropPosition;
}

/* ── pure helpers (exported for testing) ── */

/**
 * Calculate drop position based on mouse Y offset within the target element.
 * Top 1/4 = 'before', middle 1/2 = 'inside', bottom 1/4 = 'after'.
 */
export function calculateDropPosition(mouseY: number, targetTop: number, targetHeight: number): DropPosition {
  if (targetHeight <= 0) return 'inside';
  const offset = mouseY - targetTop;
  const ratio = offset / targetHeight;
  if (ratio < 0.25) return 'before';
  if (ratio > 0.75) return 'after';
  return 'inside';
}

/**
 * Validate whether a drag operation is allowed based on hierarchy rules.
 * - Volumes cannot be dragged inside chapters (volumes can't become children of chapters)
 * - Volumes cannot be dragged inside sections
 * - Chapters cannot be dragged inside sections
 * - A node cannot be dropped on itself
 * - A node cannot be dropped inside its own descendant
 *
 * For 'before'/'after' positions, the source becomes a sibling of the target,
 * so we validate against the target's parent level instead.
 */
export function isValidDrop(
  sourceLevel: Chapter['level'],
  targetLevel: Chapter['level'],
  position: DropPosition,
  sourceId: string,
  targetId: string,
  getDescendantIds: (id: string) => string[],
): boolean {
  // Cannot drop on self
  if (sourceId === targetId) return false;

  // Cannot drop into own descendants
  const descendantIds = getDescendantIds(sourceId);
  if (descendantIds.includes(targetId)) return false;

  if (position === 'inside') {
    // Dropping as a child of target
    // volume cannot go inside chapter or section
    if (sourceLevel === 'volume' && (targetLevel === 'chapter' || targetLevel === 'section')) return false;
    // chapter cannot go inside section
    if (sourceLevel === 'chapter' && targetLevel === 'section') return false;
    return true;
  }

  // For 'before'/'after', the source becomes a sibling of the target.
  // This is always structurally valid since it inherits the target's parent context.
  return true;
}

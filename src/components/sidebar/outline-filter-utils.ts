import type { Chapter } from '../../types/chapter';

/**
 * Filter chapters by selected tags.
 * Returns a Set of chapter IDs that should be visible.
 * Includes matched chapters and all their ancestors to maintain tree structure.
 * Returns all chapter IDs when selectedTagIds is empty.
 */
export function filterChaptersByTags(
  chapters: Chapter[],
  selectedTagIds: Set<string>,
  chapterTagMap: Map<string, Set<string>>,
): Set<string> {
  // Empty filter → all chapters visible
  if (selectedTagIds.size === 0) {
    return new Set(chapters.map((ch) => ch.id));
  }

  // Build a lookup from id → chapter for ancestor walking
  const chapterById = new Map<string, Chapter>();
  for (const ch of chapters) {
    chapterById.set(ch.id, ch);
  }

  const visible = new Set<string>();

  for (const ch of chapters) {
    const tags = chapterTagMap.get(ch.id);
    if (!tags) continue;

    // Check if this chapter is associated with any selected tag (OR logic)
    let matched = false;
    for (const tagId of tags) {
      if (selectedTagIds.has(tagId)) {
        matched = true;
        break;
      }
    }

    if (matched) {
      // Add the matched chapter and all its ancestors
      visible.add(ch.id);
      let current = ch;
      while (current.parentId !== null) {
        if (visible.has(current.parentId)) break; // already added this ancestor chain
        visible.add(current.parentId);
        const parent = chapterById.get(current.parentId);
        if (!parent) break;
        current = parent;
      }
    }
  }

  return visible;
}

/** 标签 */
export interface Tag {
  id: string;
  projectId: string;
  name: string;
  color: string; // CSS 颜色值，如 '#E53E3E'
}

/** 标签持久化数据 */
export interface TagData {
  tags: Tag[];
  chapterTagMap: Record<string, string[]>; // chapterId -> tagId[]
}

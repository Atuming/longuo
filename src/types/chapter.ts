/** 章节 */
export interface Chapter {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  content: string;
  sortOrder: number;
  level: 'volume' | 'chapter' | 'section';
  wordCount: number;
}

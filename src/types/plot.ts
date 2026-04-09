/** 情节线索 */
export interface PlotThread {
  id: string;
  projectId: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'resolved';
  associatedChapterIds: string[];
}

/** 时间节点 */
export interface TimelinePoint {
  id: string;
  projectId: string;
  label: string;
  description: string;
  sortOrder: number;
  associatedChapterIds: string[];
  associatedCharacterIds: string[];
}

/** 时间线事件联合类型 */
export type TimelineEvent =
  | { type: 'timeline:created'; point: TimelinePoint }
  | { type: 'timeline:updated'; point: TimelinePoint }
  | { type: 'timeline:deleted'; pointId: string };

import type { TimelineEvent } from './timeline';

/** 角色删除事件 */
export type CharacterDeletedEvent = { type: 'character:deleted'; characterId: string };

/** 章节删除事件（包含所有被删除的 ID，含子章节） */
export type ChapterDeletedEvent = { type: 'chapter:deleted'; chapterIds: string[] };

/** 应用事件联合类型 */
export type AppEvent =
  | TimelineEvent
  | CharacterDeletedEvent
  | ChapterDeletedEvent;

/** 事件总线接口 */
export interface EventBus {
  emit(event: AppEvent): void;
  on(type: AppEvent['type'], handler: (event: AppEvent) => void): () => void;
}

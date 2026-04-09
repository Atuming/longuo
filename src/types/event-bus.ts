import type { TimelineEvent } from './timeline';

/** 事件总线接口 */
export interface EventBus {
  emit(event: TimelineEvent): void;
  on(type: TimelineEvent['type'], handler: (event: TimelineEvent) => void): () => void;
}

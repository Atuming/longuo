import type { EventBus } from '../types/event-bus';
import type { TimelineEvent } from '../types/timeline';

/**
 * 创建一个事件总线实例。
 * 支持 timeline:created, timeline:updated, timeline:deleted 事件的发布/订阅。
 */
export function createEventBus(): EventBus {
  const listeners = new Map<TimelineEvent['type'], Set<(event: TimelineEvent) => void>>();

  return {
    emit(event: TimelineEvent): void {
      const handlers = listeners.get(event.type);
      if (!handlers) return;
      for (const handler of handlers) {
        try {
          handler(event);
        } catch {
          // 捕获异常，不影响其他处理器执行
        }
      }
    },

    on(type: TimelineEvent['type'], handler: (event: TimelineEvent) => void): () => void {
      let handlers = listeners.get(type);
      if (!handlers) {
        handlers = new Set();
        listeners.set(type, handlers);
      }
      handlers.add(handler);

      // 返回取消订阅函数
      return () => {
        handlers!.delete(handler);
        if (handlers!.size === 0) {
          listeners.delete(type);
        }
      };
    },
  };
}

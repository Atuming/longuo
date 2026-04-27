import type { EventBus, AppEvent } from '../types/event-bus';

/**
 * 创建一个事件总线实例。
 * 支持 timeline:created, timeline:updated, timeline:deleted,
 * character:deleted, chapter:deleted 事件的发布/订阅。
 */
export function createEventBus(): EventBus {
  const listeners = new Map<AppEvent['type'], Set<(event: AppEvent) => void>>();

  return {
    emit(event: AppEvent): void {
      const handlers = listeners.get(event.type);
      if (!handlers) return;
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (error) {
          console.error(`EventBus: listener for "${event.type}" threw an error`, error);
        }
      }
    },

    on(type: AppEvent['type'], handler: (event: AppEvent) => void): () => void {
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

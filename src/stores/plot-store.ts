import type { PlotStore } from '../types/stores';
import type { PlotThread } from '../types/plot';

/** 深拷贝一个 PlotThread（防御性拷贝） */
function cloneThread(thread: PlotThread): PlotThread {
  return {
    ...thread,
    associatedChapterIds: [...thread.associatedChapterIds],
  };
}

/**
 * 创建 PlotStore 实例。
 * 所有操作为同步内存操作，持久化由 ProjectStore 统一处理。
 */
export function createPlotStore(): PlotStore {
  const threads = new Map<string, PlotThread>();

  return {
    createThread(data: Omit<PlotThread, 'id'>): PlotThread {
      const thread: PlotThread = {
        id: crypto.randomUUID(),
        projectId: data.projectId,
        name: data.name,
        description: data.description,
        status: data.status,
        associatedChapterIds: [...data.associatedChapterIds],
      };
      threads.set(thread.id, thread);
      return cloneThread(thread);
    },

    getThread(id: string): PlotThread | undefined {
      const thread = threads.get(id);
      if (!thread) return undefined;
      return cloneThread(thread);
    },

    listThreads(projectId: string): PlotThread[] {
      const result: PlotThread[] = [];
      for (const thread of threads.values()) {
        if (thread.projectId === projectId) {
          result.push(cloneThread(thread));
        }
      }
      return result;
    },

    filterByStatus(projectId: string, status: PlotThread['status']): PlotThread[] {
      const result: PlotThread[] = [];
      for (const thread of threads.values()) {
        if (thread.projectId === projectId && thread.status === status) {
          result.push(cloneThread(thread));
        }
      }
      return result;
    },

    updateThread(id: string, updates: Partial<Omit<PlotThread, 'id' | 'projectId'>>): void {
      const thread = threads.get(id);
      if (!thread) return;
      if (updates.name !== undefined) thread.name = updates.name;
      if (updates.description !== undefined) thread.description = updates.description;
      if (updates.status !== undefined) thread.status = updates.status;
      if (updates.associatedChapterIds !== undefined) {
        thread.associatedChapterIds = [...updates.associatedChapterIds];
      }
    },

    deleteThread(id: string): void {
      threads.delete(id);
    },
  };
}

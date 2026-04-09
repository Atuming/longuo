import type { TimelineStore } from '../types/stores';
import type { TimelinePoint } from '../types/timeline';
import type { EventBus } from '../types/event-bus';

/** 深拷贝一个 TimelinePoint（防御性拷贝） */
function clonePoint(point: TimelinePoint): TimelinePoint {
  return {
    ...point,
    associatedChapterIds: [...point.associatedChapterIds],
    associatedCharacterIds: [...point.associatedCharacterIds],
  };
}

export interface CreateTimelineStoreOptions {
  eventBus?: EventBus;
  getSnapshotCount?: (timelinePointId: string) => number;
  getRelationshipCount?: (timelinePointId: string) => number;
}

/**
 * 创建 TimelineStore 实例。
 * 所有操作为同步内存操作，持久化由 ProjectStore 统一处理。
 * 创建/更新/删除时通过 EventBus 发出事件。
 */
export function createTimelineStore(options?: CreateTimelineStoreOptions): TimelineStore {
  const points = new Map<string, TimelinePoint>();
  const eventBus = options?.eventBus;
  const getSnapshotCount = options?.getSnapshotCount;
  const getRelationshipCount = options?.getRelationshipCount;

  return {
    createTimelinePoint(data: Omit<TimelinePoint, 'id'>): TimelinePoint {
      const point: TimelinePoint = {
        id: crypto.randomUUID(),
        projectId: data.projectId,
        label: data.label,
        description: data.description,
        sortOrder: data.sortOrder,
        associatedChapterIds: [...data.associatedChapterIds],
        associatedCharacterIds: [...data.associatedCharacterIds],
      };
      points.set(point.id, point);

      if (eventBus) {
        eventBus.emit({ type: 'timeline:created', point: clonePoint(point) });
      }

      return clonePoint(point);
    },

    getTimelinePoint(id: string): TimelinePoint | undefined {
      const point = points.get(id);
      if (!point) return undefined;
      return clonePoint(point);
    },

    listTimelinePoints(projectId: string): TimelinePoint[] {
      const result: TimelinePoint[] = [];
      for (const point of points.values()) {
        if (point.projectId === projectId) {
          result.push(clonePoint(point));
        }
      }
      result.sort((a, b) => a.sortOrder - b.sortOrder);
      return result;
    },

    updateTimelinePoint(id: string, updates: Partial<Omit<TimelinePoint, 'id' | 'projectId'>>): void {
      const point = points.get(id);
      if (!point) return;
      if (updates.label !== undefined) point.label = updates.label;
      if (updates.description !== undefined) point.description = updates.description;
      if (updates.sortOrder !== undefined) point.sortOrder = updates.sortOrder;
      if (updates.associatedChapterIds !== undefined) {
        point.associatedChapterIds = [...updates.associatedChapterIds];
      }
      if (updates.associatedCharacterIds !== undefined) {
        point.associatedCharacterIds = [...updates.associatedCharacterIds];
      }

      if (eventBus) {
        eventBus.emit({ type: 'timeline:updated', point: clonePoint(point) });
      }
    },

    deleteTimelinePoint(id: string): void {
      const existed = points.has(id);
      points.delete(id);

      if (existed && eventBus) {
        eventBus.emit({ type: 'timeline:deleted', pointId: id });
      }
    },

    reorderTimelinePoint(id: string, newSortOrder: number): void {
      const point = points.get(id);
      if (!point) return;

      const projectId = point.projectId;

      // Collect all points in the same project, sorted by current sortOrder
      const projectPoints: TimelinePoint[] = [];
      for (const p of points.values()) {
        if (p.projectId === projectId) {
          projectPoints.push(p);
        }
      }
      projectPoints.sort((a, b) => a.sortOrder - b.sortOrder);

      // Remove the target point from the list
      const filtered = projectPoints.filter((p) => p.id !== id);

      // Clamp newSortOrder to valid range
      const insertIndex = Math.max(0, Math.min(newSortOrder, filtered.length));

      // Insert at the new position
      filtered.splice(insertIndex, 0, point);

      // Reassign consecutive sortOrder values
      for (let i = 0; i < filtered.length; i++) {
        filtered[i].sortOrder = i;
      }

      if (eventBus) {
        eventBus.emit({ type: 'timeline:updated', point: clonePoint(point) });
      }
    },

    filterByChapter(projectId: string, chapterId: string): TimelinePoint[] {
      const result: TimelinePoint[] = [];
      for (const point of points.values()) {
        if (point.projectId === projectId && point.associatedChapterIds.includes(chapterId)) {
          result.push(clonePoint(point));
        }
      }
      return result;
    },

    filterByCharacter(projectId: string, characterId: string): TimelinePoint[] {
      const result: TimelinePoint[] = [];
      for (const point of points.values()) {
        if (point.projectId === projectId && point.associatedCharacterIds.includes(characterId)) {
          result.push(clonePoint(point));
        }
      }
      return result;
    },

    getReferences(id: string): { characterSnapshots: number; relationships: number } {
      return {
        characterSnapshots: getSnapshotCount ? getSnapshotCount(id) : 0,
        relationships: getRelationshipCount ? getRelationshipCount(id) : 0,
      };
    },
  };
}

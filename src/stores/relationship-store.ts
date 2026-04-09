import type { RelationshipStore } from '../types/stores';
import type { CharacterRelationship } from '../types/relationship';
import type { EventBus } from '../types/event-bus';

/** 深拷贝一个 CharacterRelationship（防御性拷贝） */
function cloneRelationship(r: CharacterRelationship): CharacterRelationship {
  return { ...r };
}

export interface CreateRelationshipStoreOptions {
  eventBus?: EventBus;
  /** 根据 TimelinePoint ID 获取其 sortOrder，用于 listRelationshipsAtTimeline */
  getTimelinePointSortOrder?: (id: string) => number | undefined;
}

/**
 * 创建 RelationshipStore 实例。
 * 所有操作为同步内存操作，持久化由 ProjectStore 统一处理。
 * 可选传入 EventBus 以订阅时间线事件保持同步。
 */
export function createRelationshipStore(options?: CreateRelationshipStoreOptions): RelationshipStore {
  const relationships = new Map<string, CharacterRelationship>();
  const eventBus = options?.eventBus;
  const getSortOrder = options?.getTimelinePointSortOrder;

  // 订阅时间线删除事件，级联删除引用了该时间节点的关系
  if (eventBus) {
    eventBus.on('timeline:deleted', (event) => {
      if (event.type !== 'timeline:deleted') return;
      const pointId = event.pointId;
      for (const [id, rel] of relationships) {
        if (rel.startTimelinePointId === pointId || rel.endTimelinePointId === pointId) {
          relationships.delete(id);
        }
      }
    });
  }

  return {
    createRelationship(data: Omit<CharacterRelationship, 'id'>): CharacterRelationship {
      const relationship: CharacterRelationship = {
        id: crypto.randomUUID(),
        projectId: data.projectId,
        sourceCharacterId: data.sourceCharacterId,
        targetCharacterId: data.targetCharacterId,
        relationshipType: data.relationshipType,
        description: data.description,
        startTimelinePointId: data.startTimelinePointId,
        strength: data.strength,
      };
      if (data.customTypeName !== undefined) {
        relationship.customTypeName = data.customTypeName;
      }
      if (data.endTimelinePointId !== undefined) {
        relationship.endTimelinePointId = data.endTimelinePointId;
      }
      relationships.set(relationship.id, relationship);
      return cloneRelationship(relationship);
    },

    getRelationship(id: string): CharacterRelationship | undefined {
      const rel = relationships.get(id);
      if (!rel) return undefined;
      return cloneRelationship(rel);
    },

    listRelationships(projectId: string): CharacterRelationship[] {
      const result: CharacterRelationship[] = [];
      for (const rel of relationships.values()) {
        if (rel.projectId === projectId) {
          result.push(cloneRelationship(rel));
        }
      }
      return result;
    },

    listRelationshipsAtTimeline(projectId: string, timelinePointId: string): CharacterRelationship[] {
      if (!getSortOrder) return [];
      const targetSortOrder = getSortOrder(timelinePointId);
      if (targetSortOrder === undefined) return [];

      const result: CharacterRelationship[] = [];
      for (const rel of relationships.values()) {
        if (rel.projectId !== projectId) continue;

        const startOrder = getSortOrder(rel.startTimelinePointId);
        if (startOrder === undefined) continue;
        if (startOrder > targetSortOrder) continue;

        if (rel.endTimelinePointId) {
          const endOrder = getSortOrder(rel.endTimelinePointId);
          if (endOrder === undefined) continue;
          if (endOrder < targetSortOrder) continue;
        }

        result.push(cloneRelationship(rel));
      }
      return result;
    },

    listRelationshipsForCharacter(characterId: string): CharacterRelationship[] {
      const result: CharacterRelationship[] = [];
      for (const rel of relationships.values()) {
        if (rel.sourceCharacterId === characterId || rel.targetCharacterId === characterId) {
          result.push(cloneRelationship(rel));
        }
      }
      return result;
    },

    updateRelationship(id: string, updates: Partial<Omit<CharacterRelationship, 'id' | 'projectId'>>): void {
      const rel = relationships.get(id);
      if (!rel) return;
      if (updates.sourceCharacterId !== undefined) rel.sourceCharacterId = updates.sourceCharacterId;
      if (updates.targetCharacterId !== undefined) rel.targetCharacterId = updates.targetCharacterId;
      if (updates.relationshipType !== undefined) rel.relationshipType = updates.relationshipType;
      if (updates.customTypeName !== undefined) rel.customTypeName = updates.customTypeName;
      if (updates.description !== undefined) rel.description = updates.description;
      if (updates.startTimelinePointId !== undefined) rel.startTimelinePointId = updates.startTimelinePointId;
      if (updates.endTimelinePointId !== undefined) rel.endTimelinePointId = updates.endTimelinePointId;
      if (updates.strength !== undefined) rel.strength = updates.strength;
    },

    deleteRelationship(id: string): void {
      relationships.delete(id);
    },

    filterByType(projectId: string, type: CharacterRelationship['relationshipType']): CharacterRelationship[] {
      const result: CharacterRelationship[] = [];
      for (const rel of relationships.values()) {
        if (rel.projectId === projectId && rel.relationshipType === type) {
          result.push(cloneRelationship(rel));
        }
      }
      return result;
    },
  };
}

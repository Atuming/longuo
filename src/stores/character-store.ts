import type { CharacterStore } from '../types/stores';
import type { Character, CharacterTimelineSnapshot } from '../types/character';
import type { EventBus } from '../types/event-bus';

/**
 * 创建 CharacterStore 实例。
 * 所有操作为同步内存操作，持久化由 ProjectStore 统一处理。
 * 可选传入 EventBus 以订阅时间线事件保持同步。
 */
export function createCharacterStore(eventBus?: EventBus): CharacterStore {
  const characters = new Map<string, Character>();
  const snapshots = new Map<string, CharacterTimelineSnapshot>();

  // 订阅时间线删除事件，级联清理相关快照
  if (eventBus) {
    eventBus.on('timeline:deleted', (event) => {
      if (event.type !== 'timeline:deleted') return;
      const pointId = event.pointId;
      for (const [key, snapshot] of snapshots) {
        if (snapshot.timelinePointId === pointId) {
          snapshots.delete(key);
        }
      }
    });
  }

  function snapshotKey(characterId: string, timelinePointId: string): string {
    return `${characterId}:${timelinePointId}`;
  }

  return {
    createCharacter(projectId: string, data: Omit<Character, 'id' | 'projectId'>): Character {
      const character: Character = {
        id: crypto.randomUUID(),
        projectId,
        name: data.name,
        aliases: [...data.aliases],
        appearance: data.appearance,
        personality: data.personality,
        backstory: data.backstory,
        customAttributes: { ...data.customAttributes },
      };
      characters.set(character.id, character);
      return { ...character, aliases: [...character.aliases], customAttributes: { ...character.customAttributes } };
    },

    getCharacter(id: string): Character | undefined {
      const ch = characters.get(id);
      if (!ch) return undefined;
      return { ...ch, aliases: [...ch.aliases], customAttributes: { ...ch.customAttributes } };
    },

    listCharacters(projectId: string): Character[] {
      const result: Character[] = [];
      for (const ch of characters.values()) {
        if (ch.projectId === projectId) {
          result.push({ ...ch, aliases: [...ch.aliases], customAttributes: { ...ch.customAttributes } });
        }
      }
      return result;
    },

    searchCharacters(projectId: string, query: string): Character[] {
      if (!query) return this.listCharacters(projectId);
      const lowerQuery = query.toLowerCase();
      const result: Character[] = [];
      for (const ch of characters.values()) {
        if (ch.projectId !== projectId) continue;
        const nameMatch = ch.name.toLowerCase().includes(lowerQuery);
        const aliasMatch = ch.aliases.some((alias) => alias.toLowerCase().includes(lowerQuery));
        if (nameMatch || aliasMatch) {
          result.push({ ...ch, aliases: [...ch.aliases], customAttributes: { ...ch.customAttributes } });
        }
      }
      return result;
    },

    updateCharacter(id: string, updates: Partial<Omit<Character, 'id' | 'projectId'>>): void {
      const ch = characters.get(id);
      if (!ch) return;
      if (updates.name !== undefined) ch.name = updates.name;
      if (updates.aliases !== undefined) ch.aliases = [...updates.aliases];
      if (updates.appearance !== undefined) ch.appearance = updates.appearance;
      if (updates.personality !== undefined) ch.personality = updates.personality;
      if (updates.backstory !== undefined) ch.backstory = updates.backstory;
      if (updates.customAttributes !== undefined) ch.customAttributes = { ...updates.customAttributes };
    },

    deleteCharacter(id: string): void {
      const existed = characters.has(id);
      characters.delete(id);
      // 级联删除该角色的所有快照
      for (const [key, snapshot] of snapshots) {
        if (snapshot.characterId === id) {
          snapshots.delete(key);
        }
      }
      // 通过 EventBus 通知其他 Store 清理引用
      if (existed && eventBus) {
        eventBus.emit({ type: 'character:deleted', characterId: id });
      }
    },

    getSnapshotAtTimeline(characterId: string, timelinePointId: string): CharacterTimelineSnapshot | undefined {
      const key = snapshotKey(characterId, timelinePointId);
      const snap = snapshots.get(key);
      if (!snap) return undefined;
      return {
        ...snap,
        backstoryEvents: [...snap.backstoryEvents],
        customAttributes: { ...snap.customAttributes },
      };
    },

    setSnapshotAtTimeline(
      characterId: string,
      timelinePointId: string,
      data: Partial<Omit<CharacterTimelineSnapshot, 'id' | 'characterId' | 'timelinePointId'>>,
    ): void {
      const key = snapshotKey(characterId, timelinePointId);
      const existing = snapshots.get(key);
      if (existing) {
        if (data.appearance !== undefined) existing.appearance = data.appearance;
        if (data.personality !== undefined) existing.personality = data.personality;
        if (data.backstoryEvents !== undefined) existing.backstoryEvents = [...data.backstoryEvents];
        if (data.customAttributes !== undefined) existing.customAttributes = { ...data.customAttributes };
      } else {
        const snapshot: CharacterTimelineSnapshot = {
          id: crypto.randomUUID(),
          characterId,
          timelinePointId,
          appearance: data.appearance ?? '',
          personality: data.personality ?? '',
          backstoryEvents: data.backstoryEvents ? [...data.backstoryEvents] : [],
          customAttributes: data.customAttributes ? { ...data.customAttributes } : {},
        };
        snapshots.set(key, snapshot);
      }
    },
  };
}

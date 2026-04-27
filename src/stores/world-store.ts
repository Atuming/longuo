import type { WorldStore } from '../types/stores';
import type { WorldEntry, CustomWorldCategory } from '../types/world';
import { BUILT_IN_CATEGORIES, CUSTOM_CATEGORY_DEFAULT_COLOR } from '../types/world';
import type { EventBus } from '../types/event-bus';

/** 深拷贝一个 WorldEntry（防御性拷贝） */
function cloneEntry(entry: WorldEntry): WorldEntry {
  return {
    ...entry,
    associatedCharacterIds: [...entry.associatedCharacterIds],
  };
}

export interface CreateWorldStoreOptions {
  eventBus?: EventBus;
}

/**
 * 创建 WorldStore 实例。
 * 所有操作为同步内存操作，持久化由 ProjectStore 统一处理。
 * 可选传入 EventBus 以订阅角色删除事件保持同步。
 */
export function createWorldStore(options?: CreateWorldStoreOptions): WorldStore {
  const entries = new Map<string, WorldEntry>();
  const customCategories = new Map<string, CustomWorldCategory[]>();
  const eventBus = options?.eventBus;

  // 订阅角色删除事件，从所有 WorldEntry 的 associatedCharacterIds 中移除已删除角色 ID
  if (eventBus) {
    eventBus.on('character:deleted', (event) => {
      if (event.type !== 'character:deleted') return;
      const characterId = event.characterId;
      for (const entry of entries.values()) {
        const idx = entry.associatedCharacterIds.indexOf(characterId);
        if (idx !== -1) {
          entry.associatedCharacterIds.splice(idx, 1);
        }
      }
    });
  }

  return {
    createEntry(data: Omit<WorldEntry, 'id'>): WorldEntry {
      const entry: WorldEntry = {
        id: crypto.randomUUID(),
        projectId: data.projectId,
        type: data.type,
        name: data.name,
        description: data.description,
        associatedCharacterIds: [...data.associatedCharacterIds],
      };
      if (data.category !== undefined) {
        entry.category = data.category;
      }
      entries.set(entry.id, entry);
      return cloneEntry(entry);
    },

    getEntry(id: string): WorldEntry | undefined {
      const entry = entries.get(id);
      if (!entry) return undefined;
      return cloneEntry(entry);
    },

    listEntries(projectId: string): WorldEntry[] {
      const result: WorldEntry[] = [];
      for (const entry of entries.values()) {
        if (entry.projectId === projectId) {
          result.push(cloneEntry(entry));
        }
      }
      return result;
    },

    filterByType(projectId: string, type: WorldEntry['type']): WorldEntry[] {
      const result: WorldEntry[] = [];
      for (const entry of entries.values()) {
        if (entry.projectId === projectId && entry.type === type) {
          result.push(cloneEntry(entry));
        }
      }
      return result;
    },

    searchEntries(projectId: string, query: string): WorldEntry[] {
      if (!query) return this.listEntries(projectId);
      const lowerQuery = query.toLowerCase();
      const result: WorldEntry[] = [];
      for (const entry of entries.values()) {
        if (entry.projectId !== projectId) continue;
        if (entry.name.toLowerCase().includes(lowerQuery)) {
          result.push(cloneEntry(entry));
        }
      }
      return result;
    },

    updateEntry(id: string, updates: Partial<Omit<WorldEntry, 'id' | 'projectId'>>): void {
      const entry = entries.get(id);
      if (!entry) return;
      if (updates.type !== undefined) entry.type = updates.type;
      if (updates.name !== undefined) entry.name = updates.name;
      if (updates.description !== undefined) entry.description = updates.description;
      if (updates.category !== undefined) entry.category = updates.category;
      if (updates.associatedCharacterIds !== undefined) {
        entry.associatedCharacterIds = [...updates.associatedCharacterIds];
      }
    },

    deleteEntry(id: string): void {
      entries.delete(id);
    },

    listCustomCategories(projectId: string): CustomWorldCategory[] {
      return [...(customCategories.get(projectId) ?? [])];
    },

    addCustomCategory(projectId: string, label: string): CustomWorldCategory {
      const trimmed = label.trim();
      if (!trimmed) {
        throw new Error('分类名称不能为空');
      }

      // Check duplicate with built-in category labels
      if (BUILT_IN_CATEGORIES.some((c) => c.label === trimmed)) {
        throw new Error(`分类名称"${trimmed}"与内置分类重复`);
      }

      // Check duplicate with existing custom category labels
      const existing = customCategories.get(projectId) ?? [];
      if (existing.some((c) => c.label === trimmed)) {
        throw new Error(`分类名称"${trimmed}"已存在`);
      }

      const category: CustomWorldCategory = {
        key: crypto.randomUUID(),
        label: trimmed,
      };
      customCategories.set(projectId, [...existing, category]);
      return { ...category };
    },

    updateCustomCategory(projectId: string, key: string, label: string): void {
      const trimmed = label.trim();
      if (!trimmed) {
        throw new Error('分类名称不能为空');
      }

      if (BUILT_IN_CATEGORIES.some((c) => c.label === trimmed)) {
        throw new Error(`分类名称"${trimmed}"与内置分类重复`);
      }

      const existing = customCategories.get(projectId) ?? [];
      if (existing.some((c) => c.label === trimmed && c.key !== key)) {
        throw new Error(`分类名称"${trimmed}"已存在`);
      }

      const category = existing.find((c) => c.key === key);
      if (category) {
        category.label = trimmed;
      }
    },

    deleteCustomCategory(projectId: string, key: string): void {
      const existing = customCategories.get(projectId) ?? [];
      customCategories.set(
        projectId,
        existing.filter((c) => c.key !== key),
      );

      // Reset entries referencing this category to 'rule'
      for (const entry of entries.values()) {
        if (entry.projectId === projectId && entry.type === key) {
          entry.type = 'rule';
        }
      }
    },

    getAllCategories(projectId: string): Array<{ key: string; label: string; color: { bg: string; text: string }; isBuiltIn: boolean }> {
      const result: Array<{ key: string; label: string; color: { bg: string; text: string }; isBuiltIn: boolean }> = [];

      for (const cat of BUILT_IN_CATEGORIES) {
        result.push({ key: cat.key, label: cat.label, color: { ...cat.color }, isBuiltIn: true });
      }

      for (const cat of customCategories.get(projectId) ?? []) {
        result.push({ key: cat.key, label: cat.label, color: { ...CUSTOM_CATEGORY_DEFAULT_COLOR }, isBuiltIn: false });
      }

      return result;
    },
  };
}

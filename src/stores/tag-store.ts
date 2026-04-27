import type { TagStore } from '../types/stores';
import type { Tag, TagData } from '../types/tag';
import type { EventBus } from '../types/event-bus';

/** 预设标签 */
export const PRESET_TAGS = [
  { name: '草稿', color: '#A0AEC0' },
  { name: '已完稿', color: '#48BB78' },
  { name: '需润色', color: '#ED8936' },
  { name: '待修改', color: '#E53E3E' },
  { name: '高潮', color: '#9F7AEA' },
  { name: '伏笔', color: '#4299E1' },
];

/** 默认颜色调色板 */
export const DEFAULT_COLORS = [
  '#E53E3E', '#ED8936', '#ECC94B', '#48BB78',
  '#38B2AC', '#4299E1', '#667EEA', '#9F7AEA',
  '#ED64A6', '#A0AEC0',
];

/** 深拷贝一个 Tag（防御性拷贝） */
function cloneTag(tag: Tag): Tag {
  return { ...tag };
}

/** 颜色自动分配：按已有标签数量循环取色 */
function pickColor(existingCount: number): string {
  return DEFAULT_COLORS[existingCount % DEFAULT_COLORS.length];
}

/**
 * 创建 TagStore 实例。
 * 所有操作为同步内存操作，持久化由 ProjectStore 统一处理。
 * 传入 EventBus 以订阅章节删除事件实现级联清理。
 */
export function createTagStore(eventBus: EventBus): TagStore {
  const tags = new Map<string, Tag>();
  const chapterTagMap = new Map<string, Set<string>>();

  // 订阅章节删除事件，级联清除被删除章节的标签关联
  eventBus.on('chapter:deleted', (event) => {
    if (event.type !== 'chapter:deleted') return;
    for (const chapterId of event.chapterIds) {
      chapterTagMap.delete(chapterId);
    }
  });

  const store: TagStore = {
    createTag(projectId: string, name: string, color?: string): Tag {
      const trimmed = name.trim();
      if (!trimmed) {
        throw new Error('标签名称不能为空');
      }

      // 同项目内名称去重
      for (const t of tags.values()) {
        if (t.projectId === projectId && t.name === trimmed) {
          throw new Error(`标签名称"${trimmed}"已存在`);
        }
      }

      // 统计当前项目标签数量用于自动分配颜色
      let projectTagCount = 0;
      for (const t of tags.values()) {
        if (t.projectId === projectId) projectTagCount++;
      }

      const tag: Tag = {
        id: crypto.randomUUID(),
        projectId,
        name: trimmed,
        color: color ?? pickColor(projectTagCount),
      };
      tags.set(tag.id, tag);
      return cloneTag(tag);
    },

    getTag(id: string): Tag | undefined {
      const tag = tags.get(id);
      return tag ? cloneTag(tag) : undefined;
    },

    listTags(projectId: string): Tag[] {
      const result: Tag[] = [];
      for (const tag of tags.values()) {
        if (tag.projectId === projectId) {
          result.push(cloneTag(tag));
        }
      }
      return result;
    },

    updateTag(id: string, updates: Partial<Pick<Tag, 'name' | 'color'>>): void {
      const tag = tags.get(id);
      if (!tag) return;

      if (updates.name !== undefined) {
        const trimmed = updates.name.trim();
        if (!trimmed) {
          throw new Error('标签名称不能为空');
        }
        // 同项目内名称去重（排除自身）
        for (const t of tags.values()) {
          if (t.projectId === tag.projectId && t.name === trimmed && t.id !== id) {
            throw new Error(`标签名称"${trimmed}"已存在`);
          }
        }
        tag.name = trimmed;
      }

      if (updates.color !== undefined) {
        tag.color = updates.color;
      }
    },

    deleteTag(id: string): void {
      tags.delete(id);
      // 级联清除所有章节上该标签的关联
      for (const tagIds of chapterTagMap.values()) {
        tagIds.delete(id);
      }
    },

    addTagToChapter(chapterId: string, tagId: string): void {
      // 标签 ID 无效时静默忽略
      if (!tags.has(tagId)) return;

      let tagIds = chapterTagMap.get(chapterId);
      if (!tagIds) {
        tagIds = new Set();
        chapterTagMap.set(chapterId, tagIds);
      }
      tagIds.add(tagId);
    },

    removeTagFromChapter(chapterId: string, tagId: string): void {
      const tagIds = chapterTagMap.get(chapterId);
      if (tagIds) {
        tagIds.delete(tagId);
      }
    },

    getTagsForChapter(chapterId: string): Tag[] {
      const tagIds = chapterTagMap.get(chapterId);
      if (!tagIds) return [];
      const result: Tag[] = [];
      for (const tagId of tagIds) {
        const tag = tags.get(tagId);
        if (tag) {
          result.push(cloneTag(tag));
        }
      }
      return result;
    },

    getChapterIdsForTag(tagId: string): string[] {
      const result: string[] = [];
      for (const [chapterId, tagIds] of chapterTagMap) {
        if (tagIds.has(tagId)) {
          result.push(chapterId);
        }
      }
      return result;
    },

    ensurePresetTags(projectId: string): void {
      // 如果该项目已有标签，则不创建预设标签
      for (const t of tags.values()) {
        if (t.projectId === projectId) return;
      }
      for (const preset of PRESET_TAGS) {
        store.createTag(projectId, preset.name, preset.color);
      }
    },

    exportData(projectId: string): TagData {
      const projectTags: Tag[] = [];
      const projectTagIds = new Set<string>();
      for (const tag of tags.values()) {
        if (tag.projectId === projectId) {
          projectTags.push(cloneTag(tag));
          projectTagIds.add(tag.id);
        }
      }

      const exportMap: Record<string, string[]> = {};
      for (const [chapterId, tagIds] of chapterTagMap) {
        const filtered = [...tagIds].filter((id) => projectTagIds.has(id));
        if (filtered.length > 0) {
          exportMap[chapterId] = filtered;
        }
      }

      return { tags: projectTags, chapterTagMap: exportMap };
    },

    importData(data: TagData): void {
      try {
        if (!data || !Array.isArray(data.tags)) return;

        // 清空现有数据
        tags.clear();
        chapterTagMap.clear();

        for (const tag of data.tags) {
          if (tag && tag.id && tag.projectId && tag.name && tag.color) {
            tags.set(tag.id, { ...tag });
          }
        }

        if (data.chapterTagMap && typeof data.chapterTagMap === 'object') {
          for (const [chapterId, tagIds] of Object.entries(data.chapterTagMap)) {
            if (Array.isArray(tagIds)) {
              const validIds = tagIds.filter((id) => tags.has(id));
              if (validIds.length > 0) {
                chapterTagMap.set(chapterId, new Set(validIds));
              }
            }
          }
        }
      } catch {
        // 格式异常时回退到空状态
        tags.clear();
        chapterTagMap.clear();
      }
    },
  };

  return store;
}

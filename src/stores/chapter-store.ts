import type { ChapterStore } from '../types/stores';
import type { Chapter } from '../types/chapter';

/**
 * 去除 Markdown 标记后计算字数。
 * 中文字符每个算一个字，英文单词算一个字。
 */
export function countWords(content: string): number {
  if (!content) return 0;

  let text = content;

  // 去除 Markdown 标记
  // 标题符号
  text = text.replace(/^#{1,6}\s+/gm, '');
  // 粗体/斜体
  text = text.replace(/\*{1,3}(.+?)\*{1,3}/g, '$1');
  text = text.replace(/_{1,3}(.+?)_{1,3}/g, '$1');
  // 删除线
  text = text.replace(/~~(.+?)~~/g, '$1');
  // 代码块（必须在行内代码之前处理）
  text = text.replace(/```[^]*?```/g, '');
  // 行内代码（去除标记，保留内容）
  text = text.replace(/`([^`]+)`/g, '$1');
  // 链接 [text](url)
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  // 图片 ![alt](url)
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  // 引用
  text = text.replace(/^>\s+/gm, '');
  // 分隔线
  text = text.replace(/^[-*_]{3,}\s*$/gm, '');
  // 无序列表标记
  text = text.replace(/^[\s]*[-*+]\s+/gm, '');
  // 有序列表标记
  text = text.replace(/^[\s]*\d+\.\s+/gm, '');

  text = text.trim();
  if (!text) return 0;

  let count = 0;

  // 匹配中文字符（CJK统一汉字）
  const chineseChars = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g);
  if (chineseChars) {
    count += chineseChars.length;
  }

  // 去除中文字符后，计算英文单词
  const withoutChinese = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ');
  const englishWords = withoutChinese.split(/\s+/).filter((w) => /[a-zA-Z0-9]/.test(w));
  count += englishWords.length;

  return count;
}

/**
 * 创建 ChapterStore 实例。
 * 所有操作为同步内存操作，持久化由 ProjectStore 统一处理。
 */
export function createChapterStore(): ChapterStore {
  const chapters: Map<string, Chapter> = new Map();

  /**
   * 获取指定 parentId 下的最大 sortOrder，用于新建章节时自动排序。
   */
  function getMaxSortOrder(projectId: string, parentId: string | null): number {
    let max = -1;
    for (const ch of chapters.values()) {
      if (ch.projectId === projectId && ch.parentId === parentId) {
        if (ch.sortOrder > max) max = ch.sortOrder;
      }
    }
    return max;
  }

  /**
   * 递归收集所有后代节点 ID。
   */
  function collectDescendantIds(id: string): string[] {
    const result: string[] = [];
    for (const ch of chapters.values()) {
      if (ch.parentId === id) {
        result.push(ch.id);
        result.push(...collectDescendantIds(ch.id));
      }
    }
    return result;
  }

  /**
   * 深度优先遍历，返回按树形排序的章节列表。
   * 先按 parentId 分组，再按 sortOrder 排序。
   */
  function treeSort(projectId: string): Chapter[] {
    // 按 parentId 分组
    const childrenMap = new Map<string | null, Chapter[]>();
    for (const ch of chapters.values()) {
      if (ch.projectId !== projectId) continue;
      const key = ch.parentId;
      if (!childrenMap.has(key)) {
        childrenMap.set(key, []);
      }
      childrenMap.get(key)!.push(ch);
    }

    // 每组按 sortOrder 排序
    for (const children of childrenMap.values()) {
      children.sort((a, b) => a.sortOrder - b.sortOrder);
    }

    // 深度优先遍历
    const result: Chapter[] = [];
    function dfs(parentId: string | null): void {
      const children = childrenMap.get(parentId);
      if (!children) return;
      for (const child of children) {
        result.push(child);
        dfs(child.id);
      }
    }
    dfs(null);
    return result;
  }

  return {
    createChapter(projectId: string, parentId: string | null, title: string, level: Chapter['level']): Chapter {
      const sortOrder = getMaxSortOrder(projectId, parentId) + 1;
      const chapter: Chapter = {
        id: crypto.randomUUID(),
        projectId,
        parentId,
        title,
        content: '',
        sortOrder,
        level,
        wordCount: 0,
      };
      chapters.set(chapter.id, chapter);
      return { ...chapter };
    },

    getChapter(id: string): Chapter | undefined {
      const ch = chapters.get(id);
      return ch ? { ...ch } : undefined;
    },

    listChapters(projectId: string): Chapter[] {
      return treeSort(projectId).map((ch) => ({ ...ch }));
    },

    updateChapter(id: string, updates: Partial<Pick<Chapter, 'title' | 'content' | 'sortOrder' | 'parentId'>>): void {
      const ch = chapters.get(id);
      if (!ch) return;

      if (updates.title !== undefined) ch.title = updates.title;
      if (updates.sortOrder !== undefined) ch.sortOrder = updates.sortOrder;
      if (updates.parentId !== undefined) ch.parentId = updates.parentId;
      if (updates.content !== undefined) {
        ch.content = updates.content;
        ch.wordCount = countWords(updates.content);
      }
    },

    deleteChapter(id: string): void {
      const descendantIds = collectDescendantIds(id);
      // 删除所有后代
      for (const did of descendantIds) {
        chapters.delete(did);
      }
      // 删除自身
      chapters.delete(id);
    },

    reorderChapter(id: string, newSortOrder: number, newParentId?: string | null): void {
      const ch = chapters.get(id);
      if (!ch) return;

      const oldParentId = ch.parentId;
      const targetParentId = newParentId !== undefined ? newParentId : oldParentId;
      const isSameParent = targetParentId === oldParentId;

      if (isSameParent) {
        // 同一父节点内重排序
        const siblings: Chapter[] = [];
        for (const c of chapters.values()) {
          if (c.projectId === ch.projectId && c.parentId === oldParentId && c.id !== id) {
            siblings.push(c);
          }
        }
        siblings.sort((a, b) => a.sortOrder - b.sortOrder);

        // 插入到新位置
        const clamped = Math.max(0, Math.min(newSortOrder, siblings.length));
        siblings.splice(clamped, 0, ch);

        // 重新编号
        for (let i = 0; i < siblings.length; i++) {
          siblings[i].sortOrder = i;
        }
      } else {
        // 跨父节点移动
        // 1. 从旧父节点中移除，重新编号旧兄弟
        const oldSiblings: Chapter[] = [];
        for (const c of chapters.values()) {
          if (c.projectId === ch.projectId && c.parentId === oldParentId && c.id !== id) {
            oldSiblings.push(c);
          }
        }
        oldSiblings.sort((a, b) => a.sortOrder - b.sortOrder);
        for (let i = 0; i < oldSiblings.length; i++) {
          oldSiblings[i].sortOrder = i;
        }

        // 2. 插入到新父节点
        ch.parentId = targetParentId;
        const newSiblings: Chapter[] = [];
        for (const c of chapters.values()) {
          if (c.projectId === ch.projectId && c.parentId === targetParentId && c.id !== id) {
            newSiblings.push(c);
          }
        }
        newSiblings.sort((a, b) => a.sortOrder - b.sortOrder);

        const clamped = Math.max(0, Math.min(newSortOrder, newSiblings.length));
        newSiblings.splice(clamped, 0, ch);

        for (let i = 0; i < newSiblings.length; i++) {
          newSiblings[i].sortOrder = i;
        }
      }
    },

    getWordCount(id: string): number {
      const ch = chapters.get(id);
      return ch ? ch.wordCount : 0;
    },
  };
}

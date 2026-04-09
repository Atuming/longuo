import { describe, it, expect, beforeEach } from 'vitest';
import { createChapterStore, countWords } from './chapter-store';
import type { ChapterStore } from '../types/stores';

describe('countWords', () => {
  it('should return 0 for empty string', () => {
    expect(countWords('')).toBe(0);
  });

  it('should count Chinese characters individually', () => {
    expect(countWords('你好世界')).toBe(4);
  });

  it('should count English words', () => {
    expect(countWords('hello world')).toBe(2);
  });

  it('should count mixed Chinese and English', () => {
    // 4 Chinese chars + 1 English word
    expect(countWords('你好世界 hello')).toBe(5);
  });

  it('should strip Markdown headings', () => {
    expect(countWords('## 标题内容')).toBe(4);
  });

  it('should strip bold/italic markers', () => {
    expect(countWords('**加粗**和*斜体*')).toBe(5);
  });

  it('should strip links', () => {
    expect(countWords('[链接文字](https://example.com)')).toBe(4);
  });

  it('should strip blockquotes', () => {
    expect(countWords('> 引用内容')).toBe(4);
  });

  it('should strip horizontal rules', () => {
    expect(countWords('---')).toBe(0);
    expect(countWords('***')).toBe(0);
  });

  it('should strip code blocks', () => {
    expect(countWords('```\ncode\n```')).toBe(0);
  });

  it('should strip inline code markers but keep content', () => {
    // `code` → code (1 English word) + 使用(2) + 命令(2) = 5
    expect(countWords('使用 `code` 命令')).toBe(5);
  });

  it('should strip list markers', () => {
    // '- 列表项\n1. 有序项' → '列表项\n有序项' = 6 Chinese chars
    expect(countWords('- 列表项\n1. 有序项')).toBe(6);
  });
});

describe('ChapterStore', () => {
  let store: ChapterStore;
  const projectId = 'test-project-id';

  beforeEach(() => {
    store = createChapterStore();
  });

  describe('createChapter', () => {
    it('should create a volume at top level', () => {
      const ch = store.createChapter(projectId, null, '第一卷', 'volume');
      expect(ch.id).toBeDefined();
      expect(ch.projectId).toBe(projectId);
      expect(ch.parentId).toBeNull();
      expect(ch.title).toBe('第一卷');
      expect(ch.level).toBe('volume');
      expect(ch.content).toBe('');
      expect(ch.wordCount).toBe(0);
      expect(ch.sortOrder).toBe(0);
    });

    it('should auto-increment sortOrder for siblings', () => {
      const ch1 = store.createChapter(projectId, null, '卷一', 'volume');
      const ch2 = store.createChapter(projectId, null, '卷二', 'volume');
      expect(ch1.sortOrder).toBe(0);
      expect(ch2.sortOrder).toBe(1);
    });

    it('should create child chapters under a parent', () => {
      const vol = store.createChapter(projectId, null, '卷一', 'volume');
      const ch = store.createChapter(projectId, vol.id, '第一章', 'chapter');
      expect(ch.parentId).toBe(vol.id);
      expect(ch.level).toBe('chapter');
      expect(ch.sortOrder).toBe(0);
    });
  });

  describe('getChapter', () => {
    it('should return the chapter by id', () => {
      const created = store.createChapter(projectId, null, '测试', 'volume');
      const fetched = store.getChapter(created.id);
      expect(fetched).toEqual(created);
    });

    it('should return undefined for non-existent id', () => {
      expect(store.getChapter('non-existent')).toBeUndefined();
    });

    it('should return a copy (not a reference)', () => {
      const created = store.createChapter(projectId, null, '测试', 'volume');
      const fetched = store.getChapter(created.id)!;
      fetched.title = '修改后';
      expect(store.getChapter(created.id)!.title).toBe('测试');
    });
  });

  describe('listChapters', () => {
    it('should return empty array for no chapters', () => {
      expect(store.listChapters(projectId)).toEqual([]);
    });

    it('should return chapters in tree order (depth-first)', () => {
      const vol1 = store.createChapter(projectId, null, '卷一', 'volume');
      const ch1 = store.createChapter(projectId, vol1.id, '第一章', 'chapter');
      store.createChapter(projectId, ch1.id, '第一节', 'section');
      store.createChapter(projectId, vol1.id, '第二章', 'chapter');
      store.createChapter(projectId, null, '卷二', 'volume');

      const list = store.listChapters(projectId);
      const titles = list.map((c) => c.title);
      expect(titles).toEqual(['卷一', '第一章', '第一节', '第二章', '卷二']);
    });

    it('should not return chapters from other projects', () => {
      store.createChapter(projectId, null, '本项目', 'volume');
      store.createChapter('other-project', null, '其他项目', 'volume');
      const list = store.listChapters(projectId);
      expect(list).toHaveLength(1);
      expect(list[0].title).toBe('本项目');
    });
  });

  describe('updateChapter', () => {
    it('should update title', () => {
      const ch = store.createChapter(projectId, null, '旧标题', 'volume');
      store.updateChapter(ch.id, { title: '新标题' });
      expect(store.getChapter(ch.id)!.title).toBe('新标题');
    });

    it('should update content and sync wordCount', () => {
      const ch = store.createChapter(projectId, null, '测试', 'volume');
      store.updateChapter(ch.id, { content: '你好世界 hello' });
      const updated = store.getChapter(ch.id)!;
      expect(updated.content).toBe('你好世界 hello');
      expect(updated.wordCount).toBe(5);
    });

    it('should do nothing for non-existent id', () => {
      // Should not throw
      store.updateChapter('non-existent', { title: '不存在' });
    });
  });

  describe('deleteChapter', () => {
    it('should delete a single chapter', () => {
      const ch = store.createChapter(projectId, null, '测试', 'volume');
      store.deleteChapter(ch.id);
      expect(store.getChapter(ch.id)).toBeUndefined();
    });

    it('should cascade delete all descendants', () => {
      const vol = store.createChapter(projectId, null, '卷一', 'volume');
      const ch = store.createChapter(projectId, vol.id, '第一章', 'chapter');
      const sec = store.createChapter(projectId, ch.id, '第一节', 'section');

      store.deleteChapter(vol.id);
      expect(store.getChapter(vol.id)).toBeUndefined();
      expect(store.getChapter(ch.id)).toBeUndefined();
      expect(store.getChapter(sec.id)).toBeUndefined();
    });

    it('should not affect siblings', () => {
      const vol1 = store.createChapter(projectId, null, '卷一', 'volume');
      const vol2 = store.createChapter(projectId, null, '卷二', 'volume');
      store.deleteChapter(vol1.id);
      expect(store.getChapter(vol1.id)).toBeUndefined();
      expect(store.getChapter(vol2.id)).toBeDefined();
    });
  });

  describe('reorderChapter', () => {
    it('should reorder within same parent', () => {
      store.createChapter(projectId, null, 'A', 'volume');
      store.createChapter(projectId, null, 'B', 'volume');
      const ch3 = store.createChapter(projectId, null, 'C', 'volume');

      // Move C to position 0
      store.reorderChapter(ch3.id, 0);

      const list = store.listChapters(projectId);
      expect(list.map((c) => c.title)).toEqual(['C', 'A', 'B']);
    });

    it('should move chapter to a different parent', () => {
      const vol1 = store.createChapter(projectId, null, '卷一', 'volume');
      const vol2 = store.createChapter(projectId, null, '卷二', 'volume');
      const ch = store.createChapter(projectId, vol1.id, '第一章', 'chapter');

      store.reorderChapter(ch.id, 0, vol2.id);

      const moved = store.getChapter(ch.id)!;
      expect(moved.parentId).toBe(vol2.id);

      const list = store.listChapters(projectId);
      const titles = list.map((c) => c.title);
      expect(titles).toEqual(['卷一', '卷二', '第一章']);
    });

    it('should produce continuous sortOrder after reorder', () => {
      store.createChapter(projectId, null, 'A', 'volume');
      store.createChapter(projectId, null, 'B', 'volume');
      store.createChapter(projectId, null, 'C', 'volume');
      store.createChapter(projectId, null, 'D', 'volume');

      const list1 = store.listChapters(projectId);
      // Move D to position 1
      store.reorderChapter(list1[3].id, 1);

      const list2 = store.listChapters(projectId);
      const orders = list2.filter((c) => c.parentId === null).map((c) => c.sortOrder);
      expect(orders).toEqual([0, 1, 2, 3]);
    });
  });

  describe('getWordCount', () => {
    it('should return 0 for new chapter', () => {
      const ch = store.createChapter(projectId, null, '测试', 'volume');
      expect(store.getWordCount(ch.id)).toBe(0);
    });

    it('should return correct count after content update', () => {
      const ch = store.createChapter(projectId, null, '测试', 'volume');
      store.updateChapter(ch.id, { content: '这是一段测试文字' });
      expect(store.getWordCount(ch.id)).toBe(8);
    });

    it('should return 0 for non-existent chapter', () => {
      expect(store.getWordCount('non-existent')).toBe(0);
    });
  });
});

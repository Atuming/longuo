import { describe, it, expect } from 'vitest';
import { createExportEngine, stripMarkdown, sanitizeFilename, escapeHtml } from './export-engine';
import type { Chapter } from '../types/chapter';
import JSZip from 'jszip';

function makeChapter(title: string, content: string, sortOrder = 0): Chapter {
  return {
    id: crypto.randomUUID(),
    projectId: 'proj-1',
    parentId: null,
    title,
    content,
    sortOrder,
    level: 'chapter',
    wordCount: 0,
  };
}

describe('stripMarkdown', () => {
  it('should return empty string for empty input', () => {
    expect(stripMarkdown('')).toBe('');
  });

  it('should remove heading markers', () => {
    expect(stripMarkdown('# 标题')).toBe('标题');
    expect(stripMarkdown('## 二级标题')).toBe('二级标题');
    expect(stripMarkdown('### 三级')).toBe('三级');
  });

  it('should remove bold markers', () => {
    expect(stripMarkdown('**粗体**文字')).toBe('粗体文字');
    expect(stripMarkdown('__粗体__文字')).toBe('粗体文字');
  });

  it('should remove italic markers', () => {
    expect(stripMarkdown('*斜体*文字')).toBe('斜体文字');
    expect(stripMarkdown('_斜体_文字')).toBe('斜体文字');
  });

  it('should remove strikethrough markers', () => {
    expect(stripMarkdown('~~删除~~文字')).toBe('删除文字');
  });

  it('should remove blockquote markers', () => {
    expect(stripMarkdown('> 引用内容')).toBe('引用内容');
  });

  it('should remove horizontal rules', () => {
    expect(stripMarkdown('---').trim()).toBe('');
  });

  it('should remove link syntax keeping text', () => {
    expect(stripMarkdown('[链接](http://example.com)')).toBe('链接');
  });

  it('should remove image syntax keeping alt text', () => {
    expect(stripMarkdown('![图片](http://example.com/img.png)')).toBe('图片');
  });

  it('should remove inline code markers', () => {
    expect(stripMarkdown('`代码`文字')).toBe('代码文字');
  });

  it('should remove code blocks', () => {
    expect(stripMarkdown('```\ncode\n```')).toBe('');
  });

  it('should remove list markers', () => {
    expect(stripMarkdown('- 列表项')).toBe('列表项');
    expect(stripMarkdown('* 列表项')).toBe('列表项');
    expect(stripMarkdown('1. 列表项')).toBe('列表项');
  });
});

describe('sanitizeFilename', () => {
  it('should replace illegal characters with underscores', () => {
    expect(sanitizeFilename('第一章/第二节')).toBe('第一章_第二节');
    expect(sanitizeFilename('a\\b:c*d?e"f<g>h|i')).toBe('a_b_c_d_e_f_g_h_i');
  });

  it('should not modify valid filenames', () => {
    expect(sanitizeFilename('第一章 开始')).toBe('第一章 开始');
    expect(sanitizeFilename('chapter-01')).toBe('chapter-01');
  });
});

describe('ExportEngine', () => {
  const engine = createExportEngine();

  describe('chaptersToMarkdown', () => {
    it('should produce markdown with title and author', () => {
      const chapters = [makeChapter('第一章', '内容一')];
      const md = engine.chaptersToMarkdown(chapters, '我的小说', '作者名');
      expect(md).toContain('# 我的小说');
      expect(md).toContain('作者：作者名');
      expect(md).toContain('---');
    });

    it('should include all chapters in order', () => {
      const chapters = [
        makeChapter('第一章', '内容一', 0),
        makeChapter('第二章', '内容二', 1),
      ];
      const md = engine.chaptersToMarkdown(chapters, '小说', '作者');
      const idx1 = md.indexOf('## 第一章');
      const idx2 = md.indexOf('## 第二章');
      expect(idx1).toBeGreaterThan(-1);
      expect(idx2).toBeGreaterThan(idx1);
    });

    it('should include chapter content', () => {
      const chapters = [makeChapter('第一章', '这是第一章的内容')];
      const md = engine.chaptersToMarkdown(chapters, '小说', '作者');
      expect(md).toContain('这是第一章的内容');
    });

    it('should handle empty chapters', () => {
      const chapters = [makeChapter('空章节', '')];
      const md = engine.chaptersToMarkdown(chapters, '小说', '作者');
      expect(md).toContain('## 空章节');
    });
  });

  describe('parseMarkdownToChapters', () => {
    it('should parse markdown back to chapters', () => {
      const chapters = [
        makeChapter('第一章', '内容一'),
        makeChapter('第二章', '内容二'),
      ];
      const md = engine.chaptersToMarkdown(chapters, '小说', '作者');
      const parsed = engine.parseMarkdownToChapters(md);
      expect(parsed.length).toBe(2);
      expect(parsed[0].title).toBe('第一章');
      expect(parsed[0].content).toBe('内容一');
      expect(parsed[1].title).toBe('第二章');
      expect(parsed[1].content).toBe('内容二');
    });

    it('should handle roundtrip with multiple chapters', () => {
      const chapters = [
        makeChapter('序章', '故事开始了'),
        makeChapter('第一章 相遇', '他们在雨中相遇'),
        makeChapter('第二章 离别', '最终还是分开了'),
      ];
      const md = engine.chaptersToMarkdown(chapters, '测试小说', '测试作者');
      const parsed = engine.parseMarkdownToChapters(md);
      expect(parsed.length).toBe(3);
      for (let i = 0; i < chapters.length; i++) {
        expect(parsed[i].title).toBe(chapters[i].title);
        expect(parsed[i].content).toBe(chapters[i].content);
      }
    });

    it('should handle empty content chapters', () => {
      const md = '# 小说\n作者：作者\n---\n## 空章节';
      const parsed = engine.parseMarkdownToChapters(md);
      expect(parsed.length).toBe(1);
      expect(parsed[0].title).toBe('空章节');
      expect(parsed[0].content).toBe('');
    });
  });

  describe('exportChaptersAsTxt', () => {
    it('should generate a ZIP blob', async () => {
      const chapters = [makeChapter('第一章', '内容一')];
      const blob = await engine.exportChaptersAsTxt(chapters);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(0);
    });

    it('should contain TXT files for each chapter', async () => {
      const chapters = [
        makeChapter('第一章', '内容一'),
        makeChapter('第二章', '**粗体**内容二'),
      ];
      const blob = await engine.exportChaptersAsTxt(chapters);
      const zip = await JSZip.loadAsync(blob);
      const files = Object.keys(zip.files);
      expect(files).toContain('第一章.txt');
      expect(files).toContain('第二章.txt');
    });

    it('should strip markdown from TXT content', async () => {
      const chapters = [makeChapter('测试', '## 标题\n**粗体**内容')];
      const blob = await engine.exportChaptersAsTxt(chapters);
      const zip = await JSZip.loadAsync(blob);
      const content = await zip.file('测试.txt')!.async('string');
      expect(content).not.toContain('##');
      expect(content).not.toContain('**');
      expect(content).toContain('标题');
      expect(content).toContain('粗体内容');
    });

    it('should sanitize filenames with illegal characters', async () => {
      const chapters = [makeChapter('第一章/第二节', '内容')];
      const blob = await engine.exportChaptersAsTxt(chapters);
      const zip = await JSZip.loadAsync(blob);
      const files = Object.keys(zip.files);
      expect(files).toContain('第一章_第二节.txt');
    });
  });

  describe('exportProject', () => {
    it('should export as markdown', async () => {
      const chapters = [makeChapter('第一章', '内容')];
      const result = await engine.exportProject(chapters, {
        format: 'markdown',
        title: '小说',
        author: '作者',
      });
      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Blob);
    });

    it('should export as chapter-txt', async () => {
      const chapters = [makeChapter('第一章', '内容')];
      const result = await engine.exportProject(chapters, {
        format: 'chapter-txt',
        title: '小说',
        author: '作者',
      });
      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Blob);
    });

    it('should export as pdf', async () => {
      const chapters = [makeChapter('第一章', '这是第一章的内容')];
      const result = await engine.exportProject(chapters, {
        format: 'pdf',
        title: '测试小说',
        author: '测试作者',
      });
      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Blob);
      expect(result.data!.size).toBeGreaterThan(0);
    });

    it('should export as epub', async () => {
      const chapters = [makeChapter('第一章', '这是第一章的内容')];
      const result = await engine.exportProject(chapters, {
        format: 'epub',
        title: '测试小说',
        author: '测试作者',
      });
      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Blob);
      expect(result.data!.size).toBeGreaterThan(0);
    });

    it('should include chapters in epub zip', async () => {
      const chapters = [
        makeChapter('第一章', '内容一'),
        makeChapter('第二章', '内容二'),
      ];
      const result = await engine.exportProject(chapters, {
        format: 'epub',
        title: '小说',
        author: '作者',
      });
      expect(result.success).toBe(true);
      const zip = await JSZip.loadAsync(result.data!);
      expect(zip.file('mimetype')).not.toBeNull();
      expect(zip.file('META-INF/container.xml')).not.toBeNull();
      expect(zip.file('OEBPS/content.opf')).not.toBeNull();
      expect(zip.file('OEBPS/toc.xhtml')).not.toBeNull();
      expect(zip.file('OEBPS/chapter1.xhtml')).not.toBeNull();
      expect(zip.file('OEBPS/chapter2.xhtml')).not.toBeNull();
    });

    it('should include title and author in epub metadata', async () => {
      const chapters = [makeChapter('第一章', '内容')];
      const result = await engine.exportProject(chapters, {
        format: 'epub',
        title: '我的小说',
        author: '张三',
      });
      const zip = await JSZip.loadAsync(result.data!);
      const opf = await zip.file('OEBPS/content.opf')!.async('string');
      expect(opf).toContain('我的小说');
      expect(opf).toContain('张三');
    });

    it('should handle pdf export with multiple chapters', async () => {
      const chapters = [
        makeChapter('第一章', '内容一'),
        makeChapter('第二章', '内容二'),
        makeChapter('第三章', '内容三'),
      ];
      const result = await engine.exportProject(chapters, {
        format: 'pdf',
        title: '长篇小说',
        author: '作者',
      });
      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Blob);
    });

    it('should handle empty chapters in pdf', async () => {
      const chapters = [makeChapter('空章节', '')];
      const result = await engine.exportProject(chapters, {
        format: 'pdf',
        title: '小说',
        author: '作者',
      });
      expect(result.success).toBe(true);
    });

    it('should handle empty chapters in epub', async () => {
      const chapters = [makeChapter('空章节', '')];
      const result = await engine.exportProject(chapters, {
        format: 'epub',
        title: '小说',
        author: '作者',
      });
      expect(result.success).toBe(true);
    });

    it('should return error for unsupported format', async () => {
      const chapters = [makeChapter('第一章', '内容')];
      const result = await engine.exportProject(chapters, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        format: 'unknown' as any,
        title: '小说',
        author: '作者',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

describe('escapeHtml', () => {
  it('should escape HTML special characters', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
    expect(escapeHtml("it's")).toBe("it&#39;s");
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('should not modify plain text', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});

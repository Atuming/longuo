import type { ExportEngine } from '../types/engines';
import type { Chapter } from '../types/chapter';
import type { ExportOptions, ExportResult } from '../types/export';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';

/**
 * 去除 Markdown 标记，返回纯文本。
 * 与 chapter-store.ts 中的 countWords 使用相同的去除逻辑。
 */
export function stripMarkdown(content: string): string {
  if (!content) return '';

  let text = content;

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
  // 图片 ![alt](url) — 必须在链接之前处理
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  // 链接 [text](url)
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  // 引用
  text = text.replace(/^>\s+/gm, '');
  // 分隔线
  text = text.replace(/^[-*_]{3,}\s*$/gm, '');
  // 无序列表标记
  text = text.replace(/^[\s]*[-*+]\s+/gm, '');
  // 有序列表标记
  text = text.replace(/^[\s]*\d+\.\s+/gm, '');

  return text;
}

/**
 * 将文件名中的非法字符替换为下划线。
 * 非法字符：/ \ : * ? " < > |
 */
export function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_');
}

/**
 * 转义 HTML 特殊字符。
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 创建 ExportEngine 实例。
 */
export function createExportEngine(): ExportEngine {
  function chaptersToMarkdown(chapters: Chapter[], title: string, author: string): string {
    const lines: string[] = [];

    lines.push(`# ${title}`);
    lines.push(`作者：${author}`);
    lines.push('---');

    for (const chapter of chapters) {
      lines.push(`## ${chapter.title}`);
      if (chapter.content) {
        lines.push(chapter.content);
      }
    }

    return lines.join('\n');
  }

  function parseMarkdownToChapters(markdown: string): Chapter[] {
    const chapters: Chapter[] = [];

    // 按 ## 标题分割
    const lines = markdown.split('\n');
    let currentTitle: string | null = null;
    let currentContentLines: string[] = [];
    let headerPassed = false;

    for (const line of lines) {
      // 跳过文件头部（# 标题、作者行、---）
      if (!headerPassed) {
        if (line.startsWith('# ') && !line.startsWith('## ')) {
          continue;
        }
        if (line.startsWith('作者：')) {
          continue;
        }
        if (line.trim() === '---') {
          headerPassed = true;
          continue;
        }
      }

      if (line.startsWith('## ')) {
        // 保存前一个章节
        if (currentTitle !== null) {
          chapters.push(makeChapter(currentTitle, currentContentLines));
        }
        currentTitle = line.substring(3);
        currentContentLines = [];
      } else if (currentTitle !== null) {
        currentContentLines.push(line);
      }
    }

    // 保存最后一个章节
    if (currentTitle !== null) {
      chapters.push(makeChapter(currentTitle, currentContentLines));
    }

    return chapters;
  }

  function makeChapter(title: string, contentLines: string[]): Chapter {
    const content = contentLines.join('\n');
    return {
      id: '',
      projectId: '',
      parentId: null,
      title,
      content,
      sortOrder: 0,
      level: 'chapter',
      wordCount: 0,
    };
  }

  async function exportChaptersAsTxt(chapters: Chapter[]): Promise<Blob> {
    const zip = new JSZip();

    for (const chapter of chapters) {
      const filename = sanitizeFilename(chapter.title) + '.txt';
      const plainText = stripMarkdown(chapter.content);
      zip.file(filename, plainText);
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    return blob;
  }

  async function exportProject(chapters: Chapter[], options: ExportOptions): Promise<ExportResult> {
    try {
      switch (options.format) {
        case 'markdown': {
          const md = chaptersToMarkdown(chapters, options.title, options.author);
          const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
          return { success: true, data: blob };
        }
        case 'chapter-txt': {
          const blob = await exportChaptersAsTxt(chapters);
          return { success: true, data: blob };
        }
        case 'pdf': {
          return await exportAsPdf(chapters, options);
        }
        case 'epub': {
          return await exportAsEpub(chapters, options);
        }
        default:
          return { success: false, error: `不支持的导出格式: ${options.format}` };
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage };
    }
  }

  // PDF 导出：使用 jsPDF 生成
  async function exportAsPdf(chapters: Chapter[], options: ExportOptions): Promise<ExportResult> {
    let partialDoc: jsPDF | null = null;
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      partialDoc = doc;

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      // 标题页
      doc.setFontSize(24);
      y = pageHeight / 3;
      const titleLines = doc.splitTextToSize(options.title, contentWidth);
      doc.text(titleLines, pageWidth / 2, y, { align: 'center' });
      y += titleLines.length * 10 + 10;

      doc.setFontSize(14);
      doc.text(`作者：${options.author}`, pageWidth / 2, y, { align: 'center' });

      // 章节内容
      for (const chapter of chapters) {
        doc.addPage();
        y = margin;

        // 章节标题
        doc.setFontSize(18);
        const chapterTitleLines = doc.splitTextToSize(chapter.title, contentWidth);
        doc.text(chapterTitleLines, margin, y);
        y += chapterTitleLines.length * 8 + 8;

        // 章节内容（去除 Markdown 标记）
        doc.setFontSize(12);
        const plainText = stripMarkdown(chapter.content);
        if (plainText) {
          const textLines = doc.splitTextToSize(plainText, contentWidth);
          const lineHeight = 6;

          for (const line of textLines) {
            if (y + lineHeight > pageHeight - margin) {
              doc.addPage();
              y = margin;
            }
            doc.text(line, margin, y);
            y += lineHeight;
          }
        }
      }

      const blob = doc.output('blob');
      return { success: true, data: blob };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      // 尝试保留部分内容
      let partialData: Blob | undefined;
      if (partialDoc) {
        try {
          partialData = partialDoc.output('blob');
        } catch {
          // 忽略部分内容生成失败
        }
      }
      return { success: false, error: errorMessage, partialData };
    }
  }

  // EPUB 导出：使用简单的 HTML 打包方案
  // epub-gen-memory 在浏览器环境可能有兼容问题，使用 JSZip 打包 HTML 作为简单方案
  async function exportAsEpub(chapters: Chapter[], options: ExportOptions): Promise<ExportResult> {
    let partialZip: JSZip | null = null;
    try {
      const zip = new JSZip();
      partialZip = zip;

      // EPUB 基本结构
      // mimetype 文件（不压缩）
      zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

      // META-INF/container.xml
      zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

      // 生成章节 HTML 文件
      const chapterFiles: { id: string; filename: string; title: string }[] = [];
      for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i];
        const filename = `chapter${i + 1}.xhtml`;
        const id = `chapter${i + 1}`;
        const plainText = stripMarkdown(chapter.content);
        const paragraphs = plainText.split('\n').filter((l) => l.trim()).map((l) => `    <p>${escapeHtml(l)}</p>`).join('\n');

        zip.file(`OEBPS/${filename}`, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${escapeHtml(chapter.title)}</title></head>
<body>
  <h1>${escapeHtml(chapter.title)}</h1>
${paragraphs}
</body>
</html>`);

        chapterFiles.push({ id, filename, title: chapter.title });
      }

      // 目录页
      zip.file('OEBPS/toc.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>目录</title></head>
<body>
  <nav epub:type="toc">
    <h1>目录</h1>
    <ol>
${chapterFiles.map((c) => `      <li><a href="${c.filename}">${escapeHtml(c.title)}</a></li>`).join('\n')}
    </ol>
  </nav>
</body>
</html>`);

      // content.opf
      const manifestItems = chapterFiles
        .map((c) => `    <item id="${c.id}" href="${c.filename}" media-type="application/xhtml+xml"/>`)
        .join('\n');
      const spineItems = chapterFiles
        .map((c) => `    <itemref idref="${c.id}"/>`)
        .join('\n');

      zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${escapeHtml(options.title)}</dc:title>
    <dc:creator>${escapeHtml(options.author)}</dc:creator>
    <dc:language>zh</dc:language>
    <dc:identifier id="bookid">urn:uuid:${crypto.randomUUID()}</dc:identifier>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
    <item id="toc" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>
${manifestItems}
  </manifest>
  <spine>
    <itemref idref="toc"/>
${spineItems}
  </spine>
</package>`);

      const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
      return { success: true, data: blob };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      let partialData: Blob | undefined;
      if (partialZip) {
        try {
          partialData = await partialZip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
        } catch {
          // 忽略部分内容生成失败
        }
      }
      return { success: false, error: errorMessage, partialData };
    }
  }

  return {
    exportProject,
    chaptersToMarkdown,
    parseMarkdownToChapters,
    exportChaptersAsTxt,
  };
}

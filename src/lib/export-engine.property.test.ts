import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { escapeHtml, sanitizeFilename, stripMarkdown } from './export-engine';

// ── helpers ──────────────────────────────────────────────────────────

/** Pool of general characters for building arbitrary strings. */
const generalChars = '这是一段普通的中文文本用于测试火龙果编辑器的导出功能abcdefghijklmnopqrstuvwxyz0123456789 \t\n'.split('');

/** HTML special characters. */
const htmlSpecialChars = ['<', '>', '&', '"', "'"];

/** Filesystem-illegal characters. */
const illegalFilenameChars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];

/**
 * Build an arbitrary string from a mixed pool of normal + special characters.
 */
function mixedStringArb(specialPool: string[]) {
  const pool = [...generalChars, ...specialPool];
  return fc
    .array(fc.constantFrom(...pool), { minLength: 0, maxLength: 80 })
    .map((chars) => chars.join(''));
}

// ── Property 12: HTML 转义完整性 ─────────────────────────────────────

describe('Feature: comprehensive-quality-audit, Property 12: HTML 转义完整性', () => {
  /**
   * **Validates: Requirements 7.2**
   *
   * For any string containing HTML special characters (<, >, &, ", '),
   * escapeHtml output should not contain bare (unescaped) special characters.
   */
  it('should not contain bare HTML special characters in output', () => {
    fc.assert(
      fc.property(mixedStringArb(htmlSpecialChars), (input) => {
        const output = escapeHtml(input);

        // Remove all known escape sequences, then verify no bare specials remain
        const stripped = output
          .replace(/&amp;/g, '')
          .replace(/&lt;/g, '')
          .replace(/&gt;/g, '')
          .replace(/&quot;/g, '')
          .replace(/&#39;/g, '');

        expect(stripped).not.toContain('<');
        expect(stripped).not.toContain('>');
        expect(stripped).not.toContain('&');
        expect(stripped).not.toContain('"');
        expect(stripped).not.toContain("'");
      }),
      { numRuns: 100 }
    );
  });
});

// ── Property 13: 文件名清理完整性 ────────────────────────────────────

describe('Feature: comprehensive-quality-audit, Property 13: 文件名清理完整性', () => {
  /**
   * **Validates: Requirements 7.3**
   *
   * For any string, sanitizeFilename output should not contain
   * filesystem-illegal characters: / \ : * ? " < > |
   */
  it('should not contain illegal filesystem characters in output', () => {
    fc.assert(
      fc.property(mixedStringArb(illegalFilenameChars), (input) => {
        const output = sanitizeFilename(input);

        for (const ch of illegalFilenameChars) {
          expect(output).not.toContain(ch);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ── Property 14: Markdown 标记去除完整性 ──────────────────────────────

describe('Feature: comprehensive-quality-audit, Property 14: Markdown 标记去除完整性', () => {
  /**
   * **Validates: Requirements 7.4**
   *
   * For any Markdown content, stripMarkdown output should not contain
   * Markdown syntax markers like #, *, _, ~~, ```, >, ---, list markers, etc.
   */
  it('should not contain Markdown syntax markers in output', () => {
    const plainChars = '这是一段普通的中文文本用于测试火龙果编辑器的导出功能'.split('');

    const plainTextArb = fc
      .array(fc.constantFrom(...plainChars), { minLength: 1, maxLength: 15 })
      .map((chars) => chars.join(''));

    const markdownBlockArb = fc.oneof(
      // Headings
      plainTextArb.map((t) => `# ${t}`),
      plainTextArb.map((t) => `## ${t}`),
      plainTextArb.map((t) => `### ${t}`),
      // Bold
      plainTextArb.map((t) => `**${t}**`),
      plainTextArb.map((t) => `__${t}__`),
      // Italic
      plainTextArb.map((t) => `*${t}*`),
      plainTextArb.map((t) => `_${t}_`),
      // Strikethrough
      plainTextArb.map((t) => `~~${t}~~`),
      // Inline code
      plainTextArb.map((t) => `\`${t}\``),
      // Code block
      plainTextArb.map((t) => `\`\`\`\n${t}\n\`\`\``),
      // Blockquote
      plainTextArb.map((t) => `> ${t}`),
      // Horizontal rule
      fc.constant('---'),
      fc.constant('***'),
      fc.constant('___'),
      // Unordered list
      plainTextArb.map((t) => `- ${t}`),
      plainTextArb.map((t) => `* ${t}`),
      plainTextArb.map((t) => `+ ${t}`),
      // Ordered list
      plainTextArb.map((t) => `1. ${t}`),
      // Link
      plainTextArb.map((t) => `[${t}](http://example.com)`),
      // Image
      plainTextArb.map((t) => `![${t}](http://example.com/img.png)`),
      // Plain text (no markers)
      plainTextArb
    );

    const markdownContentArb = fc
      .array(markdownBlockArb, { minLength: 1, maxLength: 6 })
      .map((blocks) => blocks.join('\n'));

    fc.assert(
      fc.property(markdownContentArb, (content) => {
        const output = stripMarkdown(content);

        // Should not contain heading markers at line start
        expect(output).not.toMatch(/^#{1,6}\s+/m);
        // Should not contain bold/italic markers wrapping text
        expect(output).not.toMatch(/\*{1,3}[^*]+\*{1,3}/);
        // Check per-line to avoid false positives across newlines
        for (const line of output.split('\n')) {
          expect(line).not.toMatch(/_{1,3}[^_]+_{1,3}/);
        }
        // Should not contain strikethrough
        expect(output).not.toMatch(/~~.+~~/);
        // Should not contain code blocks
        expect(output).not.toMatch(/```[^]*?```/);
        // Should not contain inline code
        expect(output).not.toMatch(/`[^`]+`/);
        // Should not contain blockquote markers at line start
        expect(output).not.toMatch(/^>\s+/m);
        // Should not contain horizontal rules (standalone lines of ---, ***, ___)
        expect(output).not.toMatch(/^[-*_]{3,}\s*$/m);
        // Should not contain unordered list markers at line start
        expect(output).not.toMatch(/^[\s]*[-*+]\s+/m);
        // Should not contain ordered list markers at line start
        expect(output).not.toMatch(/^[\s]*\d+\.\s+/m);
        // Should not contain link syntax
        expect(output).not.toMatch(/\[([^\]]*)\]\([^)]*\)/);
        // Should not contain image syntax
        expect(output).not.toMatch(/!\[([^\]]*)\]\([^)]*\)/);
      }),
      { numRuns: 100 }
    );
  });
});

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// Feature: ux-enhancements, Property 1: 光标插入保持周围文本不变
// Feature: ux-enhancements, Property 2: 选区替换保持周围文本不变

/**
 * Pure text insertion logic (mirrors WritingEditor.insertAtCursor behavior).
 * Extracted as a pure function for property-based testing.
 */
function insertAtPosition(doc: string, position: number, content: string): string {
  const clamped = Math.max(0, Math.min(position, doc.length));
  return doc.slice(0, clamped) + content + doc.slice(clamped);
}

/**
 * Pure text replacement logic (mirrors WritingEditor selection replacement).
 */
function replaceSelection(doc: string, from: number, to: number, content: string): string {
  const clampedFrom = Math.max(0, Math.min(from, doc.length));
  const clampedTo = Math.max(clampedFrom, Math.min(to, doc.length));
  return doc.slice(0, clampedFrom) + content + doc.slice(clampedTo);
}

describe('Property 1: 光标插入保持周围文本不变', () => {
  it('inserting text at any position preserves text before and after the insertion point', () => {
    fc.assert(
      fc.property(
        fc.string(),                          // document content
        fc.string({ minLength: 1 }),          // content to insert (non-empty)
        fc.nat(),                             // raw cursor position
        (doc, content, rawPos) => {
          const pos = doc.length === 0 ? 0 : rawPos % (doc.length + 1);
          const result = insertAtPosition(doc, pos, content);

          // Text before insertion point is unchanged
          expect(result.slice(0, pos)).toBe(doc.slice(0, pos));
          // Inserted content is at the right position
          expect(result.slice(pos, pos + content.length)).toBe(content);
          // Text after insertion point is unchanged
          expect(result.slice(pos + content.length)).toBe(doc.slice(pos));
          // Total length is correct
          expect(result.length).toBe(doc.length + content.length);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('inserting at position 0 prepends content', () => {
    fc.assert(
      fc.property(fc.string(), fc.string({ minLength: 1 }), (doc, content) => {
        const result = insertAtPosition(doc, 0, content);
        expect(result).toBe(content + doc);
      }),
      { numRuns: 100 },
    );
  });

  it('inserting at end of document appends content', () => {
    fc.assert(
      fc.property(fc.string(), fc.string({ minLength: 1 }), (doc, content) => {
        const result = insertAtPosition(doc, doc.length, content);
        expect(result).toBe(doc + content);
      }),
      { numRuns: 100 },
    );
  });
});


describe('Property 2: 选区替换保持周围文本不变', () => {
  it('replacing a selection preserves text before and after the selection', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),          // document (non-empty for valid selection)
        fc.string(),                          // replacement content
        fc.nat(),                             // raw from
        fc.nat(),                             // raw to
        (doc, replacement, rawFrom, rawTo) => {
          // Ensure from < to within valid range
          const from = rawFrom % doc.length;
          const to = Math.min(from + 1 + (rawTo % Math.max(1, doc.length - from)), doc.length);

          const result = replaceSelection(doc, from, to, replacement);

          // Text before selection is unchanged
          expect(result.slice(0, from)).toBe(doc.slice(0, from));
          // Replacement content is at the right position
          expect(result.slice(from, from + replacement.length)).toBe(replacement);
          // Text after selection is unchanged
          expect(result.slice(from + replacement.length)).toBe(doc.slice(to));
          // Result equals concatenation
          expect(result).toBe(doc.slice(0, from) + replacement + doc.slice(to));
        },
      ),
      { numRuns: 200 },
    );
  });

  it('replacing with empty string removes the selection', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 2 }),
        fc.nat(),
        fc.nat(),
        (doc, rawFrom, rawTo) => {
          const from = rawFrom % (doc.length - 1);
          const to = Math.min(from + 1 + (rawTo % Math.max(1, doc.length - from - 1)), doc.length);

          const result = replaceSelection(doc, from, to, '');
          expect(result).toBe(doc.slice(0, from) + doc.slice(to));
          expect(result.length).toBe(doc.length - (to - from));
        },
      ),
      { numRuns: 100 },
    );
  });
});

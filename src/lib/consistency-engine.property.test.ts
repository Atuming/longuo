import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createConsistencyEngine } from './consistency-engine';
import type { Character } from '../types/character';
import type { ConsistencyIssue } from '../types/consistency';

// ── helpers ──────────────────────────────────────────────────────────

function makeCharacter(name: string, aliases: string[] = []): Character {
  return {
    id: crypto.randomUUID(),
    projectId: 'proj-1',
    name,
    aliases,
    appearance: '',
    personality: '',
    backstory: '',
    customAttributes: {},
  };
}

/**
 * Arbitrary: Chinese character name of length 2-4.
 */
const chineseCharPool = '张李王赵刘陈杨黄周吴徐孙马朱胡林郭何高罗明华强伟芳秀英敏静丽娟桂珍玉兰'.split('');

const chineseNameArb = fc
  .integer({ min: 2, max: 4 })
  .chain((len) =>
    fc.tuple(...Array.from({ length: len }, () => fc.constantFrom(...chineseCharPool)))
      .map((chars) => chars.join(''))
  );

/**
 * Arbitrary: filler text from common Chinese characters (no overlap with name pool).
 */
const fillerChars = '的了是在不有人这中大为上个国我以要时来用们生到作地于出会下而过子后也年走说去能十好那得里着没看天起真都把开让给动正将很回什么事只想已经头面手前所进被些门无心'.split('');

const fillerTextArb = fc
  .array(fc.constantFrom(...fillerChars), { minLength: 0, maxLength: 20 })
  .map((chars) => chars.join(''));

const engine = createConsistencyEngine();

// ── Property 9: 一致性引擎精确匹配排除 ──────────────────────────────

describe('Feature: comprehensive-quality-audit, Property 9: 一致性引擎精确匹配排除', () => {
  /**
   * **Validates: Requirements 9.4, 9.5**
   *
   * For any character name and chapter content containing exact matches of that name,
   * ConsistencyEngine.checkChapter should NOT report exact matches as issues.
   */
  it('should not report exact character name matches as issues', () => {
    fc.assert(
      fc.property(
        chineseNameArb,
        fc.array(fillerTextArb, { minLength: 1, maxLength: 5 }),
        (name, fillerParts) => {
          // Build content that contains exact matches of the name surrounded by filler text
          const content = fillerParts.join(name);
          const characters = [makeCharacter(name)];

          const issues = engine.checkChapter(content, characters);

          // No issue should have foundText that exactly equals the character name
          for (const issue of issues) {
            expect(issue.foundText).not.toBe(name);
          }

          // No issue should overlap with an exact match position with same length
          const exactPositions: Array<{ offset: number; length: number }> = [];
          let searchFrom = 0;
          while (true) {
            const idx = content.indexOf(name, searchFrom);
            if (idx === -1) break;
            exactPositions.push({ offset: idx, length: name.length });
            searchFrom = idx + 1;
          }

          for (const issue of issues) {
            const isExactMatchPosition = exactPositions.some(
              (pos) => pos.offset === issue.offset && pos.length === issue.length
            );
            expect(isExactMatchPosition).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not report exact matches even with multiple characters', () => {
    fc.assert(
      fc.property(
        fc.array(chineseNameArb, { minLength: 1, maxLength: 4 }),
        (names) => {
          const uniqueNames = [...new Set(names)];
          if (uniqueNames.length === 0) return;

          const content = uniqueNames.join('说了一句话然后');
          const characters = uniqueNames.map((n) => makeCharacter(n));

          const issues = engine.checkChapter(content, characters);

          const nameSet = new Set(uniqueNames);
          for (const issue of issues) {
            expect(nameSet.has(issue.foundText)).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Property 10: 一致性引擎无重复报告 ────────────────────────────────

describe('Feature: comprehensive-quality-audit, Property 10: 一致性引擎无重复报告', () => {
  /**
   * **Validates: Requirements 9.6**
   *
   * For any chapter content and character list, the issues returned by checkChapter
   * should never contain two issues with the same offset AND length.
   */
  it('should not return duplicate offset+length pairs in issues', () => {
    const contentChars = [...fillerChars, ...chineseCharPool];
    const contentArb = fc
      .array(fc.constantFrom(...contentChars), { minLength: 5, maxLength: 60 })
      .map((chars) => chars.join(''));

    fc.assert(
      fc.property(
        fc.array(chineseNameArb, { minLength: 1, maxLength: 4 }),
        contentArb,
        (names, content) => {
          const uniqueNames = [...new Set(names)];
          const characters = uniqueNames.map((n) => makeCharacter(n));

          const issues = engine.checkChapter(content, characters);

          const seen = new Set<string>();
          for (const issue of issues) {
            const key = `${issue.offset}:${issue.length}`;
            expect(seen.has(key)).toBe(false);
            seen.add(key);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Property 11: applySuggestion 精确替换 ─────────────────────────────

describe('Feature: comprehensive-quality-audit, Property 11: applySuggestion 精确替换', () => {
  /**
   * **Validates: Requirements 9.7**
   *
   * For any chapter content and a valid ConsistencyIssue, applySuggestion should
   * only replace the text at the specified offset+length with suggestedName.
   * The rest of the content must remain unchanged.
   */
  it('should only modify text at the specified offset and length', () => {
    const prefixArb = fc
      .array(fc.constantFrom(...fillerChars), { minLength: 0, maxLength: 20 })
      .map((chars) => chars.join(''));
    const suffixArb = fc
      .array(fc.constantFrom(...fillerChars), { minLength: 0, maxLength: 20 })
      .map((chars) => chars.join(''));

    fc.assert(
      fc.property(
        prefixArb,
        chineseNameArb,
        suffixArb,
        chineseNameArb,
        (prefix, foundText, suffix, suggestedName) => {
          const content = prefix + foundText + suffix;
          const offset = prefix.length;

          const issue: ConsistencyIssue = {
            chapterId: '',
            offset,
            length: foundText.length,
            foundText,
            suggestedName,
            similarity: 0.8,
            ignored: false,
          };

          const result = engine.applySuggestion(content, issue);

          // The prefix should be unchanged
          expect(result.substring(0, offset)).toBe(prefix);

          // The replacement should be the suggestedName
          expect(result.substring(offset, offset + suggestedName.length)).toBe(suggestedName);

          // The suffix should be unchanged
          expect(result.substring(offset + suggestedName.length)).toBe(suffix);

          // Total length should be correct
          expect(result.length).toBe(prefix.length + suggestedName.length + suffix.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

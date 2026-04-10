import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { findCharacterMatches, filterCharacters, escapeRegExp } from './cross-reference';
import type { Character } from '../types/character';

// Feature: ux-enhancements, Property 9: 角色名匹配
// Feature: ux-enhancements, Property 10: 自动补全过滤

/** Helper: create a minimal Character object */
function makeCharacter(id: string, name: string, aliases: string[] = []): Character {
  return {
    id,
    projectId: 'test',
    name,
    aliases,
    appearance: '',
    personality: '',
    backstory: '',
    customAttributes: {},
  };
}

/** Arbitrary: simple non-empty name without regex special chars (for predictable matching) */
const arbSimpleName = fc.string({ minLength: 1, maxLength: 10 })
  .filter((s) => /^[\u4e00-\u9fff\w]+$/.test(s) && s.trim().length > 0);

describe('escapeRegExp', () => {
  it('escaping and using in RegExp should match the original string literally', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (str) => {
        const escaped = escapeRegExp(str);
        const regex = new RegExp(escaped);
        // The original string should match the escaped regex
        expect(regex.test(str)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});

describe('Property 9: 角色名匹配', () => {
  it('all embedded character names are found at correct positions', () => {
    fc.assert(
      fc.property(
        arbSimpleName,
        arbSimpleName,
        fc.string({ maxLength: 20 }),
        fc.string({ maxLength: 20 }),
        (name1, name2, prefix, suffix) => {
          // Skip if names overlap to avoid ambiguous matching
          if (name1.includes(name2) || name2.includes(name1)) return;

          const characters = [
            makeCharacter('c1', name1),
            makeCharacter('c2', name2),
          ];
          const text = `${prefix}${name1}${suffix}${name2}`;

          const matches = findCharacterMatches(text, characters);

          // Should find both names
          const matchedTexts = matches.map((m) => text.slice(m.from, m.to));
          expect(matchedTexts).toContain(name1);
          expect(matchedTexts).toContain(name2);

          // Each match position should correctly correspond to the character name
          for (const match of matches) {
            const matchedText = text.slice(match.from, match.to);
            const char = characters.find((c) => c.id === match.characterId);
            expect(char).toBeDefined();
            expect(matchedText === char!.name || char!.aliases.includes(matchedText)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns empty array for empty character list', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        expect(findCharacterMatches(text, [])).toEqual([]);
      }),
      { numRuns: 50 },
    );
  });

  it('returns empty array for empty text', () => {
    fc.assert(
      fc.property(arbSimpleName, (name) => {
        const characters = [makeCharacter('c1', name)];
        expect(findCharacterMatches('', characters)).toEqual([]);
      }),
      { numRuns: 50 },
    );
  });
});


describe('Property 10: 自动补全过滤', () => {
  it('every returned character has name or alias containing the query', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: arbSimpleName,
            aliases: fc.array(arbSimpleName, { maxLength: 3 }),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        fc.string({ maxLength: 5 }),
        (charSpecs, query) => {
          const characters = charSpecs.map((spec, i) =>
            makeCharacter(`c${i}`, spec.name, spec.aliases),
          );

          const filtered = filterCharacters(characters, query);
          const lowerQuery = query.toLowerCase();

          // Property A: every result matches the query
          for (const ch of filtered) {
            const nameMatches = ch.name.toLowerCase().includes(lowerQuery);
            const aliasMatches = ch.aliases.some((a) => a.toLowerCase().includes(lowerQuery));
            expect(nameMatches || aliasMatches).toBe(true);
          }

          // Property B: no matching characters were missed
          for (const ch of characters) {
            const nameMatches = ch.name.toLowerCase().includes(lowerQuery);
            const aliasMatches = ch.aliases.some((a) => a.toLowerCase().includes(lowerQuery));
            if (nameMatches || aliasMatches) {
              expect(filtered.some((f) => f.id === ch.id)).toBe(true);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('empty query returns all characters', () => {
    fc.assert(
      fc.property(
        fc.array(arbSimpleName, { minLength: 1, maxLength: 5 }),
        (names) => {
          const characters = names.map((n, i) => makeCharacter(`c${i}`, n));
          const filtered = filterCharacters(characters, '');
          expect(filtered.length).toBe(characters.length);
        },
      ),
      { numRuns: 50 },
    );
  });
});

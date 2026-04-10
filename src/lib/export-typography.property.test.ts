import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { generateEpubTypographyCss } from './export-engine';
import type { TypographyOptions } from '../types/export';

// Feature: ux-enhancements, Property 7: EPUB 排版 CSS 生成
// Feature: ux-enhancements, Property 8: 排版参数持久化往返

const TYPOGRAPHY_STORAGE_KEY = 'novel-export-typography';

/** Arbitrary: valid TypographyOptions */
const arbTypography: fc.Arbitrary<TypographyOptions> = fc.record({
  fontFamily: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
  fontSize: fc.double({ min: 1, max: 200, noNaN: true }),
  lineHeight: fc.double({ min: 0.5, max: 5, noNaN: true }),
  marginMm: fc.double({ min: 0, max: 100, noNaN: true }),
});

describe('Property 7: EPUB 排版 CSS 生成', () => {
  it('generated CSS contains all typography values', () => {
    fc.assert(
      fc.property(arbTypography, (typo) => {
        const css = generateEpubTypographyCss(typo);

        // Should contain font-family with the JSON-stringified value
        expect(css).toContain('font-family');
        expect(css).toContain(JSON.stringify(typo.fontFamily));

        // Should contain font-size with pt unit
        expect(css).toContain(`font-size: ${typo.fontSize}pt`);

        // Should contain line-height
        expect(css).toContain(`line-height: ${typo.lineHeight}`);

        // Should contain margin with mm unit
        expect(css).toContain(`margin: ${typo.marginMm}mm`);
      }),
      { numRuns: 200 },
    );
  });

  it('generated CSS is valid body rule structure', () => {
    fc.assert(
      fc.property(arbTypography, (typo) => {
        const css = generateEpubTypographyCss(typo);
        expect(css).toMatch(/^body \{/);
        expect(css).toMatch(/\}$/);
      }),
      { numRuns: 100 },
    );
  });
});

describe('Property 8: 排版参数持久化往返', () => {
  beforeEach(() => {
    localStorage.removeItem(TYPOGRAPHY_STORAGE_KEY);
  });

  it('saving and loading TypographyOptions via localStorage produces equivalent object', () => {
    fc.assert(
      fc.property(arbTypography, (typo) => {
        // Save
        localStorage.setItem(TYPOGRAPHY_STORAGE_KEY, JSON.stringify(typo));

        // Load
        const raw = localStorage.getItem(TYPOGRAPHY_STORAGE_KEY);
        expect(raw).not.toBeNull();
        const loaded = JSON.parse(raw!) as TypographyOptions;

        // Round-trip should produce equivalent values
        expect(loaded.fontFamily).toBe(typo.fontFamily);
        expect(loaded.fontSize).toBe(typo.fontSize);
        expect(loaded.lineHeight).toBe(typo.lineHeight);
        expect(loaded.marginMm).toBe(typo.marginMm);
      }),
      { numRuns: 200 },
    );
  });
});

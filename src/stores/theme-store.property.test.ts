import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { createThemeStore, resolveEffectiveTheme } from './theme-store';
import type { ThemeMode } from '../types/theme';

// Feature: ux-enhancements, Property 6: 主题偏好持久化往返

const arbThemeMode: fc.Arbitrary<ThemeMode> = fc.constantFrom('light', 'dark', 'system');

describe('Property 6: 主题偏好持久化往返', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('setTheme then getTheme returns the same value', () => {
    fc.assert(
      fc.property(arbThemeMode, (mode) => {
        const store = createThemeStore();
        store.setTheme(mode);
        expect(store.getTheme()).toBe(mode);
      }),
      { numRuns: 100 },
    );
  });

  it('multiple set/get cycles always return the last set value', () => {
    fc.assert(
      fc.property(fc.array(arbThemeMode, { minLength: 1, maxLength: 10 }), (modes) => {
        const store = createThemeStore();
        for (const mode of modes) {
          store.setTheme(mode);
        }
        expect(store.getTheme()).toBe(modes[modes.length - 1]);
      }),
      { numRuns: 100 },
    );
  });

  it('resolveEffectiveTheme always returns light or dark', () => {
    fc.assert(
      fc.property(arbThemeMode, fc.boolean(), (mode, systemDark) => {
        const result = resolveEffectiveTheme(mode, systemDark);
        expect(['light', 'dark']).toContain(result);

        if (mode === 'light') expect(result).toBe('light');
        if (mode === 'dark') expect(result).toBe('dark');
        if (mode === 'system') expect(result).toBe(systemDark ? 'dark' : 'light');
      }),
      { numRuns: 100 },
    );
  });
});

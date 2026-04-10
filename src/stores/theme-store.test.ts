import { describe, it, expect, beforeEach } from 'vitest';
import { createThemeStore, resolveEffectiveTheme } from './theme-store';


describe('ThemeStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getTheme / setTheme', () => {
    it('defaults to system when nothing stored', () => {
      const store = createThemeStore();
      expect(store.getTheme()).toBe('system');
    });

    it('persists and retrieves light', () => {
      const store = createThemeStore();
      store.setTheme('light');
      expect(store.getTheme()).toBe('light');
    });

    it('persists and retrieves dark', () => {
      const store = createThemeStore();
      store.setTheme('dark');
      expect(store.getTheme()).toBe('dark');
    });

    it('persists and retrieves system', () => {
      const store = createThemeStore();
      store.setTheme('dark');
      store.setTheme('system');
      expect(store.getTheme()).toBe('system');
    });

    it('returns system for invalid stored value', () => {
      localStorage.setItem('novel-theme-preference', 'invalid');
      const store = createThemeStore();
      expect(store.getTheme()).toBe('system');
    });

    it('uses correct localStorage key', () => {
      const store = createThemeStore();
      store.setTheme('dark');
      expect(localStorage.getItem('novel-theme-preference')).toBe('dark');
    });
  });

  describe('getEffectiveTheme', () => {
    it('returns light when theme is light', () => {
      const store = createThemeStore();
      store.setTheme('light');
      expect(store.getEffectiveTheme()).toBe('light');
    });

    it('returns dark when theme is dark', () => {
      const store = createThemeStore();
      store.setTheme('dark');
      expect(store.getEffectiveTheme()).toBe('dark');
    });
  });

  describe('resolveEffectiveTheme (pure function)', () => {
    it('light mode always resolves to light', () => {
      expect(resolveEffectiveTheme('light', false)).toBe('light');
      expect(resolveEffectiveTheme('light', true)).toBe('light');
    });

    it('dark mode always resolves to dark', () => {
      expect(resolveEffectiveTheme('dark', false)).toBe('dark');
      expect(resolveEffectiveTheme('dark', true)).toBe('dark');
    });

    it('system mode follows system preference', () => {
      expect(resolveEffectiveTheme('system', false)).toBe('light');
      expect(resolveEffectiveTheme('system', true)).toBe('dark');
    });
  });
});

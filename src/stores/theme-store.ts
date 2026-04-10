import type { ThemeMode, ThemeStore } from '../types/theme';

const STORAGE_KEY = 'novel-theme-preference';
const VALID_MODES: ThemeMode[] = ['light', 'dark', 'system'];

function readTheme(): ThemeMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && VALID_MODES.includes(raw as ThemeMode)) {
      return raw as ThemeMode;
    }
  } catch {
    // localStorage 不可用：回退到 system
  }
  return 'system';
}

function writeTheme(mode: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // localStorage 写入失败时静默降级
  }
}

/**
 * 检测系统是否偏好暗色模式。
 * matchMedia 不支持时默认返回 false（亮色模式）。
 */
export function getSystemPrefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

/**
 * 根据 ThemeMode 解析出实际的 'light' | 'dark'。
 * 纯函数，方便测试。
 */
export function resolveEffectiveTheme(
  mode: ThemeMode,
  systemPrefersDark: boolean,
): 'light' | 'dark' {
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  // mode === 'system'
  return systemPrefersDark ? 'dark' : 'light';
}

/**
 * 创建 ThemeStore 实例。
 * 使用 localStorage key `novel-theme-preference` 持久化。
 */
export function createThemeStore(): ThemeStore {
  return {
    getTheme(): ThemeMode {
      return readTheme();
    },

    setTheme(mode: ThemeMode): void {
      writeTheme(mode);
    },

    getEffectiveTheme(): 'light' | 'dark' {
      const mode = readTheme();
      return resolveEffectiveTheme(mode, getSystemPrefersDark());
    },
  };
}

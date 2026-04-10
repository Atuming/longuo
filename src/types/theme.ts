/**
 * 主题模式类型。
 * - 'light': 亮色模式
 * - 'dark': 暗色模式
 * - 'system': 跟随系统偏好
 */
export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeStore {
  getTheme(): ThemeMode;
  setTheme(mode: ThemeMode): void;
  /** 解析 system 后的实际主题 */
  getEffectiveTheme(): 'light' | 'dark';
}

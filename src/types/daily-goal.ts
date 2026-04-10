/**
 * 日更目标配置。
 * 以自然日（YYYY-MM-DD）为单位统计当日写作字数。
 */
export interface DailyGoalConfig {
  /** 目标字数，0 表示未设置 */
  goalWordCount: number;
  /** 基准日期 YYYY-MM-DD */
  baselineDate: string;
  /** 基准日开始时的总字数 */
  baselineWordCount: number;
}

export interface DailyGoalStore {
  getConfig(projectId: string): DailyGoalConfig;
  setGoal(projectId: string, goal: number): void;
  getBaselineWordCount(projectId: string): number;
  updateBaseline(projectId: string, currentTotalWords: number): void;
  getTodayWritten(projectId: string, currentTotalWords: number): number;
}

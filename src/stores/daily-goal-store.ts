import type { DailyGoalConfig, DailyGoalStore } from '../types/daily-goal';

const DEFAULT_CONFIG: DailyGoalConfig = {
  goalWordCount: 0,
  baselineDate: '',
  baselineWordCount: 0,
};

/**
 * 获取当前自然日，格式 YYYY-MM-DD。
 */
export function getTodayDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function storageKey(projectId: string): string {
  return `novel-daily-goal-${projectId}`;
}

function readConfig(projectId: string): DailyGoalConfig {
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw) as DailyGoalConfig;
    return {
      goalWordCount: typeof parsed.goalWordCount === 'number' ? parsed.goalWordCount : 0,
      baselineDate: typeof parsed.baselineDate === 'string' ? parsed.baselineDate : '',
      baselineWordCount: typeof parsed.baselineWordCount === 'number' ? parsed.baselineWordCount : 0,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function writeConfig(projectId: string, config: DailyGoalConfig): void {
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(config));
  } catch {
    // localStorage 写入失败时静默降级
  }
}

/**
 * 核心计算逻辑：根据基准日期和当前日期计算今日已写字数。
 * 纯函数，方便测试。
 */
export function computeTodayWritten(
  config: DailyGoalConfig,
  currentTotalWords: number,
  today: string,
): { todayWritten: number; updatedConfig: DailyGoalConfig | null } {
  if (config.baselineDate === today) {
    // 同一天：今日已写 = 当前总字数 - 基准字数
    return {
      todayWritten: Math.max(0, currentTotalWords - config.baselineWordCount),
      updatedConfig: null,
    };
  }
  // 日期变更：重置基准为当前总字数，今日已写 = 0
  const newConfig: DailyGoalConfig = {
    ...config,
    baselineDate: today,
    baselineWordCount: currentTotalWords,
  };
  return {
    todayWritten: 0,
    updatedConfig: newConfig,
  };
}

/**
 * 创建 DailyGoalStore 实例。
 * 使用 localStorage 持久化，以 `novel-daily-goal-{projectId}` 为键。
 */
export function createDailyGoalStore(): DailyGoalStore {
  return {
    getConfig(projectId: string): DailyGoalConfig {
      return readConfig(projectId);
    },

    setGoal(projectId: string, goal: number): void {
      const config = readConfig(projectId);
      config.goalWordCount = Math.max(0, Math.floor(goal));
      writeConfig(projectId, config);
    },

    getBaselineWordCount(projectId: string): number {
      return readConfig(projectId).baselineWordCount;
    },

    updateBaseline(projectId: string, currentTotalWords: number): void {
      const config = readConfig(projectId);
      const today = getTodayDate();
      if (config.baselineDate !== today) {
        config.baselineDate = today;
        config.baselineWordCount = currentTotalWords;
        writeConfig(projectId, config);
      }
    },

    getTodayWritten(projectId: string, currentTotalWords: number): number {
      const config = readConfig(projectId);
      const today = getTodayDate();
      const { todayWritten, updatedConfig } = computeTodayWritten(config, currentTotalWords, today);
      if (updatedConfig) {
        writeConfig(projectId, updatedConfig);
      }
      return todayWritten;
    },
  };
}

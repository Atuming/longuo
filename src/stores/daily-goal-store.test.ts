import { describe, it, expect, beforeEach } from 'vitest';
import { createDailyGoalStore, computeTodayWritten, getTodayDate } from './daily-goal-store';
import type { DailyGoalConfig } from '../types/daily-goal';

describe('DailyGoalStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getConfig', () => {
    it('returns default config when nothing stored', () => {
      const store = createDailyGoalStore();
      const config = store.getConfig('proj-1');
      expect(config).toEqual({
        goalWordCount: 0,
        baselineDate: '',
        baselineWordCount: 0,
      });
    });

    it('returns stored config', () => {
      const stored: DailyGoalConfig = {
        goalWordCount: 1000,
        baselineDate: '2025-01-15',
        baselineWordCount: 500,
      };
      localStorage.setItem('novel-daily-goal-proj-1', JSON.stringify(stored));
      const store = createDailyGoalStore();
      expect(store.getConfig('proj-1')).toEqual(stored);
    });

    it('returns default config on corrupted localStorage data', () => {
      localStorage.setItem('novel-daily-goal-proj-1', 'not-json');
      const store = createDailyGoalStore();
      const config = store.getConfig('proj-1');
      expect(config).toEqual({
        goalWordCount: 0,
        baselineDate: '',
        baselineWordCount: 0,
      });
    });
  });

  describe('setGoal', () => {
    it('persists goal to localStorage', () => {
      const store = createDailyGoalStore();
      store.setGoal('proj-1', 2000);
      const config = store.getConfig('proj-1');
      expect(config.goalWordCount).toBe(2000);
    });

    it('clamps negative goal to 0', () => {
      const store = createDailyGoalStore();
      store.setGoal('proj-1', -100);
      expect(store.getConfig('proj-1').goalWordCount).toBe(0);
    });

    it('floors fractional goal', () => {
      const store = createDailyGoalStore();
      store.setGoal('proj-1', 1500.7);
      expect(store.getConfig('proj-1').goalWordCount).toBe(1500);
    });
  });

  describe('getBaselineWordCount', () => {
    it('returns 0 when no baseline set', () => {
      const store = createDailyGoalStore();
      expect(store.getBaselineWordCount('proj-1')).toBe(0);
    });

    it('returns stored baseline', () => {
      const stored: DailyGoalConfig = {
        goalWordCount: 1000,
        baselineDate: '2025-01-15',
        baselineWordCount: 3000,
      };
      localStorage.setItem('novel-daily-goal-proj-1', JSON.stringify(stored));
      const store = createDailyGoalStore();
      expect(store.getBaselineWordCount('proj-1')).toBe(3000);
    });
  });

  describe('updateBaseline', () => {
    it('sets baseline when date differs', () => {
      const store = createDailyGoalStore();
      // Set an old baseline
      const old: DailyGoalConfig = {
        goalWordCount: 1000,
        baselineDate: '2020-01-01',
        baselineWordCount: 100,
      };
      localStorage.setItem('novel-daily-goal-proj-1', JSON.stringify(old));

      store.updateBaseline('proj-1', 5000);
      const config = store.getConfig('proj-1');
      expect(config.baselineDate).toBe(getTodayDate());
      expect(config.baselineWordCount).toBe(5000);
      expect(config.goalWordCount).toBe(1000); // preserved
    });

    it('does not update baseline when date is today', () => {
      const store = createDailyGoalStore();
      const today = getTodayDate();
      const existing: DailyGoalConfig = {
        goalWordCount: 500,
        baselineDate: today,
        baselineWordCount: 200,
      };
      localStorage.setItem('novel-daily-goal-proj-1', JSON.stringify(existing));

      store.updateBaseline('proj-1', 9999);
      const config = store.getConfig('proj-1');
      expect(config.baselineWordCount).toBe(200); // unchanged
    });
  });

  describe('getTodayWritten', () => {
    it('returns difference when baseline date is today', () => {
      const store = createDailyGoalStore();
      const today = getTodayDate();
      const config: DailyGoalConfig = {
        goalWordCount: 1000,
        baselineDate: today,
        baselineWordCount: 300,
      };
      localStorage.setItem('novel-daily-goal-proj-1', JSON.stringify(config));

      expect(store.getTodayWritten('proj-1', 800)).toBe(500);
    });

    it('returns 0 and resets baseline when date differs', () => {
      const store = createDailyGoalStore();
      const config: DailyGoalConfig = {
        goalWordCount: 1000,
        baselineDate: '2020-01-01',
        baselineWordCount: 300,
      };
      localStorage.setItem('novel-daily-goal-proj-1', JSON.stringify(config));

      expect(store.getTodayWritten('proj-1', 800)).toBe(0);
      // Baseline should now be reset
      const updated = store.getConfig('proj-1');
      expect(updated.baselineDate).toBe(getTodayDate());
      expect(updated.baselineWordCount).toBe(800);
    });

    it('returns 0 when current total is less than baseline (deletion)', () => {
      const store = createDailyGoalStore();
      const today = getTodayDate();
      const config: DailyGoalConfig = {
        goalWordCount: 1000,
        baselineDate: today,
        baselineWordCount: 500,
      };
      localStorage.setItem('novel-daily-goal-proj-1', JSON.stringify(config));

      expect(store.getTodayWritten('proj-1', 300)).toBe(0);
    });
  });

  describe('project isolation', () => {
    it('stores configs independently per project', () => {
      const store = createDailyGoalStore();
      store.setGoal('proj-a', 1000);
      store.setGoal('proj-b', 2000);
      expect(store.getConfig('proj-a').goalWordCount).toBe(1000);
      expect(store.getConfig('proj-b').goalWordCount).toBe(2000);
    });
  });
});

describe('computeTodayWritten (pure function)', () => {
  it('same date: returns currentTotal - baseline', () => {
    const config: DailyGoalConfig = {
      goalWordCount: 1000,
      baselineDate: '2025-07-01',
      baselineWordCount: 200,
    };
    const result = computeTodayWritten(config, 700, '2025-07-01');
    expect(result.todayWritten).toBe(500);
    expect(result.updatedConfig).toBeNull();
  });

  it('different date: resets baseline and returns 0', () => {
    const config: DailyGoalConfig = {
      goalWordCount: 1000,
      baselineDate: '2025-07-01',
      baselineWordCount: 200,
    };
    const result = computeTodayWritten(config, 700, '2025-07-02');
    expect(result.todayWritten).toBe(0);
    expect(result.updatedConfig).toEqual({
      goalWordCount: 1000,
      baselineDate: '2025-07-02',
      baselineWordCount: 700,
    });
  });

  it('same date with deletion: clamps to 0', () => {
    const config: DailyGoalConfig = {
      goalWordCount: 500,
      baselineDate: '2025-07-01',
      baselineWordCount: 1000,
    };
    const result = computeTodayWritten(config, 800, '2025-07-01');
    expect(result.todayWritten).toBe(0);
    expect(result.updatedConfig).toBeNull();
  });
});

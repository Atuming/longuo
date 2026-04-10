import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeTodayWritten } from './daily-goal-store';


// Feature: ux-enhancements, Property 3: 日更字数差值计算与日期边界

/** Arbitrary: YYYY-MM-DD date string */
const arbDateStr = fc
  .record({
    y: fc.integer({ min: 2020, max: 2030 }),
    m: fc.integer({ min: 1, max: 12 }),
    d: fc.integer({ min: 1, max: 28 }),
  })
  .map(({ y, m, d }) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);

/** Arbitrary: valid DailyGoalConfig */
const arbConfig = fc.record({
  goalWordCount: fc.nat({ max: 10000 }),
  baselineDate: arbDateStr,
  baselineWordCount: fc.nat({ max: 100000 }),
});

describe('Property 3: 日更字数差值计算与日期边界', () => {
  it('same date: todayWritten = max(0, currentTotal - baseline)', () => {
    fc.assert(
      fc.property(arbConfig, fc.nat({ max: 200000 }), (config, currentTotal) => {
        const result = computeTodayWritten(config, currentTotal, config.baselineDate);

        expect(result.todayWritten).toBe(Math.max(0, currentTotal - config.baselineWordCount));
        expect(result.updatedConfig).toBeNull();
      }),
      { numRuns: 200 },
    );
  });

  it('different date: todayWritten = 0 and baseline resets', () => {
    fc.assert(
      fc.property(
        arbConfig,
        arbDateStr,
        fc.nat({ max: 200000 }),
        (config, today, currentTotal) => {
          // Ensure dates are different
          fc.pre(config.baselineDate !== today);

          const result = computeTodayWritten(config, currentTotal, today);

          expect(result.todayWritten).toBe(0);
          expect(result.updatedConfig).not.toBeNull();
          expect(result.updatedConfig!.baselineDate).toBe(today);
          expect(result.updatedConfig!.baselineWordCount).toBe(currentTotal);
          // Goal should be preserved
          expect(result.updatedConfig!.goalWordCount).toBe(config.goalWordCount);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('todayWritten is never negative', () => {
    fc.assert(
      fc.property(arbConfig, arbDateStr, fc.nat({ max: 200000 }), (config, today, currentTotal) => {
        const result = computeTodayWritten(config, currentTotal, today);
        expect(result.todayWritten).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 200 },
    );
  });
});

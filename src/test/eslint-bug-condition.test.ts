import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

/**
 * Bug Condition Exploration Test - ESLint Zero Errors
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 *
 * This test runs `npx eslint src/ --format json` and asserts that:
 * - The exit code is zero (ESLint passes)
 * - The total errorCount across all files is 0
 * - The total warningCount across all files is 0
 *
 * On UNFIXED code, this test is EXPECTED TO FAIL because ESLint
 * reports 32 errors distributed across:
 * - react-hooks/set-state-in-effect (~20 errors)
 * - @typescript-eslint/no-unused-vars (~10 errors)
 * - Other miscellaneous errors (3)
 */
describe('Bug Condition: ESLint reports zero errors', () => {
  it('should report 0 errors and 0 warnings when running ESLint on src/', { timeout: 60_000 }, () => {
    let stdout: string;
    let exitCode: number;

    try {
      stdout = execSync('npx eslint src/ --format json', {
        encoding: 'utf-8',
        timeout: 60_000,
      });
      exitCode = 0;
    } catch (error: unknown) {
      const execError = error as { stdout?: string; status?: number };
      stdout = execError.stdout ?? '[]';
      exitCode = execError.status ?? 1;
    }

    const results: Array<{ errorCount: number; warningCount: number; filePath: string; messages: Array<{ ruleId: string; message: string; line: number }> }> = JSON.parse(stdout);

    const totalErrors = results.reduce((sum, r) => sum + r.errorCount, 0);
    const totalWarnings = results.reduce((sum, r) => sum + r.warningCount, 0);

    // Log details for counterexample documentation when test fails
    if (totalErrors > 0 || totalWarnings > 0) {
      const errorsByRule: Record<string, number> = {};
      for (const result of results) {
        for (const msg of result.messages) {
          const rule = msg.ruleId ?? 'unknown';
          errorsByRule[rule] = (errorsByRule[rule] ?? 0) + 1;
        }
      }
      console.log('ESLint error distribution by rule:', JSON.stringify(errorsByRule, null, 2));
      console.log(`Total errors: ${totalErrors}, Total warnings: ${totalWarnings}`);
    }

    expect(exitCode, 'ESLint exit code should be 0 (no errors)').toBe(0);
    expect(totalErrors, 'ESLint should report 0 errors').toBe(0);
    expect(totalWarnings, 'ESLint should report 0 warnings').toBe(0);
  });
});

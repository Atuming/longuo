import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

/**
 * Preservation Property Test - Test Suite & TypeScript Compilation
 *
 * **Validates: Requirements 3.1, 3.2**
 *
 * Property 2: Preservation - The existing test suite and TypeScript compilation
 * should not regress after ESLint error fixes are applied.
 *
 * This test establishes the baseline that must be maintained:
 * - All 287 existing tests pass via `npx vitest --run`
 * - TypeScript compilation via `tsc -b` does not introduce NEW errors
 *
 * On UNFIXED code, this test is EXPECTED TO PASS (confirms baseline to preserve).
 */
describe('Preservation: Test suite and TypeScript compilation do not regress', () => {
  it('existing test suite should have all tests passing (npx vitest --run)', () => {
    let exitCode: number;
    let output: string;

    try {
      output = execSync(
        'npx vitest --run --exclude "src/test/eslint-bug-condition.test.ts" --exclude "src/test/preservation.test.ts"',
        {
          encoding: 'utf-8',
          timeout: 120_000,
        }
      );
      exitCode = 0;
    } catch (error: unknown) {
      const execError = error as { stdout?: string; status?: number };
      output = execError.stdout ?? '';
      exitCode = execError.status ?? 1;
    }

    // Extract test counts from vitest output
    const testsMatch = output.match(/Tests\s+(?:\d+\s+failed\s+\|\s+)?(\d+)\s+passed/);
    const failedMatch = output.match(/Tests\s+(\d+)\s+failed/);

    const passedCount = testsMatch ? parseInt(testsMatch[1], 10) : 0;
    const failedCount = failedMatch ? parseInt(failedMatch[1], 10) : 0;

    if (exitCode !== 0) {
      console.log('Vitest output (failure):', output.slice(-2000));
    }

    expect(exitCode, 'vitest should exit with code 0 (all tests pass)').toBe(0);
    expect(failedCount, 'no tests should fail').toBe(0);
    expect(passedCount, 'all existing tests should pass').toBeGreaterThanOrEqual(287);
  }, 180_000);

  it('TypeScript compilation should not introduce new errors (tsc -b)', () => {
    let output: string;

    try {
      output = execSync('npx tsc -b 2>&1', {
        encoding: 'utf-8',
        timeout: 60_000,
      });
    } catch (error: unknown) {
      const execError = error as { stdout?: string; stderr?: string };
      output = (execError.stdout ?? '') + (execError.stderr ?? '');
    }

    // Count the number of TS errors in output
    const errorLines = output.match(/error TS\d+/g) ?? [];
    const errorCount = errorLines.length;

    // On unfixed code, there are pre-existing TS errors (unused vars, missing types)
    // that are part of the bug being fixed. We record the baseline count.
    // After fixes, this count should be <= the baseline (ideally 0).
    //
    // Pre-existing errors on unfixed code:
    // - TS6133 (unused locals/params): ~12 errors across multiple files
    // - TS2339/TS2304 (showSaveFilePicker/FilePickerAcceptType): 3 errors in file-manager
    // Total baseline: 15 errors
    const BASELINE_ERROR_COUNT = 15;

    if (errorCount > 0) {
      console.log(`TypeScript compilation errors: ${errorCount} (baseline: ${BASELINE_ERROR_COUNT})`);
    }

    // The fix should not introduce MORE TypeScript errors than the baseline
    expect(
      errorCount,
      `TypeScript errors (${errorCount}) should not exceed baseline (${BASELINE_ERROR_COUNT})`
    ).toBeLessThanOrEqual(BASELINE_ERROR_COUNT);
  }, 120_000);
});

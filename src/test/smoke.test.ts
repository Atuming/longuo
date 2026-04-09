import { describe, test, expect } from 'vitest'
import * as fc from 'fast-check'

describe('Smoke test', () => {
  test('vitest works', () => {
    expect(1 + 1).toBe(2)
  })

  test('fast-check works', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        expect(a + b).toBe(b + a)
      })
    )
  })
})

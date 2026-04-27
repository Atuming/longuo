import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { serialize, deserialize } from './file-manager';
import type { NovelFileData } from '../types/project';

/**
 * Arbitrary for a minimal valid NovelFileData with random Date fields.
 * We focus on the project.createdAt and project.updatedAt Date fields
 * since those are the ones revived by deserialize.
 */
const validDateArb = fc
  .date({
    min: new Date('2000-01-01T00:00:00.000Z'),
    max: new Date('2099-12-31T23:59:59.999Z'),
  })
  .filter((d) => !isNaN(d.getTime()));

const novelFileDataArb: fc.Arbitrary<NovelFileData> = fc
  .record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 30 }),
    description: fc.string({ maxLength: 50 }),
    createdAt: validDateArb,
    updatedAt: validDateArb,
  })
  .map((project) => ({
    version: 1,
    project,
    chapters: [],
    characters: [],
    characterSnapshots: [],
    relationships: [],
    timelinePoints: [],
    worldEntries: [],
    plotThreads: [],
  }));

/**
 * Feature: comprehensive-quality-audit, Property 18: Date 字段序列化往返
 * Validates: Requirements 13.5
 *
 * 对于任意有效的 NovelFileData，serialize 后再 deserialize 应正确恢复
 * project.createdAt 和 project.updatedAt 为 Date 对象，且时间值等价。
 */
describe('Property 18: Date 字段序列化往返', () => {
  it('serialize→deserialize 后 createdAt 和 updatedAt 是 Date 对象且时间值相同', () => {
    fc.assert(
      fc.property(novelFileDataArb, (data) => {
        const json = serialize(data);
        const restored = deserialize(json);

        // createdAt is a Date instance with the same time value
        expect(restored.project.createdAt).toBeInstanceOf(Date);
        expect(restored.project.createdAt.getTime()).toBe(
          data.project.createdAt.getTime(),
        );

        // updatedAt is a Date instance with the same time value
        expect(restored.project.updatedAt).toBeInstanceOf(Date);
        expect(restored.project.updatedAt.getTime()).toBe(
          data.project.updatedAt.getTime(),
        );
      }),
      { numRuns: 100 },
    );
  });
});

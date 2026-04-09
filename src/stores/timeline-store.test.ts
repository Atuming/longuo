import { describe, it, expect, vi } from 'vitest';
import { createTimelineStore } from './timeline-store';
import { createEventBus } from '../lib/event-bus';
import type { TimelinePoint } from '../types/timeline';

const PROJECT_ID = 'project-1';

function makePointData(overrides?: Partial<Omit<TimelinePoint, 'id'>>): Omit<TimelinePoint, 'id'> {
  return {
    projectId: PROJECT_ID,
    label: 'Point',
    description: 'A timeline point',
    sortOrder: 0,
    associatedChapterIds: [],
    associatedCharacterIds: [],
    ...overrides,
  };
}

describe('TimelineStore', () => {
  // --- createTimelinePoint & getTimelinePoint ---
  it('should create a timeline point and retrieve it', () => {
    const store = createTimelineStore();
    const point = store.createTimelinePoint(makePointData({ label: 'Beginning' }));
    expect(point.id).toBeDefined();
    expect(point.label).toBe('Beginning');

    const fetched = store.getTimelinePoint(point.id);
    expect(fetched).toEqual(point);
  });

  it('should return undefined for non-existent point', () => {
    const store = createTimelineStore();
    expect(store.getTimelinePoint('non-existent')).toBeUndefined();
  });

  // --- listTimelinePoints (sorted by sortOrder) ---
  it('should list points sorted by sortOrder', () => {
    const store = createTimelineStore();
    store.createTimelinePoint(makePointData({ label: 'C', sortOrder: 2 }));
    store.createTimelinePoint(makePointData({ label: 'A', sortOrder: 0 }));
    store.createTimelinePoint(makePointData({ label: 'B', sortOrder: 1 }));

    const list = store.listTimelinePoints(PROJECT_ID);
    expect(list.map((p) => p.label)).toEqual(['A', 'B', 'C']);
  });

  it('should only list points for the specified project', () => {
    const store = createTimelineStore();
    store.createTimelinePoint(makePointData({ label: 'Mine' }));
    store.createTimelinePoint(makePointData({ label: 'Other', projectId: 'other' }));

    const list = store.listTimelinePoints(PROJECT_ID);
    expect(list).toHaveLength(1);
    expect(list[0].label).toBe('Mine');
  });

  // --- updateTimelinePoint ---
  it('should update timeline point fields', () => {
    const store = createTimelineStore();
    const point = store.createTimelinePoint(makePointData({ label: 'Old' }));

    store.updateTimelinePoint(point.id, { label: 'New', description: 'Updated' });
    const updated = store.getTimelinePoint(point.id);
    expect(updated?.label).toBe('New');
    expect(updated?.description).toBe('Updated');
  });

  it('should update associatedChapterIds and associatedCharacterIds', () => {
    const store = createTimelineStore();
    const point = store.createTimelinePoint(makePointData());

    store.updateTimelinePoint(point.id, {
      associatedChapterIds: ['ch1', 'ch2'],
      associatedCharacterIds: ['char1'],
    });
    const updated = store.getTimelinePoint(point.id);
    expect(updated?.associatedChapterIds).toEqual(['ch1', 'ch2']);
    expect(updated?.associatedCharacterIds).toEqual(['char1']);
  });

  it('should not throw when updating non-existent point', () => {
    const store = createTimelineStore();
    expect(() => store.updateTimelinePoint('non-existent', { label: 'X' })).not.toThrow();
  });

  // --- deleteTimelinePoint ---
  it('should delete a timeline point', () => {
    const store = createTimelineStore();
    const point = store.createTimelinePoint(makePointData());
    store.deleteTimelinePoint(point.id);
    expect(store.getTimelinePoint(point.id)).toBeUndefined();
  });

  it('should not throw when deleting non-existent point', () => {
    const store = createTimelineStore();
    expect(() => store.deleteTimelinePoint('non-existent')).not.toThrow();
  });

  // --- reorderTimelinePoint ---
  it('should reorder a point and maintain consecutive sortOrder', () => {
    const store = createTimelineStore();
    const a = store.createTimelinePoint(makePointData({ label: 'A', sortOrder: 0 }));
    store.createTimelinePoint(makePointData({ label: 'B', sortOrder: 1 }));
    store.createTimelinePoint(makePointData({ label: 'C', sortOrder: 2 }));

    // Move A to position 2 (end)
    store.reorderTimelinePoint(a.id, 2);

    const list = store.listTimelinePoints(PROJECT_ID);
    expect(list.map((p) => p.label)).toEqual(['B', 'C', 'A']);
    expect(list.map((p) => p.sortOrder)).toEqual([0, 1, 2]);
  });

  it('should handle reorder to position 0', () => {
    const store = createTimelineStore();
    store.createTimelinePoint(makePointData({ label: 'A', sortOrder: 0 }));
    store.createTimelinePoint(makePointData({ label: 'B', sortOrder: 1 }));
    const c = store.createTimelinePoint(makePointData({ label: 'C', sortOrder: 2 }));

    store.reorderTimelinePoint(c.id, 0);

    const list = store.listTimelinePoints(PROJECT_ID);
    expect(list.map((p) => p.label)).toEqual(['C', 'A', 'B']);
    expect(list.map((p) => p.sortOrder)).toEqual([0, 1, 2]);
  });

  it('should clamp reorder to valid range', () => {
    const store = createTimelineStore();
    const a = store.createTimelinePoint(makePointData({ label: 'A', sortOrder: 0 }));
    store.createTimelinePoint(makePointData({ label: 'B', sortOrder: 1 }));

    store.reorderTimelinePoint(a.id, 100);

    const list = store.listTimelinePoints(PROJECT_ID);
    expect(list.map((p) => p.label)).toEqual(['B', 'A']);
    expect(list.map((p) => p.sortOrder)).toEqual([0, 1]);
  });

  it('should not throw when reordering non-existent point', () => {
    const store = createTimelineStore();
    expect(() => store.reorderTimelinePoint('non-existent', 0)).not.toThrow();
  });

  // --- filterByChapter ---
  it('should filter points by associated chapter', () => {
    const store = createTimelineStore();
    store.createTimelinePoint(makePointData({ label: 'A', associatedChapterIds: ['ch1', 'ch2'] }));
    store.createTimelinePoint(makePointData({ label: 'B', associatedChapterIds: ['ch2'] }));
    store.createTimelinePoint(makePointData({ label: 'C', associatedChapterIds: ['ch3'] }));

    const filtered = store.filterByChapter(PROJECT_ID, 'ch2');
    expect(filtered).toHaveLength(2);
    expect(filtered.map((p) => p.label).sort()).toEqual(['A', 'B']);
  });

  // --- filterByCharacter ---
  it('should filter points by associated character', () => {
    const store = createTimelineStore();
    store.createTimelinePoint(makePointData({ label: 'A', associatedCharacterIds: ['char1'] }));
    store.createTimelinePoint(makePointData({ label: 'B', associatedCharacterIds: ['char1', 'char2'] }));
    store.createTimelinePoint(makePointData({ label: 'C', associatedCharacterIds: ['char3'] }));

    const filtered = store.filterByCharacter(PROJECT_ID, 'char1');
    expect(filtered).toHaveLength(2);
    expect(filtered.map((p) => p.label).sort()).toEqual(['A', 'B']);
  });

  // --- getReferences ---
  it('should return reference counts from callbacks', () => {
    const getSnapshotCount = vi.fn().mockReturnValue(3);
    const getRelationshipCount = vi.fn().mockReturnValue(5);

    const store = createTimelineStore({ getSnapshotCount, getRelationshipCount });
    const point = store.createTimelinePoint(makePointData());

    const refs = store.getReferences(point.id);
    expect(refs).toEqual({ characterSnapshots: 3, relationships: 5 });
    expect(getSnapshotCount).toHaveBeenCalledWith(point.id);
    expect(getRelationshipCount).toHaveBeenCalledWith(point.id);
  });

  it('should return zero counts when callbacks are not provided', () => {
    const store = createTimelineStore();
    const point = store.createTimelinePoint(makePointData());

    const refs = store.getReferences(point.id);
    expect(refs).toEqual({ characterSnapshots: 0, relationships: 0 });
  });

  // --- EventBus integration ---
  it('should emit timeline:created event on create', () => {
    const eventBus = createEventBus();
    const handler = vi.fn();
    eventBus.on('timeline:created', handler);

    const store = createTimelineStore({ eventBus });
    const point = store.createTimelinePoint(makePointData({ label: 'New' }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ type: 'timeline:created', point: expect.objectContaining({ label: 'New', id: point.id }) });
  });

  it('should emit timeline:updated event on update', () => {
    const eventBus = createEventBus();
    const handler = vi.fn();
    eventBus.on('timeline:updated', handler);

    const store = createTimelineStore({ eventBus });
    const point = store.createTimelinePoint(makePointData({ label: 'Old' }));

    store.updateTimelinePoint(point.id, { label: 'Updated' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ type: 'timeline:updated', point: expect.objectContaining({ label: 'Updated' }) });
  });

  it('should emit timeline:deleted event on delete', () => {
    const eventBus = createEventBus();
    const handler = vi.fn();
    eventBus.on('timeline:deleted', handler);

    const store = createTimelineStore({ eventBus });
    const point = store.createTimelinePoint(makePointData());

    store.deleteTimelinePoint(point.id);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ type: 'timeline:deleted', pointId: point.id });
  });

  it('should not emit timeline:deleted for non-existent point', () => {
    const eventBus = createEventBus();
    const handler = vi.fn();
    eventBus.on('timeline:deleted', handler);

    const store = createTimelineStore({ eventBus });
    store.deleteTimelinePoint('non-existent');

    expect(handler).not.toHaveBeenCalled();
  });

  it('should emit timeline:updated event on reorder', () => {
    const eventBus = createEventBus();
    const handler = vi.fn();
    eventBus.on('timeline:updated', handler);

    const store = createTimelineStore({ eventBus });
    const a = store.createTimelinePoint(makePointData({ label: 'A', sortOrder: 0 }));
    store.createTimelinePoint(makePointData({ label: 'B', sortOrder: 1 }));

    store.reorderTimelinePoint(a.id, 1);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  // --- Defensive copy ---
  it('should return defensive copies (mutations do not affect store)', () => {
    const store = createTimelineStore();
    const point = store.createTimelinePoint(makePointData({
      label: 'Original',
      associatedChapterIds: ['ch1'],
      associatedCharacterIds: ['char1'],
    }));

    point.label = 'Mutated';
    point.associatedChapterIds.push('ch99');
    point.associatedCharacterIds.push('char99');

    const fetched = store.getTimelinePoint(point.id);
    expect(fetched?.label).toBe('Original');
    expect(fetched?.associatedChapterIds).toEqual(['ch1']);
    expect(fetched?.associatedCharacterIds).toEqual(['char1']);
  });

  it('should return defensive copies from listTimelinePoints', () => {
    const store = createTimelineStore();
    store.createTimelinePoint(makePointData({ label: 'Listed' }));

    const list = store.listTimelinePoints(PROJECT_ID);
    list[0].label = 'Mutated';

    const list2 = store.listTimelinePoints(PROJECT_ID);
    expect(list2[0].label).toBe('Listed');
  });
});

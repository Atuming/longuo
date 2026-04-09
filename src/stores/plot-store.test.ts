import { describe, it, expect } from 'vitest';
import { createPlotStore } from './plot-store';
import type { PlotThread } from '../types/plot';

const PROJECT_ID = 'project-1';

function makeThreadData(overrides?: Partial<Omit<PlotThread, 'id'>>): Omit<PlotThread, 'id'> {
  return {
    projectId: PROJECT_ID,
    name: 'Test Thread',
    description: 'A test plot thread',
    status: 'pending',
    associatedChapterIds: [],
    ...overrides,
  };
}

describe('PlotStore', () => {
  // --- createThread & getThread ---
  it('should create a thread and retrieve it by id', () => {
    const store = createPlotStore();
    const thread = store.createThread(makeThreadData({ name: 'Mystery' }));
    expect(thread.id).toBeDefined();
    expect(thread.name).toBe('Mystery');
    expect(thread.status).toBe('pending');

    const fetched = store.getThread(thread.id);
    expect(fetched).toEqual(thread);
  });

  it('should return undefined for non-existent thread', () => {
    const store = createPlotStore();
    expect(store.getThread('non-existent')).toBeUndefined();
  });

  it('should support all three statuses', () => {
    const store = createPlotStore();
    const pending = store.createThread(makeThreadData({ status: 'pending' }));
    const inProgress = store.createThread(makeThreadData({ status: 'in_progress' }));
    const resolved = store.createThread(makeThreadData({ status: 'resolved' }));

    expect(pending.status).toBe('pending');
    expect(inProgress.status).toBe('in_progress');
    expect(resolved.status).toBe('resolved');
  });

  // --- listThreads ---
  it('should list threads for a specific project', () => {
    const store = createPlotStore();
    store.createThread(makeThreadData({ name: 'A' }));
    store.createThread(makeThreadData({ name: 'B' }));
    store.createThread(makeThreadData({ name: 'C', projectId: 'other-project' }));

    const list = store.listThreads(PROJECT_ID);
    expect(list).toHaveLength(2);
    expect(list.map((t) => t.name).sort()).toEqual(['A', 'B']);
  });

  // --- filterByStatus ---
  it('should filter threads by status', () => {
    const store = createPlotStore();
    store.createThread(makeThreadData({ name: 'A', status: 'pending' }));
    store.createThread(makeThreadData({ name: 'B', status: 'in_progress' }));
    store.createThread(makeThreadData({ name: 'C', status: 'resolved' }));
    store.createThread(makeThreadData({ name: 'D', status: 'pending' }));

    const pending = store.filterByStatus(PROJECT_ID, 'pending');
    expect(pending).toHaveLength(2);
    expect(pending.every((t) => t.status === 'pending')).toBe(true);

    const inProgress = store.filterByStatus(PROJECT_ID, 'in_progress');
    expect(inProgress).toHaveLength(1);
    expect(inProgress[0].name).toBe('B');

    const resolved = store.filterByStatus(PROJECT_ID, 'resolved');
    expect(resolved).toHaveLength(1);
    expect(resolved[0].name).toBe('C');
  });

  it('should only filter within the specified project', () => {
    const store = createPlotStore();
    store.createThread(makeThreadData({ name: 'Mine', status: 'pending' }));
    store.createThread(makeThreadData({ name: 'Other', status: 'pending', projectId: 'other' }));

    const pending = store.filterByStatus(PROJECT_ID, 'pending');
    expect(pending).toHaveLength(1);
    expect(pending[0].name).toBe('Mine');
  });

  // --- updateThread ---
  it('should update thread fields', () => {
    const store = createPlotStore();
    const thread = store.createThread(makeThreadData({ name: 'Old', status: 'pending' }));

    store.updateThread(thread.id, { name: 'New', status: 'in_progress', description: 'Updated' });
    const updated = store.getThread(thread.id);
    expect(updated?.name).toBe('New');
    expect(updated?.status).toBe('in_progress');
    expect(updated?.description).toBe('Updated');
  });

  it('should update associatedChapterIds', () => {
    const store = createPlotStore();
    const thread = store.createThread(makeThreadData({ associatedChapterIds: ['ch1'] }));

    store.updateThread(thread.id, { associatedChapterIds: ['ch1', 'ch2'] });
    const updated = store.getThread(thread.id);
    expect(updated?.associatedChapterIds).toEqual(['ch1', 'ch2']);
  });

  it('should not throw when updating non-existent thread', () => {
    const store = createPlotStore();
    expect(() => store.updateThread('non-existent', { name: 'X' })).not.toThrow();
  });

  // --- deleteThread ---
  it('should delete a thread', () => {
    const store = createPlotStore();
    const thread = store.createThread(makeThreadData({ name: 'ToDelete' }));
    expect(store.getThread(thread.id)).toBeDefined();

    store.deleteThread(thread.id);
    expect(store.getThread(thread.id)).toBeUndefined();
  });

  it('should not throw when deleting non-existent thread', () => {
    const store = createPlotStore();
    expect(() => store.deleteThread('non-existent')).not.toThrow();
  });

  // --- Defensive copy ---
  it('should return defensive copies (mutations do not affect store)', () => {
    const store = createPlotStore();
    const thread = store.createThread(makeThreadData({ name: 'Original', associatedChapterIds: ['ch1'] }));

    thread.name = 'Mutated';
    thread.associatedChapterIds.push('ch99');

    const fetched = store.getThread(thread.id);
    expect(fetched?.name).toBe('Original');
    expect(fetched?.associatedChapterIds).toEqual(['ch1']);
  });

  it('should return defensive copies from listThreads', () => {
    const store = createPlotStore();
    const thread = store.createThread(makeThreadData({ name: 'Listed' }));

    const list = store.listThreads(PROJECT_ID);
    list[0].name = 'Mutated';

    const fetched = store.getThread(thread.id);
    expect(fetched?.name).toBe('Listed');
  });
});

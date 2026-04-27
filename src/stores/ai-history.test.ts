import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAIAssistantStore } from './ai-assistant-store';

const PROJECT_ID = 'test-project-1';
const HISTORY_KEY = `novel-ai-history-${PROJECT_ID}`;

function makeRecord() {
  return {
    projectId: PROJECT_ID,
    skillLabel: '续写',
    userInput: '请续写下一段',
    generatedContent: '生成的内容',
  };
}

describe('AI History — corrupted data handling (Req 17.2)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should clear corrupted data and return empty list when stored value is a non-array object', () => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify({ bad: 'data' }));

    const store = createAIAssistantStore();
    const list = store.listHistory(PROJECT_ID);

    expect(list).toEqual([]);
    // Corrupted data should have been removed
    expect(localStorage.getItem(HISTORY_KEY)).toBeNull();
  });

  it('should clear corrupted data and return empty list when stored value is a string', () => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify('not-an-array'));

    const store = createAIAssistantStore();
    const list = store.listHistory(PROJECT_ID);

    expect(list).toEqual([]);
    expect(localStorage.getItem(HISTORY_KEY)).toBeNull();
  });

  it('should clear corrupted data and return empty list when stored value is a number', () => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(42));

    const store = createAIAssistantStore();
    const list = store.listHistory(PROJECT_ID);

    expect(list).toEqual([]);
    expect(localStorage.getItem(HISTORY_KEY)).toBeNull();
  });

  it('should clear corrupted data when stored value is invalid JSON', () => {
    localStorage.setItem(HISTORY_KEY, '{not valid json!!!');

    const store = createAIAssistantStore();
    const list = store.listHistory(PROJECT_ID);

    expect(list).toEqual([]);
    expect(localStorage.getItem(HISTORY_KEY)).toBeNull();
  });
});

describe('AI History — localStorage write failure silent degradation (Req 17.3)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should not throw when localStorage.setItem fails during addHistoryRecord', () => {
    const store = createAIAssistantStore();

    // Simulate QuotaExceededError on setItem
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    });

    // addHistoryRecord should not throw — silent degradation
    expect(() => {
      store.addHistoryRecord(PROJECT_ID, makeRecord());
    }).not.toThrow();

    setItemSpy.mockRestore();
  });

  it('should return a valid record even when localStorage write fails', () => {
    const store = createAIAssistantStore();

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    });

    const record = store.addHistoryRecord(PROJECT_ID, makeRecord());

    expect(record).toBeDefined();
    expect(record.id).toBeTruthy();
    expect(record.timestamp).toBeTruthy();
    expect(record.skillLabel).toBe('续写');

    setItemSpy.mockRestore();
  });
});

describe('AI History — clearHistory removes all data (Req 17.5)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should remove all history data for the given project', () => {
    const store = createAIAssistantStore();

    // Add some records
    store.addHistoryRecord(PROJECT_ID, makeRecord());
    store.addHistoryRecord(PROJECT_ID, makeRecord());

    // Verify records exist
    expect(store.listHistory(PROJECT_ID).length).toBe(2);
    expect(localStorage.getItem(HISTORY_KEY)).not.toBeNull();

    // Clear history
    store.clearHistory(PROJECT_ID);

    // Verify data is removed from localStorage
    expect(localStorage.getItem(HISTORY_KEY)).toBeNull();
    // Verify listHistory returns empty
    expect(store.listHistory(PROJECT_ID)).toEqual([]);
  });

  it('should not affect history of other projects', () => {
    const store = createAIAssistantStore();
    const otherProjectId = 'other-project';

    store.addHistoryRecord(PROJECT_ID, makeRecord());
    store.addHistoryRecord(otherProjectId, {
      projectId: otherProjectId,
      skillLabel: '润色',
      userInput: '润色这段',
      generatedContent: '润色后的内容',
    });

    store.clearHistory(PROJECT_ID);

    expect(store.listHistory(PROJECT_ID)).toEqual([]);
    expect(store.listHistory(otherProjectId).length).toBe(1);
  });

  it('should not throw when clearing history for a project with no records', () => {
    const store = createAIAssistantStore();

    expect(() => {
      store.clearHistory(PROJECT_ID);
    }).not.toThrow();
  });
});

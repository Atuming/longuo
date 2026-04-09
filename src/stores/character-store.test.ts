import { describe, it, expect } from 'vitest';
import { createCharacterStore } from './character-store';
import { createEventBus } from '../lib/event-bus';


describe('CharacterStore', () => {
  const projectId = 'proj-1';

  function makeStore() {
    return createCharacterStore();
  }

  function makeCharacterData(overrides: Partial<{ name: string; aliases: string[]; customAttributes: Record<string, string> }> = {}) {
    return {
      name: overrides.name ?? '张三',
      aliases: overrides.aliases ?? ['小张', '老张'],
      appearance: '高大威猛',
      personality: '沉稳内敛',
      backstory: '出身名门',
      customAttributes: overrides.customAttributes ?? { 武力: '90', 智力: '85' },
    };
  }

  describe('createCharacter', () => {
    it('should create a character with generated id and projectId', () => {
      const store = makeStore();
      const ch = store.createCharacter(projectId, makeCharacterData());
      expect(ch.id).toBeTruthy();
      expect(ch.projectId).toBe(projectId);
      expect(ch.name).toBe('张三');
      expect(ch.aliases).toEqual(['小张', '老张']);
      expect(ch.customAttributes).toEqual({ 武力: '90', 智力: '85' });
    });

    it('should return a defensive copy', () => {
      const store = makeStore();
      const ch = store.createCharacter(projectId, makeCharacterData());
      ch.name = 'modified';
      ch.aliases.push('new');
      ch.customAttributes['new'] = 'val';
      const fetched = store.getCharacter(ch.id)!;
      expect(fetched.name).toBe('张三');
      expect(fetched.aliases).toEqual(['小张', '老张']);
      expect(fetched.customAttributes).toEqual({ 武力: '90', 智力: '85' });
    });
  });

  describe('getCharacter', () => {
    it('should return undefined for non-existent id', () => {
      const store = makeStore();
      expect(store.getCharacter('non-existent')).toBeUndefined();
    });

    it('should return the character by id', () => {
      const store = makeStore();
      const ch = store.createCharacter(projectId, makeCharacterData());
      const fetched = store.getCharacter(ch.id);
      expect(fetched).toBeDefined();
      expect(fetched!.name).toBe('张三');
    });
  });

  describe('listCharacters', () => {
    it('should return empty array for empty store', () => {
      const store = makeStore();
      expect(store.listCharacters(projectId)).toEqual([]);
    });

    it('should list characters filtered by projectId', () => {
      const store = makeStore();
      store.createCharacter('proj-a', makeCharacterData({ name: 'A' }));
      store.createCharacter('proj-b', makeCharacterData({ name: 'B' }));
      store.createCharacter('proj-a', makeCharacterData({ name: 'C' }));
      const list = store.listCharacters('proj-a');
      expect(list).toHaveLength(2);
      expect(list.map((c) => c.name).sort()).toEqual(['A', 'C']);
    });
  });

  describe('searchCharacters', () => {
    it('should return all characters when query is empty', () => {
      const store = makeStore();
      store.createCharacter(projectId, makeCharacterData({ name: '张三' }));
      store.createCharacter(projectId, makeCharacterData({ name: '李四' }));
      expect(store.searchCharacters(projectId, '')).toHaveLength(2);
    });

    it('should match by name (case-insensitive)', () => {
      const store = makeStore();
      store.createCharacter(projectId, makeCharacterData({ name: 'Alice' }));
      store.createCharacter(projectId, makeCharacterData({ name: 'Bob' }));
      const results = store.searchCharacters(projectId, 'alice');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Alice');
    });

    it('should match by alias (case-insensitive, partial match)', () => {
      const store = makeStore();
      store.createCharacter(projectId, makeCharacterData({ name: '张三', aliases: ['The Dragon', '小张'] }));
      store.createCharacter(projectId, makeCharacterData({ name: '李四', aliases: ['The Phoenix'] }));
      const results = store.searchCharacters(projectId, 'dragon');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('张三');
    });

    it('should match partial name', () => {
      const store = makeStore();
      store.createCharacter(projectId, makeCharacterData({ name: '诸葛亮' }));
      const results = store.searchCharacters(projectId, '诸葛');
      expect(results).toHaveLength(1);
    });

    it('should not return characters from other projects', () => {
      const store = makeStore();
      store.createCharacter('other', makeCharacterData({ name: '张三' }));
      expect(store.searchCharacters(projectId, '张三')).toHaveLength(0);
    });
  });

  describe('updateCharacter', () => {
    it('should update specified fields', () => {
      const store = makeStore();
      const ch = store.createCharacter(projectId, makeCharacterData());
      store.updateCharacter(ch.id, { name: '李四', appearance: '矮小' });
      const updated = store.getCharacter(ch.id)!;
      expect(updated.name).toBe('李四');
      expect(updated.appearance).toBe('矮小');
      expect(updated.personality).toBe('沉稳内敛'); // unchanged
    });

    it('should update custom attributes', () => {
      const store = makeStore();
      const ch = store.createCharacter(projectId, makeCharacterData());
      store.updateCharacter(ch.id, { customAttributes: { 魅力: '100' } });
      const updated = store.getCharacter(ch.id)!;
      expect(updated.customAttributes).toEqual({ 魅力: '100' });
    });

    it('should do nothing for non-existent id', () => {
      const store = makeStore();
      expect(() => store.updateCharacter('non-existent', { name: 'x' })).not.toThrow();
    });
  });

  describe('deleteCharacter', () => {
    it('should remove the character', () => {
      const store = makeStore();
      const ch = store.createCharacter(projectId, makeCharacterData());
      store.deleteCharacter(ch.id);
      expect(store.getCharacter(ch.id)).toBeUndefined();
    });

    it('should cascade delete snapshots', () => {
      const store = makeStore();
      const ch = store.createCharacter(projectId, makeCharacterData());
      store.setSnapshotAtTimeline(ch.id, 'tp-1', { appearance: '年轻' });
      store.setSnapshotAtTimeline(ch.id, 'tp-2', { appearance: '年老' });
      store.deleteCharacter(ch.id);
      expect(store.getSnapshotAtTimeline(ch.id, 'tp-1')).toBeUndefined();
      expect(store.getSnapshotAtTimeline(ch.id, 'tp-2')).toBeUndefined();
    });

    it('should not affect other characters snapshots', () => {
      const store = makeStore();
      const ch1 = store.createCharacter(projectId, makeCharacterData({ name: 'A' }));
      const ch2 = store.createCharacter(projectId, makeCharacterData({ name: 'B' }));
      store.setSnapshotAtTimeline(ch1.id, 'tp-1', { appearance: 'A-snap' });
      store.setSnapshotAtTimeline(ch2.id, 'tp-1', { appearance: 'B-snap' });
      store.deleteCharacter(ch1.id);
      expect(store.getSnapshotAtTimeline(ch2.id, 'tp-1')).toBeDefined();
      expect(store.getSnapshotAtTimeline(ch2.id, 'tp-1')!.appearance).toBe('B-snap');
    });
  });

  describe('getSnapshotAtTimeline / setSnapshotAtTimeline', () => {
    it('should return undefined for non-existent snapshot', () => {
      const store = makeStore();
      expect(store.getSnapshotAtTimeline('ch-1', 'tp-1')).toBeUndefined();
    });

    it('should create a new snapshot', () => {
      const store = makeStore();
      const ch = store.createCharacter(projectId, makeCharacterData());
      store.setSnapshotAtTimeline(ch.id, 'tp-1', {
        appearance: '年轻貌美',
        personality: '天真烂漫',
        backstoryEvents: ['出生', '入学'],
        customAttributes: { 等级: '1' },
      });
      const snap = store.getSnapshotAtTimeline(ch.id, 'tp-1')!;
      expect(snap.characterId).toBe(ch.id);
      expect(snap.timelinePointId).toBe('tp-1');
      expect(snap.appearance).toBe('年轻貌美');
      expect(snap.backstoryEvents).toEqual(['出生', '入学']);
      expect(snap.customAttributes).toEqual({ 等级: '1' });
    });

    it('should update an existing snapshot', () => {
      const store = makeStore();
      const ch = store.createCharacter(projectId, makeCharacterData());
      store.setSnapshotAtTimeline(ch.id, 'tp-1', { appearance: 'v1' });
      store.setSnapshotAtTimeline(ch.id, 'tp-1', { appearance: 'v2' });
      const snap = store.getSnapshotAtTimeline(ch.id, 'tp-1')!;
      expect(snap.appearance).toBe('v2');
    });

    it('should preserve unmodified fields on update', () => {
      const store = makeStore();
      const ch = store.createCharacter(projectId, makeCharacterData());
      store.setSnapshotAtTimeline(ch.id, 'tp-1', {
        appearance: 'original',
        personality: 'kind',
      });
      store.setSnapshotAtTimeline(ch.id, 'tp-1', { appearance: 'updated' });
      const snap = store.getSnapshotAtTimeline(ch.id, 'tp-1')!;
      expect(snap.appearance).toBe('updated');
      expect(snap.personality).toBe('kind');
    });

    it('should return defensive copies', () => {
      const store = makeStore();
      const ch = store.createCharacter(projectId, makeCharacterData());
      store.setSnapshotAtTimeline(ch.id, 'tp-1', { backstoryEvents: ['event1'] });
      const snap = store.getSnapshotAtTimeline(ch.id, 'tp-1')!;
      snap.backstoryEvents.push('mutated');
      snap.customAttributes['hack'] = 'val';
      const snap2 = store.getSnapshotAtTimeline(ch.id, 'tp-1')!;
      expect(snap2.backstoryEvents).toEqual(['event1']);
      expect(snap2.customAttributes).toEqual({});
    });

    it('should use defaults for missing fields on create', () => {
      const store = makeStore();
      const ch = store.createCharacter(projectId, makeCharacterData());
      store.setSnapshotAtTimeline(ch.id, 'tp-1', {});
      const snap = store.getSnapshotAtTimeline(ch.id, 'tp-1')!;
      expect(snap.appearance).toBe('');
      expect(snap.personality).toBe('');
      expect(snap.backstoryEvents).toEqual([]);
      expect(snap.customAttributes).toEqual({});
    });
  });

  describe('EventBus integration', () => {
    it('should delete snapshots when timeline point is deleted', () => {
      const eventBus = createEventBus();
      const store = createCharacterStore(eventBus);
      const ch = store.createCharacter(projectId, makeCharacterData());
      store.setSnapshotAtTimeline(ch.id, 'tp-1', { appearance: 'snap1' });
      store.setSnapshotAtTimeline(ch.id, 'tp-2', { appearance: 'snap2' });

      eventBus.emit({ type: 'timeline:deleted', pointId: 'tp-1' });

      expect(store.getSnapshotAtTimeline(ch.id, 'tp-1')).toBeUndefined();
      expect(store.getSnapshotAtTimeline(ch.id, 'tp-2')).toBeDefined();
    });

    it('should delete snapshots for multiple characters when timeline point is deleted', () => {
      const eventBus = createEventBus();
      const store = createCharacterStore(eventBus);
      const ch1 = store.createCharacter(projectId, makeCharacterData({ name: 'A' }));
      const ch2 = store.createCharacter(projectId, makeCharacterData({ name: 'B' }));
      store.setSnapshotAtTimeline(ch1.id, 'tp-1', { appearance: 'A' });
      store.setSnapshotAtTimeline(ch2.id, 'tp-1', { appearance: 'B' });

      eventBus.emit({ type: 'timeline:deleted', pointId: 'tp-1' });

      expect(store.getSnapshotAtTimeline(ch1.id, 'tp-1')).toBeUndefined();
      expect(store.getSnapshotAtTimeline(ch2.id, 'tp-1')).toBeUndefined();
    });

    it('should work without eventBus', () => {
      const store = createCharacterStore();
      const ch = store.createCharacter(projectId, makeCharacterData());
      expect(ch.name).toBe('张三');
    });
  });
});

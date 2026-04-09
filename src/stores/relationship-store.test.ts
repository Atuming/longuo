import { describe, it, expect } from 'vitest';
import { createRelationshipStore } from './relationship-store';
import { createEventBus } from '../lib/event-bus';
import type { CharacterRelationship } from '../types/relationship';

describe('RelationshipStore', () => {
  const projectId = 'proj-1';

  function makeRelData(overrides: Partial<Omit<CharacterRelationship, 'id'>> = {}): Omit<CharacterRelationship, 'id'> {
    return {
      projectId: overrides.projectId ?? projectId,
      sourceCharacterId: overrides.sourceCharacterId ?? 'char-a',
      targetCharacterId: overrides.targetCharacterId ?? 'char-b',
      relationshipType: overrides.relationshipType ?? 'friend',
      description: overrides.description ?? '好朋友',
      startTimelinePointId: overrides.startTimelinePointId ?? 'tp-1',
      endTimelinePointId: overrides.endTimelinePointId,
      strength: overrides.strength ?? 5,
      customTypeName: overrides.customTypeName,
    };
  }

  // sortOrder lookup for timeline-based tests
  const sortOrders: Record<string, number> = {
    'tp-1': 1,
    'tp-2': 2,
    'tp-3': 3,
    'tp-4': 4,
  };

  function makeStoreWithTimeline() {
    return createRelationshipStore({
      getTimelinePointSortOrder: (id) => sortOrders[id],
    });
  }

  describe('createRelationship', () => {
    it('should create a relationship with generated id', () => {
      const store = createRelationshipStore();
      const rel = store.createRelationship(makeRelData());
      expect(rel.id).toBeTruthy();
      expect(rel.projectId).toBe(projectId);
      expect(rel.sourceCharacterId).toBe('char-a');
      expect(rel.targetCharacterId).toBe('char-b');
      expect(rel.relationshipType).toBe('friend');
      expect(rel.strength).toBe(5);
    });

    it('should return a defensive copy', () => {
      const store = createRelationshipStore();
      const rel = store.createRelationship(makeRelData());
      rel.description = 'mutated';
      const fetched = store.getRelationship(rel.id)!;
      expect(fetched.description).toBe('好朋友');
    });

    it('should preserve customTypeName when provided', () => {
      const store = createRelationshipStore();
      const rel = store.createRelationship(makeRelData({ relationshipType: 'custom', customTypeName: '义兄弟' }));
      expect(rel.customTypeName).toBe('义兄弟');
    });

    it('should preserve endTimelinePointId when provided', () => {
      const store = createRelationshipStore();
      const rel = store.createRelationship(makeRelData({ endTimelinePointId: 'tp-3' }));
      expect(rel.endTimelinePointId).toBe('tp-3');
    });
  });

  describe('getRelationship', () => {
    it('should return undefined for non-existent id', () => {
      const store = createRelationshipStore();
      expect(store.getRelationship('non-existent')).toBeUndefined();
    });

    it('should return a defensive copy', () => {
      const store = createRelationshipStore();
      const rel = store.createRelationship(makeRelData());
      const fetched = store.getRelationship(rel.id)!;
      fetched.strength = 999;
      expect(store.getRelationship(rel.id)!.strength).toBe(5);
    });
  });

  describe('listRelationships', () => {
    it('should return empty array for empty store', () => {
      const store = createRelationshipStore();
      expect(store.listRelationships(projectId)).toEqual([]);
    });

    it('should filter by projectId', () => {
      const store = createRelationshipStore();
      store.createRelationship(makeRelData({ projectId: 'proj-a' }));
      store.createRelationship(makeRelData({ projectId: 'proj-b' }));
      store.createRelationship(makeRelData({ projectId: 'proj-a' }));
      expect(store.listRelationships('proj-a')).toHaveLength(2);
      expect(store.listRelationships('proj-b')).toHaveLength(1);
    });
  });

  describe('listRelationshipsAtTimeline', () => {
    it('should return empty when no getSortOrder callback', () => {
      const store = createRelationshipStore();
      store.createRelationship(makeRelData());
      expect(store.listRelationshipsAtTimeline(projectId, 'tp-1')).toEqual([]);
    });

    it('should return empty for unknown timelinePointId', () => {
      const store = makeStoreWithTimeline();
      store.createRelationship(makeRelData());
      expect(store.listRelationshipsAtTimeline(projectId, 'unknown')).toEqual([]);
    });

    it('should include relationship when target is at or after start and no end', () => {
      const store = makeStoreWithTimeline();
      store.createRelationship(makeRelData({ startTimelinePointId: 'tp-2' }));
      // tp-1 (sortOrder=1) < tp-2 (sortOrder=2), so not active at tp-1
      expect(store.listRelationshipsAtTimeline(projectId, 'tp-1')).toHaveLength(0);
      // tp-2 (sortOrder=2) == tp-2 (sortOrder=2), active
      expect(store.listRelationshipsAtTimeline(projectId, 'tp-2')).toHaveLength(1);
      // tp-3 (sortOrder=3) > tp-2 (sortOrder=2), active (no end)
      expect(store.listRelationshipsAtTimeline(projectId, 'tp-3')).toHaveLength(1);
    });

    it('should exclude relationship when target is after end', () => {
      const store = makeStoreWithTimeline();
      store.createRelationship(makeRelData({ startTimelinePointId: 'tp-1', endTimelinePointId: 'tp-2' }));
      expect(store.listRelationshipsAtTimeline(projectId, 'tp-1')).toHaveLength(1);
      expect(store.listRelationshipsAtTimeline(projectId, 'tp-2')).toHaveLength(1);
      expect(store.listRelationshipsAtTimeline(projectId, 'tp-3')).toHaveLength(0);
    });

    it('should skip relationships with unknown start/end timeline points', () => {
      const store = makeStoreWithTimeline();
      store.createRelationship(makeRelData({ startTimelinePointId: 'unknown-tp' }));
      expect(store.listRelationshipsAtTimeline(projectId, 'tp-2')).toHaveLength(0);
    });
  });

  describe('listRelationshipsForCharacter', () => {
    it('should return relationships where character is source or target', () => {
      const store = createRelationshipStore();
      store.createRelationship(makeRelData({ sourceCharacterId: 'char-a', targetCharacterId: 'char-b' }));
      store.createRelationship(makeRelData({ sourceCharacterId: 'char-c', targetCharacterId: 'char-a' }));
      store.createRelationship(makeRelData({ sourceCharacterId: 'char-b', targetCharacterId: 'char-c' }));
      expect(store.listRelationshipsForCharacter('char-a')).toHaveLength(2);
      expect(store.listRelationshipsForCharacter('char-c')).toHaveLength(2);
      expect(store.listRelationshipsForCharacter('char-b')).toHaveLength(2);
    });

    it('should return empty for character with no relationships', () => {
      const store = createRelationshipStore();
      expect(store.listRelationshipsForCharacter('char-x')).toEqual([]);
    });
  });

  describe('updateRelationship', () => {
    it('should update specified fields', () => {
      const store = createRelationshipStore();
      const rel = store.createRelationship(makeRelData());
      store.updateRelationship(rel.id, { description: '死敌', relationshipType: 'enemy', strength: 10 });
      const updated = store.getRelationship(rel.id)!;
      expect(updated.description).toBe('死敌');
      expect(updated.relationshipType).toBe('enemy');
      expect(updated.strength).toBe(10);
      expect(updated.sourceCharacterId).toBe('char-a'); // unchanged
    });

    it('should do nothing for non-existent id', () => {
      const store = createRelationshipStore();
      expect(() => store.updateRelationship('non-existent', { description: 'x' })).not.toThrow();
    });
  });

  describe('deleteRelationship', () => {
    it('should remove the relationship', () => {
      const store = createRelationshipStore();
      const rel = store.createRelationship(makeRelData());
      store.deleteRelationship(rel.id);
      expect(store.getRelationship(rel.id)).toBeUndefined();
    });

    it('should not affect other relationships', () => {
      const store = createRelationshipStore();
      const r1 = store.createRelationship(makeRelData({ description: 'r1' }));
      const r2 = store.createRelationship(makeRelData({ description: 'r2' }));
      store.deleteRelationship(r1.id);
      expect(store.getRelationship(r2.id)).toBeDefined();
    });
  });

  describe('filterByType', () => {
    it('should return only relationships of the specified type', () => {
      const store = createRelationshipStore();
      store.createRelationship(makeRelData({ relationshipType: 'friend' }));
      store.createRelationship(makeRelData({ relationshipType: 'enemy' }));
      store.createRelationship(makeRelData({ relationshipType: 'friend' }));
      store.createRelationship(makeRelData({ relationshipType: 'family' }));
      expect(store.filterByType(projectId, 'friend')).toHaveLength(2);
      expect(store.filterByType(projectId, 'enemy')).toHaveLength(1);
      expect(store.filterByType(projectId, 'family')).toHaveLength(1);
      expect(store.filterByType(projectId, 'lover')).toHaveLength(0);
    });

    it('should filter by projectId as well', () => {
      const store = createRelationshipStore();
      store.createRelationship(makeRelData({ projectId: 'proj-a', relationshipType: 'friend' }));
      store.createRelationship(makeRelData({ projectId: 'proj-b', relationshipType: 'friend' }));
      expect(store.filterByType('proj-a', 'friend')).toHaveLength(1);
    });
  });

  describe('EventBus integration', () => {
    it('should delete relationships referencing deleted timeline point (start)', () => {
      const eventBus = createEventBus();
      const store = createRelationshipStore({ eventBus });
      const r1 = store.createRelationship(makeRelData({ startTimelinePointId: 'tp-1' }));
      const r2 = store.createRelationship(makeRelData({ startTimelinePointId: 'tp-2' }));

      eventBus.emit({ type: 'timeline:deleted', pointId: 'tp-1' });

      expect(store.getRelationship(r1.id)).toBeUndefined();
      expect(store.getRelationship(r2.id)).toBeDefined();
    });

    it('should delete relationships referencing deleted timeline point (end)', () => {
      const eventBus = createEventBus();
      const store = createRelationshipStore({ eventBus });
      const r1 = store.createRelationship(makeRelData({ startTimelinePointId: 'tp-1', endTimelinePointId: 'tp-3' }));
      const r2 = store.createRelationship(makeRelData({ startTimelinePointId: 'tp-1', endTimelinePointId: 'tp-4' }));

      eventBus.emit({ type: 'timeline:deleted', pointId: 'tp-3' });

      expect(store.getRelationship(r1.id)).toBeUndefined();
      expect(store.getRelationship(r2.id)).toBeDefined();
    });

    it('should work without eventBus', () => {
      const store = createRelationshipStore();
      const rel = store.createRelationship(makeRelData());
      expect(rel.id).toBeTruthy();
    });
  });
});

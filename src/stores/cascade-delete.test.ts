import { describe, it, expect, vi } from 'vitest';
import { createEventBus } from '../lib/event-bus';
import { createCharacterStore } from './character-store';
import { createRelationshipStore } from './relationship-store';
import { createWorldStore } from './world-store';
import { createTimelineStore } from './timeline-store';
import { createChapterStore } from './chapter-store';
import { createPlotStore } from './plot-store';

const PROJECT_ID = 'proj-cascade';

/**
 * 级联删除单元测试
 * 验证需求 2.1-2.9：跨模块级联删除一致性
 */
describe('Cascade Delete', () => {
  /** 创建共享 EventBus 的全部 Store */
  function createStores() {
    const eventBus = createEventBus();
    const characterStore = createCharacterStore(eventBus);
    const relationshipStore = createRelationshipStore({ eventBus });
    const worldStore = createWorldStore({ eventBus });
    const timelineStore = createTimelineStore({ eventBus });
    const chapterStore = createChapterStore({ eventBus });
    const plotStore = createPlotStore({ eventBus });
    return { eventBus, characterStore, relationshipStore, worldStore, timelineStore, chapterStore, plotStore };
  }

  describe('角色删除级联 (Req 2.1-2.4)', () => {
    // Req 2.1: 删除角色后，该角色的所有时间线快照被清理
    it('should delete character timeline snapshots when character is deleted (Req 2.1)', () => {
      const { characterStore, timelineStore } = createStores();

      const char = characterStore.createCharacter(PROJECT_ID, {
        name: '张三', aliases: [], appearance: '', personality: '', backstory: '', customAttributes: {},
      });

      // 创建时间线节点
      const tp = timelineStore.createTimelinePoint({
        projectId: PROJECT_ID, label: '开篇', description: '', sortOrder: 0,
        associatedChapterIds: [], associatedCharacterIds: [char.id],
      });

      // 设置快照
      characterStore.setSnapshotAtTimeline(char.id, tp.id, { appearance: '年轻' });
      expect(characterStore.getSnapshotAtTimeline(char.id, tp.id)).toBeDefined();

      // 删除角色
      characterStore.deleteCharacter(char.id);

      // 快照应被清理
      expect(characterStore.getSnapshotAtTimeline(char.id, tp.id)).toBeUndefined();
    });

    // Req 2.2: 删除角色后，引用该角色的关系记录被清理
    it('should delete relationships referencing the deleted character (Req 2.2)', () => {
      const { characterStore, relationshipStore, timelineStore } = createStores();

      const charA = characterStore.createCharacter(PROJECT_ID, {
        name: 'A', aliases: [], appearance: '', personality: '', backstory: '', customAttributes: {},
      });
      const charB = characterStore.createCharacter(PROJECT_ID, {
        name: 'B', aliases: [], appearance: '', personality: '', backstory: '', customAttributes: {},
      });
      const charC = characterStore.createCharacter(PROJECT_ID, {
        name: 'C', aliases: [], appearance: '', personality: '', backstory: '', customAttributes: {},
      });

      const tp = timelineStore.createTimelinePoint({
        projectId: PROJECT_ID, label: 'tp', description: '', sortOrder: 0,
        associatedChapterIds: [], associatedCharacterIds: [],
      });

      // A-B 关系
      const relAB = relationshipStore.createRelationship({
        projectId: PROJECT_ID, sourceCharacterId: charA.id, targetCharacterId: charB.id,
        relationshipType: 'friend', description: '好友', startTimelinePointId: tp.id, strength: 5,
      });
      // B-C 关系（不涉及 A）
      const relBC = relationshipStore.createRelationship({
        projectId: PROJECT_ID, sourceCharacterId: charB.id, targetCharacterId: charC.id,
        relationshipType: 'ally', description: '盟友', startTimelinePointId: tp.id, strength: 3,
      });

      // 删除角色 A
      characterStore.deleteCharacter(charA.id);

      // A-B 关系应被删除
      expect(relationshipStore.getRelationship(relAB.id)).toBeUndefined();
      // B-C 关系应保留
      expect(relationshipStore.getRelationship(relBC.id)).toBeDefined();
    });

    // Req 2.3: 删除角色后，WorldEntry.associatedCharacterIds 被清理
    it('should remove deleted character from WorldEntry.associatedCharacterIds (Req 2.3)', () => {
      const { characterStore, worldStore } = createStores();

      const charA = characterStore.createCharacter(PROJECT_ID, {
        name: 'A', aliases: [], appearance: '', personality: '', backstory: '', customAttributes: {},
      });
      const charB = characterStore.createCharacter(PROJECT_ID, {
        name: 'B', aliases: [], appearance: '', personality: '', backstory: '', customAttributes: {},
      });

      const entry = worldStore.createEntry({
        projectId: PROJECT_ID, type: 'location', name: '京城',
        description: '首都', associatedCharacterIds: [charA.id, charB.id],
      });

      // 删除角色 A
      characterStore.deleteCharacter(charA.id);

      const updated = worldStore.getEntry(entry.id)!;
      expect(updated.associatedCharacterIds).toEqual([charB.id]);
      expect(updated.associatedCharacterIds).not.toContain(charA.id);
    });

    // Req 2.4: 删除角色后，TimelinePoint.associatedCharacterIds 被清理
    it('should remove deleted character from TimelinePoint.associatedCharacterIds (Req 2.4)', () => {
      const { characterStore, timelineStore } = createStores();

      const charA = characterStore.createCharacter(PROJECT_ID, {
        name: 'A', aliases: [], appearance: '', personality: '', backstory: '', customAttributes: {},
      });
      const charB = characterStore.createCharacter(PROJECT_ID, {
        name: 'B', aliases: [], appearance: '', personality: '', backstory: '', customAttributes: {},
      });

      const tp = timelineStore.createTimelinePoint({
        projectId: PROJECT_ID, label: '事件', description: '', sortOrder: 0,
        associatedChapterIds: [], associatedCharacterIds: [charA.id, charB.id],
      });

      // 删除角色 A
      characterStore.deleteCharacter(charA.id);

      const updated = timelineStore.getTimelinePoint(tp.id)!;
      expect(updated.associatedCharacterIds).toEqual([charB.id]);
      expect(updated.associatedCharacterIds).not.toContain(charA.id);
    });
  });

  describe('章节删除级联 (Req 2.6-2.7)', () => {
    // Req 2.6: 删除章节后递归删除所有子章节
    it('should recursively delete all descendant chapters (Req 2.6)', () => {
      const { chapterStore } = createStores();

      const vol = chapterStore.createChapter(PROJECT_ID, null, '第一卷', 'volume');
      const ch1 = chapterStore.createChapter(PROJECT_ID, vol.id, '第一章', 'chapter');
      const sec1 = chapterStore.createChapter(PROJECT_ID, ch1.id, '第一节', 'section');
      const ch2 = chapterStore.createChapter(PROJECT_ID, vol.id, '第二章', 'chapter');

      // 删除卷
      chapterStore.deleteChapter(vol.id);

      expect(chapterStore.getChapter(vol.id)).toBeUndefined();
      expect(chapterStore.getChapter(ch1.id)).toBeUndefined();
      expect(chapterStore.getChapter(sec1.id)).toBeUndefined();
      expect(chapterStore.getChapter(ch2.id)).toBeUndefined();
    });

    // Req 2.7: 删除章节后，PlotThread.associatedChapterIds 被清理
    it('should remove deleted chapter IDs from PlotThread.associatedChapterIds (Req 2.7)', () => {
      const { chapterStore, plotStore } = createStores();

      const vol = chapterStore.createChapter(PROJECT_ID, null, '第一卷', 'volume');
      const ch1 = chapterStore.createChapter(PROJECT_ID, vol.id, '第一章', 'chapter');
      const ch2 = chapterStore.createChapter(PROJECT_ID, null, '独立章', 'chapter');

      const thread = plotStore.createThread({
        projectId: PROJECT_ID, name: '主线', description: '主要情节',
        status: 'in_progress', associatedChapterIds: [vol.id, ch1.id, ch2.id],
      });

      // 删除卷（含子章节 ch1）
      chapterStore.deleteChapter(vol.id);

      const updated = plotStore.getThread(thread.id)!;
      // vol 和 ch1 都应被移除，ch2 保留
      expect(updated.associatedChapterIds).toEqual([ch2.id]);
      expect(updated.associatedChapterIds).not.toContain(vol.id);
      expect(updated.associatedChapterIds).not.toContain(ch1.id);
    });

    // Req 2.7: 删除章节后，TimelinePoint.associatedChapterIds 被清理
    it('should remove deleted chapter IDs from TimelinePoint.associatedChapterIds (Req 2.7)', () => {
      const { chapterStore, timelineStore } = createStores();

      const ch1 = chapterStore.createChapter(PROJECT_ID, null, '第一章', 'chapter');
      const sec1 = chapterStore.createChapter(PROJECT_ID, ch1.id, '第一节', 'section');
      const ch2 = chapterStore.createChapter(PROJECT_ID, null, '第二章', 'chapter');

      const tp = timelineStore.createTimelinePoint({
        projectId: PROJECT_ID, label: '事件', description: '', sortOrder: 0,
        associatedChapterIds: [ch1.id, sec1.id, ch2.id], associatedCharacterIds: [],
      });

      // 删除 ch1（含子节 sec1）
      chapterStore.deleteChapter(ch1.id);

      const updated = timelineStore.getTimelinePoint(tp.id)!;
      expect(updated.associatedChapterIds).toEqual([ch2.id]);
      expect(updated.associatedChapterIds).not.toContain(ch1.id);
      expect(updated.associatedChapterIds).not.toContain(sec1.id);
    });
  });

  describe('自定义分类删除 (Req 2.8)', () => {
    // Req 2.8: 删除自定义分类后，WorldEntry type 重置为 'rule'
    it('should reset WorldEntry type to rule when custom category is deleted (Req 2.8)', () => {
      const { worldStore } = createStores();

      const cat = worldStore.addCustomCategory(PROJECT_ID, '自定义势力');

      // 创建使用自定义分类的条目
      const entry1 = worldStore.createEntry({
        projectId: PROJECT_ID, type: cat.key, name: '条目1',
        description: '描述', associatedCharacterIds: [],
      });
      // 创建使用内置分类的条目
      const entry2 = worldStore.createEntry({
        projectId: PROJECT_ID, type: 'location', name: '条目2',
        description: '描述', associatedCharacterIds: [],
      });

      // 删除自定义分类
      worldStore.deleteCustomCategory(PROJECT_ID, cat.key);

      const updated1 = worldStore.getEntry(entry1.id)!;
      const updated2 = worldStore.getEntry(entry2.id)!;
      expect(updated1.type).toBe('rule');
      expect(updated2.type).toBe('location'); // 不受影响
    });
  });

  describe('级联删除错误隔离 (Req 2.9)', () => {
    // Req 2.9: 某一步失败不影响其他步骤
    it('should continue cascade cleanup even if one listener throws (Req 2.9)', () => {
      const eventBus = createEventBus();
      const characterStore = createCharacterStore(eventBus);
      const worldStore = createWorldStore({ eventBus });
      const timelineStore = createTimelineStore({ eventBus });

      // 注入一个会抛出异常的监听器（模拟 RelationshipStore 出错）
      eventBus.on('character:deleted', () => {
        throw new Error('模拟 RelationshipStore 清理失败');
      });

      const char = characterStore.createCharacter(PROJECT_ID, {
        name: '测试角色', aliases: [], appearance: '', personality: '', backstory: '', customAttributes: {},
      });

      const entry = worldStore.createEntry({
        projectId: PROJECT_ID, type: 'location', name: '地点',
        description: '', associatedCharacterIds: [char.id],
      });

      const tp = timelineStore.createTimelinePoint({
        projectId: PROJECT_ID, label: '事件', description: '', sortOrder: 0,
        associatedChapterIds: [], associatedCharacterIds: [char.id],
      });

      // 抑制 console.error 输出
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // 删除角色——即使有监听器抛出异常，其他监听器仍应正常执行
      characterStore.deleteCharacter(char.id);

      // 角色本身应被删除
      expect(characterStore.getCharacter(char.id)).toBeUndefined();

      // WorldStore 和 TimelineStore 的清理应正常完成
      const updatedEntry = worldStore.getEntry(entry.id)!;
      expect(updatedEntry.associatedCharacterIds).not.toContain(char.id);

      const updatedTp = timelineStore.getTimelinePoint(tp.id)!;
      expect(updatedTp.associatedCharacterIds).not.toContain(char.id);

      // EventBus 应记录了错误
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});

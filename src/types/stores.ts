import type { NovelProject, RecentProject } from './project';
import type { Chapter } from './chapter';
import type { Character, CharacterTimelineSnapshot } from './character';
import type { CharacterRelationship } from './relationship';
import type { TimelinePoint } from './timeline';
import type { WorldEntry, CustomWorldCategory } from './world';
import type { PlotThread } from './plot';
import type { AIConfig, AIProvider, PromptTemplate, AIHistoryRecord, WritingSkill } from './ai';

/** 项目 Store */
export interface ProjectStore {
  createProject(name: string, description: string): Promise<NovelProject>;
  openProject(): Promise<NovelProject>;
  openRecentProject(filePath: string): Promise<NovelProject>;
  saveProject(): Promise<void>;
  closeProject(): Promise<void>;
  getCurrentProject(): NovelProject | null;
  getRecentProjects(): RecentProject[];
  updateProject(updates: Partial<Pick<NovelProject, 'name' | 'description'>>): Promise<void>;
}

/** 章节 Store */
export interface ChapterStore {
  createChapter(projectId: string, parentId: string | null, title: string, level: Chapter['level']): Chapter;
  getChapter(id: string): Chapter | undefined;
  listChapters(projectId: string): Chapter[];
  updateChapter(id: string, updates: Partial<Pick<Chapter, 'title' | 'content' | 'sortOrder' | 'parentId'>>): void;
  deleteChapter(id: string): void;
  reorderChapter(id: string, newSortOrder: number, newParentId?: string | null): void;
  getWordCount(id: string): number;
}

/** 角色 Store */
export interface CharacterStore {
  createCharacter(projectId: string, data: Omit<Character, 'id' | 'projectId'>): Character;
  getCharacter(id: string): Character | undefined;
  listCharacters(projectId: string): Character[];
  searchCharacters(projectId: string, query: string): Character[];
  updateCharacter(id: string, updates: Partial<Omit<Character, 'id' | 'projectId'>>): void;
  deleteCharacter(id: string): void;
  getSnapshotAtTimeline(characterId: string, timelinePointId: string): CharacterTimelineSnapshot | undefined;
  setSnapshotAtTimeline(characterId: string, timelinePointId: string, data: Partial<Omit<CharacterTimelineSnapshot, 'id' | 'characterId' | 'timelinePointId'>>): void;
}

/** 关系 Store */
export interface RelationshipStore {
  createRelationship(data: Omit<CharacterRelationship, 'id'>): CharacterRelationship;
  getRelationship(id: string): CharacterRelationship | undefined;
  listRelationships(projectId: string): CharacterRelationship[];
  listRelationshipsAtTimeline(projectId: string, timelinePointId: string): CharacterRelationship[];
  listRelationshipsForCharacter(characterId: string): CharacterRelationship[];
  updateRelationship(id: string, updates: Partial<Omit<CharacterRelationship, 'id' | 'projectId'>>): void;
  deleteRelationship(id: string): void;
  filterByType(projectId: string, type: CharacterRelationship['relationshipType']): CharacterRelationship[];
}

/** 世界观 Store */
export interface WorldStore {
  createEntry(data: Omit<WorldEntry, 'id'>): WorldEntry;
  getEntry(id: string): WorldEntry | undefined;
  listEntries(projectId: string): WorldEntry[];
  filterByType(projectId: string, type: string): WorldEntry[];
  searchEntries(projectId: string, query: string): WorldEntry[];
  updateEntry(id: string, updates: Partial<Omit<WorldEntry, 'id' | 'projectId'>>): void;
  deleteEntry(id: string): void;

  // 自定义分类管理
  listCustomCategories(projectId: string): CustomWorldCategory[];
  addCustomCategory(projectId: string, label: string): CustomWorldCategory;
  updateCustomCategory(projectId: string, key: string, label: string): void;
  deleteCustomCategory(projectId: string, key: string): void;
  getAllCategories(projectId: string): Array<{ key: string; label: string; color: { bg: string; text: string }; isBuiltIn: boolean }>;
}

/** 时间线 Store */
export interface TimelineStore {
  createTimelinePoint(data: Omit<TimelinePoint, 'id'>): TimelinePoint;
  getTimelinePoint(id: string): TimelinePoint | undefined;
  listTimelinePoints(projectId: string): TimelinePoint[];
  updateTimelinePoint(id: string, updates: Partial<Omit<TimelinePoint, 'id' | 'projectId'>>): void;
  deleteTimelinePoint(id: string): void;
  reorderTimelinePoint(id: string, newSortOrder: number): void;
  filterByChapter(projectId: string, chapterId: string): TimelinePoint[];
  filterByCharacter(projectId: string, characterId: string): TimelinePoint[];
  getReferences(id: string): { characterSnapshots: number; relationships: number };
}

/** 情节 Store */
export interface PlotStore {
  createThread(data: Omit<PlotThread, 'id'>): PlotThread;
  getThread(id: string): PlotThread | undefined;
  listThreads(projectId: string): PlotThread[];
  filterByStatus(projectId: string, status: PlotThread['status']): PlotThread[];
  updateThread(id: string, updates: Partial<Omit<PlotThread, 'id' | 'projectId'>>): void;
  deleteThread(id: string): void;
}

/** AI 配置 Store */
export interface AIAssistantStore {
  getConfig(): AIConfig;
  updateConfig(updates: Partial<AIConfig>): void;
  addProvider(data: Omit<AIProvider, 'id'>): AIProvider;
  updateProvider(id: string, updates: Partial<Omit<AIProvider, 'id'>>): void;
  deleteProvider(id: string): void;
  setActiveProvider(id: string): void;
  getActiveProvider(): AIProvider | null;
  addTemplate(data: Omit<PromptTemplate, 'id'>): PromptTemplate;
  updateTemplate(id: string, updates: Partial<Omit<PromptTemplate, 'id'>>): void;
  deleteTemplate(id: string): void;
  setActiveTemplate(id: string): void;
  getActiveTemplate(): PromptTemplate;

  // AI 历史记录方法
  addHistoryRecord(projectId: string, record: Omit<AIHistoryRecord, 'id' | 'timestamp'>): AIHistoryRecord;
  listHistory(projectId: string): AIHistoryRecord[];
  getHistoryRecord(projectId: string, id: string): AIHistoryRecord | undefined;
  clearHistory(projectId: string): void;

  // 技能管理
  listSkills(): WritingSkill[];
  getSkill(id: string): WritingSkill | undefined;
  addSkill(data: Omit<WritingSkill, 'id' | 'builtIn'>): WritingSkill;
  updateSkill(id: string, updates: Partial<Omit<WritingSkill, 'id' | 'builtIn'>>): void;
  deleteSkill(id: string): void;
  resetSkill(id: string): void;
  reorderSkills(orderedIds: string[]): void;
  setBuiltInSkills(skills: WritingSkill[]): void;
}

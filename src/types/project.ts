import type { Chapter } from './chapter';
import type { Character, CharacterTimelineSnapshot } from './character';
import type { CharacterRelationship } from './relationship';
import type { TimelinePoint } from './timeline';
import type { CustomWorldCategory, WorldEntry } from './world';
import type { PlotThread } from './plot';
import type { AIConfig } from './ai';

/** .novel 项目文件的完整数据结构 */
export interface NovelFileData {
  version: number;
  project: NovelProject;
  chapters: Chapter[];
  characters: Character[];
  characterSnapshots: CharacterTimelineSnapshot[];
  relationships: CharacterRelationship[];
  timelinePoints: TimelinePoint[];
  worldEntries: WorldEntry[];
  plotThreads: PlotThread[];
  aiConfig?: AIConfig;
  customWorldCategories?: CustomWorldCategory[];
}

/** 小说项目元数据 */
export interface NovelProject {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

/** 最近打开的项目记录（存储在 localStorage 中） */
export interface RecentProject {
  name: string;
  filePath: string;
  lastOpenedAt: Date;
}

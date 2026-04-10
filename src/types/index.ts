// 项目与文件
export type { NovelFileData, NovelProject, RecentProject } from './project';

// 章节
export type { Chapter } from './chapter';

// 角色
export type { Character, CharacterTimelineSnapshot } from './character';

// 角色关系
export type { CharacterRelationship } from './relationship';

// 时间线
export type { TimelinePoint, TimelineEvent } from './timeline';

// 世界观
export type { WorldEntry, BuiltInCategory, CustomWorldCategory } from './world';
export { BUILT_IN_CATEGORIES, CUSTOM_CATEGORY_DEFAULT_COLOR, getCategoryInfo } from './world';

// 情节线索
export type { PlotThread } from './plot';

// 一致性检查
export type { ConsistencyIssue, ConsistencyCheckResult } from './consistency';

// 日更目标
export type { DailyGoalConfig, DailyGoalStore } from './daily-goal';

// 快照
export type { Snapshot, SnapshotStore } from './snapshot';

// 主题
export type { ThemeMode, ThemeStore } from './theme';

// 导出
export type { ExportOptions, ExportResult, TypographyOptions } from './export';
export { DEFAULT_TYPOGRAPHY } from './export';

// AI 辅助写作
export type { AIProvider, PromptTemplate, AIConfig, PackedContext, AIGenerateRequest, AIGenerateResult } from './ai';

// 事件总线
export type { EventBus } from './event-bus';

// Store 接口
export type {
  ProjectStore,
  ChapterStore,
  CharacterStore,
  RelationshipStore,
  WorldStore,
  TimelineStore,
  PlotStore,
  AIAssistantStore,
} from './stores';

// 引擎接口
export type {
  FileManager,
  ConsistencyEngine,
  ExportEngine,
  AIAssistantEngine,
} from './engines';

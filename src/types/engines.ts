import type { NovelFileData } from './project';
import type { Chapter } from './chapter';
import type { Character } from './character';
import type { ConsistencyIssue } from './consistency';
import type { ExportOptions, ExportResult } from './export';
import type { PackedContext, AIGenerateRequest, AIGenerateResult, AIProvider, PromptTemplate, WritingSkill, ScoredSkill } from './ai';

/** 文件管理器接口 */
export interface FileManager {
  createNewFile(data: NovelFileData): Promise<FileSystemFileHandle>;
  openFile(): Promise<{ handle: FileSystemFileHandle; data: NovelFileData }>;
  saveFile(handle: FileSystemFileHandle, data: NovelFileData): Promise<void>;
  isSupported(): boolean;
}

/** 一致性引擎接口 */
export interface ConsistencyEngine {
  checkChapter(chapterContent: string, characters: Character[]): ConsistencyIssue[];
  applySuggestion(content: string, issue: ConsistencyIssue): string;
}

/** 导出引擎接口 */
export interface ExportEngine {
  exportProject(chapters: Chapter[], options: ExportOptions): Promise<ExportResult>;
  chaptersToMarkdown(chapters: Chapter[], title: string, author: string): string;
  parseMarkdownToChapters(markdown: string): Chapter[];
  exportChaptersAsTxt(chapters: Chapter[]): Promise<Blob>;
}

/** AI 辅助引擎接口 */
export interface AIAssistantEngine {
  packContext(chapterId: string): PackedContext;
  buildPrompt(context: PackedContext, userInput: string, template: PromptTemplate): { systemPrompt: string; userPrompt: string };
  generate(request: AIGenerateRequest, onChunk?: (chunk: string) => void): Promise<AIGenerateResult>;
  validateConfig(provider: AIProvider): { valid: boolean; errors: string[] };
  abort(): void;
  resolveSkillPrompt(skill: WritingSkill, paramValues: Record<string, string>): string;
  recommendSkills(chapterId: string, skills: WritingSkill[]): ScoredSkill[];
}

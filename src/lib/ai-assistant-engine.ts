import type { AIAssistantEngine } from '../types/engines';
import type {
  ChapterStore,
  CharacterStore,
  WorldStore,
  TimelineStore,
  AIAssistantStore,
} from '../types/stores';
import type {
  PackedContext,
  AIGenerateRequest,
  AIGenerateResult,
  AIProvider,
  PromptTemplate,
  WritingSkill,
  ScoredSkill,
  ContextSignals,
  WritingStyle,
  ConversationMessage,
  TokenUsage,
  ConsistencyReport,
  ConsistencyReportIssue,
} from '../types/ai';
import type { Character } from '../types/character';
import type { WorldEntry } from '../types/world';
import { BUILT_IN_CATEGORIES } from '../types/world';
import { estimateTokens, calculateBudget, estimateRequestTokens } from './token-counter';
import { parseSSEStream } from './sse-parser';
import { analyzeStyleFingerprint, type StyleFingerprint } from './style-analyzer';

export interface AIAssistantEngineDeps {
  chapterStore: ChapterStore;
  characterStore: CharacterStore;
  worldStore: WorldStore;
  timelineStore: TimelineStore;
  aiStore: AIAssistantStore;
}

/** 所有支持的占位符 */
const PLACEHOLDERS = [
  '{chapter_content}',
  '{prev_chapter_summary}',
  '{next_chapter_summary}',
  '{character_info}',
  '{world_setting}',
  '{timeline_context}',
  '{selected_text}',
  '{writing_style}',
  '{user_input}',
] as const;

/** 替换模板中的所有占位符 */
function replacePlaceholders(template: string, values: Record<string, string>): string {
  let result = template;
  for (const placeholder of PLACEHOLDERS) {
    const key = placeholder.slice(1, -1);
    result = result.replaceAll(placeholder, values[key] ?? '');
  }
  return result;
}

/** 清理替换后 Prompt 中的空标签行和多余空行 */
function cleanPrompt(prompt: string): string {
  let result = prompt.replace(/^.*[：:]\s*\n(?=\s*\n)/gm, '');
  result = result.replace(/\n{3,}/g, '\n\n');
  return result.trim();
}

/** 取前 N 个字符作为摘要 */
function summarize(content: string, maxLength = 200): string {
  if (!content) return '';
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength) + '...';
}

/** 技能参数占位符正则：{param:key} */
const SKILL_PARAM_RE = /\{param:(\w+)\}/g;

/** 中文对话标记正则 */
const DIALOGUE_RE = /[「」""'']/;

/** 句末标点 */
const SENTENCE_END_RE = /[。！？!?…]$/;

/** 替换技能参数占位符 */
function resolveParams(
  template: string,
  paramValues: Record<string, string>,
  skill: WritingSkill,
): string {
  const requiredKeys = new Set(
    skill.parameters.filter((p) => p.required).map((p) => p.key),
  );

  let result = template.replace(SKILL_PARAM_RE, (match, key: string) => {
    const value = paramValues[key];
    if (value && value.trim()) return value.trim();
    if (requiredKeys.has(key)) return match;
    return '';
  });

  result = result.replace(/ {2,}/g, ' ').trim();
  return result;
}

/** 分析章节上下文信号 */
function analyzeSignals(context: PackedContext): ContextSignals {
  const content = context.chapterContent;
  const wordCount = content.length;
  const hasDialogue = DIALOGUE_RE.test(content);

  const tail = content.slice(-100).trim();
  const isNearEnd = tail.length > 0 && !SENTENCE_END_RE.test(tail);

  const hasCharacters = context.characterInfo.length > 0;
  const hasWorldEntries = context.worldSetting.length > 0;

  return { wordCount, hasDialogue, isNearEnd, hasCharacters, hasWorldEntries };
}

/** 根据信号和条件评分 */
function matchSignal(
  signals: ContextSignals,
  signal: string,
  condition: string,
): boolean {
  switch (signal) {
    case 'wordCount':
      if (condition === 'low') return signals.wordCount < 200;
      if (condition === 'high') return signals.wordCount > 2000;
      return false;
    case 'hasDialogue':
      return condition === 'true' ? signals.hasDialogue : !signals.hasDialogue;
    case 'isNearEnd':
      return condition === 'true' ? signals.isNearEnd : !signals.isNearEnd;
    case 'hasCharacters':
      return condition === 'true' ? signals.hasCharacters : !signals.hasCharacters;
    case 'hasWorldEntries':
      return condition === 'true' ? signals.hasWorldEntries : !signals.hasWorldEntries;
    default:
      return false;
  }
}

/** 将 WritingStyle 转换为 Prompt 可用的文字摘要 */
export function buildWritingStyleSummary(style: WritingStyle): string {
  const parts: string[] = [];

  const genreMap: Record<string, string> = {
    xianxia: '仙侠', wuxia: '武侠', xuanhuan: '玄幻', urban: '都市',
    scifi: '科幻', history: '历史', fantasy: '奇幻', mystery: '悬疑', romance: '言情',
  };

  if (style.genre && style.genre !== 'other') {
    const label = genreMap[style.genre] ?? style.genre;
    parts.push(`小说流派：${label}`);
  } else if (style.genre === 'other' && style.genreCustom) {
    parts.push(`小说流派：${style.genreCustom}`);
  }

  const povMap: Record<string, string> = {
    first: '第一人称', 'third-limited': '第三人称限知视角', 'third-omniscient': '第三人称全知视角',
  };
  if (style.narrativePov && povMap[style.narrativePov]) {
    parts.push(`叙事视角：${povMap[style.narrativePov]}`);
  }

  const langMap: Record<string, string> = {
    classical: '古风典雅', modern: '现代流畅', colloquial: '口语化/接地气',
    literary: '文学性强', minimalist: '极简白描',
  };
  if (style.languageStyle && langMap[style.languageStyle]) {
    parts.push(`语言风格：${langMap[style.languageStyle]}`);
  }

  const toneMap: Record<string, string> = {
    serious: '严肃正剧', light: '轻松诙谐', dark: '暗黑压抑',
    tragic: '悲壮感人', warm: '温馨治愈', suspenseful: '紧张悬疑',
  };
  if (style.tone && toneMap[style.tone]) {
    parts.push(`整体基调：${toneMap[style.tone]}`);
  }

  if (style.customNotes) {
    parts.push(`补充风格要求：${style.customNotes}`);
  }

  return parts.length > 0
    ? '【写作风格设定】\n' + parts.join('\n')
    : '';
}

/* ───── 相关性评分工具 ───── */

/** 计算角色与章节内容的相关性得分 */
function characterRelevanceScore(char: Character, chapterContent: string): number {
  let score = 0;
  const content = chapterContent;
  if (!char.name) return 0; // 空名字不参与评分
  // 名字直接出现（高权重）
  const nameRegex = new RegExp(char.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  const nameMatches = (content.match(nameRegex) || []).length;
  score += nameMatches * 3;

  // 别名出现（中权重）
  for (const alias of char.aliases) {
    const aliasRegex = new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const aliasMatches = (content.match(aliasRegex) || []).length;
    score += aliasMatches * 2;
  }

  return score;
}

/** 计算世界观条目与章节内容的相关性得分 */
function worldEntryRelevanceScore(entry: WorldEntry, chapterContent: string): number {
  let score = 0;
  const content = chapterContent;
  // 名称出现
  const nameRegex = new RegExp(entry.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  score += (content.match(nameRegex) || []).length * 3;

  // 描述关键词出现
  const keywords = entry.description.split(/[，。、；\s]+/).filter((w) => w.length >= 2);
  for (const kw of keywords.slice(0, 5)) {
    if (content.includes(kw)) score += 1;
  }

  return score;
}

/* ───── API 调用基础设施 ───── */

interface APIRequestConfig {
  provider: AIProvider;
  messages: Array<{ role: string; content: string }>;
  onChunk?: (chunk: string) => void;
}

/**
 * 发送 OpenAI 兼容的 API 请求（共享核心逻辑）。
 * 由 generate()、extractWorldEntries()、runConsistencyCheck() 共用。
 */
async function callAIAPI(config: APIRequestConfig, activeState: {
  getRequestId: () => string | null;
  setRequestId: (id: string | null) => void;
  getController: () => AbortController | null;
  setController: (c: AbortController | null) => void;
}): Promise<AIGenerateResult> {
  const { provider, messages, onChunk } = config;
  const requestId = crypto.randomUUID();

  // 取消上一个活跃请求
  const prevController = activeState.getController();
  if (prevController) prevController.abort();

  const controller = new AbortController();
  activeState.setRequestId(requestId);
  activeState.setController(controller);

  const requestBody: Record<string, unknown> = {
    model: provider.modelName,
    messages,
    stream: !!onChunk,
  };

  // 注入生成控制参数
  if ((provider.temperature ?? 0) > 0) requestBody['temperature'] = provider.temperature;
  if ((provider.maxTokens ?? 0) > 0) requestBody['max_tokens'] = provider.maxTokens;
  const topP = provider.topP ?? 1;
  if (topP > 0 && topP < 1) requestBody['top_p'] = topP;
  if ((provider.presencePenalty ?? 0) !== 0) requestBody['presence_penalty'] = provider.presencePenalty;
  if ((provider.frequencyPenalty ?? 0) !== 0) requestBody['frequency_penalty'] = provider.frequencyPenalty;

  const body = JSON.stringify(requestBody);
  const timeoutMs = provider.timeoutMs;

  const timeoutId = setTimeout(() => {
    if (activeState.getRequestId() === requestId) controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(provider.apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const statusMessages: Record<number, string> = {
        401: 'API Key 无效或已过期，请检查配置。',
        403: 'API Key 无效或已过期，请检查配置。',
        429: '请求过于频繁，请稍后重试。',
      };
      const errorMsg = statusMessages[response.status] ??
        (response.status >= 500 ? 'AI 服务暂时不可用，请稍后重试。' : `请求失败（HTTP ${response.status}）。`);
      return { success: false, error: errorMsg };
    }

    // 流式响应 — 使用共享 SSE 解析器
    if (onChunk && response.body) {
      let streamIdleTimer: ReturnType<typeof setTimeout> | null = null;

      const result = await parseSSEStream({
        reader: response.body.getReader(),
        idleTimeoutMs: 30000,
        signal: controller.signal,
        onChunk,
        requestId,
        getActiveRequestId: () => activeState.getRequestId(),
        setIdleTimer: (timer) => { streamIdleTimer = timer; },
      });

      if (streamIdleTimer) clearTimeout(streamIdleTimer);

      // 请求正常完成，清理状态
      if (activeState.getRequestId() === requestId) {
        activeState.setRequestId(null);
        activeState.setController(null);
      }

      if (!result.success) {
        return result;
      }
      return { success: true, content: result.content, truncated: result.truncated };
    }

    // 非流式响应
    const json = await response.json();
    const content = json.choices?.[0]?.message?.content ?? '';

    if (activeState.getRequestId() === requestId) {
      activeState.setRequestId(null);
      activeState.setController(null);
    }

    if (!content) {
      return { success: false, error: 'AI 未生成有效内容，请调整输入后重试。' };
    }
    return { success: true, content };
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof DOMException && error.name === 'AbortError') {
      if (activeState.getRequestId() !== requestId) {
        return { success: false, cancelled: true };
      }
      activeState.setRequestId(null);
      activeState.setController(null);
      return { success: false, error: '请求超时，请增加超时时间或缩短输入内容后重试。' };
    }
    if (error instanceof TypeError) {
      return { success: false, error: '网络错误，请检查网络连接后重试。' };
    }
    return { success: false, error: `请求失败：${error instanceof Error ? error.message : '未知错误'}` };
  }
}

/**
 * 创建 AIAssistantEngine 实例。
 */
export function createAIAssistantEngine(deps: AIAssistantEngineDeps): AIAssistantEngine {
  const { chapterStore, characterStore, worldStore, timelineStore, aiStore } = deps;

  // 并发控制状态
  let activeRequestId: string | null = null;
  let activeController: AbortController | null = null;

  const activeState = {
    getRequestId: () => activeRequestId,
    setRequestId: (id: string | null) => { activeRequestId = id; },
    getController: () => activeController,
    setController: (c: AbortController | null) => { activeController = c; },
  };

  return {
    /* ══════════════════════════════════════════════════════════════
       packContext — 上下文打包（含相关性过滤 + Token 预算管理）
       ══════════════════════════════════════════════════════════════ */
    packContext(chapterId: string, selectedText?: string, writingStyleSummary?: string): PackedContext {
      const chapter = chapterStore.getChapter(chapterId);
      const chapterContent = chapter?.content ?? '';

      // 获取前后章节摘要
      let prevChapterSummary = '';
      let nextChapterSummary = '';
      if (chapter) {
        const allChapters = chapterStore.listChapters(chapter.projectId);
        const currentIndex = allChapters.findIndex((c) => c.id === chapterId);
        if (currentIndex > 0) {
          const prev = allChapters[currentIndex - 1];
          prevChapterSummary = `[${prev.title}] ${summarize(prev.content)}`;
        }
        if (currentIndex >= 0 && currentIndex < allChapters.length - 1) {
          const next = allChapters[currentIndex + 1];
          nextChapterSummary = `[${next.title}] ${summarize(next.content)}`;
        }
      }

      // ── 角色信息（相关性过滤）──
      let characterInfo = '';
      if (chapter) {
        const allChars = characterStore.listCharacters(chapter.projectId);

        // 获取时间线关联的角色 ID
        const timelineCharIds = new Set<string>();
        const timelinePoints = timelineStore.filterByChapter(chapter.projectId, chapterId);
        for (const tp of timelinePoints) {
          for (const cid of tp.associatedCharacterIds) {
            timelineCharIds.add(cid);
          }
        }

        // 计算每个角色的相关性得分
        const scored = allChars.map((char) => ({
          char,
          score: characterRelevanceScore(char, chapterContent),
          isTimelineLinked: timelineCharIds.has(char.id),
        }));

        // 时间线关联的角色始终包含，其余按相关性排序
        const relevant = scored
          .filter((s) => s.score > 0 || s.isTimelineLinked)
          .sort((a, b) => {
            if (a.isTimelineLinked !== b.isTimelineLinked) return a.isTimelineLinked ? -1 : 1;
            return b.score - a.score;
          });

        // 最多包含 15 个角色（避免上下文溢出）
        const selected = relevant.slice(0, 15);

        // 如果时间线没有关联角色且相关性过滤后为空，回退到前 10 个
        const charsToInclude = selected.length > 0 ? selected : scored.slice(0, 10);

        const charInfoParts: string[] = [];
        for (const { char } of charsToInclude) {
          const parts: string[] = [];
          parts.push(`- ${char.name}`);
          if (char.aliases.length > 0) parts.push(`（别名：${char.aliases.join('、')}）`);
          if (char.appearance) parts.push(`\n  外貌：${char.appearance}`);
          if (char.personality) parts.push(`\n  性格：${char.personality}`);
          if (char.backstory) parts.push(`\n  背景：${char.backstory}`);
          charInfoParts.push(parts.join(''));
        }

        if (charsToInclude.length < allChars.length) {
          charInfoParts.push(`\n（共 ${allChars.length} 个角色，此处仅展示与当前章节相关的 ${charsToInclude.length} 个）`);
        }

        characterInfo = charInfoParts.join('\n');
      }

      // ── 世界观设定（相关性过滤）──
      let worldSetting = '';
      if (chapter) {
        const entries = worldStore.listEntries(chapter.projectId);
        if (entries.length > 0) {
          // 按相关性排序
          const scored = entries.map((entry) => ({
            entry,
            score: worldEntryRelevanceScore(entry, chapterContent),
          }));
          const relevant = scored
            .filter((s) => s.score > 0)
            .sort((a, b) => b.score - a.score);

          // 最多 20 条世界观设定
          const selected = relevant.length > 0
            ? relevant.slice(0, 20)
            : scored.slice(0, 10);

          const worldParts: string[] = [];
          for (const { entry } of selected) {
            const catInfo = BUILT_IN_CATEGORIES.find((c) => c.key === entry.type);
            const typeLabel = catInfo?.label ?? entry.type;
            worldParts.push(`- 【${typeLabel}】${entry.name}：${entry.description}`);
          }

          if (selected.length < entries.length) {
            worldParts.push(`\n（共 ${entries.length} 条世界观设定，此处仅展示相关的 ${selected.length} 条）`);
          }

          worldSetting = worldParts.join('\n');
        }
      }

      // ── 时间线上下文 ──
      let timelineContext = '';
      if (chapter) {
        const points = timelineStore.filterByChapter(chapter.projectId, chapterId);
        if (points.length > 0) {
          const timelineParts: string[] = [];
          for (const tp of points.slice(0, 10)) {
            const charNames: string[] = [];
            for (const cid of tp.associatedCharacterIds) {
              const c = characterStore.getCharacter(cid);
              if (c) charNames.push(c.name);
            }
            const charRef = charNames.length > 0 ? `（关联角色：${charNames.join('、')}）` : '';
            timelineParts.push(`- [${tp.label}] ${tp.description}${charRef}`);
          }
          timelineContext = timelineParts.join('\n');
        }
      }

      // ── 选中文本 ──
      const effectiveSelectedText = selectedText?.trim() || '';

      // ── 写作风格摘要 ──
      let effectiveStyleSummary = writingStyleSummary ?? '';
      if (!effectiveStyleSummary) {
        const style = aiStore.getWritingStyle();
        if (style?.enabled) {
          effectiveStyleSummary = buildWritingStyleSummary(style);
        }
      }

      return {
        chapterContent,
        prevChapterSummary,
        nextChapterSummary,
        characterInfo,
        worldSetting,
        timelineContext,
        selectedText: effectiveSelectedText,
        writingStyleSummary: effectiveStyleSummary,
      };
    },

    /* ══════════════════════════════════════════════════════════════
       estimateContextTokens
       ══════════════════════════════════════════════════════════════ */
    estimateContextTokens(chapterId: string, userInput: string, selectedText?: string): TokenUsage {
      const context = this.packContext(chapterId, selectedText);
      const template = aiStore.getActiveTemplate();
      const values: Record<string, string> = {
        chapter_content: context.chapterContent,
        prev_chapter_summary: context.prevChapterSummary,
        next_chapter_summary: context.nextChapterSummary,
        character_info: context.characterInfo,
        world_setting: context.worldSetting,
        timeline_context: context.timelineContext,
        selected_text: context.selectedText,
        writing_style: context.writingStyleSummary,
        user_input: userInput,
      };

      const systemPrompt = cleanPrompt(replacePlaceholders(template.systemPrompt, values));
      const userPrompt = cleanPrompt(replacePlaceholders(template.userPromptTemplate, values));
      const inputTokens = estimateRequestTokens(systemPrompt, userPrompt);

      const provider = aiStore.getActiveProvider();
      const contextLimit = calculateBudget(provider?.modelName);
      const usageRatio = inputTokens / contextLimit;

      return { estimatedInputTokens: inputTokens, contextLimit, usageRatio };
    },

    /* ══════════════════════════════════════════════════════════════
       abort
       ══════════════════════════════════════════════════════════════ */
    abort(): void {
      if (activeController) {
        activeController.abort();
        activeController = null;
      }
      activeRequestId = null;
    },

    /* ══════════════════════════════════════════════════════════════
       buildPrompt — 支持多轮对话
       ══════════════════════════════════════════════════════════════ */
    buildPrompt(
      context: PackedContext,
      userInput: string,
      template: PromptTemplate,
      conversationHistory?: ConversationMessage[],
    ): { systemPrompt: string; userPrompt: string; messages: Array<{ role: string; content: string }> } {
      const values: Record<string, string> = {
        chapter_content: context.chapterContent,
        prev_chapter_summary: context.prevChapterSummary,
        next_chapter_summary: context.nextChapterSummary,
        character_info: context.characterInfo,
        world_setting: context.worldSetting,
        timeline_context: context.timelineContext,
        selected_text: context.selectedText,
        writing_style: context.writingStyleSummary,
        user_input: userInput,
      };

      const systemPrompt = cleanPrompt(replacePlaceholders(template.systemPrompt, values));
      const userPrompt = cleanPrompt(replacePlaceholders(template.userPromptTemplate, values));

      // 构建消息列表（支持多轮对话）
      const messages: Array<{ role: string; content: string }> = [
        { role: 'system', content: systemPrompt },
      ];

      // 插入对话历史（如果有）
      if (conversationHistory && conversationHistory.length > 0) {
        for (const msg of conversationHistory) {
          messages.push({ role: msg.role, content: msg.content });
        }
      }

      messages.push({ role: 'user', content: userPrompt });

      return { systemPrompt, userPrompt, messages };
    },

    /* ══════════════════════════════════════════════════════════════
       generate — 使用共享 SSE 解析器 + Token 报告
       ══════════════════════════════════════════════════════════════ */
    async generate(
      request: AIGenerateRequest,
      onChunk?: (chunk: string) => void,
    ): Promise<AIGenerateResult> {
      const provider = aiStore.getActiveProvider();
      if (!provider) {
        return { success: false, error: 'AI 模型未配置，请前往设置页面配置 AI 模型提供商。' };
      }

      const validation = this.validateConfig(provider);
      if (!validation.valid) {
        return { success: false, error: `AI 配置无效：${validation.errors.join('；')}` };
      }

      const context = this.packContext(request.chapterId, request.selectedText);
      const template = aiStore.getActiveTemplate();
      const { messages } = this.buildPrompt(context, request.userInput, template, request.conversationHistory);

      // 计算 token 用量
      const allContent = messages.map((m) => m.content).join('\n');
      const inputTokens = estimateTokens(allContent);
      const contextLimit = calculateBudget(provider.modelName);

      const result = await callAIAPI({ provider, messages, onChunk }, activeState);

      if (result.success && result.content) {
        result.tokenUsage = { estimatedInputTokens: inputTokens, contextLimit, usageRatio: inputTokens / contextLimit };
      }

      return result;
    },

    /* ══════════════════════════════════════════════════════════════
       validateConfig
       ══════════════════════════════════════════════════════════════ */
    validateConfig(provider: AIProvider): { valid: boolean; errors: string[] } {
      const errors: string[] = [];
      if (!provider.apiKey?.trim()) errors.push('API Key 不能为空');
      if (!provider.apiEndpoint?.trim()) errors.push('API 端点 URL 不能为空');
      if (!provider.modelName?.trim()) errors.push('模型名称不能为空');
      return { valid: errors.length === 0, errors };
    },

    /* ══════════════════════════════════════════════════════════════
       resolveSkillPrompt
       ══════════════════════════════════════════════════════════════ */
    resolveSkillPrompt(skill: WritingSkill, paramValues: Record<string, string>): string {
      let result = resolveParams(skill.promptTemplate, paramValues, skill);

      if (skill.references && skill.references.length > 0) {
        const refBlock = skill.references
          .map((r) => `### ${r.filename}\n${r.content}`)
          .join('\n\n');
        result += `\n\n--- 参考资料 ---\n${refBlock}`;
      }

      return result;
    },

    /* ══════════════════════════════════════════════════════════════
       recommendSkills
       ══════════════════════════════════════════════════════════════ */
    recommendSkills(chapterId: string, skills: WritingSkill[]): ScoredSkill[] {
      const context = this.packContext(chapterId);
      const signals = analyzeSignals(context);
      const scored: ScoredSkill[] = [];

      for (const skill of skills) {
        if (!skill.enabled) continue;

        if (skill.contextHints.length === 0) {
          scored.push({ skill, score: 0.5, matchedSignals: [] });
          continue;
        }

        let totalWeight = 0;
        let matchedWeight = 0;
        const matchedSignals: string[] = [];

        for (const hint of skill.contextHints) {
          const weight = hint.weight ?? 1.0;
          totalWeight += weight;
          if (matchSignal(signals, hint.signal, hint.condition)) {
            matchedWeight += weight;
            matchedSignals.push(hint.signal);
          }
        }

        const score = totalWeight > 0 ? Math.min(matchedWeight / totalWeight, 1.0) : 0.5;
        scored.push({ skill, score, matchedSignals });
      }

      scored.sort((a, b) => b.score - a.score);
      return scored;
    },

    /* ══════════════════════════════════════════════════════════════
       extractWorldEntries — 使用共享 SSE 解析器 + 可配置模板
       ══════════════════════════════════════════════════════════════ */
    async extractWorldEntries(
      text: string,
      onChunk?: (chunk: string) => void,
    ): Promise<AIGenerateResult> {
      const provider = aiStore.getActiveProvider();
      if (!provider) {
        return { success: false, error: 'AI 模型未配置，请前往设置页面配置 AI 模型提供商。' };
      }

      const validation = this.validateConfig(provider);
      if (!validation.valid) {
        return { success: false, error: `AI 配置无效：${validation.errors.join('；')}` };
      }

      // 尝试从技能列表中获取"从文档导入"技能的模板
      const extractSkill = aiStore.getSkill('builtin-extract-world');
      let systemPrompt: string;
      let userPrompt: string;

      if (extractSkill?.promptTemplate) {
        // 使用技能模板（可配置）
        const categoryList = BUILT_IN_CATEGORIES.map((c) => `${c.key}（${c.label}）`).join('、');
        systemPrompt = extractSkill.promptTemplate.replace(/\{category_list\}/g, categoryList);
        userPrompt = `请从以下文本中同时提取角色信息和世界观设定：\n\n${text}`;
      } else {
        // 回退到硬编码模板
        const categoryList = BUILT_IN_CATEGORIES.map((c) => `${c.key}（${c.label}）`).join('、');
        systemPrompt =
          '你是一个小说资料提取助手。你的任务是从给定的文本中同时提取两类信息：角色和世界观设定。' +
          '输出严格的 JSON 对象格式，不要包含任何其他文字说明。' +
          'JSON 结构如下：{"characters":[...],"worldEntries":[...]}\n' +
          'characters 数组中每个元素包含：name（姓名）、aliases（别名列表，字符串数组）、appearance（外貌描写）、personality（性格特点）、backstory（背景故事）。' +
          'worldEntries 数组中每个元素包含：name（名称）、type（分类 key）、description（详细描述）。' +
          `worldEntries 的 type 取值：${categoryList}。` +
          '重要区分：具体的有名字的个体（如"张三""李长老"）归入 characters；抽象设定（如"青云门""灵石""修仙体系"）归入 worldEntries。' +
          '种族分类只用于物种大类（如"人族""妖族"），不要把具体角色放入种族。' +
          '如果某一类没有提取到结果，对应数组为空。';
        userPrompt = `请从以下文本中同时提取角色信息和世界观设定：\n\n${text}`;
      }

      const messages: Array<{ role: string; content: string }> = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      return callAIAPI({ provider, messages, onChunk }, activeState);
    },

    /* ══════════════════════════════════════════════════════════════
       runConsistencyCheck — AI 一致性检查
       ══════════════════════════════════════════════════════════════ */
    async runConsistencyCheck(chapterId: string, onChunk?: (chunk: string) => void): Promise<ConsistencyReport> {
      const provider = aiStore.getActiveProvider();
      if (!provider) {
        return { issues: [], summary: 'AI 模型未配置，无法执行一致性检查。', checkedAt: new Date().toISOString() };
      }

      const validation = this.validateConfig(provider);
      if (!validation.valid) {
        return { issues: [], summary: 'AI 配置无效。', checkedAt: new Date().toISOString() };
      }

      const context = this.packContext(chapterId);
      const chapter = chapterStore.getChapter(chapterId);

      // 收集前面几章内容用于对比
      let previousChaptersContent = '';
      if (chapter) {
        const allChapters = chapterStore.listChapters(chapter.projectId);
        const currentIndex = allChapters.findIndex((c) => c.id === chapterId);
        const prevChapters = allChapters.slice(Math.max(0, currentIndex - 3), currentIndex);
        previousChaptersContent = prevChapters
          .map((c) => `### ${c.title}\n${c.content.slice(0, 500)}`)
          .join('\n\n');
      }

      const systemPrompt =
        '你是一位资深小说编辑，专门负责检查小说的一致性。请对当前章节进行全面的一致性分析。\n\n' +
        '检查维度：\n' +
        '1. 角色一致性：角色性格、行为、说话方式是否与设定及前文一致\n' +
        '2. 时间线一致性：事件发生顺序是否合理，有无时间矛盾\n' +
        '3. 情节连贯性：情节发展是否符合前文铺垫，伏笔是否被遗漏\n' +
        '4. 世界观一致性：设定是否前后矛盾\n' +
        '5. 称呼一致性：角色名称、称号是否前后统一\n\n' +
        '请以严格的 JSON 格式输出检查报告：\n' +
        '{"issues":[{"category":"character|timeline|plot|world|naming","severity":"critical|warning|info","title":"简短标题","description":"详细说明","location":"问题位置引用","suggestion":"修改建议"}],"summary":"总体评价"}\n' +
        '如果没有发现问题，issues 为空数组，summary 中说明未发现明显问题。';

      const userPrompt =
        `请检查以下章节的一致性：\n\n` +
        `【当前章节】${chapter?.title ?? ''}\n${context.chapterContent.slice(0, 3000)}\n\n` +
        `【前文章节摘要】\n${previousChaptersContent || '无'}\n\n` +
        `【角色信息】\n${context.characterInfo.slice(0, 1500)}\n\n` +
        `【世界观设定】\n${context.worldSetting.slice(0, 1000)}\n\n` +
        `【时间线】\n${context.timelineContext.slice(0, 500)}`;

      const messages: Array<{ role: string; content: string }> = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const result = await callAIAPI({ provider, messages, onChunk }, activeState);

      if (!result.success || !result.content) {
        return {
          issues: [],
          summary: result.error ?? '一致性检查失败',
          checkedAt: new Date().toISOString(),
        };
      }

      // 解析 JSON 结果（兼容 ```json 和 ``` json 等变体）
      try {
        const cleanContent = result.content
          .replace(/^```[\s\S]*?\n/gm, '')  // 去除开头的 fence 行（含语言标签）
          .replace(/^```\s*$/gm, '')         // 去除结尾的 fence 行
          .trim();
        const parsed = JSON.parse(cleanContent);
        return {
          issues: (parsed.issues || []).map((issue: Record<string, unknown>, idx: number) => ({
            id: crypto.randomUUID(),
            category: issue.category as ConsistencyReportIssue['category'] ?? 'plot',
            severity: issue.severity as ConsistencyReportIssue['severity'] ?? 'info',
            title: String(issue.title ?? `问题 ${idx + 1}`),
            description: String(issue.description ?? ''),
            location: issue.location ? String(issue.location) : undefined,
            suggestion: String(issue.suggestion ?? ''),
          })),
          summary: String(parsed.summary ?? '检查完成'),
          checkedAt: new Date().toISOString(),
        };
      } catch {
        return {
          issues: [],
          summary: '一致性检查结果解析失败，请重试。',
          checkedAt: new Date().toISOString(),
        };
      }
    },

    /* ══════════════════════════════════════════════════════════════
       analyzeStyle — 分析写作风格指纹
       ══════════════════════════════════════════════════════════════ */
    analyzeStyle(chapterId: string): StyleFingerprint {
      const chapter = chapterStore.getChapter(chapterId);
      if (!chapter) {
        return {
          avgSentenceLength: 0, avgParagraphLength: 0, dialogueRatio: 0,
          topWords: [], styleDescription: '', confidence: 0,
        };
      }

      // 收集最近几章内容
      const allChapters = chapterStore.listChapters(chapter.projectId);
      const currentIndex = allChapters.findIndex((c) => c.id === chapterId);
      const recentChapters = allChapters.slice(Math.max(0, currentIndex - 2), currentIndex + 1);

      return analyzeStyleFingerprint(recentChapters.map((c) => c.content).join('\n\n'));
    },

    /* ══════════════════════════════════════════════════════════════
       runSkillPipeline — 技能链
       ══════════════════════════════════════════════════════════════ */
    async runSkillPipeline(
      chapterId: string,
      skills: WritingSkill[],
      onChunk?: (chunk: string) => void,
    ): Promise<AIGenerateResult> {
      if (skills.length === 0) {
        return { success: false, error: '技能链为空' };
      }

      const provider = aiStore.getActiveProvider();
      if (!provider) {
        return { success: false, error: 'AI 模型未配置' };
      }

      const validation = this.validateConfig(provider);
      if (!validation.valid) {
        return { success: false, error: `AI 配置无效：${validation.errors.join('；')}` };
      }

      // 依次执行每个技能，将上一步输出作为下一步输入
      const template = aiStore.getActiveTemplate();
      const context = this.packContext(chapterId);
      let input = context.chapterContent.slice(-500) || '请开始创作';

      for (let i = 0; i < skills.length; i++) {
        const skill = skills[i];
        const isLast = i === skills.length - 1;

        // 构建当前技能的 prompt
        const skillPrompt = skill.promptTemplate || '';
        const combinedInput = `${skillPrompt}\n\n${input}`;

        const { messages } = this.buildPrompt(context, combinedInput, template);

        const result = await callAIAPI({
          provider,
          messages,
          onChunk: isLast ? onChunk : undefined, // 仅最后一步流式输出
        }, activeState);

        if (!result.success) {
          return { success: false, error: `技能链第 ${i + 1} 步（${skill.name}）失败：${result.error}` };
        }

        input = result.content ?? input;
      }

      // 注意：最后一步已通过 callAIAPI 的 onChunk 流式输出，
      // 此处不再重复调用 onChunk，避免内容重复
      return { success: true, content: input };
    },
  };
}

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
} from '../types/ai';

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
  '{user_input}',
] as const;

/** 替换模板中的所有占位符 */
function replacePlaceholders(template: string, values: Record<string, string>): string {
  let result = template;
  for (const placeholder of PLACEHOLDERS) {
    const key = placeholder.slice(1, -1); // remove { }
    result = result.replaceAll(placeholder, values[key] ?? '');
  }
  return result;
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
    // required 参数缺失时保留占位符
    if (requiredKeys.has(key)) return match;
    // optional 参数缺失时替换为空
    return '';
  });

  // 清理多余空格
  result = result.replace(/ {2,}/g, ' ').trim();
  return result;
}

/** 分析章节上下文信号 */
function analyzeSignals(context: PackedContext): ContextSignals {
  const content = context.chapterContent;
  const wordCount = content.length;
  const hasDialogue = DIALOGUE_RE.test(content);

  // isNearEnd：最后 100 个字符没有句末标点，或内容较短
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

/**
 * 创建 AIAssistantEngine 实例。
 * 负责上下文打包、Prompt 组装、AI API 调用和配置验证。
 */
export function createAIAssistantEngine(deps: AIAssistantEngineDeps): AIAssistantEngine {
  const { chapterStore, characterStore, worldStore, timelineStore, aiStore } = deps;

  // 并发控制状态（闭包变量）
  let activeRequestId: string | null = null;
  let activeController: AbortController | null = null;

  return {
    packContext(chapterId: string): PackedContext {
      const chapter = chapterStore.getChapter(chapterId);
      const chapterContent = chapter?.content ?? '';

      // 获取同项目所有章节（树形排序），找到当前章节的前后章节
      let prevChapterSummary = '';
      let nextChapterSummary = '';
      if (chapter) {
        const allChapters = chapterStore.listChapters(chapter.projectId);
        const currentIndex = allChapters.findIndex((c) => c.id === chapterId);
        if (currentIndex > 0) {
          prevChapterSummary = summarize(allChapters[currentIndex - 1].content);
        }
        if (currentIndex >= 0 && currentIndex < allChapters.length - 1) {
          nextChapterSummary = summarize(allChapters[currentIndex + 1].content);
        }
      }

      // 获取关联角色信息（通过时间线的 associatedCharacterIds）
      let characterInfo = '';
      if (chapter) {
        const characterIds = new Set<string>();
        const timelinePoints = timelineStore.filterByChapter(chapter.projectId, chapterId);
        for (const tp of timelinePoints) {
          for (const cid of tp.associatedCharacterIds) {
            characterIds.add(cid);
          }
        }
        const charInfoParts: string[] = [];
        for (const cid of characterIds) {
          const char = characterStore.getCharacter(cid);
          if (char) {
            const aliases = char.aliases.length > 0 ? `（别名：${char.aliases.join('、')}）` : '';
            charInfoParts.push(
              `【${char.name}${aliases}】外貌：${char.appearance}；性格：${char.personality}；背景：${char.backstory}`
            );
          }
        }
        characterInfo = charInfoParts.join('\n');
      }

      // 获取世界观背景设定
      let worldSetting = '';
      if (chapter) {
        const entries = worldStore.listEntries(chapter.projectId);
        const worldParts: string[] = [];
        for (const entry of entries) {
          const typeLabel = entry.type === 'location' ? '地点' : entry.type === 'faction' ? '势力' : '规则';
          worldParts.push(`【${typeLabel}：${entry.name}】${entry.description}`);
        }
        worldSetting = worldParts.join('\n');
      }

      // 获取时间线上下文
      let timelineContext = '';
      if (chapter) {
        const points = timelineStore.filterByChapter(chapter.projectId, chapterId);
        const timelineParts: string[] = [];
        for (const tp of points) {
          timelineParts.push(`[${tp.label}] ${tp.description}`);
        }
        timelineContext = timelineParts.join('\n');
      }

      return {
        chapterContent,
        prevChapterSummary,
        nextChapterSummary,
        characterInfo,
        worldSetting,
        timelineContext,
      };
    },

    abort(): void {
      if (activeController) {
        activeController.abort();
        activeController = null;
      }
      activeRequestId = null;
    },

    buildPrompt(
      context: PackedContext,
      userInput: string,
      template: PromptTemplate,
    ): { systemPrompt: string; userPrompt: string } {
      const values: Record<string, string> = {
        chapter_content: context.chapterContent,
        prev_chapter_summary: context.prevChapterSummary,
        next_chapter_summary: context.nextChapterSummary,
        character_info: context.characterInfo,
        world_setting: context.worldSetting,
        timeline_context: context.timelineContext,
        user_input: userInput,
      };

      return {
        systemPrompt: replacePlaceholders(template.systemPrompt, values),
        userPrompt: replacePlaceholders(template.userPromptTemplate, values),
      };
    },

    async generate(
      request: AIGenerateRequest,
      onChunk?: (chunk: string) => void,
    ): Promise<AIGenerateResult> {
      // 1. 生成唯一请求 ID
      const requestId = crypto.randomUUID();

      // 2. 自动取消上一个活跃请求
      if (activeController) {
        activeController.abort();
      }

      // 3. 创建新的 AbortController，更新闭包状态
      const controller = new AbortController();
      activeRequestId = requestId;
      activeController = controller;

      // 获取当前活跃的 provider
      const provider = aiStore.getActiveProvider();
      if (!provider) {
        return { success: false, error: 'AI 模型未配置，请前往设置页面配置 AI 模型提供商。' };
      }

      // 验证配置
      const validation = this.validateConfig(provider);
      if (!validation.valid) {
        return { success: false, error: `AI 配置无效：${validation.errors.join('；')}` };
      }

      // 打包上下文并构建 Prompt
      const context = this.packContext(request.chapterId);
      const template = aiStore.getActiveTemplate();
      const { systemPrompt, userPrompt } = this.buildPrompt(context, request.userInput, template);

      // 构建请求体（OpenAI 兼容格式）
      const body = JSON.stringify({
        model: provider.modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: !!onChunk,
      });

      // 4. 超时控制合并到同一个 controller
      const timeoutId = setTimeout(() => {
        if (activeRequestId === requestId) {
          controller.abort();
        }
      }, provider.timeoutMs);

      try {
        const response = await fetch(provider.apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${provider.apiKey}`,
          },
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
          const errorMsg =
            statusMessages[response.status] ??
            (response.status >= 500
              ? 'AI 服务暂时不可用，请稍后重试。'
              : `请求失败（HTTP ${response.status}）。`);
          return { success: false, error: errorMsg };
        }

        // 流式响应处理
        if (onChunk && response.body) {
          // onChunk 守卫：仅当请求仍为活跃请求时才传递 chunk
          const guardedOnChunk = (chunk: string) => {
            if (activeRequestId === requestId) {
              onChunk(chunk);
            }
          };

          let fullContent = '';
          const reader = response.body.getReader();
          const decoder = new TextDecoder();

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const text = decoder.decode(value, { stream: true });
              // 解析 SSE 格式
              const lines = text.split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6).trim();
                  if (data === '[DONE]') continue;
                  try {
                    const parsed = JSON.parse(data);
                    const chunk = parsed.choices?.[0]?.delta?.content ?? '';
                    if (chunk) {
                      fullContent += chunk;
                      guardedOnChunk(chunk);
                    }
                  } catch {
                    // Skip malformed JSON lines
                  }
                }
              }
            }
          } catch {
            // 流式中断，保留已接收内容
            if (fullContent) {
              return { success: true, content: fullContent };
            }
            return { success: false, error: '流式响应中断，未接收到有效内容。' };
          }

          // 请求正常完成后清理闭包状态
          if (activeRequestId === requestId) {
            activeRequestId = null;
            activeController = null;
          }

          if (!fullContent) {
            return { success: false, error: 'AI 未生成有效内容，请调整输入后重试。' };
          }
          return { success: true, content: fullContent };
        }

        // 非流式响应
        const json = await response.json();
        const content = json.choices?.[0]?.message?.content ?? '';

        // 请求正常完成后清理闭包状态
        if (activeRequestId === requestId) {
          activeRequestId = null;
          activeController = null;
        }

        if (!content) {
          return { success: false, error: 'AI 未生成有效内容，请调整输入后重试。' };
        }
        return { success: true, content };
      } catch (error: unknown) {
        clearTimeout(timeoutId);

        // 区分取消和超时
        if (error instanceof DOMException && error.name === 'AbortError') {
          if (activeRequestId !== requestId) {
            // 被新请求取消，返回 cancelled 标识
            return { success: false, cancelled: true };
          }
          // 超时取消，清理闭包状态
          activeRequestId = null;
          activeController = null;
          return { success: false, error: '请求超时，请增加超时时间或缩短输入内容后重试。' };
        }
        if (error instanceof TypeError) {
          return { success: false, error: '网络错误，请检查网络连接后重试。' };
        }
        return {
          success: false,
          error: `请求失败：${error instanceof Error ? error.message : '未知错误'}`,
        };
      }
    },

    validateConfig(provider: AIProvider): { valid: boolean; errors: string[] } {
      const errors: string[] = [];
      if (!provider.apiKey || provider.apiKey.trim() === '') {
        errors.push('API Key 不能为空');
      }
      if (!provider.apiEndpoint || provider.apiEndpoint.trim() === '') {
        errors.push('API 端点 URL 不能为空');
      }
      if (!provider.modelName || provider.modelName.trim() === '') {
        errors.push('模型名称不能为空');
      }
      return { valid: errors.length === 0, errors };
    },

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

    recommendSkills(chapterId: string, skills: WritingSkill[]): ScoredSkill[] {
      const context = this.packContext(chapterId);
      const signals = analyzeSignals(context);

      const scored: ScoredSkill[] = [];

      for (const skill of skills) {
        if (!skill.enabled) continue;

        if (skill.contextHints.length === 0) {
          // 没有推荐条件的技能给中性分数
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
  };
}

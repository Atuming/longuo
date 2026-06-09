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
} from '../types/ai';
import { BUILT_IN_CATEGORIES } from '../types/world';

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
    const key = placeholder.slice(1, -1); // remove { }
    result = result.replaceAll(placeholder, values[key] ?? '');
  }
  return result;
}

/** 清理替换后 Prompt 中的空标签行和多余空行 */
function cleanPrompt(prompt: string): string {
  // 1. 移除空标签行：标签行后面紧跟空行，说明占位符为空
  //    例如 "写作风格要求：\n\n" → 整段移除
  //    但 "写作风格要求：\n【写作风格设定】\n" → 保留（下一行有内容）
  let result = prompt.replace(/^.*[：:]\s*\n(?=\s*\n)/gm, '');
  // 2. 合并 3 个及以上连续空行为 2 个
  result = result.replace(/\n{3,}/g, '\n\n');
  // 3. 去掉开头和结尾的空行
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
    packContext(chapterId: string, selectedText?: string, writingStyleSummary?: string): PackedContext {
      const chapter = chapterStore.getChapter(chapterId);
      const chapterContent = chapter?.content ?? '';

      // 获取同项目所有章节（树形排序），找到当前章节的前后章节
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

      // 获取关联角色信息，使用叙事化格式
      let characterInfo = '';
      if (chapter) {
        const characterIds = new Set<string>();
        const timelinePoints = timelineStore.filterByChapter(chapter.projectId, chapterId);
        for (const tp of timelinePoints) {
          for (const cid of tp.associatedCharacterIds) {
            characterIds.add(cid);
          }
        }
        // 如果时间线没有关联角色，则获取项目中所有角色
        if (characterIds.size === 0) {
          const allChars = characterStore.listCharacters(chapter.projectId);
          for (const c of allChars) {
            characterIds.add(c.id);
          }
        }
        const charInfoParts: string[] = [];
        for (const cid of characterIds) {
          const char = characterStore.getCharacter(cid);
          if (!char) continue;
          const parts: string[] = [];
          parts.push(`- ${char.name}`);
          if (char.aliases.length > 0) {
            parts.push(`（别名：${char.aliases.join('、')}）`);
          }
          if (char.appearance) {
            parts.push(`\n  外貌特征：${char.appearance}`);
          }
          if (char.personality) {
            parts.push(`\n  性格特点：${char.personality}`);
          }
          if (char.backstory) {
            parts.push(`\n  背景故事：${char.backstory}`);
          }
          charInfoParts.push(parts.join(''));
        }
        characterInfo = charInfoParts.join('\n');
      }

      // 获取世界观背景设定（补全所有 11 种类型标签）
      let worldSetting = '';
      if (chapter) {
        const entries = worldStore.listEntries(chapter.projectId);
        if (entries.length > 0) {
          const worldParts: string[] = [];
          for (const entry of entries) {
            const catInfo = BUILT_IN_CATEGORIES.find((c) => c.key === entry.type);
            const typeLabel = catInfo?.label ?? entry.type;
            worldParts.push(`- 【${typeLabel}】${entry.name}：${entry.description}`);
          }
          worldSetting = worldParts.join('\n');
        }
      }

      // 获取时间线上下文
      let timelineContext = '';
      if (chapter) {
        const points = timelineStore.filterByChapter(chapter.projectId, chapterId);
        if (points.length > 0) {
          const timelineParts: string[] = [];
          for (const tp of points) {
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

      // 选中的文本段落
      const effectiveSelectedText = selectedText && selectedText.trim()
        ? selectedText.trim()
        : '';

      // 写作风格摘要（如果没有传入则从 store 读取）
      let effectiveStyleSummary = writingStyleSummary ?? '';
      if (!effectiveStyleSummary) {
        const style = aiStore.getWritingStyle();
        if (style && style.enabled) {
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
        selected_text: context.selectedText,
        writing_style: context.writingStyleSummary,
        user_input: userInput,
      };

      return {
        systemPrompt: cleanPrompt(replacePlaceholders(template.systemPrompt, values)),
        userPrompt: cleanPrompt(replacePlaceholders(template.userPromptTemplate, values)),
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
      const context = this.packContext(
        request.chapterId,
        request.selectedText,
      );
      const template = aiStore.getActiveTemplate();
      const { systemPrompt, userPrompt } = this.buildPrompt(context, request.userInput, template);

      // 构建请求体（OpenAI 兼容格式）
      const requestBody: Record<string, unknown> = {
        model: provider.modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: !!onChunk,
      };

      // 注入生成控制参数
      if ((provider.temperature ?? 0) > 0) {
        requestBody['temperature'] = provider.temperature;
      }
      if ((provider.maxTokens ?? 0) > 0) {
        requestBody['max_tokens'] = provider.maxTokens;
      }
      const topP = provider.topP ?? 1;
      if (topP > 0 && topP < 1) {
        requestBody['top_p'] = topP;
      }
      if ((provider.presencePenalty ?? 0) !== 0) {
        requestBody['presence_penalty'] = provider.presencePenalty;
      }
      if ((provider.frequencyPenalty ?? 0) !== 0) {
        requestBody['frequency_penalty'] = provider.frequencyPenalty;
      }

      const body = JSON.stringify(requestBody);

      // 4. 超时控制：连接阶段使用 provider.timeoutMs
      //      流式接收阶段改用数据间隔超时（30秒无新数据则中断）
      const STREAM_IDLE_TIMEOUT_MS = 30000;
      let streamIdleTimer: ReturnType<typeof setTimeout> | null = null;

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

          // 启动流式数据间隔超时
          const resetStreamIdleTimer = () => {
            if (streamIdleTimer) clearTimeout(streamIdleTimer);
            streamIdleTimer = setTimeout(() => {
              if (activeRequestId === requestId) {
                controller.abort();
              }
            }, STREAM_IDLE_TIMEOUT_MS);
          };
          resetStreamIdleTimer();

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              // 收到数据，重置间隔超时
              resetStreamIdleTimer();

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
            if (streamIdleTimer) clearTimeout(streamIdleTimer);
            if (fullContent) {
              return { success: true, content: fullContent };
            }
            return { success: false, error: '流式响应中断，未接收到有效内容。' };
          }

          if (streamIdleTimer) clearTimeout(streamIdleTimer);

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

    async extractWorldEntries(
      text: string,
      onChunk?: (chunk: string) => void,
    ): Promise<AIGenerateResult> {
      const categoryList = BUILT_IN_CATEGORIES.map((c) => `${c.key}（${c.label}）`).join('、');

      const systemPrompt =
        '你是一个小说资料提取助手。你的任务是从给定的文本中同时提取两类信息：角色和世界观设定。' +
        '输出严格的 JSON 对象格式，不要包含任何其他文字说明。' +
        'JSON 结构如下：{"characters":[...],"worldEntries":[...]}\n' +
        'characters 数组中每个元素包含：name（姓名）、aliases（别名列表，字符串数组）、appearance（外貌描写）、personality（性格特点）、backstory（背景故事）。' +
        'worldEntries 数组中每个元素包含：name（名称）、type（分类 key）、description（详细描述）。' +
        `worldEntries 的 type 取值：${categoryList}。` +
        '重要区分：具体的有名字的个体（如"张三""李长老"）归入 characters；抽象设定（如"青云门""灵石""修仙体系"）归入 worldEntries。' +
        '种族分类只用于物种大类（如"人族""妖族"），不要把具体角色放入种族。' +
        '如果某一类没有提取到结果，对应数组为空。' +
        '示例输出：{"characters":[{"name":"张三","aliases":["三哥"],"appearance":"身高八尺，剑眉星目","personality":"沉稳内敛，重情重义","backstory":"青云门内门弟子，幼年丧父"}],"worldEntries":[{"name":"青云门","type":"faction","description":"修仙界第一大宗门"},{"name":"灵石","type":"economy","description":"修仙界通用货币"}]}';

      const userPrompt = `请从以下文本中同时提取角色信息和世界观设定：\n\n${text}`;

      // 生成唯一请求 ID
      const requestId = crypto.randomUUID();

      // 自动取消上一个活跃请求
      if (activeController) {
        activeController.abort();
      }

      const controller = new AbortController();
      activeRequestId = requestId;
      activeController = controller;

      const provider = aiStore.getActiveProvider();
      if (!provider) {
        return { success: false, error: 'AI 模型未配置，请前往设置页面配置 AI 模型提供商。' };
      }

      const validation = this.validateConfig(provider);
      if (!validation.valid) {
        return { success: false, error: `AI 配置无效：${validation.errors.join('；')}` };
      }

      const requestBody: Record<string, unknown> = {
        model: provider.modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: !!onChunk,
      };

      // 注入生成控制参数
      if ((provider.temperature ?? 0) > 0) {
        requestBody['temperature'] = provider.temperature;
      }
      if ((provider.maxTokens ?? 0) > 0) {
        requestBody['max_tokens'] = provider.maxTokens;
      }
      const topP = provider.topP ?? 1;
      if (topP > 0 && topP < 1) {
        requestBody['top_p'] = topP;
      }

      const body = JSON.stringify(requestBody);

      // 超时控制：连接阶段使用 provider.timeoutMs
      //      流式接收阶段改用数据间隔超时（30秒无新数据则中断）
      const STREAM_IDLE_TIMEOUT_MS = 30000;
      let streamIdleTimer: ReturnType<typeof setTimeout> | null = null;

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
          const guardedOnChunk = (chunk: string) => {
            if (activeRequestId === requestId) {
              onChunk(chunk);
            }
          };

          let fullContent = '';
          const reader = response.body.getReader();
          const decoder = new TextDecoder();

          // 启动流式数据间隔超时
          const resetStreamIdleTimer = () => {
            if (streamIdleTimer) clearTimeout(streamIdleTimer);
            streamIdleTimer = setTimeout(() => {
              if (activeRequestId === requestId) {
                controller.abort();
              }
            }, STREAM_IDLE_TIMEOUT_MS);
          };
          resetStreamIdleTimer();

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              // 收到数据，重置间隔超时
              resetStreamIdleTimer();

              const decoded = decoder.decode(value, { stream: true });
              const lines = decoded.split('\n');
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
            if (streamIdleTimer) clearTimeout(streamIdleTimer);
            if (fullContent) {
              return { success: true, content: fullContent };
            }
            return { success: false, error: '流式响应中断，未接收到有效内容。' };
          }

          if (streamIdleTimer) clearTimeout(streamIdleTimer);

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

        if (error instanceof DOMException && error.name === 'AbortError') {
          if (activeRequestId !== requestId) {
            return { success: false, cancelled: true };
          }
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
  };
}

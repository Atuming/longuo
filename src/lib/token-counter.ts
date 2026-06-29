/**
 * Token 估算工具。
 * 使用字符数粗略估算 token 数（中文约 1.5 字符/token，英文约 4 字符/token）。
 * 这不会像 tiktoken 那样精确，但足够判断上下文是否接近模型限制。
 */

/** 默认模型上下文窗口 token 数（通用估算） */
export const DEFAULT_CONTEXT_LIMIT = 8192;

/** 保守预留：给模型输出留出空间 */
export const OUTPUT_RESERVE = 2048;

/** 安全边距：总限制的 5%，避免边界溢出 */
export const SAFETY_MARGIN_RATIO = 0.05;

/** 各模型的上下文窗口估算 */
const MODEL_CONTEXT_MAP: Record<string, number> = {
  'glm-4-flash': 128_000,
  'glm-4': 128_000,
  'glm-4-plus': 128_000,
  'gpt-3.5-turbo': 4096,
  'gpt-3.5-turbo-16k': 16384,
  'gpt-4': 8192,
  'gpt-4-32k': 32768,
  'gpt-4-turbo': 128_000,
  'gpt-4o': 128_000,
  'gpt-4o-mini': 128_000,
  'claude-3-haiku': 200_000,
  'claude-3-sonnet': 200_000,
  'claude-3-opus': 200_000,
  'deepseek-v3': 65536,
  'deepseek-r1': 65536,
  'qwen-turbo': 8192,
  'qwen-plus': 32768,
  'qwen-max': 32768,
};

/**
 * 根据模型名获取上下文窗口大小。
 * 如果未匹配到具体模型，返回默认值 8192。
 */
export function getContextLimit(modelName?: string): number {
  if (!modelName) return DEFAULT_CONTEXT_LIMIT;
  // 精确匹配
  if (MODEL_CONTEXT_MAP[modelName]) return MODEL_CONTEXT_MAP[modelName];
  // 模糊匹配（如 glm-4-flash-20250101 匹配 glm-4-flash）
  for (const [key, limit] of Object.entries(MODEL_CONTEXT_MAP)) {
    if (modelName.includes(key)) return limit;
  }
  return DEFAULT_CONTEXT_LIMIT;
}

/**
 * 估算文本 token 数。
 * 策略：中文字符约 1 字符 ≈ 0.67 token，英文/数字约 4 字符 ≈ 1 token，
 * 混合文本按比例估算。
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  let chineseChars = 0;
  let otherChars = 0;

  for (const ch of text) {
    if (/[一-鿿㐀-䶿豈-﫿]/.test(ch)) {
      chineseChars++;
    } else if (!/\s/.test(ch)) {
      otherChars++;
    }
  }

  // 中文约 1.5 字符/token → 0.67 token/char
  // 英文/其他约 4 字符/token → 0.25 token/char
  return Math.ceil(chineseChars * 0.67 + otherChars * 0.25);
}

/**
 * 计算上下文打包后可用的最大 token 数。
 */
export function calculateBudget(modelName?: string): number {
  const total = getContextLimit(modelName);
  const usable = total - OUTPUT_RESERVE;
  const withMargin = Math.floor(usable * (1 - SAFETY_MARGIN_RATIO));
  return Math.max(withMargin, 1024); // 至少保留 1024 token
}

/** 上下文各部分的优先级（数字越小越重要，越不容易被裁剪） */
export const CONTEXT_PRIORITY = {
  chapterContent: 0,       // 当前章节内容 - 最重要
  selectedText: 1,         // 用户选中文本
  userInput: 2,            // 用户输入
  writingStyle: 3,         // 写作风格
  prevChapterSummary: 4,   // 前一章摘要
  nextChapterSummary: 5,   // 后一章摘要
  characterInfo: 6,        // 角色信息
  timelineContext: 7,      // 时间线上下文
  worldSetting: 8,         // 世界观设定 - 最容易被裁剪
} as const;

/** 上下文部分定义 */
export interface ContextPart {
  key: string;
  content: string;
  priority: number;
  estimatedTokens: number;
}

/**
 * 测量上下文中各部分的 token 用量。
 */
export function measureContext(parts: ContextPart[]): {
  parts: ContextPart[];
  totalTokens: number;
  budget: number;
  overBudget: boolean;
} {
  const budget = calculateBudget();
  const totalTokens = parts.reduce((sum, p) => sum + p.estimatedTokens, 0);
  return { parts, totalTokens, budget, overBudget: totalTokens > budget };
}

/**
 * 智能裁剪上下文。
 * 按优先级从低到高依次裁剪各部分内容。
 * - 第 1 步：截断低优先级部分（保留前 N 字符）
 * - 第 2 步：如仍超预算，移除最低优先级部分
 */
export function trimContext(parts: ContextPart[], budget?: number): ContextPart[] {
  const effectiveBudget = budget ?? calculateBudget();
  let currentTotal = parts.reduce((sum, p) => sum + p.estimatedTokens, 0);

  if (currentTotal <= effectiveBudget) return parts;

  // 按优先级从低到高排序
  const sorted = [...parts].sort((a, b) => b.priority - a.priority);
  const result = parts.map((p) => ({ ...p }));

  // 第 1 步：对低优先级部分逐步截断
  for (const part of sorted) {
    if (currentTotal <= effectiveBudget) break;
    const idx = result.findIndex((r) => r.key === part.key);
    if (idx < 0) continue;

    // 截断到 50%，然后 25%
    const ratios = [1, 0.5, 0.25, 0];
    for (const ratio of ratios) {
      if (currentTotal <= effectiveBudget) break;
      if (ratio === 1) continue; // 当前已是全量

      if (ratio === 0) {
        result[idx].content = '';
        result[idx].estimatedTokens = 0;
      } else {
        const charLimit = Math.floor(result[idx].content.length * ratio);
        result[idx].content = result[idx].content.slice(0, charLimit) + '\n...(已裁剪)';
        result[idx].estimatedTokens = estimateTokens(result[idx].content);
      }
      currentTotal = result.reduce((sum, p) => sum + p.estimatedTokens, 0);
    }
  }

  return result;
}

/**
 * 计算生成请求消息的总 token 估计（system + user）。
 */
export function estimateRequestTokens(systemPrompt: string, userPrompt: string): number {
  return estimateTokens(systemPrompt) + estimateTokens(userPrompt) + 50; // +50 系统开销
}

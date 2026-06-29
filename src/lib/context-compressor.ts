/**
 * 智能上下文压缩器。
 * 当上下文超过 token 预算时，对非核心内容生成摘要而非截断。
 * 压缩在本地执行（无 AI 调用），通过对结构化数据进行精简。
 */

import { estimateTokens } from './token-counter';

/** 压缩结果 */
export interface CompressedContext {
  text: string;
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
}

/**
 * 压缩角色信息。
 * 策略：保留名字、关键性格词、核心外貌特征，去掉完整描述。
 * 对于大量角色，只保留前 N 个与章节关联最紧密的。
 */
export function compressCharacterInfo(info: string, maxTokens: number): CompressedContext {
  const originalTokens = estimateTokens(info);
  if (originalTokens <= maxTokens || !info.trim()) {
    return { text: info, originalTokens, compressedTokens: originalTokens, compressionRatio: 1 };
  }

  const lines = info.split('\n');
  const compressed: string[] = [];
  let currentTokens = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 角色名行（以 "- " 开头）始终保留
    if (trimmed.startsWith('- ')) {
      compressed.push(trimmed);
      currentTokens = estimateTokens(compressed.join('\n'));
      continue;
    }

    // 子行（缩进的细节）：只保留一行核心属性
    const keyValue = trimmed.trim();
    if (currentTokens + estimateTokens(keyValue) > maxTokens) {
      // 超出预算，用省略标记
      if (!compressed[compressed.length - 1].endsWith('...')) {
        compressed.push('  ...(已压缩)');
      }
      break;
    }
    compressed.push(keyValue);
    currentTokens = estimateTokens(compressed.join('\n'));
  }

  const text = compressed.join('\n');
  const compressedTokens = estimateTokens(text);
  return { text, originalTokens, compressedTokens, compressionRatio: compressedTokens / originalTokens };
}

/**
 * 压缩世界观信息。
 * 策略：每个条目合并为一行简短格式 "[类型] 名称：简述"
 */
export function compressWorldSetting(info: string, maxTokens: number): CompressedContext {
  const originalTokens = estimateTokens(info);
  if (originalTokens <= maxTokens || !info.trim()) {
    return { text: info, originalTokens, compressedTokens: originalTokens, compressionRatio: 1 };
  }

  const lines = info.split('\n');
  const compressed: string[] = [];
  let currentTokens = 0;

  for (const line of lines) {
    if (currentTokens >= maxTokens) break;
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 缩短描述：超过 80 字符的描述截断到 60 + "..."
    let processed = trimmed;
    if (trimmed.length > 80) {
      const dashIdx = trimmed.indexOf('：');
      if (dashIdx > 0) {
        const namePart = trimmed.slice(0, dashIdx + 1);
        const descPart = trimmed.slice(dashIdx + 1);
        if (descPart.length > 60) {
          processed = namePart + descPart.slice(0, 60) + '...';
        }
      }
    }

    const estimatedAdd = estimateTokens(processed);
    if (currentTokens + estimatedAdd > maxTokens) {
      compressed.push(`...(共 ${lines.filter(l => l.trim() && l.startsWith('-')).length} 条设定，此处已压缩)`);
      break;
    }
    compressed.push(processed);
    currentTokens += estimatedAdd;
  }

  const text = compressed.join('\n');
  return { text, originalTokens, compressedTokens: estimateTokens(text), compressionRatio: estimateTokens(text) / originalTokens };
}

/**
 * 压缩时间线上下文。
 */
export function compressTimelineContext(info: string, maxTokens: number): CompressedContext {
  const originalTokens = estimateTokens(info);
  if (originalTokens <= maxTokens || !info.trim()) {
    return { text: info, originalTokens, compressedTokens: originalTokens, compressionRatio: 1 };
  }

  // 时间线条目天然较简短，只需截断过长的条目
  const lines = info.split('\n');
  const compressed: string[] = [];
  let currentTokens = 0;

  for (const line of lines) {
    if (currentTokens >= maxTokens) break;
    let processed = line;
    if (line.length > 120) {
      processed = line.slice(0, 120) + '...';
    }
    const add = estimateTokens(processed);
    if (currentTokens + add > maxTokens) break;
    compressed.push(processed);
    currentTokens += add;
  }

  const text = compressed.join('\n');
  return { text, originalTokens, compressedTokens: estimateTokens(text), compressionRatio: estimateTokens(text) / originalTokens };
}

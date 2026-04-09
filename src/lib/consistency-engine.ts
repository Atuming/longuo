import type { ConsistencyEngine } from '../types/engines';
import type { Character } from '../types/character';
import type { ConsistencyIssue } from '../types/consistency';

/**
 * 计算两个字符串之间的 Levenshtein 编辑距离。
 */
export function levenshteinDistance(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;

  if (la === 0) return lb;
  if (lb === 0) return la;

  // 使用单行滚动数组优化空间
  let prev = new Array<number>(lb + 1);
  let curr = new Array<number>(lb + 1);

  for (let j = 0; j <= lb; j++) {
    prev[j] = j;
  }

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,       // 删除
        curr[j - 1] + 1,   // 插入
        prev[j - 1] + cost  // 替换
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[lb];
}

/**
 * 计算归一化相似度 (0-1)，基于编辑距离。
 */
export function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = levenshteinDistance(a, b);
  return 1 - dist / maxLen;
}

/**
 * 创建 ConsistencyEngine 实例。
 */
export function createConsistencyEngine(): ConsistencyEngine {
  return {
    checkChapter(chapterContent: string, characters: Character[]): ConsistencyIssue[] {
      const issues: ConsistencyIssue[] = [];

      if (!chapterContent || characters.length === 0) {
        return issues;
      }

      // 收集所有角色名称和别名
      const nameMap: { name: string }[] = [];
      for (const char of characters) {
        if (char.name) {
          nameMap.push({ name: char.name });
        }
        for (const alias of char.aliases) {
          if (alias) {
            nameMap.push({ name: alias });
          }
        }
      }

      // 只处理长度 >= 2 的名称
      const validNames = nameMap.filter((n) => n.name.length >= 2);
      if (validNames.length === 0) return issues;

      // 收集所有精确名称用于排除完全匹配
      const exactNames = new Set(validNames.map((n) => n.name));

      // 在内容中滑动窗口搜索相似文本
      for (const { name } of validNames) {
        const nameLen = name.length;

        // 搜索窗口大小：名称长度 ± 1（因为编辑距离 <= 1）
        for (let windowSize = Math.max(2, nameLen - 1); windowSize <= nameLen + 1; windowSize++) {
          for (let i = 0; i <= chapterContent.length - windowSize; i++) {
            const candidate = chapterContent.substring(i, i + windowSize);

            // 跳过完全匹配
            if (exactNames.has(candidate)) continue;

            // 跳过包含精确名称的候选（如 "张三走" 包含 "张三"）
            let containsExact = false;
            for (const exactName of exactNames) {
              if (candidate.includes(exactName)) {
                containsExact = true;
                break;
              }
            }
            if (containsExact) continue;

            // 计算编辑距离
            const dist = levenshteinDistance(candidate, name);

            // 阈值：编辑距离 <= 1 且长度 >= 2
            if (dist === 1 && candidate.length >= 2) {
              const sim = similarity(candidate, name);

              // 检查是否已有相同 offset 的问题（避免重复）
              const alreadyReported = issues.some(
                (issue) => issue.offset === i && issue.length === windowSize
              );
              if (!alreadyReported) {
                issues.push({
                  chapterId: '',  // 由调用方设置
                  offset: i,
                  length: windowSize,
                  foundText: candidate,
                  suggestedName: name,
                  similarity: sim,
                  ignored: false,
                });
              }
            }
          }
        }
      }

      // 按 offset 排序
      issues.sort((a, b) => a.offset - b.offset);

      return issues;
    },

    applySuggestion(content: string, issue: ConsistencyIssue): string {
      const before = content.substring(0, issue.offset);
      const after = content.substring(issue.offset + issue.length);
      return before + issue.suggestedName + after;
    },
  };
}

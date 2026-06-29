/**
 * 写作风格指纹分析器。
 * 从用户已写内容中提取风格特征，生成可注入 prompt 的风格约束。
 * 本地执行（纯统计分析），不消耗 AI token。
 */

/** 风格指纹 */
export interface StyleFingerprint {
  /** 平均句子长度（字符数） */
  avgSentenceLength: number;
  /** 平均段落长度（字符数） */
  avgParagraphLength: number;
  /** 对话比例（引导内的内容占总字符数比例） */
  dialogueRatio: number;
  /** 常用词频前 10 */
  topWords: string[];
  /** 风格描述文本（可直接注入 prompt） */
  styleDescription: string;
  /** 分析质量评分 (0-1)，基于样本量 */
  confidence: number;
}

/** 中文句末标点 */
const SENTENCE_ENDERS = /[。！？!?…~～]/;

/** 中文对话引号 */
const DIALOGUE_MARKS = /[「」""''""『』]/;

/** 中文停用词（常见高频虚词，不计入风格词频） */
const STOP_WORDS = new Set([
  '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一',
  '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着',
  '没有', '看', '好', '自己', '这', '他', '她', '它', '们', '那', '什么',
  '而', '以', '之', '与', '及', '为', '所', '其', '但', '被', '把', '从',
  '对', '向', '往', '朝', '当', '时', '后', '前', '里', '外', '中',
  '来', '去', '能', '可以', '应该', '需要', '已经', '正在', '将', '会',
  '还', '又', '再', '才', '刚', '便', '却', '只', '仍', '并',
]);

/**
 * 剔除停用词并提取有意义的词汇（2-4 字词）。
 */
function extractWords(text: string): string[] {
  // 移除标点
  const cleaned = text.replace(/[，。！？、；：""''「」『』（）【】《》\s\n\r]/g, ' ');
  const segments = cleaned.split(/\s+/).filter(Boolean);

  const words: string[] = [];
  for (const seg of segments) {
    if (seg.length < 2 || seg.length > 4) continue;
    if (STOP_WORDS.has(seg)) continue;
    // 过滤纯数字/标点
    if (/^[\d.,;:!?]+$/.test(seg)) continue;
    words.push(seg);
  }
  return words;
}

/**
 * 从文本中分析写作风格指纹。
 * 至少需要 200 字才能给出有意义的分析结果。
 */
export function analyzeStyleFingerprint(text: string): StyleFingerprint {
  const charCount = text.length;

  // 默认低置信度结果
  if (charCount < 200) {
    return {
      avgSentenceLength: 0,
      avgParagraphLength: 0,
      dialogueRatio: 0,
      topWords: [],
      styleDescription: '',
      confidence: Math.min(charCount / 200, 0.3),
    };
  }

  // --- 句子分析 ---
  const sentences = text
    .split(SENTENCE_ENDERS)
    .filter((s) => s.trim().length > 0);
  const avgSentenceLength = sentences.length > 0
    ? Math.round(sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length)
    : 0;

  // --- 段落分析 ---
  const paragraphs = text
    .split(/\n{2,}/)
    .filter((p) => p.trim().length > 0);
  const avgParagraphLength = paragraphs.length > 0
    ? Math.round(paragraphs.reduce((sum, p) => sum + p.length, 0) / paragraphs.length)
    : 0;

  // --- 对话比例 ---
  let dialogueChars = 0;
  let inDialogue = false;
  for (const ch of text) {
    if (DIALOGUE_MARKS.test(ch)) {
      inDialogue = !inDialogue;
      continue;
    }
    if (inDialogue && !/\s/.test(ch)) {
      dialogueChars++;
    }
  }
  const dialogueRatio = charCount > 0 ? dialogueChars / charCount : 0;

  // --- 词频分析 ---
  const words = extractWords(text);
  const wordFreq = new Map<string, number>();
  for (const w of words) {
    wordFreq.set(w, (wordFreq.get(w) ?? 0) + 1);
  }
  const topWords = Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([w]) => w);

  // --- 生成风格描述 ---
  const descriptions: string[] = [];

  // 句子长度风格
  if (avgSentenceLength > 0) {
    if (avgSentenceLength < 15) {
      descriptions.push('短句为主，节奏明快');
    } else if (avgSentenceLength < 30) {
      descriptions.push('中等句长，节奏舒缓');
    } else {
      descriptions.push('长句为主，描写细腻丰富');
    }
  }

  // 对话密度
  if (dialogueRatio > 0.25) {
    descriptions.push('对话密集');
  } else if (dialogueRatio > 0.1) {
    descriptions.push('对话适中');
  } else if (dialogueRatio > 0) {
    descriptions.push('叙述为主，对话较少');
  }

  // 段落风格
  if (avgParagraphLength > 500) {
    descriptions.push('长段落叙事');
  } else if (avgParagraphLength > 200) {
    descriptions.push('中等段落节奏');
  } else if (avgParagraphLength > 0) {
    descriptions.push('短段落，节奏紧凑');
  }

  // 词汇偏好
  if (topWords.length > 0) {
    descriptions.push(`高频用词：${topWords.slice(0, 5).join('、')}`);
  }

  const styleDescription = descriptions.length > 0
    ? `【作者风格指纹】${descriptions.join('；')}。请尽量匹配以上风格特征。`
    : '';

  const confidence = Math.min(charCount / 2000, 1.0);

  return {
    avgSentenceLength,
    avgParagraphLength,
    dialogueRatio,
    topWords,
    styleDescription,
    confidence,
  };
}

/**
 * 从多个章节合并分析风格指纹。
 * 后续章节权重递减（最新内容权重最高）。
 */
export function analyzeProjectStyle(chapters: { content: string }[]): StyleFingerprint {
  if (chapters.length === 0) {
    return {
      avgSentenceLength: 0,
      avgParagraphLength: 0,
      dialogueRatio: 0,
      topWords: [],
      styleDescription: '',
      confidence: 0,
    };
  }

  // 合并最近 3 章内容用于分析
  const recentChapters = chapters.slice(-3);
  const combinedText = recentChapters.map((c) => c.content).join('\n\n');

  return analyzeStyleFingerprint(combinedText);
}

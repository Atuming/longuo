import { describe, it, expect } from 'vitest';
import type { ExtractedWorldEntry, ExtractedCharacter, ExtractedResult } from '../types/world';

/** Parse AI response text into ExtractedResult (characters + world entries) */
function parseExtractedResult(content: string): ExtractedResult {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { characters: [], worldEntries: [] };

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (typeof parsed !== 'object' || parsed === null) return { characters: [], worldEntries: [] };

    const validTypes = new Set([
      'location', 'faction', 'rule', 'item', 'race',
      'magic', 'history', 'culture', 'technology', 'economy', 'religion',
    ]);

    const characters: ExtractedCharacter[] = Array.isArray(parsed.characters)
      ? parsed.characters.filter(
          (item: unknown): item is Record<string, unknown> =>
            typeof item === 'object' && item !== null &&
            typeof (item as Record<string, unknown>).name === 'string',
        ).map((item: Record<string, unknown>) => ({
          name: String(item.name).trim(),
          aliases: Array.isArray(item.aliases)
            ? (item.aliases as unknown[]).filter((a: unknown) => typeof a === 'string').map((a: string) => a.trim())
            : [],
          appearance: typeof item.appearance === 'string' ? (item.appearance as string).trim() : '',
          personality: typeof item.personality === 'string' ? (item.personality as string).trim() : '',
          backstory: typeof item.backstory === 'string' ? (item.backstory as string).trim() : '',
          selected: true,
        }))
      : [];

    const worldEntries: ExtractedWorldEntry[] = Array.isArray(parsed.worldEntries)
      ? parsed.worldEntries.filter(
          (item: unknown): item is { name: string; type: string; description: string } =>
            typeof item === 'object' && item !== null &&
            typeof (item as Record<string, unknown>).name === 'string' &&
            typeof (item as Record<string, unknown>).type === 'string' &&
            typeof (item as Record<string, unknown>).description === 'string',
        ).map((item: { name: string; type: string; description: string }) => ({
          name: item.name.trim(),
          type: validTypes.has(item.type) ? item.type : 'rule',
          description: item.description.trim(),
          selected: true,
        }))
      : [];

    return { characters, worldEntries };
  } catch {
    return { characters: [], worldEntries: [] };
  }
}

describe('parseExtractedResult', () => {
  it('should parse valid combined result with both characters and world entries', () => {
    const content = JSON.stringify({
      characters: [
        { name: '张三', aliases: ['三哥'], appearance: '剑眉星目', personality: '沉稳', backstory: '青云门弟子' },
      ],
      worldEntries: [
        { name: '青云门', type: 'faction', description: '第一大宗门' },
        { name: '灵石', type: 'economy', description: '通用货币' },
      ],
    });

    const result = parseExtractedResult(content);
    expect(result.characters).toHaveLength(1);
    expect(result.characters[0].name).toBe('张三');
    expect(result.characters[0].aliases).toEqual(['三哥']);
    expect(result.characters[0].appearance).toBe('剑眉星目');
    expect(result.characters[0].selected).toBe(true);
    expect(result.worldEntries).toHaveLength(2);
    expect(result.worldEntries[0].name).toBe('青云门');
    expect(result.worldEntries[0].type).toBe('faction');
  });

  it('should handle only characters, no world entries', () => {
    const content = JSON.stringify({
      characters: [{ name: '李四', aliases: [], appearance: '壮汉', personality: '豪爽', backstory: '猎户' }],
      worldEntries: [],
    });
    const result = parseExtractedResult(content);
    expect(result.characters).toHaveLength(1);
    expect(result.worldEntries).toHaveLength(0);
  });

  it('should handle only world entries, no characters', () => {
    const content = JSON.stringify({
      characters: [],
      worldEntries: [{ name: '灵石', type: 'economy', description: '货币' }],
    });
    const result = parseExtractedResult(content);
    expect(result.characters).toHaveLength(0);
    expect(result.worldEntries).toHaveLength(1);
  });

  it('should parse JSON from markdown code block wrapper', () => {
    const content = '```json\n{"characters":[{"name":"王五","aliases":[],"appearance":"瘦","personality":"狡黠","backstory":"商人"}],"worldEntries":[]}\n```';
    const result = parseExtractedResult(content);
    expect(result.characters).toHaveLength(1);
    expect(result.characters[0].name).toBe('王五');
  });

  it('should fall back to rule type for unknown worldEntry type', () => {
    const content = JSON.stringify({
      characters: [],
      worldEntries: [{ name: '不明', type: 'unknown_type', description: '未知类型' }],
    });
    const result = parseExtractedResult(content);
    expect(result.worldEntries[0].type).toBe('rule');
  });

  it('should return empty result for invalid JSON', () => {
    const result = parseExtractedResult('not json');
    expect(result.characters).toHaveLength(0);
    expect(result.worldEntries).toHaveLength(0);
  });

  it('should return empty result when no JSON object found', () => {
    const result = parseExtractedResult('AI 说：没有提取到内容。');
    expect(result.characters).toHaveLength(0);
    expect(result.worldEntries).toHaveLength(0);
  });

  it('should filter characters missing name field', () => {
    const content = JSON.stringify({
      characters: [
        { name: '有名字', aliases: [], appearance: '', personality: '', backstory: '' },
        { appearance: '没有名字', personality: '', backstory: '' }, // missing name
      ],
      worldEntries: [],
    });
    const result = parseExtractedResult(content);
    expect(result.characters).toHaveLength(1);
    expect(result.characters[0].name).toBe('有名字');
  });

  it('should filter worldEntries missing required fields', () => {
    const content = JSON.stringify({
      characters: [],
      worldEntries: [
        { name: '完整', type: 'location', description: '完整条目' },
        { name: '缺描述', type: 'faction' }, // missing description
      ],
    });
    const result = parseExtractedResult(content);
    expect(result.worldEntries).toHaveLength(1);
  });

  it('should handle AI response with extra text around JSON', () => {
    const content = '提取结果如下：\n{"characters":[{"name":"赵六","aliases":[],"appearance":"高大","personality":"忠诚","backstory":"将军"}],"worldEntries":[{"name":"王城","type":"location","description":"帝国首都"}]}\n以上是提取结果。';
    const result = parseExtractedResult(content);
    expect(result.characters).toHaveLength(1);
    expect(result.worldEntries).toHaveLength(1);
  });

  it('should handle characters with missing optional fields gracefully', () => {
    const content = JSON.stringify({
      characters: [{ name: '只有名' }],
      worldEntries: [],
    });
    const result = parseExtractedResult(content);
    expect(result.characters).toHaveLength(1);
    expect(result.characters[0].name).toBe('只有名');
    expect(result.characters[0].aliases).toEqual([]);
    expect(result.characters[0].appearance).toBe('');
  });
});

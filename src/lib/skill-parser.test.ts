import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  parseSkillMarkdown,
  serializeSkillToMarkdown,
  validateSkillFrontmatter,
  parseSkillDirectory,
  serializeSkillToZip,
  parseSkillZip,
} from './skill-parser';
import type { WritingSkill } from '../types/ai';

// --- Helper ---

const MINIMAL_MD = `---
id: test-skill
name: 测试技能
icon: "🔧"
description: 测试描述
parameters: []
contextHints: []
sortOrder: 0
enabled: true
---

这是提示词模板内容。
`;

const COMPLEX_MD = `---
id: builtin-dialogue
name: 对话
icon: "💬"
description: 生成符合角色性格的高质量对话
parameters:
  - key: character1
    label: 角色A
    type: select
    source: characters
    placeholder: 选择角色（可选）
    required: false
  - key: character2
    label: 角色B
    type: select
    source: characters
    placeholder: 选择角色（可选）
    required: false
contextHints:
  - signal: hasCharacters
    condition: "true"
    weight: 1.5
  - signal: hasDialogue
    condition: "true"
    weight: 0.5
sortOrder: 2
enabled: true
---

请根据当前场景和在场角色，生成一段高质量的角色对话。
{param:character1}{param:character2}
要求：对话要推动剧情发展。
`;

/** 社区格式（无 id，有 license） */
const COMMUNITY_MD = `---
name: writing-assistant
description: 专业中文写稿助手
license: MIT
---

# 专业写稿助手
## 核心能力
洗稿改写、风格仿写、文案优化。
`;

function makeTestSkill(overrides?: Partial<WritingSkill>): WritingSkill {
  return {
    id: 'test-id',
    name: '测试',
    icon: '🔧',
    description: '描述',
    promptTemplate: '请续写',
    parameters: [],
    contextHints: [],
    sortOrder: 0,
    builtIn: false,
    enabled: true,
    ...overrides,
  };
}

// ============================================================
// parseSkillMarkdown
// ============================================================

describe('parseSkillMarkdown', () => {
  it('parses minimal valid markdown', () => {
    const skill = parseSkillMarkdown(MINIMAL_MD);
    expect(skill.id).toBe('test-skill');
    expect(skill.name).toBe('测试技能');
    expect(skill.icon).toBe('🔧');
    expect(skill.description).toBe('测试描述');
    expect(skill.promptTemplate).toBe('这是提示词模板内容。');
    expect(skill.parameters).toEqual([]);
    expect(skill.contextHints).toEqual([]);
    expect(skill.sortOrder).toBe(0);
    expect(skill.enabled).toBe(true);
    expect(skill.builtIn).toBe(false);
  });

  it('parses complex markdown with parameters and contextHints', () => {
    const skill = parseSkillMarkdown(COMPLEX_MD);
    expect(skill.id).toBe('builtin-dialogue');
    expect(skill.name).toBe('对话');
    expect(skill.parameters).toHaveLength(2);
    expect(skill.parameters[0].key).toBe('character1');
    expect(skill.parameters[0].type).toBe('select');
    expect(skill.parameters[0].source).toBe('characters');
    expect(skill.parameters[1].key).toBe('character2');
    expect(skill.contextHints).toHaveLength(2);
    expect(skill.contextHints[0].signal).toBe('hasCharacters');
    expect(skill.contextHints[0].weight).toBe(1.5);
    expect(skill.promptTemplate).toContain('{param:character1}');
    expect(skill.promptTemplate).toContain('对话要推动剧情发展');
  });

  it('preserves multi-paragraph body', () => {
    const md = `---
id: multi
name: 多段
parameters: []
contextHints: []
---

第一段内容。

第二段内容。

第三段内容。
`;
    const skill = parseSkillMarkdown(md);
    expect(skill.promptTemplate).toBe('第一段内容。\n\n第二段内容。\n\n第三段内容。');
  });

  it('defaults icon to 🔧 when missing', () => {
    const md = `---
id: no-icon
name: 无图标
parameters: []
contextHints: []
---

模板内容。
`;
    const skill = parseSkillMarkdown(md);
    expect(skill.icon).toBe('🔧');
  });

  it('defaults enabled to true when not specified', () => {
    const md = `---
id: no-enabled
name: 测试
parameters: []
contextHints: []
---

模板。
`;
    const skill = parseSkillMarkdown(md);
    expect(skill.enabled).toBe(true);
  });

  it('sets enabled to false when explicitly false', () => {
    const md = `---
id: disabled
name: 禁用
enabled: false
parameters: []
contextHints: []
---

模板。
`;
    const skill = parseSkillMarkdown(md);
    expect(skill.enabled).toBe(false);
  });

  it('throws on missing frontmatter delimiters', () => {
    expect(() => parseSkillMarkdown('no frontmatter here')).toThrow('缺少 YAML frontmatter');
  });

  it('throws on malformed YAML', () => {
    const md = `---
id: bad
name: [unclosed
---

body
`;
    expect(() => parseSkillMarkdown(md)).toThrow('YAML 解析失败');
  });

  it('parses community format without id (generates id from name)', () => {
    const skill = parseSkillMarkdown(COMMUNITY_MD);
    expect(skill.id).toBe('writing-assistant');
    expect(skill.name).toBe('writing-assistant');
    expect(skill.description).toBe('专业中文写稿助手');
    expect(skill.license).toBe('MIT');
    expect(skill.promptTemplate).toContain('专业写稿助手');
  });

  it('parses markdown with only id (no name)', () => {
    const md = `---
id: only-id-skill
---

body
`;
    const skill = parseSkillMarkdown(md);
    expect(skill.id).toBe('only-id-skill');
    expect(skill.name).toBe('only-id-skill');
  });

  it('throws when both id and name are missing', () => {
    const md = `---
parameters: []
contextHints: []
---

body
`;
    expect(() => parseSkillMarkdown(md)).toThrow('id 和 name 至少需要一个');
  });

  it('throws on invalid parameter type', () => {
    const md = `---
id: bad-param
name: 坏参数
parameters:
  - key: p1
    label: 参数
    type: invalid
contextHints: []
---

body
`;
    expect(() => parseSkillMarkdown(md)).toThrow('type 值无效');
  });

  it('throws on invalid contextHint signal', () => {
    const md = `---
id: bad-hint
name: 坏条件
parameters: []
contextHints:
  - signal: badSignal
    condition: "true"
---

body
`;
    expect(() => parseSkillMarkdown(md)).toThrow('signal 值无效');
  });

  it('parses license field', () => {
    const md = `---
id: licensed
name: 授权技能
license: Apache-2.0
---

模板。
`;
    const skill = parseSkillMarkdown(md);
    expect(skill.license).toBe('Apache-2.0');
  });

  it('omits license when not present', () => {
    const skill = parseSkillMarkdown(MINIMAL_MD);
    expect(skill.license).toBeUndefined();
  });
});

// ============================================================
// serializeSkillToMarkdown
// ============================================================

describe('serializeSkillToMarkdown', () => {
  it('serializes a minimal skill', () => {
    const skill = makeTestSkill();
    const md = serializeSkillToMarkdown(skill);
    expect(md).toContain('---');
    expect(md).toContain('id: test-id');
    expect(md).toContain('name: 测试');
    expect(md).toContain('请续写');
    expect(md).not.toContain('builtIn');
  });

  it('does not include builtIn field', () => {
    const skill = makeTestSkill({ builtIn: true });
    const md = serializeSkillToMarkdown(skill);
    expect(md).not.toContain('builtIn');
  });

  it('serializes parameters correctly', () => {
    const skill = makeTestSkill({
      parameters: [
        { key: 'char1', label: '角色', type: 'select', source: 'characters', placeholder: '选择', required: true },
      ],
    });
    const md = serializeSkillToMarkdown(skill);
    expect(md).toContain('key: char1');
    expect(md).toContain('label: 角色');
    expect(md).toContain('type: select');
    expect(md).toContain('source: characters');
    expect(md).toContain('required: true');
  });

  it('serializes contextHints correctly', () => {
    const skill = makeTestSkill({
      contextHints: [{ signal: 'wordCount', condition: 'low', weight: 1.5 }],
    });
    const md = serializeSkillToMarkdown(skill);
    expect(md).toContain('signal: wordCount');
    expect(md).toContain('condition: low');
    expect(md).toContain('weight: 1.5');
  });

  it('includes license when present', () => {
    const skill = makeTestSkill({ license: 'MIT' });
    const md = serializeSkillToMarkdown(skill);
    expect(md).toContain('license: MIT');
  });

  it('omits license when not present', () => {
    const skill = makeTestSkill();
    const md = serializeSkillToMarkdown(skill);
    expect(md).not.toContain('license');
  });
});

// ============================================================
// validateSkillFrontmatter
// ============================================================

describe('validateSkillFrontmatter', () => {
  it('returns valid for correct data', () => {
    const result = validateSkillFrontmatter({ id: 'x', name: 'y', parameters: [], contextHints: [] });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns valid when only id is present', () => {
    const result = validateSkillFrontmatter({ id: 'x' });
    expect(result.valid).toBe(true);
  });

  it('returns valid when only name is present', () => {
    const result = validateSkillFrontmatter({ name: 'y' });
    expect(result.valid).toBe(true);
  });

  it('returns errors for null', () => {
    const result = validateSkillFrontmatter(null);
    expect(result.valid).toBe(false);
  });

  it('returns errors when both id and name are missing', () => {
    const result = validateSkillFrontmatter({});
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('id 和 name 至少需要一个非空字段');
  });

  it('returns errors for bad parameter structure', () => {
    const result = validateSkillFrontmatter({
      id: 'x', name: 'y',
      parameters: [{ key: '', label: '', type: 'bad' }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// parseSkillDirectory
// ============================================================

describe('parseSkillDirectory', () => {
  it('parses directory with only SKILL.md', () => {
    const files = { 'SKILL.md': MINIMAL_MD };
    const skill = parseSkillDirectory(files);
    expect(skill.id).toBe('test-skill');
    expect(skill.name).toBe('测试技能');
    expect(skill.references).toBeUndefined();
  });

  it('parses directory with SKILL.md and _meta.json', () => {
    const files = {
      'SKILL.md': MINIMAL_MD,
      '_meta.json': JSON.stringify({ slug: 'my-skill', version: '2.0.0' }),
    };
    const skill = parseSkillDirectory(files);
    expect(skill.slug).toBe('my-skill');
    expect(skill.version).toBe('2.0.0');
  });

  it('parses directory with SKILL.md, _meta.json, and references', () => {
    const files = {
      'SKILL.md': COMMUNITY_MD,
      '_meta.json': JSON.stringify({ slug: 'chinese-writing', version: '1.0.0' }),
      'references/guide.md': '# 风格指南\n内容...',
      'references/dict.md': '# 同义词库\n内容...',
    };
    const skill = parseSkillDirectory(files);
    expect(skill.slug).toBe('chinese-writing');
    expect(skill.version).toBe('1.0.0');
    expect(skill.references).toHaveLength(2);
    expect(skill.references![0].filename).toBe('guide.md');
    expect(skill.references![0].content).toContain('风格指南');
    expect(skill.references![1].filename).toBe('dict.md');
  });

  it('throws when SKILL.md is missing', () => {
    expect(() => parseSkillDirectory({ '_meta.json': '{}' })).toThrow('缺少 SKILL.md');
  });

  it('ignores malformed _meta.json gracefully', () => {
    const files = { 'SKILL.md': MINIMAL_MD, '_meta.json': 'not json' };
    const skill = parseSkillDirectory(files);
    expect(skill.id).toBe('test-skill');
    expect(skill.slug).toBeUndefined();
  });
});

// ============================================================
// serializeSkillToZip / parseSkillZip round-trip
// ============================================================

describe('zip round-trip', () => {
  it('round-trips a minimal skill through zip', async () => {
    const original = makeTestSkill();
    const blob = await serializeSkillToZip(original);
    expect(blob).toBeInstanceOf(Blob);
    const parsed = await parseSkillZip(blob);
    expect(parsed.id).toBe(original.id);
    expect(parsed.name).toBe(original.name);
    expect(parsed.promptTemplate).toBe(original.promptTemplate);
  });

  it('round-trips a skill with references through zip', async () => {
    const original = makeTestSkill({
      slug: 'test-slug',
      version: '1.2.3',
      license: 'MIT',
      references: [
        { filename: 'guide.md', content: '# 指南\n详细内容' },
        { filename: 'dict.md', content: '# 词典\n替换词列表' },
      ],
    });
    const blob = await serializeSkillToZip(original);
    const parsed = await parseSkillZip(blob);
    expect(parsed.id).toBe(original.id);
    expect(parsed.slug).toBe('test-slug');
    expect(parsed.version).toBe('1.2.3');
    expect(parsed.license).toBe('MIT');
    expect(parsed.references).toHaveLength(2);
    expect(parsed.references![0].filename).toBe('guide.md');
    expect(parsed.references![0].content).toContain('指南');
    expect(parsed.references![1].filename).toBe('dict.md');
  });

  it('zip without references produces no references/ entries', async () => {
    const original = makeTestSkill();
    const blob = await serializeSkillToZip(original);
    const parsed = await parseSkillZip(blob);
    expect(parsed.references).toBeUndefined();
  });
});

// ============================================================
// Round-trip property tests
// ============================================================

describe('Round-trip property tests', () => {
  it('serialize → parse produces equivalent skill (minus builtIn)', () => {
    const arbParam = fc.record({
      key: fc.stringMatching(/^[a-z]\w{0,9}$/),
      label: fc.string({ minLength: 1, maxLength: 10 }),
      type: fc.constantFrom('text' as const, 'number' as const, 'select' as const),
      required: fc.boolean(),
    });

    const arbHint = fc.record({
      signal: fc.constantFrom(
        'wordCount' as const, 'hasDialogue' as const, 'isNearEnd' as const,
        'hasCharacters' as const, 'hasWorldEntries' as const,
      ),
      condition: fc.constantFrom('low' as const, 'high' as const, 'true' as const, 'false' as const),
      weight: fc.double({ min: 0.1, max: 10, noNaN: true }),
    });

    const arbSkill = fc.record({
      id: fc.stringMatching(/^[a-z][\w-]{2,20}$/),
      name: fc.string({ minLength: 1, maxLength: 20 }),
      icon: fc.constantFrom('🔧', '✍️', '💬', '📝'),
      description: fc.string({ maxLength: 50 }),
      promptTemplate: fc.string({ minLength: 1, maxLength: 200 }),
      parameters: fc.array(arbParam, { maxLength: 3 }),
      contextHints: fc.array(arbHint, { maxLength: 3 }),
      sortOrder: fc.integer({ min: 0, max: 100 }),
      builtIn: fc.boolean(),
      enabled: fc.boolean(),
    });

    fc.assert(
      fc.property(arbSkill, (skill) => {
        const md = serializeSkillToMarkdown(skill as WritingSkill);
        const parsed = parseSkillMarkdown(md);
        expect(parsed.id).toBe(skill.id);
        expect(parsed.name).toBe(skill.name);
        expect(parsed.icon).toBe(skill.icon);
        expect(parsed.promptTemplate).toBe(skill.promptTemplate.trim());
        expect(parsed.parameters.length).toBe(skill.parameters.length);
        expect(parsed.contextHints.length).toBe(skill.contextHints.length);
        expect(parsed.sortOrder).toBe(skill.sortOrder);
        expect(parsed.enabled).toBe(skill.enabled);
        // builtIn is always false from parse (by design)
        expect(parsed.builtIn).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});

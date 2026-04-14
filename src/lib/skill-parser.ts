import { parse as yamlParse, stringify as yamlStringify } from 'yaml';
import JSZip from 'jszip';
import type { WritingSkill, SkillParameter, ContextHint, SkillReference } from '../types/ai';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/** 将名称转换为 URL 友好的 slug，用作 id 的备选 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-|-$/g, '') || 'unnamed-skill';
}

const VALID_SIGNALS = new Set(['wordCount', 'hasDialogue', 'isNearEnd', 'hasCharacters', 'hasWorldEntries']);
const VALID_CONDITIONS = new Set(['low', 'high', 'true', 'false']);
const VALID_PARAM_TYPES = new Set(['text', 'number', 'select']);

/**
 * 验证 frontmatter 解析后的数据结构。
 * 返回字段级别的错误列表。
 */
export function validateSkillFrontmatter(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['frontmatter 不是有效的对象'] };
  }

  const d = data as Record<string, unknown>;

  const hasId = typeof d.id === 'string' && d.id.trim() !== '';
  const hasName = typeof d.name === 'string' && d.name.trim() !== '';
  if (!hasId && !hasName) {
    errors.push('id 和 name 至少需要一个非空字段');
  }

  if (d.parameters !== undefined && d.parameters !== null) {
    if (!Array.isArray(d.parameters)) {
      errors.push('parameters 必须是数组');
    } else {
      for (let i = 0; i < d.parameters.length; i++) {
        const p = d.parameters[i] as Record<string, unknown>;
        if (!p || typeof p !== 'object') {
          errors.push(`parameters[${i}] 不是有效的对象`);
          continue;
        }
        if (typeof p.key !== 'string' || p.key.trim() === '') {
          errors.push(`parameters[${i}].key 缺失或为空`);
        }
        if (typeof p.label !== 'string' || p.label.trim() === '') {
          errors.push(`parameters[${i}].label 缺失或为空`);
        }
        if (!VALID_PARAM_TYPES.has(p.type as string)) {
          errors.push(`parameters[${i}].type 值无效: ${String(p.type)}，应为 text/number/select`);
        }
      }
    }
  }

  if (d.contextHints !== undefined && d.contextHints !== null) {
    if (!Array.isArray(d.contextHints)) {
      errors.push('contextHints 必须是数组');
    } else {
      for (let i = 0; i < d.contextHints.length; i++) {
        const h = d.contextHints[i] as Record<string, unknown>;
        if (!h || typeof h !== 'object') {
          errors.push(`contextHints[${i}] 不是有效的对象`);
          continue;
        }
        if (!VALID_SIGNALS.has(h.signal as string)) {
          errors.push(`contextHints[${i}].signal 值无效: ${String(h.signal)}`);
        }
        if (!VALID_CONDITIONS.has(h.condition as string)) {
          errors.push(`contextHints[${i}].condition 值无效: ${String(h.condition)}`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 解析 Markdown 格式的技能定义文件。
 * 格式：YAML frontmatter（--- 分隔）+ 正文作为 promptTemplate。
 */
export function parseSkillMarkdown(mdText: string): WritingSkill {
  const match = mdText.match(FRONTMATTER_RE);
  if (!match) {
    throw new Error('无效的技能文件格式：缺少 YAML frontmatter（需要 --- 分隔符）');
  }

  const [, yamlBlock, body] = match;

  let frontmatter: Record<string, unknown>;
  try {
    frontmatter = yamlParse(yamlBlock) as Record<string, unknown>;
  } catch (e) {
    throw new Error(`YAML 解析失败: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!frontmatter || typeof frontmatter !== 'object') {
    throw new Error('YAML frontmatter 解析结果不是有效对象');
  }

  const validation = validateSkillFrontmatter(frontmatter);
  if (!validation.valid) {
    throw new Error(`技能定义验证失败:\n${validation.errors.join('\n')}`);
  }

  const parameters: SkillParameter[] = Array.isArray(frontmatter.parameters)
    ? frontmatter.parameters.map((p: Record<string, unknown>) => ({
        key: String(p.key),
        label: String(p.label),
        type: String(p.type) as SkillParameter['type'],
        ...(p.source ? { source: String(p.source) as SkillParameter['source'] } : {}),
        ...(p.options ? { options: (p.options as string[]).map(String) } : {}),
        ...(p.defaultValue !== undefined ? { defaultValue: String(p.defaultValue) } : {}),
        ...(p.placeholder !== undefined ? { placeholder: String(p.placeholder) } : {}),
        ...(p.required !== undefined ? { required: Boolean(p.required) } : {}),
      }))
    : [];

  const contextHints: ContextHint[] = Array.isArray(frontmatter.contextHints)
    ? frontmatter.contextHints.map((h: Record<string, unknown>) => ({
        signal: String(h.signal) as ContextHint['signal'],
        condition: String(h.condition) as ContextHint['condition'],
        ...(h.weight !== undefined ? { weight: Number(h.weight) } : {}),
      }))
    : [];

  const nameStr = typeof frontmatter.name === 'string' ? frontmatter.name : '';
  const idStr = typeof frontmatter.id === 'string' && frontmatter.id.trim() !== ''
    ? String(frontmatter.id)
    : slugify(nameStr);

  return {
    id: idStr,
    name: nameStr || idStr,
    icon: String(frontmatter.icon ?? '🔧'),
    description: String(frontmatter.description ?? ''),
    promptTemplate: body.trim(),
    parameters,
    contextHints,
    sortOrder: typeof frontmatter.sortOrder === 'number' ? frontmatter.sortOrder : 0,
    builtIn: false,
    enabled: frontmatter.enabled !== false,
    ...(typeof frontmatter.license === 'string' ? { license: frontmatter.license } : {}),
  };
}

/**
 * 将 WritingSkill 序列化为 Markdown 格式。
 * builtIn 字段不写入文件（由加载来源决定）。
 */
export function serializeSkillToMarkdown(skill: WritingSkill): string {
  const frontmatter: Record<string, unknown> = {
    id: skill.id,
    name: skill.name,
    icon: skill.icon,
    description: skill.description,
    ...(skill.license ? { license: skill.license } : {}),
    sortOrder: skill.sortOrder,
    enabled: skill.enabled,
  };

  if (skill.parameters.length > 0) {
    frontmatter.parameters = skill.parameters.map((p) => {
      const obj: Record<string, unknown> = {
        key: p.key,
        label: p.label,
        type: p.type,
      };
      if (p.source) obj.source = p.source;
      if (p.options && p.options.length > 0) obj.options = p.options;
      if (p.defaultValue !== undefined && p.defaultValue !== '') obj.defaultValue = p.defaultValue;
      if (p.placeholder !== undefined && p.placeholder !== '') obj.placeholder = p.placeholder;
      if (p.required) obj.required = p.required;
      return obj;
    });
  } else {
    frontmatter.parameters = [];
  }

  if (skill.contextHints.length > 0) {
    frontmatter.contextHints = skill.contextHints.map((h) => {
      const obj: Record<string, unknown> = {
        signal: h.signal,
        condition: h.condition,
      };
      if (h.weight !== undefined) obj.weight = h.weight;
      return obj;
    });
  } else {
    frontmatter.contextHints = [];
  }

  const yamlStr = yamlStringify(frontmatter, { lineWidth: 0 }).trimEnd();

  return `---\n${yamlStr}\n---\n\n${skill.promptTemplate.trim()}\n`;
}

/**
 * 解析技能目录结构。
 * files 为 { "SKILL.md": "...", "_meta.json": "...", "references/xxx.md": "..." } 映射。
 */
export function parseSkillDirectory(files: Record<string, string>): WritingSkill {
  const skillMd = files['SKILL.md'];
  if (!skillMd) {
    throw new Error('技能目录中缺少 SKILL.md 文件');
  }

  const skill = parseSkillMarkdown(skillMd);

  // 合并 _meta.json 中的元数据
  const metaRaw = files['_meta.json'];
  if (metaRaw) {
    try {
      const meta = JSON.parse(metaRaw) as Record<string, unknown>;
      if (typeof meta.slug === 'string') skill.slug = meta.slug;
      if (typeof meta.version === 'string') skill.version = meta.version;
    } catch {
      // _meta.json 格式错误时静默忽略
    }
  }

  // 收集 references/ 目录下的文件
  const refs: SkillReference[] = [];
  const refPrefix = 'references/';
  for (const [path, content] of Object.entries(files)) {
    if (path.startsWith(refPrefix) && path.length > refPrefix.length) {
      refs.push({ filename: path.slice(refPrefix.length), content });
    }
  }
  if (refs.length > 0) {
    skill.references = refs;
  }

  return skill;
}

/**
 * 将 WritingSkill 序列化为 zip Blob。
 * 包含 SKILL.md + 可选 _meta.json + 可选 references/ 目录。
 */
export async function serializeSkillToZip(skill: WritingSkill): Promise<Blob> {
  const zip = new JSZip();

  // SKILL.md
  zip.file('SKILL.md', serializeSkillToMarkdown(skill));

  // _meta.json（如果有 slug 或 version）
  if (skill.slug || skill.version || skill.license) {
    const meta: Record<string, unknown> = {};
    if (skill.slug) meta.slug = skill.slug;
    if (skill.version) meta.version = skill.version;
    if (skill.references && skill.references.length > 0) {
      meta.references = skill.references.map((r) => r.filename);
    }
    zip.file('_meta.json', JSON.stringify(meta, null, 2));
  }

  // references/
  if (skill.references && skill.references.length > 0) {
    for (const ref of skill.references) {
      zip.file(`references/${ref.filename}`, ref.content);
    }
  }

  return zip.generateAsync({ type: 'blob' });
}

/**
 * 从 zip Blob 解析技能。
 */
export async function parseSkillZip(zipBlob: Blob): Promise<WritingSkill> {
  const zip = await JSZip.loadAsync(zipBlob);
  const files: Record<string, string> = {};

  for (const [path, entry] of Object.entries(zip.files)) {
    if (!entry.dir) {
      files[path] = await entry.async('string');
    }
  }

  return parseSkillDirectory(files);
}

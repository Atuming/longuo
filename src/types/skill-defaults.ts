import type { WritingSkill } from './ai';
import { parseSkillMarkdown, parseSkillDirectory } from '../lib/skill-parser';

interface SkillManifest {
  version: number;
  skills: string[];
}

interface MetaJson {
  slug?: string;
  version?: string;
  references?: string[];
  [key: string]: unknown;
}

/**
 * 从 public/skills/ 目录异步加载内置技能。
 * 支持 v1（单文件 .md）和 v2（目录格式）两种清单版本。
 * 失败时回退到 BUILT_IN_SKILLS 硬编码常量。
 */
export async function loadBuiltInSkills(): Promise<WritingSkill[]> {
  try {
    const res = await fetch('./skills/index.json');
    if (!res.ok) {
      console.warn(`[skills] 清单加载失败: ${res.status}，使用内置默认值`);
      return BUILT_IN_SKILLS;
    }
    const manifest = (await res.json()) as SkillManifest;
    if (!manifest.skills || !Array.isArray(manifest.skills) || manifest.skills.length === 0) {
      console.warn('[skills] 清单为空，使用内置默认值');
      return BUILT_IN_SKILLS;
    }

    const loader = manifest.version === 2 ? loadSkillV2 : loadSkillV1;
    const results = await Promise.allSettled(manifest.skills.map(loader));

    const loaded: WritingSkill[] = [];
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'fulfilled') {
        loaded.push(r.value);
      } else {
        console.warn(`[skills] ${manifest.skills[i]} 加载失败:`, r.reason);
      }
    }

    if (loaded.length === 0) {
      console.warn('[skills] 所有技能文件加载失败，使用内置默认值');
      return BUILT_IN_SKILLS;
    }

    return loaded.sort((a, b) => a.sortOrder - b.sortOrder);
  } catch (e) {
    console.warn('[skills] 加载异常，使用内置默认值:', e);
    return BUILT_IN_SKILLS;
  }
}

/** v1 加载器：单个 .md 文件 */
async function loadSkillV1(filename: string): Promise<WritingSkill> {
  const mdRes = await fetch(`./skills/${filename}`);
  if (!mdRes.ok) throw new Error(`HTTP ${mdRes.status}`);
  const mdText = await mdRes.text();
  const skill = parseSkillMarkdown(mdText);
  skill.builtIn = true;
  return skill;
}

/** v2 加载器：目录结构 (SKILL.md + _meta.json + references/) */
async function loadSkillV2(dirName: string): Promise<WritingSkill> {
  const files: Record<string, string> = {};

  // 加载 SKILL.md（必需）
  const mdRes = await fetch(`./skills/${dirName}/SKILL.md`);
  if (!mdRes.ok) throw new Error(`SKILL.md HTTP ${mdRes.status}`);
  files['SKILL.md'] = await mdRes.text();

  // 加载 _meta.json（可选）
  let meta: MetaJson | null = null;
  try {
    const metaRes = await fetch(`./skills/${dirName}/_meta.json`);
    if (metaRes.ok) {
      const metaText = await metaRes.text();
      files['_meta.json'] = metaText;
      meta = JSON.parse(metaText) as MetaJson;
    }
  } catch {
    // _meta.json 不存在或解析失败，忽略
  }

  // 加载 references（从 _meta.json 声明的列表）
  if (meta?.references && Array.isArray(meta.references)) {
    const refResults = await Promise.allSettled(
      meta.references.map(async (refName: string) => {
        const refRes = await fetch(`./skills/${dirName}/references/${refName}`);
        if (!refRes.ok) throw new Error(`HTTP ${refRes.status}`);
        return { name: refName, content: await refRes.text() };
      }),
    );
    for (const r of refResults) {
      if (r.status === 'fulfilled') {
        files[`references/${r.value.name}`] = r.value.content;
      }
    }
  }

  const skill = parseSkillDirectory(files);
  skill.builtIn = true;
  return skill;
}

/** 8 个内置写作技能（同步回退常量） */
export const BUILT_IN_SKILLS: WritingSkill[] = [
  {
    id: 'builtin-continue',
    name: '续写',
    icon: '✍️',
    description: '根据当前章节内容自然地续写下去',
    promptTemplate:
      '请根据当前章节的最后几段内容，保持一致的叙事视角、文风和节奏，自然地续写下去。' +
      '注意：1）延续当前的情节走向和情绪基调；2）如果有对话正在进行，继续对话并推进剧情；' +
      '3）保持与已出场角色的性格一致性；4）适当穿插环境描写和心理活动；5）约400-600字。',
    parameters: [],
    contextHints: [
      { signal: 'isNearEnd', condition: 'true', weight: 1.5 },
      { signal: 'wordCount', condition: 'high', weight: 0.5 },
    ],
    sortOrder: 0,
    builtIn: true,
    enabled: true,
  },
  {
    id: 'builtin-polish',
    name: '润色',
    icon: '💎',
    description: '对当前章节内容进行深度润色',
    promptTemplate:
      '请对当前章节内容进行深度润色。要求：' +
      '1）优化句式结构，消除口语化和重复表达；2）增强五感描写（视觉、听觉、触觉、嗅觉、味觉）；' +
      '3）用更精准的动词和形容词替换平淡用词；4）调整段落节奏，长短句交替；' +
      '5）保持原有情节和人物性格不变，只提升文学表现力。请输出润色后的完整段落。',
    parameters: [],
    contextHints: [
      { signal: 'wordCount', condition: 'high', weight: 1.0 },
    ],
    sortOrder: 1,
    builtIn: true,
    enabled: true,
  },
  {
    id: 'builtin-dialogue',
    name: '对话',
    icon: '💬',
    description: '生成符合角色性格的高质量对话',
    promptTemplate:
      '请根据当前场景和在场角色，生成一段高质量的角色对话。' +
      '{param:character1}{param:character2}' +
      '要求：' +
      '1）每个角色的语气、用词、说话习惯要符合其性格设定；2）对话要推动剧情发展或揭示角色关系；' +
      '3）穿插适当的动作描写、表情描写和心理活动（不要纯对话）；4）对话节奏有张有弛，避免一问一答的机械感；' +
      '5）如有冲突或悬念，通过对话自然展现。约300-500字。',
    parameters: [
      { key: 'character1', label: '角色A', type: 'select', source: 'characters', placeholder: '选择角色（可选）', required: false },
      { key: 'character2', label: '角色B', type: 'select', source: 'characters', placeholder: '选择角色（可选）', required: false },
    ],
    contextHints: [
      { signal: 'hasCharacters', condition: 'true', weight: 1.5 },
      { signal: 'hasDialogue', condition: 'true', weight: 0.5 },
    ],
    sortOrder: 2,
    builtIn: true,
    enabled: true,
  },
  {
    id: 'builtin-scene',
    name: '场景',
    icon: '🏞️',
    description: '写一段沉浸式的场景描写',
    promptTemplate:
      '请根据当前章节的背景设定和世界观，写一段沉浸式的场景描写。要求：' +
      '1）综合运用视觉、听觉、嗅觉、触觉等多感官描写；2）场景氛围要与当前情节的情绪基调一致；' +
      '3）通过环境细节暗示时间、天气、季节等信息；4）将场景描写与角色的情绪或行动自然融合，避免静态罗列；' +
      '5）如涉及世界观特有元素（魔法、科技等），要体现设定特色。约200-400字。',
    parameters: [],
    contextHints: [
      { signal: 'hasWorldEntries', condition: 'true', weight: 1.5 },
    ],
    sortOrder: 3,
    builtIn: true,
    enabled: true,
  },
  {
    id: 'builtin-expand',
    name: '扩写',
    icon: '📝',
    description: '将当前内容扩写得更加丰满立体',
    promptTemplate:
      '请将当前章节内容进行扩写，使其更加丰满立体。要求：' +
      '1）补充角色的内心独白和情感变化；2）增加环境氛围和感官细节；3）展开被一笔带过的动作和过程；' +
      '4）添加角色之间的微表情和肢体语言；5）如有伏笔或暗示，适当强化但不要太明显；' +
      '6）扩写后的内容应是原文的1.5-2倍长度，保持情节走向不变。',
    parameters: [],
    contextHints: [
      { signal: 'wordCount', condition: 'low', weight: 1.5 },
    ],
    sortOrder: 4,
    builtIn: true,
    enabled: true,
  },
  {
    id: 'builtin-rewrite',
    name: '改写',
    icon: '🔄',
    description: '用不同的叙述方式改写当前内容',
    promptTemplate:
      '请用不同的叙述方式改写当前章节内容。要求：' +
      '1）可以尝试切换叙事视角（如从第三人称改为第一人称，或从旁观者视角改为某角色视角）；' +
      '2）调整叙事节奏（如将平铺直叙改为倒叙或插叙）；3）保持核心情节和角色关系不变；' +
      '4）用全新的比喻和意象替换原有描写；5）改写后的文字应有明显不同的阅读体验。',
    parameters: [],
    contextHints: [
      { signal: 'wordCount', condition: 'high', weight: 0.5 },
    ],
    sortOrder: 5,
    builtIn: true,
    enabled: true,
  },
  {
    id: 'builtin-conflict',
    name: '冲突',
    icon: '🎭',
    description: '设计并写出一段戏剧冲突',
    promptTemplate:
      '请根据当前章节的角色关系和情节走向，设计并写出一段戏剧冲突。要求：' +
      '1）冲突要有合理的起因，符合角色动机和性格；2）通过对话、行动和心理描写层层升级紧张感；' +
      '3）冲突中要展现角色的不同立场和价值观；4）留下悬念或转折，不要在这一段内完全解决冲突；' +
      '5）约400-600字。',
    parameters: [],
    contextHints: [
      { signal: 'hasCharacters', condition: 'true', weight: 1.0 },
    ],
    sortOrder: 6,
    builtIn: true,
    enabled: true,
  },
  {
    id: 'builtin-inner',
    name: '内心',
    icon: '💭',
    description: '为角色写一段深入的内心独白',
    promptTemplate:
      '请为当前场景中的{param:character}写一段深入的内心独白。要求：' +
      '1）展现角色此刻的真实想法和情感波动；2）通过内心活动揭示角色的动机、恐惧或欲望；' +
      '3）可以穿插回忆片段或联想；4）内心独白的语言风格要符合角色的教育背景和性格特点；' +
      '5）与外在表现形成对比或呼应，增加角色的层次感。约200-400字。',
    parameters: [
      { key: 'character', label: '角色', type: 'select', source: 'characters', placeholder: '选择角色（可选）', required: false },
    ],
    contextHints: [
      { signal: 'hasCharacters', condition: 'true', weight: 1.5 },
    ],
    sortOrder: 7,
    builtIn: true,
    enabled: true,
  },
];

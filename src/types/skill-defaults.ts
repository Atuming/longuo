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
      '你是一位经验丰富的中文小说家。请根据当前章节内容自然续写。\n\n' +
      '核心原则：1）从原文末句自然延伸，续写首句要有明确承接关系；' +
      '2）严格沿用原文叙事视角（人称/全知/限知）；' +
      '3）场景-续场节奏：行动场景后接情绪反应和思考，再开启新场景；' +
      '4）角色每个行动须符合其性格设定，不做"剧情需要"的违和行为；' +
      '5）穿插感官细节（环境变化、身体反应、具体物件），控制句式长短节奏；' +
      '6）自然提及未解决伏笔但不要急于揭晓，结尾可埋新悬念。\n\n' +
      '约400-800字，直接输出正文。',
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
      '你是一位资深中文小说文字编辑。请对下方内容进行深度文学润色，保持原意和情节不变。\n\n' +
      '技法要求：1）具体化抽象表述——用感官细节替代概括描述（"他很生气"→描写动作和表情）；' +
      '2）升级动词——将"走/看/说"等通用词替换为精准具象词（踱/凝视/低语）；' +
      '3）优化句式节奏——长短句交替，短句独段制造冲击力；' +
      '4）去除冗余——删除多余程度副词、"他开始/他觉得"等过滤词、网文套话；' +
      '5）深化感官——每个重要场景至少两层感官（不只视觉）；' +
      '6）对话润色——精简填充寒暄，增强角色声纹辨识度，提示语多样化。\n\n' +
      '输出润色后的完整段落，不要加说明或标注。',
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
      '你是一位擅长对话的中文小说家。请根据当前场景生成高质量对话。{param:character1}{param:character2}\n\n' +
      '技法要求：1）角色"声纹"差异化——词汇选择、句子长短、口头禅、称呼方式各有不同，不看提示语就能分辨说话者；' +
      '2）潜台词原则——角色很少直接说真话，用暗示、回避、转移话题表达，说的和想的之间有张力；' +
      '3）对话即行动——每句话有明确意图（说服/威胁/试探/隐瞒），对话结束后至少一个角色状态应改变；' +
      '4）节奏控制——避免一问一答，打断、沉默、转移话题交替使用，关键台词前用动作制造停顿感；' +
      '5）动作镶嵌——每2-3轮对话插入身体语言和微表情（摸鼻子/握拳/转动手中物件）；' +
      '6）权力关系——通过对话展现角色地位及微妙变化。\n\n' +
      '约300-600字叙事体（非纯对话剧本格式），直接输出正文。',
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
      '你是一位擅长环境描写的中文小说家。请写一段沉浸式场景描写。\n\n' +
      '技法要求：1）POV过滤——场景必须通过当前视角角色的感官和情绪来呈现，角色心情不同看到的同一场景也不同；' +
      '2）五感交响——每段场景至少调动3种感官（视觉/听觉/嗅觉/触觉/味觉），颜色用具体词汇（猩红而非红色），声音有距离感；' +
      '3）情绪功能——场景氛围与情节情绪呼应或对比（悲伤配阴雨/悲剧发生在好天气里更有冲击力）；' +
      '4）动态描写——不静态罗列，通过风吹草动、光线变化、角色行动带出场景；' +
      '5）选择性细节——选2-3个有表意功能的细节深入（破损门槛暗示家族没落）；' +
      '6）时间维度——光线角度暗示早中晚，植物状态暗示季节。\n\n' +
      '约200-500字，直接输出正文。',
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
      '你是一位擅长细节铺陈的中文小说家。请将下方内容扩写得更丰满。\n\n' +
      '技法要求：1）识别扩展点——在情感节拍（震惊→消化→决策）、过渡时刻（旅途/等待）、关键动作处增加血肉；' +
      '2）展开情感——不要跳过情绪反应，展示：身体反应→即时情绪→内心思考→外部行动这四步；' +
      '3）Show, Don\'t Tell——将概括陈述转为具体场景（"她很紧张"→反复检查装备、深呼吸、手心出汗）；' +
      '4）添加微表情与肢体语言——习惯性小动作（转笔、咬嘴唇）让角色跃然纸上；' +
      '5）环境作为情感放大器——每个环境细节有情感功能，不为扩写而堆砌；' +
      '6）保持叙事效率——添加内容应推进情节/深化角色/营造氛围/埋设伏笔，扩至原文1.5-2倍。\n\n' +
      '输出扩写后完整段落，直接输出正文。',
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
      '你是一位风格多变的中文小说家。请用与原文明显不同的叙述方式改写。\n\n' +
      '可选策略（选1-2个主要方向）：1）视角切换——限知↔全知、旁观↔深潜内心、多视角交替呈现同一事件的不同解读；' +
      '2）时间重构——顺叙变倒叙制造悬念、插叙补充背景、时间压缩/拉伸改变节奏；' +
      '3）语气转换——严肃↔幽默、华丽↔简练、冷静↔激情；' +
      '4）叙事距离——远距俯瞰/中距跟随/近距深潜意识流，高潮处有意拉近。\n\n' +
      '约束：核心情节和关键事件不变，角色关系和性格不变，重要台词必须保留。改写后应有全新阅读体验。\n\n' +
      '直接输出正文。',
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
      '你是一位精通戏剧冲突的中文小说家。请设计并写出精彩的冲突场景。\n\n' +
      '技法要求：1）三层冲突——表层（具体争论）+ 中层（价值观/目标差异）+ 深层（内心创伤被触发），三层同时运行；' +
      '2）升级弧线——小摩擦触发→双方不退让→情绪失控→不可挽回的话/行动→余波（不完全解决）；' +
      '3）必然性——冲突根植于角色性格和处境，不是巧合或误会；' +
      '4）对话是武器——指责/辩解/讽刺/威胁/情感绑架，角色用最擅长的手段攻击；' +
      '5）身体语言——姿态变化（逼近/后退/拍桌）、空间距离变化反映心理距离，沉默和停顿是强力武器；' +
      '6）留出口——结束时至少留一个未解决的张力点。\n\n' +
      '约400-700字，直接输出叙事正文。',
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
      '你是一位擅长心理描写的中文小说家。请为当前场景中的{param:character}写一段内心独白。\n\n' +
      '技法要求：1）触发具体——由一句话/一个物件/一种气味触发思绪；' +
      '2）思维真实感——跳跃性（A→B→C省略连接）、碎片化（不完整句子/思路中断）、重复纠结（反复打转）、自我对话（自我辩论/欺骗）；' +
      '3）情感与理智博弈——知道该怎么做但情感做不到，表面想法vs真实欲望；' +
      '4）记忆运用——当前事件对照过去记忆，感官触发最为真实；' +
      '5）语言风格匹配角色——学者逻辑分析/感性比喻意象/少年自我中心/沧桑克制；' +
      '6）内心与外在对比——表面平静内心波涛汹涌更有张力。\n\n' +
      '约200-500字，自由间接引语或第一人称皆可，直接输出正文。',
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
  {
    id: 'builtin-extract-world',
    name: '从文档导入',
    icon: '\u{1F4E5}',
    description: '从文本中同时提取角色信息和世界观设定，导入到角色和世界观面板',
    promptTemplate:
      '请从给定文本中同时提取角色信息和世界观设定。' +
      '输出严格 JSON 对象：{"characters":[...],"worldEntries":[...]}。' +
      'characters 每项含：name、aliases（字符串数组）、appearance、personality、backstory。' +
      'worldEntries 每项含：name、type、description。' +
      '具体有名字的个体归 characters，抽象设定归 worldEntries。种族只用于物种大类。',
    parameters: [],
    contextHints: [
      { signal: 'hasWorldEntries', condition: 'false', weight: 1.0 },
      { signal: 'hasCharacters', condition: 'false', weight: 1.0 },
    ],
    sortOrder: 8,
    builtIn: true,
    enabled: true,
  },
];

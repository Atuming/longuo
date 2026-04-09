/** 世界观条目 */
export interface WorldEntry {
  id: string;
  projectId: string;
  type: string;
  name: string;
  description: string;
  category?: string;
  associatedCharacterIds: string[];
}

/** 内置分类定义 */
export interface BuiltInCategory {
  key: string;
  label: string;
  color: { bg: string; text: string };
}

/** 用户自定义的世界观分类 */
export interface CustomWorldCategory {
  key: string;
  label: string;
}

/** 11 种内置分类 */
export const BUILT_IN_CATEGORIES: BuiltInCategory[] = [
  { key: 'location',   label: '地点',       color: { bg: '#EBF8FF', text: '#3182CE' } },
  { key: 'faction',    label: '势力',       color: { bg: '#FAF5FF', text: '#9F7AEA' } },
  { key: 'rule',       label: '规则',       color: { bg: '#FFF5F5', text: '#E53E3E' } },
  { key: 'item',       label: '物品/道具',  color: { bg: '#FFFFF0', text: '#D69E2E' } },
  { key: 'race',       label: '种族/物种',  color: { bg: '#F0FFF4', text: '#38A169' } },
  { key: 'magic',      label: '魔法/能力',  color: { bg: '#EBF4FF', text: '#5A67D8' } },
  { key: 'history',    label: '历史/事件',  color: { bg: '#FFF5F7', text: '#D53F8C' } },
  { key: 'culture',    label: '文化/习俗',  color: { bg: '#FEFCBF', text: '#B7791F' } },
  { key: 'technology', label: '科技/技术',  color: { bg: '#E6FFFA', text: '#319795' } },
  { key: 'economy',    label: '货币/经济',  color: { bg: '#FED7D7', text: '#C53030' } },
  { key: 'religion',   label: '宗教/信仰',  color: { bg: '#E9D8FD', text: '#6B46C1' } },
];

/** 默认自定义分类颜色 */
export const CUSTOM_CATEGORY_DEFAULT_COLOR = { bg: '#EDF2F7', text: '#4A5568' };

/** 根据 type 返回分类的 label 和 color */
export function getCategoryInfo(
  type: string,
  customCategories: CustomWorldCategory[],
): { label: string; color: { bg: string; text: string } } {
  const builtIn = BUILT_IN_CATEGORIES.find((c) => c.key === type);
  if (builtIn) {
    return { label: builtIn.label, color: builtIn.color };
  }

  const custom = customCategories.find((c) => c.key === type);
  if (custom) {
    return { label: custom.label, color: CUSTOM_CATEGORY_DEFAULT_COLOR };
  }

  // 未知分类：使用 type 原始值作为 label，默认颜色
  return { label: type, color: CUSTOM_CATEGORY_DEFAULT_COLOR };
}

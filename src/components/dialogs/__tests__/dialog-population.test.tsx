import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CharacterDialog } from '../CharacterDialog';
import { WorldDialog } from '../WorldDialog';
import { TimelineDialog } from '../TimelineDialog';
import { PlotDialog } from '../PlotDialog';
import { RelationshipDialog } from '../RelationshipDialog';
import type { Character } from '../../../types/character';
import type { Chapter } from '../../../types/chapter';
import type { TimelinePoint } from '../../../types/timeline';

/**
 * 弹窗数据回填测试
 * Validates: Requirements 1.1-1.7
 */

// --- Mock data ---

const mockCharacter: Character = {
  id: 'char-1',
  projectId: 'proj-1',
  name: '张三',
  aliases: ['小张', '老张'],
  appearance: '高大威猛',
  personality: '沉稳内敛',
  backstory: '出生于江南水乡',
  customAttributes: { 武器: '长剑', 门派: '华山派' },
};

const mockCharacter2: Character = {
  id: 'char-2',
  projectId: 'proj-1',
  name: '李四',
  aliases: [],
  appearance: '',
  personality: '',
  backstory: '',
  customAttributes: {},
};

const mockChapters: Chapter[] = [
  { id: 'ch-1', projectId: 'proj-1', parentId: null, title: '第一章', content: '', sortOrder: 0, level: 'chapter', wordCount: 0 },
  { id: 'ch-2', projectId: 'proj-1', parentId: null, title: '第二章', content: '', sortOrder: 1, level: 'chapter', wordCount: 0 },
];

const mockTimelinePoints: TimelinePoint[] = [
  { id: 'tp-1', projectId: 'proj-1', label: '第一年春', description: '开端', sortOrder: 0, associatedChapterIds: [], associatedCharacterIds: [] },
  { id: 'tp-2', projectId: 'proj-1', label: '第二年秋', description: '高潮', sortOrder: 1, associatedChapterIds: [], associatedCharacterIds: [] },
];

// ============================================================
// CharacterDialog 回填测试 (需求 1.1)
// ============================================================
describe('CharacterDialog 数据回填', () => {
  const baseProps = {
    open: true,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it('should populate form fields with initialData', () => {
    render(<CharacterDialog {...baseProps} initialData={mockCharacter} />);

    // Name field
    const nameInput = screen.getByPlaceholderText('角色姓名') as HTMLInputElement;
    expect(nameInput.value).toBe('张三');

    // Appearance
    const appearanceInput = screen.getByPlaceholderText('描述角色外貌') as HTMLTextAreaElement;
    expect(appearanceInput.value).toBe('高大威猛');

    // Personality
    const personalityInput = screen.getByPlaceholderText('描述角色性格') as HTMLTextAreaElement;
    expect(personalityInput.value).toBe('沉稳内敛');

    // Backstory
    const backstoryInput = screen.getByPlaceholderText('角色背景故事') as HTMLTextAreaElement;
    expect(backstoryInput.value).toBe('出生于江南水乡');

    // Aliases should be displayed
    expect(screen.getByText('小张')).toBeInTheDocument();
    expect(screen.getByText('老张')).toBeInTheDocument();

    // Custom attributes should be displayed
    expect(screen.getByText('武器')).toBeInTheDocument();
    expect(screen.getByText('长剑')).toBeInTheDocument();
    expect(screen.getByText('门派')).toBeInTheDocument();
    expect(screen.getByText('华山派')).toBeInTheDocument();

    // Title should indicate edit mode
    expect(screen.getByText('编辑角色')).toBeInTheDocument();
  });

  it('should show empty form when initialData is undefined (new creation)', () => {
    render(<CharacterDialog {...baseProps} />);

    const nameInput = screen.getByPlaceholderText('角色姓名') as HTMLInputElement;
    expect(nameInput.value).toBe('');

    const appearanceInput = screen.getByPlaceholderText('描述角色外貌') as HTMLTextAreaElement;
    expect(appearanceInput.value).toBe('');

    const personalityInput = screen.getByPlaceholderText('描述角色性格') as HTMLTextAreaElement;
    expect(personalityInput.value).toBe('');

    const backstoryInput = screen.getByPlaceholderText('角色背景故事') as HTMLTextAreaElement;
    expect(backstoryInput.value).toBe('');

    // Title should indicate new creation
    expect(screen.getByText('新建角色')).toBeInTheDocument();
  });

  it('should reset form when dialog closes and reopens for new creation (需求 1.6)', () => {
    const { rerender } = render(
      <CharacterDialog {...baseProps} open={true} initialData={mockCharacter} />,
    );

    // Verify data is populated
    expect((screen.getByPlaceholderText('角色姓名') as HTMLInputElement).value).toBe('张三');

    // Close dialog
    rerender(<CharacterDialog {...baseProps} open={false} initialData={mockCharacter} />);

    // Reopen for new creation (no initialData)
    rerender(<CharacterDialog {...baseProps} open={true} initialData={undefined} />);

    expect((screen.getByPlaceholderText('角色姓名') as HTMLInputElement).value).toBe('');
    expect((screen.getByPlaceholderText('描述角色外貌') as HTMLTextAreaElement).value).toBe('');
    expect((screen.getByPlaceholderText('描述角色性格') as HTMLTextAreaElement).value).toBe('');
    expect((screen.getByPlaceholderText('角色背景故事') as HTMLTextAreaElement).value).toBe('');
    expect(screen.getByText('新建角色')).toBeInTheDocument();
  });
});

// ============================================================
// WorldDialog 回填测试 (需求 1.2)
// ============================================================
describe('WorldDialog 数据回填', () => {
  const baseProps = {
    open: true,
    projectId: 'proj-1',
    characters: [mockCharacter, mockCharacter2],
    customCategories: [],
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it('should populate form fields with initialData including type highlight', () => {
    const worldEntry = {
      id: 'w-1',
      projectId: 'proj-1',
      type: 'faction',
      name: '华山派',
      description: '五岳剑派之一',
      category: '',
      associatedCharacterIds: ['char-1'],
    };

    render(<WorldDialog {...baseProps} initialData={worldEntry} />);

    // Name
    expect((screen.getByPlaceholderText('条目名称') as HTMLInputElement).value).toBe('华山派');

    // Description
    expect((screen.getByPlaceholderText('详细描述') as HTMLTextAreaElement).value).toBe('五岳剑派之一');

    // Title should indicate edit mode
    expect(screen.getByText('编辑世界观')).toBeInTheDocument();

    // Associated character checkbox should be checked
    const charCheckboxes = screen.getAllByRole('checkbox');
    const char1Checkbox = charCheckboxes.find((cb) => {
      const label = cb.closest('label');
      return label?.textContent?.includes('张三');
    }) as HTMLInputElement;
    expect(char1Checkbox.checked).toBe(true);

    const char2Checkbox = charCheckboxes.find((cb) => {
      const label = cb.closest('label');
      return label?.textContent?.includes('李四');
    }) as HTMLInputElement;
    expect(char2Checkbox.checked).toBe(false);
  });

  it('should show default form when initialData is undefined', () => {
    render(<WorldDialog {...baseProps} />);

    expect((screen.getByPlaceholderText('条目名称') as HTMLInputElement).value).toBe('');
    expect((screen.getByPlaceholderText('详细描述') as HTMLTextAreaElement).value).toBe('');
    expect(screen.getByText('新建世界观')).toBeInTheDocument();
  });

  it('should reset form when dialog closes and reopens for new creation (需求 1.6)', () => {
    const worldEntry = {
      id: 'w-1',
      projectId: 'proj-1',
      type: 'faction',
      name: '华山派',
      description: '五岳剑派之一',
      category: '',
      associatedCharacterIds: ['char-1'],
    };

    const { rerender } = render(
      <WorldDialog {...baseProps} open={true} initialData={worldEntry} />,
    );

    expect((screen.getByPlaceholderText('条目名称') as HTMLInputElement).value).toBe('华山派');

    // Close
    rerender(<WorldDialog {...baseProps} open={false} initialData={worldEntry} />);

    // Reopen for new creation
    rerender(<WorldDialog {...baseProps} open={true} initialData={undefined} />);

    expect((screen.getByPlaceholderText('条目名称') as HTMLInputElement).value).toBe('');
    expect((screen.getByPlaceholderText('详细描述') as HTMLTextAreaElement).value).toBe('');
    expect(screen.getByText('新建世界观')).toBeInTheDocument();
  });
});

// ============================================================
// TimelineDialog 回填测试 (需求 1.3)
// ============================================================
describe('TimelineDialog 数据回填', () => {
  const baseProps = {
    open: true,
    projectId: 'proj-1',
    chapters: mockChapters,
    characters: [mockCharacter, mockCharacter2],
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it('should populate form fields with initialData including checkbox states', () => {
    const timelinePoint: TimelinePoint = {
      id: 'tp-1',
      projectId: 'proj-1',
      label: '第一年春',
      description: '万物复苏',
      sortOrder: 0,
      associatedChapterIds: ['ch-1'],
      associatedCharacterIds: ['char-2'],
    };

    render(<TimelineDialog {...baseProps} initialData={timelinePoint} />);

    // Label
    expect((screen.getByPlaceholderText('如：第一年春') as HTMLInputElement).value).toBe('第一年春');

    // Description
    expect((screen.getByPlaceholderText('描述该时间节点的事件') as HTMLTextAreaElement).value).toBe('万物复苏');

    // Title should indicate edit mode
    expect(screen.getByText('编辑时间节点')).toBeInTheDocument();

    // Chapter checkboxes
    const checkboxes = screen.getAllByRole('checkbox');
    const ch1Checkbox = checkboxes.find((cb) => {
      const label = cb.closest('label');
      return label?.textContent?.includes('第一章');
    }) as HTMLInputElement;
    expect(ch1Checkbox.checked).toBe(true);

    const ch2Checkbox = checkboxes.find((cb) => {
      const label = cb.closest('label');
      return label?.textContent?.includes('第二章');
    }) as HTMLInputElement;
    expect(ch2Checkbox.checked).toBe(false);

    // Character checkboxes
    const char1Checkbox = checkboxes.find((cb) => {
      const label = cb.closest('label');
      return label?.textContent?.includes('张三');
    }) as HTMLInputElement;
    expect(char1Checkbox.checked).toBe(false);

    const char2Checkbox = checkboxes.find((cb) => {
      const label = cb.closest('label');
      return label?.textContent?.includes('李四');
    }) as HTMLInputElement;
    expect(char2Checkbox.checked).toBe(true);
  });

  it('should show default form when initialData is undefined', () => {
    render(<TimelineDialog {...baseProps} />);

    expect((screen.getByPlaceholderText('如：第一年春') as HTMLInputElement).value).toBe('');
    expect((screen.getByPlaceholderText('描述该时间节点的事件') as HTMLTextAreaElement).value).toBe('');
    expect(screen.getByText('新建时间节点')).toBeInTheDocument();

    // All checkboxes should be unchecked
    const checkboxes = screen.getAllByRole('checkbox');
    for (const cb of checkboxes) {
      expect((cb as HTMLInputElement).checked).toBe(false);
    }
  });

  it('should reset form when dialog closes and reopens for new creation (需求 1.6)', () => {
    const timelinePoint: TimelinePoint = {
      id: 'tp-1',
      projectId: 'proj-1',
      label: '第一年春',
      description: '万物复苏',
      sortOrder: 0,
      associatedChapterIds: ['ch-1'],
      associatedCharacterIds: ['char-2'],
    };

    const { rerender } = render(
      <TimelineDialog {...baseProps} open={true} initialData={timelinePoint} />,
    );

    expect((screen.getByPlaceholderText('如：第一年春') as HTMLInputElement).value).toBe('第一年春');

    // Close
    rerender(<TimelineDialog {...baseProps} open={false} initialData={timelinePoint} />);

    // Reopen for new creation
    rerender(<TimelineDialog {...baseProps} open={true} initialData={undefined} />);

    expect((screen.getByPlaceholderText('如：第一年春') as HTMLInputElement).value).toBe('');
    expect((screen.getByPlaceholderText('描述该时间节点的事件') as HTMLTextAreaElement).value).toBe('');
    expect(screen.getByText('新建时间节点')).toBeInTheDocument();
  });
});


// ============================================================
// PlotDialog 回填测试 (需求 1.4)
// ============================================================
describe('PlotDialog 数据回填', () => {
  const baseProps = {
    open: true,
    projectId: 'proj-1',
    chapters: mockChapters,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it('should populate form fields with initialData including status highlight', () => {
    const plotThread = {
      id: 'plot-1',
      projectId: 'proj-1',
      name: '复仇线',
      description: '主角的复仇之路',
      status: 'in_progress' as const,
      associatedChapterIds: ['ch-2'],
    };

    render(<PlotDialog {...baseProps} initialData={plotThread} />);

    // Name
    expect((screen.getByPlaceholderText('线索名称') as HTMLInputElement).value).toBe('复仇线');

    // Description
    expect((screen.getByPlaceholderText('线索描述') as HTMLTextAreaElement).value).toBe('主角的复仇之路');

    // Title should indicate edit mode
    expect(screen.getByText('编辑情节线索')).toBeInTheDocument();

    // Chapter checkbox - ch-2 should be checked
    const checkboxes = screen.getAllByRole('checkbox');
    const ch1Checkbox = checkboxes.find((cb) => {
      const label = cb.closest('label');
      return label?.textContent?.includes('第一章');
    }) as HTMLInputElement;
    expect(ch1Checkbox.checked).toBe(false);

    const ch2Checkbox = checkboxes.find((cb) => {
      const label = cb.closest('label');
      return label?.textContent?.includes('第二章');
    }) as HTMLInputElement;
    expect(ch2Checkbox.checked).toBe(true);
  });

  it('should show default form when initialData is undefined', () => {
    render(<PlotDialog {...baseProps} />);

    expect((screen.getByPlaceholderText('线索名称') as HTMLInputElement).value).toBe('');
    expect((screen.getByPlaceholderText('线索描述') as HTMLTextAreaElement).value).toBe('');
    expect(screen.getByText('新建情节线索')).toBeInTheDocument();
  });

  it('should reset form when dialog closes and reopens for new creation (需求 1.6)', () => {
    const plotThread = {
      id: 'plot-1',
      projectId: 'proj-1',
      name: '复仇线',
      description: '主角的复仇之路',
      status: 'in_progress' as const,
      associatedChapterIds: ['ch-2'],
    };

    const { rerender } = render(
      <PlotDialog {...baseProps} open={true} initialData={plotThread} />,
    );

    expect((screen.getByPlaceholderText('线索名称') as HTMLInputElement).value).toBe('复仇线');

    // Close
    rerender(<PlotDialog {...baseProps} open={false} initialData={plotThread} />);

    // Reopen for new creation
    rerender(<PlotDialog {...baseProps} open={true} initialData={undefined} />);

    expect((screen.getByPlaceholderText('线索名称') as HTMLInputElement).value).toBe('');
    expect((screen.getByPlaceholderText('线索描述') as HTMLTextAreaElement).value).toBe('');
    expect(screen.getByText('新建情节线索')).toBeInTheDocument();
  });
});

// ============================================================
// RelationshipDialog 回填测试 (需求 1.5)
// ============================================================
describe('RelationshipDialog 数据回填', () => {
  const baseProps = {
    open: true,
    projectId: 'proj-1',
    sourceCharacterId: 'char-1',
    characters: [mockCharacter, mockCharacter2],
    timelinePoints: mockTimelinePoints,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it('should populate form fields with initialData', () => {
    const relationship = {
      id: 'rel-1',
      projectId: 'proj-1',
      sourceCharacterId: 'char-1',
      targetCharacterId: 'char-2',
      relationshipType: 'enemy' as const,
      customTypeName: '',
      description: '宿敌关系',
      startTimelinePointId: 'tp-1',
      strength: 8,
    };

    render(<RelationshipDialog {...baseProps} initialData={relationship} />);

    // Title should indicate edit mode
    expect(screen.getByText('编辑关系')).toBeInTheDocument();

    // Target character select
    const selects = screen.getAllByRole('combobox');
    const targetSelect = selects[0] as HTMLSelectElement;
    expect(targetSelect.value).toBe('char-2');

    // Relationship type select
    const typeSelect = selects[1] as HTMLSelectElement;
    expect(typeSelect.value).toBe('enemy');

    // Description
    expect((screen.getByPlaceholderText('关系描述') as HTMLTextAreaElement).value).toBe('宿敌关系');

    // Start timeline point select
    const timelineSelect = selects[2] as HTMLSelectElement;
    expect(timelineSelect.value).toBe('tp-1');

    // Strength slider
    const slider = screen.getByRole('slider') as HTMLInputElement;
    expect(slider.value).toBe('8');
  });

  it('should show default form when initialData is undefined', () => {
    render(<RelationshipDialog {...baseProps} />);

    expect(screen.getByText('创建角色关系')).toBeInTheDocument();

    // Description should be empty
    expect((screen.getByPlaceholderText('关系描述') as HTMLTextAreaElement).value).toBe('');

    // Default relationship type should be 'friend'
    const selects = screen.getAllByRole('combobox');
    const typeSelect = selects[1] as HTMLSelectElement;
    expect(typeSelect.value).toBe('friend');

    // Default strength should be 5
    const slider = screen.getByRole('slider') as HTMLInputElement;
    expect(slider.value).toBe('5');
  });

  it('should reset form when dialog closes and reopens for new creation (需求 1.6)', () => {
    const relationship = {
      id: 'rel-1',
      projectId: 'proj-1',
      sourceCharacterId: 'char-1',
      targetCharacterId: 'char-2',
      relationshipType: 'enemy' as const,
      customTypeName: '',
      description: '宿敌关系',
      startTimelinePointId: 'tp-1',
      strength: 8,
    };

    const { rerender } = render(
      <RelationshipDialog {...baseProps} open={true} initialData={relationship} />,
    );

    // Verify populated
    expect((screen.getByPlaceholderText('关系描述') as HTMLTextAreaElement).value).toBe('宿敌关系');

    // Close
    rerender(<RelationshipDialog {...baseProps} open={false} initialData={relationship} />);

    // Reopen for new creation
    rerender(<RelationshipDialog {...baseProps} open={true} initialData={undefined} />);

    expect(screen.getByText('创建角色关系')).toBeInTheDocument();
    expect((screen.getByPlaceholderText('关系描述') as HTMLTextAreaElement).value).toBe('');

    // Type should reset to friend
    const selects = screen.getAllByRole('combobox');
    const typeSelect = selects[1] as HTMLSelectElement;
    expect(typeSelect.value).toBe('friend');

    // Strength should reset to 5
    const slider = screen.getByRole('slider') as HTMLInputElement;
    expect(slider.value).toBe('5');
  });
});

// ============================================================
// 需求 1.7: initialData 变化时重新初始化
// ============================================================
describe('弹窗 initialData 变化时重新初始化 (需求 1.7)', () => {
  it('CharacterDialog should reinitialize when initialData changes while open', () => {
    const props = {
      open: true,
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
    };

    const char1 = { ...mockCharacter, name: '角色A' };
    const char2 = { ...mockCharacter, id: 'char-2', name: '角色B', aliases: [], appearance: '矮小', personality: '活泼', backstory: '来自北方', customAttributes: {} };

    const { rerender } = render(<CharacterDialog {...props} initialData={char1} />);
    expect((screen.getByPlaceholderText('角色姓名') as HTMLInputElement).value).toBe('角色A');

    // Close and reopen with different data
    rerender(<CharacterDialog {...props} open={false} initialData={char1} />);
    rerender(<CharacterDialog {...props} open={true} initialData={char2} />);

    expect((screen.getByPlaceholderText('角色姓名') as HTMLInputElement).value).toBe('角色B');
    expect((screen.getByPlaceholderText('描述角色外貌') as HTMLTextAreaElement).value).toBe('矮小');
  });
});

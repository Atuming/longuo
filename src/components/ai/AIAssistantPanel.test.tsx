import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import fc from 'fast-check';
import { vi, describe, it, expect } from 'vitest';
import { AIAssistantPanel } from './AIAssistantPanel';
import { EditorStoreProvider, type EditorStoreContextValue } from '../../pages/editor/EditorStoreContext';
import { BUILT_IN_SKILLS } from '../../types/skill-defaults';
import type { AIAssistantStore } from '../../types/stores';
import type { AIAssistantEngine } from '../../types/engines';
import type { AIGenerateResult, WritingSkill } from '../../types/ai';

// --- Mock factories ---

function createMockAIStore(): AIAssistantStore {
  return {
    getConfig: vi.fn(() => ({
      providers: [],
      activeProviderId: null,
      promptTemplates: [],
      activeTemplateId: null,
      defaultTemplate: { id: 'default', name: 'Default', systemPrompt: '', userPromptTemplate: '' },
    })),
    updateConfig: vi.fn(),
    addProvider: vi.fn(),
    updateProvider: vi.fn(),
    deleteProvider: vi.fn(),
    setActiveProvider: vi.fn(),
    getActiveProvider: vi.fn(() => ({
      id: 'p1', name: 'Test', apiKey: 'key', modelName: 'gpt-4',
      apiEndpoint: 'https://api.test.com', timeoutMs: 30000,
    })),
    addTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    setActiveTemplate: vi.fn(),
    getActiveTemplate: vi.fn(() => ({
      id: 'default', name: 'Default', systemPrompt: '', userPromptTemplate: '',
    })),
    addHistoryRecord: vi.fn(),
    listHistory: vi.fn(() => []),
    getHistoryRecord: vi.fn(),
    clearHistory: vi.fn(),
    listSkills: vi.fn(() => BUILT_IN_SKILLS.map((sk) => ({ ...sk, parameters: [...sk.parameters], contextHints: [...sk.contextHints] }))),
    getSkill: vi.fn(),
    addSkill: vi.fn(),
    updateSkill: vi.fn(),
    deleteSkill: vi.fn(),
    resetSkill: vi.fn(),
    reorderSkills: vi.fn(),
  } as unknown as AIAssistantStore;
}

function createMockAIEngine(
  generateFn?: (...args: unknown[]) => Promise<unknown>,
): AIAssistantEngine {
  return {
    packContext: vi.fn(),
    buildPrompt: vi.fn(),
    generate: generateFn ?? vi.fn().mockResolvedValue({ success: true, content: 'test' }),
    validateConfig: vi.fn(() => ({ valid: true, errors: [] })),
    abort: vi.fn(),
    resolveSkillPrompt: vi.fn((skill: WritingSkill) => skill.promptTemplate),
    recommendSkills: vi.fn(() => []),
  } as unknown as AIAssistantEngine;
}

function createMockEditorContext(overrides?: {
  aiStore?: AIAssistantStore;
  aiEngine?: AIAssistantEngine;
}): EditorStoreContextValue {
  return {
    projectStore: {} as EditorStoreContextValue['projectStore'],
    projectId: 'proj-1',
    projectName: 'Test',
    chapterStore: {} as EditorStoreContextValue['chapterStore'],
    characterStore: { listCharacters: vi.fn(() => []) } as unknown as EditorStoreContextValue['characterStore'],
    worldStore: {} as EditorStoreContextValue['worldStore'],
    timelineStore: {} as EditorStoreContextValue['timelineStore'],
    plotStore: {} as EditorStoreContextValue['plotStore'],
    relationshipStore: {} as EditorStoreContextValue['relationshipStore'],
    aiStore: overrides?.aiStore ?? createMockAIStore(),
    themeStore: {} as EditorStoreContextValue['themeStore'],
    snapshotStore: {} as EditorStoreContextValue['snapshotStore'],
    consistencyEngine: {} as EditorStoreContextValue['consistencyEngine'],
    exportEngine: {} as EditorStoreContextValue['exportEngine'],
    aiEngine: (overrides?.aiEngine ?? createMockAIEngine()) as unknown as EditorStoreContextValue['aiEngine'],
    eventBus: {} as EditorStoreContextValue['eventBus'],
  };
}

const mockCtx = createMockEditorContext();

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <EditorStoreProvider {...mockCtx}>{children}</EditorStoreProvider>;
}

function defaultProps(overrides?: Partial<Parameters<typeof AIAssistantPanel>[0]>) {
  return {
    open: true,
    onClose: vi.fn(),
    chapterId: 'ch-1',
    projectId: 'proj-1',
    aiStore: createMockAIStore(),
    aiEngine: createMockAIEngine(),
    onAccept: vi.fn(),
    onOpenSettings: vi.fn(),
    ...overrides,
  };
}

/** Helper: create a generate function that returns a controllable promise */
function createControllableGenerate() {
  let resolveGenerate!: (val: AIGenerateResult) => void;
  const generateFn = vi.fn().mockImplementation(() => {
    return new Promise<AIGenerateResult>((resolve) => {
      resolveGenerate = resolve;
    });
  });
  return { generateFn, resolve: (val: AIGenerateResult) => resolveGenerate(val) };
}

const skillLabels = BUILT_IN_SKILLS.map((sk) => `${sk.icon} ${sk.name}`);


// ============================================================
// Property 5: 任意完成类型后按钮恢复
// Feature: ai-concurrency-safety, Property 5: 任意完成类型后按钮恢复
// **Validates: Requirements 2.3, 2.4**
// ============================================================

describe('Property 5: 任意完成类型后按钮恢复', () => {
  it('after any completion type, isGenerating becomes false and buttons are re-enabled', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<AIGenerateResult>(
          { success: true, content: 'generated content' },
          { success: false, error: 'some error' },
          { success: false, cancelled: true },
        ),
        async (completionResult) => {
          const { generateFn, resolve } = createControllableGenerate();
          const engine = createMockAIEngine(generateFn);
          const store = createMockAIStore();
          const props = defaultProps({ aiEngine: engine, aiStore: store });
          const ctx = createMockEditorContext({ aiEngine: engine, aiStore: store });

          const container = document.createElement('div');
          document.body.appendChild(container);

          try {
            const { unmount } = render(
              <EditorStoreProvider {...ctx}>
                <AIAssistantPanel {...props} />
              </EditorStoreProvider>,
              { container },
            );

            const textarea = container.querySelector('textarea')!;
            await act(async () => {
              fireEvent.change(textarea, { target: { value: '测试输入' } });
            });

            const generateBtn = Array.from(container.querySelectorAll('button')).find(
              (b) => b.textContent === '生成',
            )!;
            await act(async () => {
              fireEvent.click(generateBtn);
            });

            // During generation: cancel button should be visible, skill buttons disabled
            const cancelBtn = Array.from(container.querySelectorAll('button')).find(
              (b) => b.textContent === '取消',
            );
            expect(cancelBtn).toBeTruthy();

            const skillButtonsDuring = Array.from(container.querySelectorAll('button')).filter(
              (btn) => skillLabels.includes(btn.textContent ?? ''),
            );
            for (const btn of skillButtonsDuring) {
              expect(btn).toBeDisabled();
            }

            await act(async () => {
              resolve(completionResult);
            });

            await waitFor(() => {
              const genBtn = Array.from(container.querySelectorAll('button')).find(
                (b) => b.textContent === '生成',
              );
              expect(genBtn).toBeTruthy();
            });

            const skillButtonsAfter = Array.from(container.querySelectorAll('button')).filter(
              (btn) => skillLabels.includes(btn.textContent ?? ''),
            );
            for (const btn of skillButtonsAfter) {
              expect(btn).not.toBeDisabled();
            }

            unmount();
          } finally {
            document.body.removeChild(container);
          }
        },
      ),
      { numRuns: 100 },
    );
  }, 60000);
});



// ============================================================
// Property 6: 取消时保留已接收的部分内容
// Feature: ai-concurrency-safety, Property 6: 取消时保留已接收的部分内容
// **Validates: Requirements 4.4**
// ============================================================

describe('Property 6: 取消时保留已接收的部分内容', () => {
  it('partial content from K chunks is preserved and displayed after cancel', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 10, unit: fc.constantFrom('a', 'b', 'c', '1', '2', '你', '好') }), { minLength: 1, maxLength: 5 }),
        async (chunks) => {
          const mockGenerate = vi.fn().mockImplementation(
            (_req: unknown, onChunk?: (chunk: string) => void) => {
              if (onChunk) {
                for (const chunk of chunks) {
                  onChunk(chunk);
                }
              }
              return Promise.resolve({ success: false, cancelled: true });
            },
          );
          const engine = createMockAIEngine(mockGenerate);
          const store = createMockAIStore();
          const props = defaultProps({ aiEngine: engine, aiStore: store });
          const ctx = createMockEditorContext({ aiEngine: engine, aiStore: store });

          const container = document.createElement('div');
          document.body.appendChild(container);

          try {
            const { unmount } = render(
              <EditorStoreProvider {...ctx}>
                <AIAssistantPanel {...props} />
              </EditorStoreProvider>,
              { container },
            );

            const textarea = container.querySelector('textarea')!;
            await act(async () => {
              fireEvent.change(textarea, { target: { value: '测试输入' } });
            });

            const generateBtn = Array.from(container.querySelectorAll('button')).find(
              (b) => b.textContent === '生成',
            )!;
            await act(async () => {
              fireEvent.click(generateBtn);
            });

            await waitFor(() => {
              const genBtn = Array.from(container.querySelectorAll('button')).find(
                (b) => b.textContent === '生成',
              );
              expect(genBtn).toBeTruthy();
            });

            const expectedContent = chunks.join('');
            expect(container.textContent).toContain(expectedContent);

            unmount();
          } finally {
            document.body.removeChild(container);
          }
        },
      ),
      { numRuns: 100 },
    );
  }, 60000);
});



// ============================================================
// Task 4.5: UI 单元测试
// ============================================================

describe('AIAssistantPanel UI 单元测试', () => {
  // 需求 4.1: 生成中状态下显示取消按钮
  it('shows cancel button during generation', async () => {
    const { generateFn, resolve } = createControllableGenerate();
    const engine = createMockAIEngine(generateFn);
    const props = defaultProps({ aiEngine: engine });

    render(<AIAssistantPanel {...props} />, { wrapper: TestWrapper });

    const textarea = screen.getByPlaceholderText('输入你的想法、草稿或写作指令...');
    await act(async () => {
      fireEvent.change(textarea, { target: { value: '测试' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '生成' }));
    });

    expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '生成' })).not.toBeInTheDocument();

    await act(async () => { resolve({ success: true, content: 'done' }); });
  });

  // 需求 4.2: 点击取消按钮调用 engine.abort()
  it('clicking cancel button calls engine.abort()', async () => {
    const { generateFn, resolve } = createControllableGenerate();
    const engine = createMockAIEngine(generateFn);
    const props = defaultProps({ aiEngine: engine });

    render(<AIAssistantPanel {...props} />, { wrapper: TestWrapper });

    const textarea = screen.getByPlaceholderText('输入你的想法、草稿或写作指令...');
    await act(async () => {
      fireEvent.change(textarea, { target: { value: '测试' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '生成' }));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '取消' }));
    });

    expect(engine.abort).toHaveBeenCalled();

    await act(async () => { resolve({ success: false, cancelled: true }); });
  });

  // 需求 4.5: 取消后无内容时显示"已取消生成"
  it('shows "已取消生成" when cancel with no content', async () => {
    const { generateFn, resolve } = createControllableGenerate();
    const engine = createMockAIEngine(generateFn);
    const props = defaultProps({ aiEngine: engine });

    render(<AIAssistantPanel {...props} />, { wrapper: TestWrapper });

    const textarea = screen.getByPlaceholderText('输入你的想法、草稿或写作指令...');
    await act(async () => {
      fireEvent.change(textarea, { target: { value: '测试' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '生成' }));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '取消' }));
    });

    expect(screen.getByText('已取消生成')).toBeInTheDocument();

    await act(async () => { resolve({ success: false, cancelled: true }); });
  });

  // 需求 1.5: 面板关闭时取消活跃请求
  it('panel close cancels active request', async () => {
    const { generateFn, resolve } = createControllableGenerate();
    const engine = createMockAIEngine(generateFn);
    const onClose = vi.fn();
    const props = defaultProps({ aiEngine: engine, onClose });

    render(<AIAssistantPanel {...props} />, { wrapper: TestWrapper });

    const textarea = screen.getByPlaceholderText('输入你的想法、草稿或写作指令...');
    await act(async () => {
      fireEvent.change(textarea, { target: { value: '测试' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '生成' }));
    });

    const closeBtn = screen.getByRole('button', { name: '×' });
    await act(async () => {
      fireEvent.click(closeBtn);
    });

    expect(engine.abort).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();

    await act(async () => { resolve({ success: false, cancelled: true }); });
  });

  // 需求 3.4: 新请求发起时清空结果区域
  it('new request clears result area', async () => {
    const { generateFn, resolve } = createControllableGenerate();
    const engine = createMockAIEngine(generateFn);
    const props = defaultProps({ aiEngine: engine });

    render(<AIAssistantPanel {...props} />, { wrapper: TestWrapper });

    const textarea = screen.getByPlaceholderText('输入你的想法、草稿或写作指令...');

    await act(async () => {
      fireEvent.change(textarea, { target: { value: '第一次请求' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '生成' }));
    });
    await act(async () => {
      resolve({ success: true, content: '第一次结果' });
    });

    await waitFor(() => {
      expect(screen.getByText('第一次结果')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.change(textarea, { target: { value: '第二次请求' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '生成' }));
    });

    expect(screen.queryByText('第一次结果')).not.toBeInTheDocument();

    await act(async () => {
      resolve({ success: true, content: '第二次结果' });
    });
  });

  // 需求 2.2: 生成中状态下写作技能按钮禁用
  it('skill buttons are disabled during generation', async () => {
    const { generateFn, resolve } = createControllableGenerate();
    const engine = createMockAIEngine(generateFn);
    const props = defaultProps({ aiEngine: engine });

    render(<AIAssistantPanel {...props} />, { wrapper: TestWrapper });

    const textarea = screen.getByPlaceholderText('输入你的想法、草稿或写作指令...');
    await act(async () => {
      fireEvent.change(textarea, { target: { value: '测试' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '生成' }));
    });

    const skillButtons = screen.getAllByRole('button').filter(
      (btn) => skillLabels.includes(btn.textContent ?? ''),
    );

    expect(skillButtons.length).toBeGreaterThanOrEqual(1);
    for (const btn of skillButtons) {
      expect(btn).toBeDisabled();
    }

    await act(async () => { resolve({ success: true, content: 'done' }); });
  });
});

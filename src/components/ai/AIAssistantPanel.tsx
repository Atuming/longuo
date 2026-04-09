import { useState, useRef, useEffect, type CSSProperties } from 'react';
import type { AIAssistantStore } from '../../types/stores';
import type { AIAssistantEngine } from '../../types/engines';
import { Button } from '../ui/Button';
import { TextArea } from '../ui/TextArea';

const s: Record<string, CSSProperties> = {
  overlay: {
    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)',
    display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end',
    zIndex: 500,
  },
  panel: {
    width: '50%', minWidth: 480, maxWidth: 720, background: 'white',
    boxShadow: '-4px 0 20px rgba(0,0,0,0.15)', display: 'flex',
    flexDirection: 'column', height: '100%',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', borderBottom: '1px solid var(--color-border)',
  },
  title: { fontSize: 16, fontWeight: 600, color: 'var(--color-text)' },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 18, cursor: 'pointer',
    color: 'var(--color-text-secondary)', padding: 4,
  },
  body: { padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto', flex: 1 },
  inputArea: { minHeight: 60 },
  submitRow: { display: 'flex', justifyContent: 'flex-end' },
  resultArea: {
    background: 'white', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius)', padding: 12, maxHeight: 'none',
    overflowY: 'auto', fontSize: 14, lineHeight: '1.6',
    color: 'var(--color-text)', whiteSpace: 'pre-wrap', flex: 1, minHeight: 200,
  },
  actions: { display: 'flex', gap: 8 },
  footer: {
    padding: '8px 16px', borderTop: '1px solid var(--color-border)',
    fontSize: 12, color: 'var(--color-text-secondary)',
  },
  error: {
    background: '#FFF5F5', border: '1px solid #FEB2B2', borderRadius: 'var(--radius)',
    padding: '8px 12px', fontSize: 13, color: '#E53E3E',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  unconfigured: {
    padding: 16, textAlign: 'center', fontSize: 13,
    color: 'var(--color-text-secondary)',
  },
  link: { color: 'var(--color-accent)', cursor: 'pointer', textDecoration: 'underline' },
  loading: {
    display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
    color: 'var(--color-text-secondary)', padding: 8,
  },
};

const WRITING_SKILLS = [
  {
    label: '✍️ 续写',
    prompt: '请根据当前章节的最后几段内容，保持一致的叙事视角、文风和节奏，自然地续写下去。' +
      '注意：1）延续当前的情节走向和情绪基调；2）如果有对话正在进行，继续对话并推进剧情；' +
      '3）保持与已出场角色的性格一致性；4）适当穿插环境描写和心理活动；5）约400-600字。',
  },
  {
    label: '💎 润色',
    prompt: '请对当前章节内容进行深度润色。要求：' +
      '1）优化句式结构，消除口语化和重复表达；2）增强五感描写（视觉、听觉、触觉、嗅觉、味觉）；' +
      '3）用更精准的动词和形容词替换平淡用词；4）调整段落节奏，长短句交替；' +
      '5）保持原有情节和人物性格不变，只提升文学表现力。请输出润色后的完整段落。',
  },
  {
    label: '💬 对话',
    prompt: '请根据当前场景和在场角色，生成一段高质量的角色对话。要求：' +
      '1）每个角色的语气、用词、说话习惯要符合其性格设定；2）对话要推动剧情发展或揭示角色关系；' +
      '3）穿插适当的动作描写、表情描写和心理活动（不要纯对话）；4）对话节奏有张有弛，避免一问一答的机械感；' +
      '5）如有冲突或悬念，通过对话自然展现。约300-500字。',
  },
  {
    label: '🏞️ 场景',
    prompt: '请根据当前章节的背景设定和世界观，写一段沉浸式的场景描写。要求：' +
      '1）综合运用视觉、听觉、嗅觉、触觉等多感官描写；2）场景氛围要与当前情节的情绪基调一致；' +
      '3）通过环境细节暗示时间、天气、季节等信息；4）将场景描写与角色的情绪或行动自然融合，避免静态罗列；' +
      '5）如涉及世界观特有元素（魔法、科技等），要体现设定特色。约200-400字。',
  },
  {
    label: '📝 扩写',
    prompt: '请将当前章节内容进行扩写，使其更加丰满立体。要求：' +
      '1）补充角色的内心独白和情感变化；2）增加环境氛围和感官细节；3）展开被一笔带过的动作和过程；' +
      '4）添加角色之间的微表情和肢体语言；5）如有伏笔或暗示，适当强化但不要太明显；' +
      '6）扩写后的内容应是原文的1.5-2倍长度，保持情节走向不变。',
  },
  {
    label: '🔄 改写',
    prompt: '请用不同的叙述方式改写当前章节内容。要求：' +
      '1）可以尝试切换叙事视角（如从第三人称改为第一人称，或从旁观者视角改为某角色视角）；' +
      '2）调整叙事节奏（如将平铺直叙改为倒叙或插叙）；3）保持核心情节和角色关系不变；' +
      '4）用全新的比喻和意象替换原有描写；5）改写后的文字应有明显不同的阅读体验。',
  },
  {
    label: '🎭 冲突',
    prompt: '请根据当前章节的角色关系和情节走向，设计并写出一段戏剧冲突。要求：' +
      '1）冲突要有合理的起因，符合角色动机和性格；2）通过对话、行动和心理描写层层升级紧张感；' +
      '3）冲突中要展现角色的不同立场和价值观；4）留下悬念或转折，不要在这一段内完全解决冲突；' +
      '5）约400-600字。',
  },
  {
    label: '💭 内心',
    prompt: '请为当前场景中的主要角色写一段深入的内心独白。要求：' +
      '1）展现角色此刻的真实想法和情感波动；2）通过内心活动揭示角色的动机、恐惧或欲望；' +
      '3）可以穿插回忆片段或联想；4）内心独白的语言风格要符合角色的教育背景和性格特点；' +
      '5）与外在表现形成对比或呼应，增加角色的层次感。约200-400字。',
  },
];

interface AIAssistantPanelProps {
  open: boolean;
  onClose: () => void;
  chapterId: string | null;
  aiStore: AIAssistantStore;
  aiEngine: AIAssistantEngine;
  onAccept?: (content: string) => void;
  onOpenSettings?: () => void;
}

export function AIAssistantPanel({
  open, onClose, chapterId, aiStore, aiEngine, onAccept, onOpenSettings,
}: AIAssistantPanelProps) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea when input changes (e.g. from skill button)
  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 600) + 'px';
    }
  }, [input]);

  useEffect(() => {
    if (open) {
      setResult('');
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const provider = aiStore.getActiveProvider();
  const modelName = provider?.modelName ?? '未配置';
  const isConfigured = !!provider;

  const handleGenerate = async () => {
    if (!chapterId) {
      setError('请先在左侧大纲中选择一个章节');
      return;
    }
    if (!input.trim()) {
      setError('请输入写作指令或选择一个写作技能');
      return;
    }
    setIsGenerating(true);
    setError(null);
    setResult('');
    resultRef.current = '';

    try {
      const res = await aiEngine.generate(
        { userInput: input, chapterId },
        (chunk: string) => {
          resultRef.current += chunk;
          setResult(resultRef.current);
        },
      );
      if (!res.success) {
        setError(res.error ?? '生成失败');
        // Keep partial content if any
        if (resultRef.current) {
          setResult(resultRef.current);
        }
      } else if (res.content && !resultRef.current) {
        setResult(res.content);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAccept = () => {
    if (result) {
      onAccept?.(result);
      onClose();
    }
  };

  const handleModify = () => {
    setInput(result);
    setResult('');
    setError(null);
  };

  const handleRetry = () => {
    handleGenerate();
  };

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.panel} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <span style={s.title}>AI 辅助写作</span>
          <button style={s.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={s.body}>
          {!isConfigured ? (
            <div style={s.unconfigured}>
              AI 模型未配置。
              <span style={s.link} onClick={onOpenSettings}>前往设置</span>
              配置 AI 模型提供商后即可使用。
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {WRITING_SKILLS.map((skill) => (
                  <button
                    key={skill.label}
                    style={{
                      height: 30, padding: '0 10px', fontSize: 12, borderRadius: 'var(--radius)',
                      border: '1px solid var(--color-border)', background: '#fff',
                      cursor: isGenerating ? 'not-allowed' : 'pointer',
                      color: 'var(--color-text)', transition: 'all 0.15s',
                      opacity: isGenerating ? 0.5 : 1,
                    }}
                    disabled={isGenerating}
                    onClick={() => { setInput(skill.prompt); }}
                  >
                    {skill.label}
                  </button>
                ))}
              </div>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.currentTarget.value)}
                placeholder="输入你的想法、草稿或写作指令..."
                style={{
                  ...s.inputArea, overflow: 'auto', resize: 'none',
                  borderRadius: 'var(--radius)', border: '1px solid var(--color-border)',
                  padding: '8px 12px', fontSize: 14, width: '100%', fontFamily: 'var(--font-family)',
                  outline: 'none', boxSizing: 'border-box',
                }}
                disabled={isGenerating}
              />
              <div style={s.submitRow}>
                <Button
                  variant="primary"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  style={{ height: 32, fontSize: 13 }}
                >
                  {isGenerating ? '生成中...' : '生成'}
                </Button>
              </div>

              {error && (
                <div style={s.error}>
                  <span>{error}</span>
                  <Button variant="secondary" onClick={handleRetry}
                    style={{ height: 24, fontSize: 11, padding: '0 10px', marginLeft: 8 }}>
                    重试
                  </Button>
                </div>
              )}

              {isGenerating && !result && (
                <div style={s.loading}>
                  <span>⏳</span> AI 正在生成内容...
                </div>
              )}

              {result && (
                <>
                  <div style={s.resultArea}>{result}</div>
                  <div style={s.actions}>
                    <Button variant="primary" onClick={handleAccept}
                      style={{ height: 32, fontSize: 13 }} disabled={isGenerating}>
                      接受
                    </Button>
                    <Button variant="secondary" onClick={handleModify}
                      style={{ height: 32, fontSize: 13 }} disabled={isGenerating}>
                      修改
                    </Button>
                    <Button variant="secondary" onClick={handleRetry}
                      style={{ height: 32, fontSize: 13 }} disabled={isGenerating}>
                      重新生成
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div style={s.footer}>
          当前模型：{modelName}
        </div>
      </div>
    </div>
  );
}

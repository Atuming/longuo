import { useState, useRef, useEffect, useCallback, useMemo, type CSSProperties } from 'react';
import type { AIAssistantStore } from '../../types/stores';
import type { AIAssistantEngine } from '../../types/engines';
import type { AIHistoryRecord, WritingSkill, ScoredSkill } from '../../types/ai';
import { useEditorStores } from '../../pages/editor/EditorStoreContext';
import { Button } from '../ui/Button';

const s: Record<string, CSSProperties> = {
  overlay: {
    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)',
    display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end',
    zIndex: 500,
  },
  panel: {
    width: '50%', minWidth: 480, maxWidth: 720, background: 'var(--color-card, white)',
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
    background: 'var(--color-card, white)', border: '1px solid var(--color-border)',
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
  // Skill recommendation dot
  skillBtnRecommended: {
    boxShadow: '0 0 0 2px var(--color-accent, #3182CE)',
  },
  // Param form styles
  paramForm: {
    display: 'flex', flexDirection: 'column', gap: 8,
    padding: '10px 12px', borderRadius: 'var(--radius)',
    border: '1px solid var(--color-border)', background: 'var(--color-bg, #fafafa)',
  },
  paramFormHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    fontSize: 13, fontWeight: 600, color: 'var(--color-text)',
  },
  paramField: {
    display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
  },
  paramLabel: {
    minWidth: 60, color: 'var(--color-text-secondary)', fontSize: 12,
  },
  paramInput: {
    flex: 1, height: 28, padding: '0 8px', fontSize: 13,
    borderRadius: 'var(--radius)', border: '1px solid var(--color-border)',
    background: 'var(--color-card, white)', color: 'var(--color-text)',
    outline: 'none', boxSizing: 'border-box' as const,
  },
  paramActions: {
    display: 'flex', gap: 6, justifyContent: 'flex-end',
  },
  // History section styles
  historySection: {
    borderTop: '1px solid var(--color-border)', marginTop: 4,
  },
  historyToggle: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 0', cursor: 'pointer', background: 'none', border: 'none',
    width: '100%', fontSize: 13, fontWeight: 600, color: 'var(--color-text)',
  },
  historyList: {
    display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 300,
    overflowY: 'auto',
  },
  historyItem: {
    display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 10px',
    borderRadius: 'var(--radius)', border: '1px solid var(--color-border)',
    cursor: 'pointer', fontSize: 12, transition: 'background 0.15s',
    background: 'var(--color-bg, #fafafa)',
  },
  historyItemHeader: {
    display: 'flex', alignItems: 'center', gap: 6,
  },
  historySkillBadge: {
    display: 'inline-block', padding: '1px 6px', borderRadius: 10,
    fontSize: 11, background: 'var(--color-accent, #3182CE)', color: '#fff',
    whiteSpace: 'nowrap',
  },
  historyTime: {
    fontSize: 11, color: 'var(--color-text-secondary)',
  },
  historySummary: {
    fontSize: 12, color: 'var(--color-text)', overflow: 'hidden',
    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  historyExpanded: {
    background: 'var(--color-card, white)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius)', padding: 10, fontSize: 13,
    lineHeight: '1.6', whiteSpace: 'pre-wrap', color: 'var(--color-text)',
    maxHeight: 200, overflowY: 'auto',
  },
  historyActions: {
    display: 'flex', gap: 6, marginTop: 4,
  },
  historyEmpty: {
    fontSize: 12, color: 'var(--color-text-secondary)', textAlign: 'center',
    padding: '8px 0',
  },
};

/** Format ISO timestamp to a readable string */
function formatTime(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return isoStr;
  }
}

/** Build score map from ScoredSkill array */
function buildScoreMap(scored: ScoredSkill[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of scored) {
    map.set(s.skill.id, s.score);
  }
  return map;
}

/** Render a param form control for a single skill parameter */
function ParamControl({
  param,
  value,
  onChange,
  characters,
}: {
  param: WritingSkill['parameters'][number];
  value: string;
  onChange: (v: string) => void;
  characters: { id: string; name: string }[];
}) {
  if (param.type === 'select' && param.source === 'characters') {
    return (
      <select
        style={s.paramInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{param.placeholder || '请选择...'}</option>
        {characters.map((c) => (
          <option key={c.id} value={c.name}>{c.name}</option>
        ))}
      </select>
    );
  }
  if (param.type === 'select' && param.options) {
    return (
      <select
        style={s.paramInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{param.placeholder || '请选择...'}</option>
        {param.options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }
  return (
    <input
      type={param.type === 'number' ? 'number' : 'text'}
      style={s.paramInput}
      value={value}
      placeholder={param.placeholder || ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

interface AIAssistantPanelProps {
  open: boolean;
  onClose: () => void;
  chapterId: string | null;
  projectId: string;
  aiStore: AIAssistantStore;
  aiEngine: AIAssistantEngine;
  onAccept?: (content: string) => void;
  onOpenSettings?: () => void;
}

export function AIAssistantPanel({
  open, onClose, chapterId, projectId, aiStore, aiEngine, onAccept, onOpenSettings,
}: AIAssistantPanelProps) {
  const { characterStore } = useEditorStores();

  const [input, setInput] = useState('');
  const [result, setResult] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSkillLabel, setSelectedSkillLabel] = useState<string>('自定义');
  const resultRef = useRef('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Skill state
  const [skills, setSkills] = useState<WritingSkill[]>([]);
  const [scoreMap, setScoreMap] = useState<Map<string, number>>(new Map());
  const [activeParamSkill, setActiveParamSkill] = useState<WritingSkill | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});

  // History state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<AIHistoryRecord[]>([]);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

  // Characters for parameter source
  const characters = useMemo(() => {
    if (!projectId) return [];
    return characterStore.listCharacters(projectId).map((c) => ({ id: c.id, name: c.name }));
  }, [characterStore, projectId, open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load skills and compute recommendations
  const refreshSkills = useCallback(() => {
    const loaded = aiStore.listSkills();
    setSkills(loaded);
    if (chapterId) {
      const scored = aiEngine.recommendSkills(chapterId, loaded);
      setScoreMap(buildScoreMap(scored));
    }
  }, [aiStore, aiEngine, chapterId]);

  // Auto-resize textarea when input changes (e.g. from skill button)
  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 600) + 'px';
    }
  }, [input]);

  // Refresh history when panel opens or history section is toggled open
  const refreshHistory = useCallback(() => {
    if (projectId) {
      setHistoryRecords(aiStore.listHistory(projectId));
    }
  }, [aiStore, projectId]);

  useEffect(() => {
    if (open) {
      setResult('');
      setError(null);
      setExpandedRecordId(null);
      setActiveParamSkill(null);
      setParamValues({});
      refreshHistory();
      refreshSkills();
    }
  }, [open, refreshHistory, refreshSkills]);

  useEffect(() => {
    if (historyOpen) {
      refreshHistory();
    }
  }, [historyOpen, refreshHistory]);

  // Re-compute recommendations when chapter changes
  useEffect(() => {
    if (open && chapterId && skills.length > 0) {
      const scored = aiEngine.recommendSkills(chapterId, skills);
      setScoreMap(buildScoreMap(scored));
    }
  }, [open, chapterId, skills, aiEngine]);

  if (!open) return null;

  const provider = aiStore.getActiveProvider();
  const modelName = provider?.modelName ?? '未配置';
  const isConfigured = !!provider;

  const handleSkillClick = (skill: WritingSkill) => {
    if (skill.parameters.length > 0) {
      // Show param form
      setActiveParamSkill(skill);
      const defaults: Record<string, string> = {};
      for (const p of skill.parameters) {
        defaults[p.key] = p.defaultValue ?? '';
      }
      setParamValues(defaults);
    } else {
      // No params — fill textarea directly
      setInput(skill.promptTemplate);
      setSelectedSkillLabel(`${skill.icon} ${skill.name}`);
      setActiveParamSkill(null);
    }
  };

  const handleParamConfirm = () => {
    if (!activeParamSkill) return;
    const resolved = aiEngine.resolveSkillPrompt(activeParamSkill, paramValues);
    setInput(resolved);
    setSelectedSkillLabel(`${activeParamSkill.icon} ${activeParamSkill.name}`);
    setActiveParamSkill(null);
    setParamValues({});
  };

  const handleParamCancel = () => {
    setActiveParamSkill(null);
    setParamValues({});
  };

  const handleGenerate = async (overrideInput?: string, overrideSkillLabel?: string) => {
    const effectiveInput = overrideInput ?? input;
    const effectiveSkillLabel = overrideSkillLabel ?? selectedSkillLabel;

    if (!chapterId) {
      setError('请先在左侧大纲中选择一个章节');
      return;
    }
    if (!effectiveInput.trim()) {
      setError('请输入写作指令或选择一个写作技能');
      return;
    }
    setIsGenerating(true);
    setError(null);
    setResult('');
    resultRef.current = '';

    try {
      const res = await aiEngine.generate(
        { userInput: effectiveInput, chapterId },
        (chunk: string) => {
          resultRef.current += chunk;
          setResult(resultRef.current);
        },
      );
      if (res.cancelled) {
        return;
      }
      if (!res.success) {
        setError(res.error ?? '生成失败');
        if (resultRef.current) {
          setResult(resultRef.current);
        }
      } else {
        const finalContent = resultRef.current || res.content || '';
        if (res.content && !resultRef.current) {
          setResult(res.content);
        }
        // Save history record on successful generation
        if (finalContent && projectId) {
          aiStore.addHistoryRecord(projectId, {
            projectId,
            skillLabel: effectiveSkillLabel,
            userInput: effectiveInput,
            generatedContent: finalContent,
          });
          refreshHistory();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    if (isGenerating) {
      aiEngine.abort();
    }
    onClose();
  };

  const handleCancel = () => {
    aiEngine.abort();
    setIsGenerating(false);
    if (!resultRef.current) {
      setError('已取消生成');
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

  const handleHistoryInsert = (content: string) => {
    onAccept?.(content);
  };

  const handleHistoryRegenerate = (record: AIHistoryRecord) => {
    setInput(record.userInput);
    setSelectedSkillLabel(record.skillLabel);
    handleGenerate(record.userInput, record.skillLabel);
  };

  const enabledSkills = skills.filter((sk) => sk.enabled);

  return (
    <div style={s.overlay} onClick={handleClose}>
      <div style={s.panel} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <span style={s.title}>AI 辅助写作</span>
          <button style={s.closeBtn} onClick={handleClose}>×</button>
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
              {/* Skill buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {enabledSkills.map((skill) => {
                  const score = scoreMap.get(skill.id) ?? 0.5;
                  const isRecommended = score > 0.7;
                  return (
                    <button
                      key={skill.id}
                      title={skill.description}
                      style={{
                        height: 30, padding: '0 10px', fontSize: 12, borderRadius: 'var(--radius)',
                        border: '1px solid var(--color-border)', background: 'var(--color-card, #fff)',
                        cursor: isGenerating ? 'not-allowed' : 'pointer',
                        color: 'var(--color-text)', transition: 'all 0.15s',
                        opacity: isGenerating ? 0.5 : 1,
                        ...(isRecommended ? s.skillBtnRecommended : {}),
                      }}
                      disabled={isGenerating}
                      onClick={() => handleSkillClick(skill)}
                    >
                      {skill.icon} {skill.name}
                    </button>
                  );
                })}
              </div>

              {/* Parameter form */}
              {activeParamSkill && (
                <div style={s.paramForm}>
                  <div style={s.paramFormHeader}>
                    <span>{activeParamSkill.icon} {activeParamSkill.name} - 参数设置</span>
                    <button
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--color-text-secondary)' }}
                      onClick={handleParamCancel}
                    >×</button>
                  </div>
                  {activeParamSkill.parameters.map((param) => (
                    <div key={param.key} style={s.paramField}>
                      <span style={s.paramLabel}>
                        {param.label}
                        {param.required && <span style={{ color: '#E53E3E' }}>*</span>}
                      </span>
                      <ParamControl
                        param={param}
                        value={paramValues[param.key] ?? ''}
                        onChange={(v) => setParamValues((prev) => ({ ...prev, [param.key]: v }))}
                        characters={characters}
                      />
                    </div>
                  ))}
                  <div style={s.paramActions}>
                    <Button variant="secondary" onClick={handleParamCancel}
                      style={{ height: 28, fontSize: 12 }}>
                      取消
                    </Button>
                    <Button variant="primary" onClick={handleParamConfirm}
                      style={{ height: 28, fontSize: 12 }}>
                      确认参数
                    </Button>
                  </div>
                </div>
              )}

              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => { setInput(e.currentTarget.value); setSelectedSkillLabel('自定义'); }}
                placeholder="输入你的想法、草稿或写作指令..."
                style={{
                  ...s.inputArea, overflow: 'auto', resize: 'none',
                  borderRadius: 'var(--radius)', border: '1px solid var(--color-border)',
                  padding: '8px 12px', fontSize: 14, width: '100%', fontFamily: 'var(--font-family)',
                  outline: 'none', boxSizing: 'border-box',
                  background: 'var(--color-card, white)', color: 'var(--color-text)',
                }}
                disabled={isGenerating}
              />
              <div style={s.submitRow}>
                {isGenerating ? (
                  <Button
                    variant="secondary"
                    onClick={handleCancel}
                    style={{ height: 32, fontSize: 13 }}
                  >
                    取消
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    onClick={() => handleGenerate()}
                    style={{ height: 32, fontSize: 13 }}
                  >
                    生成
                  </Button>
                )}
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

              {/* History section */}
              <div style={s.historySection}>
                <button
                  style={s.historyToggle}
                  onClick={() => setHistoryOpen((v) => !v)}
                >
                  <span>📋 历史记录 ({historyRecords.length})</span>
                  <span style={{ fontSize: 11 }}>{historyOpen ? '▲ 收起' : '▼ 展开'}</span>
                </button>
                {historyOpen && (
                  <div style={s.historyList as CSSProperties}>
                    {historyRecords.length === 0 ? (
                      <div style={s.historyEmpty as CSSProperties}>暂无历史记录</div>
                    ) : (
                      historyRecords.map((record) => {
                        const isExpanded = expandedRecordId === record.id;
                        return (
                          <div
                            key={record.id}
                            style={s.historyItem}
                            onClick={() => setExpandedRecordId(isExpanded ? null : record.id)}
                          >
                            <div style={s.historyItemHeader}>
                              <span style={s.historySkillBadge}>{record.skillLabel}</span>
                              <span style={s.historyTime}>{formatTime(record.timestamp)}</span>
                            </div>
                            {!isExpanded && (
                              <div style={s.historySummary}>
                                {record.generatedContent.slice(0, 50)}{record.generatedContent.length > 50 ? '...' : ''}
                              </div>
                            )}
                            {isExpanded && (
                              <>
                                <div style={s.historyExpanded}>{record.generatedContent}</div>
                                <div style={s.historyActions} onClick={(e) => e.stopPropagation()}>
                                  <Button variant="primary" onClick={() => handleHistoryInsert(record.generatedContent)}
                                    style={{ height: 26, fontSize: 11, padding: '0 10px' }}>
                                    插入到编辑器
                                  </Button>
                                  <Button variant="secondary" onClick={() => handleHistoryRegenerate(record)}
                                    style={{ height: 26, fontSize: 11, padding: '0 10px' }}
                                    disabled={isGenerating}>
                                    重新生成
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
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

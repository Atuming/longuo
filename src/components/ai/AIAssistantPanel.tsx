import { useState, useRef, useEffect, useCallback, useMemo, type CSSProperties } from 'react';
import type { AIAssistantStore } from '../../types/stores';
import type { AIAssistantEngine } from '../../types/engines';
import type { AIHistoryRecord, WritingSkill, ScoredSkill, ConversationMessage, TokenUsage } from '../../types/ai';
import { useEditorStores } from '../../pages/editor/EditorStoreContext';
import { Button } from '../ui/Button';

const s: Record<string, CSSProperties> = {
  overlay: {
    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)',
    display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end', zIndex: 500,
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
  body: { padding: 16, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'auto', flex: 1 },
  inputArea: { minHeight: 60 },
  submitRow: { display: 'flex', justifyContent: 'flex-end', gap: 8 },
  footer: {
    padding: '8px 16px', borderTop: '1px solid var(--color-border)',
    fontSize: 12, color: 'var(--color-text-secondary)',
  },
  // Token bar
  tokenBar: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 11,
    color: 'var(--color-text-secondary)',
  },
  tokenFillBase: {
    height: 3, borderRadius: 2,
    transition: 'width 0.3s',
  } as CSSProperties,
  // Conversation
  chatArea: {
    display: 'flex', flexDirection: 'column', gap: 10, flex: 1,
    overflowY: 'auto', minHeight: 200, maxHeight: 400,
    padding: '4px 0',
  },
  userBubble: {
    alignSelf: 'flex-end', maxWidth: '80%', padding: '8px 12px',
    borderRadius: 12, borderBottomRightRadius: 4,
    background: 'var(--color-accent, #3182CE)', color: '#fff',
    fontSize: 13, lineHeight: '1.5', whiteSpace: 'pre-wrap',
  },
  assistantBubble: {
    alignSelf: 'flex-start', maxWidth: '85%', padding: '10px 14px',
    borderRadius: 12, borderBottomLeftRadius: 4,
    background: 'var(--color-bg, #f0f0f0)', color: 'var(--color-text)',
    fontSize: 13, lineHeight: '1.6', whiteSpace: 'pre-wrap',
  },
  bubbleActions: {
    display: 'flex', gap: 6, marginTop: 6,
  },
  error: {
    background: '#FFF5F5', border: '1px solid #FEB2B2', borderRadius: 'var(--radius)',
    padding: '8px 12px', fontSize: 13, color: '#E53E3E',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  unconfigured: {
    padding: 16, textAlign: 'center', fontSize: 13, color: 'var(--color-text-secondary)',
  },
  link: { color: 'var(--color-accent)', cursor: 'pointer', textDecoration: 'underline' },
  loading: {
    display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
    color: 'var(--color-text-secondary)', padding: 8,
  },
  skillBtnRecommended: { boxShadow: '0 0 0 2px var(--color-accent, #3182CE)' },
  // Param form
  paramForm: {
    display: 'flex', flexDirection: 'column', gap: 8,
    padding: '10px 12px', borderRadius: 'var(--radius)',
    border: '1px solid var(--color-border)', background: 'var(--color-bg, #fafafa)',
  },
  paramFormHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    fontSize: 13, fontWeight: 600, color: 'var(--color-text)',
  },
  paramField: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 },
  paramLabel: { minWidth: 60, color: 'var(--color-text-secondary)', fontSize: 12 },
  paramInput: {
    flex: 1, height: 28, padding: '0 8px', fontSize: 13,
    borderRadius: 'var(--radius)', border: '1px solid var(--color-border)',
    background: 'var(--color-card, white)', color: 'var(--color-text)',
    outline: 'none', boxSizing: 'border-box' as const,
  },
  paramActions: { display: 'flex', gap: 6, justifyContent: 'flex-end' },
  // History
  historySection: { borderTop: '1px solid var(--color-border)', marginTop: 4 },
  historyToggle: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 0', cursor: 'pointer', background: 'none', border: 'none',
    width: '100%', fontSize: 13, fontWeight: 600, color: 'var(--color-text)',
  },
  historyList: {
    display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 250, overflowY: 'auto',
  },
  historyItem: {
    display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 10px',
    borderRadius: 'var(--radius)', border: '1px solid var(--color-border)',
    cursor: 'pointer', fontSize: 12, transition: 'background 0.15s',
    background: 'var(--color-bg, #fafafa)',
  },
  historyItemHeader: { display: 'flex', alignItems: 'center', gap: 6 },
  historySkillBadge: {
    display: 'inline-block', padding: '1px 6px', borderRadius: 10,
    fontSize: 11, background: 'var(--color-accent, #3182CE)', color: '#fff', whiteSpace: 'nowrap',
  },
  historyTime: { fontSize: 11, color: 'var(--color-text-secondary)' },
  historySummary: {
    fontSize: 12, color: 'var(--color-text)', overflow: 'hidden',
    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  historyExpanded: {
    background: 'var(--color-card, white)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius)', padding: 10, fontSize: 13,
    lineHeight: '1.6', whiteSpace: 'pre-wrap', color: 'var(--color-text)',
    maxHeight: 180, overflowY: 'auto',
  },
  historyActions: { display: 'flex', gap: 6, marginTop: 4 },
  historyEmpty: {
    fontSize: 12, color: 'var(--color-text-secondary)', textAlign: 'center', padding: '8px 0',
  },
  // History search bar
  historySearchRow: {
    display: 'flex', gap: 6, alignItems: 'center', paddingBottom: 6,
  },
  historySearchInput: {
    flex: 1, height: 26, padding: '0 8px', fontSize: 12,
    borderRadius: 'var(--radius)', border: '1px solid var(--color-border)',
    background: 'var(--color-card, white)', color: 'var(--color-text)', outline: 'none',
    boxSizing: 'border-box' as const,
  },
  // Pipeline
  pipelineBar: {
    display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap',
    padding: '4px 8px', borderRadius: 'var(--radius)',
    border: '1px dashed var(--color-border)', fontSize: 12,
    color: 'var(--color-text-secondary)',
  },
  pipelineChip: {
    display: 'inline-flex', alignItems: 'center', gap: 2,
    padding: '2px 8px', borderRadius: 10, fontSize: 11,
    background: 'var(--color-accent, #3182CE)', color: '#fff',
  },
  // Mode toggle
  modeToggle: {
    display: 'flex', gap: 1, borderRadius: 'var(--radius)',
    border: '1px solid var(--color-border)', overflow: 'hidden',
  } as CSSProperties,
  modeBtnBase: {
    padding: '4px 12px', fontSize: 12, cursor: 'pointer', border: 'none',
    transition: 'all 0.15s',
  } as CSSProperties,
};

function formatTime(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return isoStr; }
}

/** Dynamic token fill bar style */
function tokenFillStyle(ratio: number): CSSProperties {
  return {
    ...s.tokenFillBase,
    background: ratio > 0.9 ? '#FC8181' : ratio > 0.7 ? '#F6AD55' : '#68D391',
    width: `${Math.min(ratio * 100, 100)}%`,
  };
}

/** Dynamic mode button style */
function modeBtnStyle(active: boolean): CSSProperties {
  return {
    ...s.modeBtnBase,
    background: active ? 'var(--color-accent, #3182CE)' : 'var(--color-bg, #fafafa)',
    color: active ? '#fff' : 'var(--color-text)',
  };
}

function buildScoreMap(scored: ScoredSkill[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of scored) map.set(s.skill.id, s.score);
  return map;
}

function ParamControl({
  param, value, onChange, characters,
}: {
  param: WritingSkill['parameters'][number];
  value: string;
  onChange: (v: string) => void;
  characters: { id: string; name: string }[];
}) {
  if (param.type === 'select' && param.source === 'characters') {
    return (
      <select style={s.paramInput} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{param.placeholder || '请选择...'}</option>
        {characters.map((c) => (<option key={c.id} value={c.name}>{c.name}</option>))}
      </select>
    );
  }
  if (param.type === 'select' && param.options) {
    return (
      <select style={s.paramInput} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{param.placeholder || '请选择...'}</option>
        {param.options.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
      </select>
    );
  }
  return (
    <input
      type={param.type === 'number' ? 'number' : 'text'}
      style={s.paramInput} value={value}
      placeholder={param.placeholder || ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/* ── Conversation bubble component ── */
interface MessageBubble {
  role: 'user' | 'assistant';
  content: string;
  skillLabel?: string;
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
  getSelectedText?: () => string;
  /** Callback when AI consistency check completes (to switch to consistency panel) */
  onConsistencyReport?: (report: import('../../types/ai').ConsistencyReport) => void;
  /** Pre-fill payload from selection toolbar quick action */
  quickPayload?: { skillId: string; text: string } | null;
  /** Called after quick payload is consumed */
  onQuickPayloadConsumed?: () => void;
}

export function AIAssistantPanel({
  open, onClose, chapterId, projectId, aiStore, aiEngine, onAccept, onOpenSettings, getSelectedText, onConsistencyReport, quickPayload, onQuickPayloadConsumed,
}: AIAssistantPanelProps) {
  const { characterStore } = useEditorStores();

  // ── Core state ──
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSkillLabel, setSelectedSkillLabel] = useState<string>('自定义');
  const resultRef = useRef('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Multi-turn conversation ──
  const [conversationMode, setConversationMode] = useState(false);
  const [messages, setMessages] = useState<MessageBubble[]>([]);
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);

  // ── Skill state ──
  const [skills, setSkills] = useState<WritingSkill[]>([]);
  const [scoreMap, setScoreMap] = useState<Map<string, number>>(new Map());
  const [activeParamSkill, setActiveParamSkill] = useState<WritingSkill | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});

  // ── Pipeline state ──
  const [pipelineSkills, setPipelineSkills] = useState<WritingSkill[]>([]);
  const [pipelineMode, setPipelineMode] = useState(false);
  const [pipelineProgress, setPipelineProgress] = useState<{ current: number; total: number; skillName: string } | null>(null);

  // ── Token display ──
  const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null);

  // ── History state ──
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<AIHistoryRecord[]>([]);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  // ── Characters for parameter source ──
  const characters = useMemo(() => {
    if (!projectId) return [];
    return characterStore.listCharacters(projectId).map((c) => ({ id: c.id, name: c.name }));
  }, [characterStore, projectId]);

  // ── Refresh skills ──
  const refreshSkills = useCallback(() => {
    const loaded = aiStore.listSkills();
    setSkills(loaded);
    if (chapterId) {
      const scored = aiEngine.recommendSkills(chapterId, loaded);
      setScoreMap(buildScoreMap(scored));
    }
  }, [aiStore, aiEngine, chapterId]);

  // ── Auto-resize textarea ──
  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 600) + 'px';
    }
  }, [input]);

  // ── Refresh history ──
  const refreshHistory = useCallback(() => {
    if (!projectId) return;
    if (historySearchQuery.trim()) {
      setHistoryRecords(aiStore.searchHistory(projectId, historySearchQuery));
    } else {
      setHistoryRecords(aiStore.listHistory(projectId));
    }
  }, [aiStore, projectId, historySearchQuery]);

  // ── Derive provider info early (used by callbacks) ──
  const provider = aiStore.getActiveProvider();
  const modelName = provider?.modelName ?? '未配置';
  const isConfigured = !!provider;

  // ── Update token estimate ──
  const updateTokenEstimate = useCallback(() => {
    if (!chapterId || !isConfigured) return;
    const usage = aiEngine.estimateContextTokens(chapterId, input, getSelectedText?.());
    setTokenUsage(usage);
  }, [aiEngine, chapterId, input, getSelectedText, isConfigured]);

  useEffect(() => {
    if (open) {
      setResult('');
      setError(null);
      setExpandedRecordId(null);
      setActiveParamSkill(null);
      setParamValues({});
      setMessages([]);
      setConversationHistory([]);
      setPipelineSkills([]);
      setPipelineMode(false);
      setHistorySearchQuery('');
      refreshHistory();
      refreshSkills();
      updateTokenEstimate();
    }
  }, [open, refreshHistory, refreshSkills, updateTokenEstimate]);

  // Handle quick action payload from selection toolbar
  useEffect(() => {
    if (open && quickPayload) {
      const skill = aiStore.getSkill(quickPayload.skillId);
      if (skill) {
        const resolved = aiEngine.resolveSkillPrompt(skill, {});
        setInput(`${resolved}\n\n选中文本：\n${quickPayload.text}`);
        setSelectedSkillLabel(`${skill.icon} ${skill.name}`);
      } else {
        setInput(quickPayload.text);
      }
      onQuickPayloadConsumed?.();
    }
  }, [open, quickPayload, aiStore, aiEngine, onQuickPayloadConsumed]);

  useEffect(() => {
    if (historyOpen) refreshHistory();
  }, [historyOpen, refreshHistory]);

  // Re-compute recommendations when chapter changes
  useEffect(() => {
    if (open && chapterId && skills.length > 0) {
      const scored = aiEngine.recommendSkills(chapterId, skills);
      setScoreMap(buildScoreMap(scored));
    }
  }, [open, chapterId, skills, aiEngine]);

  // Debounced token estimate update
  useEffect(() => {
    if (!open || !chapterId) return;
    const timer = setTimeout(updateTokenEstimate, 500);
    return () => clearTimeout(timer);
  }, [input, chapterId, open, updateTokenEstimate]);

  if (!open) return null;

  /* ── Skill handlers ── */
  const handleSkillClick = (skill: WritingSkill) => {
    if (skill.id === 'builtin-consistency' && chapterId && onConsistencyReport) {
      // Consistency check — special flow
      setIsGenerating(true);
      setError(null);
      aiEngine.runConsistencyCheck(chapterId).then((report) => {
        setIsGenerating(false);
        onConsistencyReport(report);
        onClose();
      }).catch(() => {
        setIsGenerating(false);
        setError('一致性检查失败');
      });
      return;
    }

    if (skill.parameters.length > 0) {
      setActiveParamSkill(skill);
      const defaults: Record<string, string> = {};
      for (const p of skill.parameters) defaults[p.key] = p.defaultValue ?? '';
      setParamValues(defaults);
    } else {
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

  /* ── Pipeline handlers ── */
  const handleAddToPipeline = (skill: WritingSkill) => {
    setPipelineSkills((prev) => [...prev, skill]);
  };

  const handleRemoveFromPipeline = (idx: number) => {
    setPipelineSkills((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleRunPipeline = async () => {
    if (pipelineSkills.length === 0) {
      setError('请先添加技能到执行链');
      return;
    }
    if (!chapterId) {
      setError('请先选择章节');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setResult('');
    resultRef.current = '';
    setPipelineProgress({ current: 0, total: pipelineSkills.length, skillName: pipelineSkills[0].name });

    try {
      // Execute skills sequentially, showing progress
      let input = '';
      for (let i = 0; i < pipelineSkills.length; i++) {
        const skill = pipelineSkills[i];
        const isLast = i === pipelineSkills.length - 1;
        setPipelineProgress({ current: i + 1, total: pipelineSkills.length, skillName: skill.name });

        const resolved = aiEngine.resolveSkillPrompt(skill, {});
        const effectiveInput = i === 0 ? resolved : `${resolved}\n\n${input}`;

        const res = await aiEngine.generate(
          { userInput: effectiveInput, chapterId, selectedText: getSelectedText?.() ?? '' },
          isLast ? (chunk: string) => {
            resultRef.current += chunk;
            setResult(resultRef.current);
          } : undefined,
        );

        if (!res.success) {
          if (res.cancelled) return;
          setError(`第 ${i + 1} 步（${skill.name}）失败：${res.error}`);
          return;
        }

        input = res.content ?? input;
      }

      // Save final result
      if (input && projectId) {
        aiStore.addHistoryRecord(projectId, {
          projectId,
          skillLabel: `🔗 ${pipelineSkills.map((s) => s.name).join(' → ')}`,
          userInput: `技能链: ${pipelineSkills.map((s) => s.name).join(' → ')}`,
          generatedContent: input,
        });
        refreshHistory();
      }
      if (!pipelineSkills[pipelineSkills.length - 1]?.promptTemplate.includes('{param:')) {
        setResult(input);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setIsGenerating(false);
      setPipelineProgress(null);
    }
  };

  /* ── Generate ── */
  const handleGenerate = async (overrideInput?: string, overrideSkillLabel?: string) => {
    const effectiveInput = overrideInput ?? input;
    const effectiveSkillLabel = overrideSkillLabel ?? selectedSkillLabel;

    if (!chapterId) { setError('请先在左侧大纲中选择一个章节'); return; }
    if (!effectiveInput.trim()) { setError('请输入写作指令或选择一个写作技能'); return; }

    setIsGenerating(true);
    setError(null);
    setResult('');
    resultRef.current = '';

    // Multi-turn: build history
    const history: ConversationMessage[] = conversationMode ? [...conversationHistory] : [];

    try {
      const res = await aiEngine.generate(
        {
          userInput: effectiveInput,
          chapterId,
          selectedText: getSelectedText?.() ?? '',
          conversationHistory: history.length > 0 ? history : undefined,
        },
        (chunk: string) => {
          resultRef.current += chunk;
          setResult(resultRef.current);
        },
      );

      if (res.cancelled) return;

      if (!res.success) {
        setError(res.error ?? '生成失败');
        if (resultRef.current) setResult(resultRef.current);
      } else {
        const finalContent = resultRef.current || res.content || '';
        if (res.content && !resultRef.current) setResult(res.content);

        if (res.tokenUsage) setTokenUsage(res.tokenUsage);

        // Multi-turn: add to conversation
        if (conversationMode && finalContent) {
          const userMsg: MessageBubble = { role: 'user', content: effectiveInput, skillLabel: effectiveSkillLabel };
          const assistantMsg: MessageBubble = { role: 'assistant', content: finalContent };
          setMessages((prev) => [...prev, userMsg, assistantMsg]);
          setConversationHistory((prev) => [
            ...prev,
            { role: 'user', content: effectiveInput },
            { role: 'assistant', content: finalContent },
          ]);
          setInput('');
          setResult('');
          setSelectedSkillLabel('自定义');
        }

        // Save history
        if (finalContent && projectId) {
          aiStore.addHistoryRecord(projectId, {
            projectId,
            skillLabel: effectiveSkillLabel,
            userInput: effectiveInput,
            generatedContent: finalContent,
            conversationHistory: history.length > 0 ? history : undefined,
            tokenUsage: res.tokenUsage,
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
    if (isGenerating) aiEngine.abort();
    onClose();
  };

  const handleCancel = () => {
    aiEngine.abort();
    setIsGenerating(false);
    if (!resultRef.current) setError('已取消生成');
  };

  const handleAccept = (content?: string) => {
    const final = content ?? result;
    if (final) {
      onAccept?.(final);
    }
  };

  const handleModify = (content?: string) => {
    setInput(content ?? result);
    setResult('');
    setError(null);
  };

  const handleRetry = () => handleGenerate();

  const handleHistoryInsert = (content: string) => onAccept?.(content);

  const handleHistoryRegenerate = (record: AIHistoryRecord) => {
    setInput(record.userInput);
    setSelectedSkillLabel(record.skillLabel);
    handleGenerate(record.userInput, record.skillLabel);
  };

  const handleExportHistory = () => {
    const md = aiStore.exportHistoryMarkdown(projectId);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-history-${projectId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearConversation = () => {
    setMessages([]);
    setConversationHistory([]);
    setResult('');
    setInput('');
  };

  const enabledSkills = skills.filter((sk) => sk.enabled);

  return (
    <div style={s.overlay} onClick={handleClose}>
      <div style={s.panel} onClick={(e) => e.stopPropagation()}>
        {/* ── Header ── */}
        <div style={s.header}>
          <span style={s.title}>AI 辅助写作</span>
          <button style={s.closeBtn} onClick={handleClose}>×</button>
        </div>

        <div style={s.body}>
          {!isConfigured ? (
            <div style={s.unconfigured}>
              AI 模型未配置。<span style={s.link} onClick={onOpenSettings}>前往设置</span>配置后即可使用。
            </div>
          ) : (
            <>
              {/* ── Token bar ── */}
              {tokenUsage && (
                <div style={s.tokenBar}>
                  <span>📊 上下文：{tokenUsage.estimatedInputTokens?.toLocaleString() ?? '—'} / {tokenUsage.contextLimit?.toLocaleString() ?? '—'} tokens</span>
                  <div style={{ flex: 1, background: 'var(--color-border)', borderRadius: 2, height: 3 }}>
                    <div style={tokenFillStyle(tokenUsage.usageRatio ?? 0)} />
                  </div>
                  <span>{Math.round((tokenUsage.usageRatio ?? 0) * 100)}%</span>
                </div>
              )}

              {/* ── Mode toggle ── */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={s.modeToggle}>
                  <button style={modeBtnStyle(!conversationMode)} onClick={() => setConversationMode(false)}>单次</button>
                  <button style={modeBtnStyle(conversationMode)} onClick={() => setConversationMode(true)}>对话</button>
                </div>
                {conversationMode && messages.length > 0 && (
                  <button
                    style={{ ...modeBtnStyle(false), fontSize: 11, padding: '2px 8px' }}
                    onClick={handleClearConversation}
                  >
                    清空对话
                  </button>
                )}
              </div>

              {/* ── Skill buttons ── */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {enabledSkills.map((skill) => {
                  const score = scoreMap.get(skill.id) ?? 0.5;
                  const isRecommended = score > 0.7;
                  const isInPipeline = pipelineSkills.some((ps) => ps.id === skill.id);
                  return (
                    <div key={skill.id} style={{ display: 'flex', gap: 2 }}>
                      <button
                        title={skill.description}
                        style={{
                          height: 30, padding: '0 10px', fontSize: 12, borderRadius: 'var(--radius)',
                          border: isInPipeline ? '2px solid var(--color-accent, #3182CE)' : '1px solid var(--color-border)',
                          background: isInPipeline ? 'var(--color-accent-light, #EBF8FF)' : 'var(--color-card, #fff)',
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
                      {pipelineMode && (
                        <button
                          title={isInPipeline ? '从链中移除' : '添加到执行链'}
                          style={{
                            height: 30, width: 24, fontSize: 10, borderRadius: 'var(--radius)',
                            border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                            cursor: 'pointer', color: 'var(--color-text)',
                          }}
                          onClick={() => isInPipeline ? handleRemoveFromPipeline(pipelineSkills.findIndex((s) => s.id === skill.id)) : handleAddToPipeline(skill)}
                        >
                          {isInPipeline ? '✕' : '+'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ── Pipeline bar ── */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button
                  style={{ ...modeBtnStyle(pipelineMode), fontSize: 11, padding: '2px 10px' }}
                  onClick={() => { setPipelineMode((v) => !v); if (pipelineMode) setPipelineSkills([]); }}
                >
                  🔗 技能链 {pipelineMode ? '(开)' : '(关)'}
                </button>
                {pipelineMode && pipelineSkills.length > 0 && (
                  <div style={s.pipelineBar}>
                    {pipelineSkills.map((sk, idx) => (
                      <span key={idx} style={s.pipelineChip}>
                        {sk.icon} {sk.name}
                        <span style={{ cursor: 'pointer', marginLeft: 2 }} onClick={() => handleRemoveFromPipeline(idx)}>×</span>
                      </span>
                    ))}
                    <span>→</span>
                    <button
                      style={{ ...modeBtnStyle(true), fontSize: 11, padding: '2px 8px' }}
                      disabled={isGenerating}
                      onClick={handleRunPipeline}
                    >
                      执行
                    </button>
                  </div>
                )}
              </div>

              {/* ── Parameter form ── */}
              {activeParamSkill && (
                <div style={s.paramForm}>
                  <div style={s.paramFormHeader}>
                    <span>{activeParamSkill.icon} {activeParamSkill.name} - 参数</span>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--color-text-secondary)' }} onClick={handleParamCancel}>×</button>
                  </div>
                  {activeParamSkill.parameters.map((param) => (
                    <div key={param.key} style={s.paramField}>
                      <span style={s.paramLabel}>{param.label}{param.required && <span style={{ color: '#E53E3E' }}>*</span>}</span>
                      <ParamControl param={param} value={paramValues[param.key] ?? ''} onChange={(v) => setParamValues((prev) => ({ ...prev, [param.key]: v }))} characters={characters} />
                    </div>
                  ))}
                  <div style={s.paramActions}>
                    <Button variant="secondary" onClick={handleParamCancel} style={{ height: 28, fontSize: 12 }}>取消</Button>
                    <Button variant="primary" onClick={handleParamConfirm} style={{ height: 28, fontSize: 12 }}>确认参数</Button>
                  </div>
                </div>
              )}

              {/* ── Conversation area ── */}
              {conversationMode && messages.length > 0 && (
                <div style={s.chatArea}>
                  {messages.map((msg, idx) => (
                    <div key={idx}>
                      <div style={msg.role === 'user' ? s.userBubble : s.assistantBubble}>
                        {msg.skillLabel && msg.role === 'user' && (
                          <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 4 }}>{msg.skillLabel}</div>
                        )}
                        {msg.content}
                      </div>
                      {msg.role === 'assistant' && (
                        <div style={{ ...s.bubbleActions, marginLeft: 8 }}>
                          <Button variant="primary" onClick={() => handleAccept(msg.content)} style={{ height: 24, fontSize: 11, padding: '0 10px' }}>接受</Button>
                          <Button variant="secondary" onClick={() => handleModify(msg.content)} style={{ height: 24, fontSize: 11, padding: '0 10px' }}>修改</Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ── Textarea (hidden in conversation mode when messages exist) ── */}
              {(!conversationMode || messages.length === 0) && (
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => { setInput(e.currentTarget.value); setSelectedSkillLabel('自定义'); }}
                  placeholder={conversationMode ? '输入你的想法，与 AI 对话...' : '输入你的想法、草稿或写作指令...'}
                  style={{
                    ...s.inputArea, overflow: 'auto', resize: 'none',
                    borderRadius: 'var(--radius)', border: '1px solid var(--color-border)',
                    padding: '8px 12px', fontSize: 14, width: '100%', fontFamily: 'var(--font-family)',
                    outline: 'none', boxSizing: 'border-box',
                    background: 'var(--color-card, white)', color: 'var(--color-text)',
                  }}
                  disabled={isGenerating}
                />
              )}

              {/* ── Submit + Pipeline row ── */}
              <div style={s.submitRow}>
                {isGenerating ? (
                  <Button variant="secondary" onClick={handleCancel} style={{ height: 32, fontSize: 13 }}>取消</Button>
                ) : (
                  (!conversationMode || messages.length === 0) && (
                    <Button variant="primary" onClick={() => handleGenerate()} style={{ height: 32, fontSize: 13 }}>生成</Button>
                  )
                )}
              </div>

              {/* ── Error ── */}
              {error && (
                <div style={s.error}>
                  <span>{error}</span>
                  <Button variant="secondary" onClick={handleRetry} style={{ height: 24, fontSize: 11, padding: '0 10px', marginLeft: 8 }}>重试</Button>
                </div>
              )}

              {/* ── Loading ── */}
              {isGenerating && !result && !conversationMode && (
                <div style={s.loading}>
                  <span>⏳</span>
                  {pipelineProgress
                    ? `执行技能链: ${pipelineProgress.current}/${pipelineProgress.total} — ${pipelineProgress.skillName}`
                    : 'AI 正在生成内容...'}
                </div>
              )}

              {/* ── Result (non-conversation mode) ── */}
              {!conversationMode && result && (
                <>
                  <div style={{
                    background: 'var(--color-card, white)', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius)', padding: 12, overflowY: 'auto',
                    fontSize: 14, lineHeight: '1.6', color: 'var(--color-text)',
                    whiteSpace: 'pre-wrap', flex: 1, minHeight: 150,
                  }}>
                    {isGenerating && <span style={{ color: 'var(--color-accent)' }}>⏳ </span>}
                    {result}
                  </div>
                  {!isGenerating && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button variant="primary" onClick={() => handleAccept()} style={{ height: 32, fontSize: 13 }}>接受</Button>
                      <Button variant="secondary" onClick={() => handleModify()} style={{ height: 32, fontSize: 13 }}>修改</Button>
                      <Button variant="secondary" onClick={handleRetry} style={{ height: 32, fontSize: 13 }}>重新生成</Button>
                    </div>
                  )}
                </>
              )}

              {/* ── Conversation mode generating indicator ── */}
              {conversationMode && isGenerating && (
                <div style={s.loading}><span>⏳</span> AI 正在生成回复...</div>
              )}

              {/* ── Conversation mode input row ── */}
              {conversationMode && messages.length > 0 && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <textarea
                    value={input}
                    onChange={(e) => { setInput(e.currentTarget.value); setSelectedSkillLabel('自定义'); }}
                    placeholder="继续对话..."
                    style={{
                      flex: 1, minHeight: 36, maxHeight: 100, resize: 'none',
                      borderRadius: 'var(--radius)', border: '1px solid var(--color-border)',
                      padding: '6px 10px', fontSize: 13, fontFamily: 'var(--font-family)',
                      outline: 'none', background: 'var(--color-card, white)', color: 'var(--color-text)',
                      boxSizing: 'border-box',
                    }}
                    disabled={isGenerating}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleGenerate();
                      }
                    }}
                  />
                  <Button variant="primary" onClick={() => handleGenerate()} disabled={isGenerating}
                    style={{ height: 36, fontSize: 13 }}>发送</Button>
                </div>
              )}

              {/* ── History section (enhanced) ── */}
              <div style={s.historySection}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button style={s.historyToggle} onClick={() => setHistoryOpen((v) => !v)}>
                    <span>📋 历史记录 ({historyRecords.length})</span>
                    <span style={{ fontSize: 11 }}>{historyOpen ? '▲ 收起' : '▼ 展开'}</span>
                  </button>
                  {historyOpen && (
                    <button
                      style={{ ...modeBtnStyle(false), fontSize: 10, padding: '2px 6px' }}
                      onClick={handleExportHistory}
                      title="导出历史记录为 Markdown"
                    >
                      📥 导出
                    </button>
                  )}
                </div>
                {historyOpen && (
                  <>
                    {/* Search */}
                    <div style={s.historySearchRow}>
                      <input
                        style={s.historySearchInput}
                        placeholder="搜索历史记录..."
                        value={historySearchQuery}
                        onChange={(e) => setHistorySearchQuery(e.target.value)}
                      />
                      {historySearchQuery && (
                        <button
                          style={{ ...modeBtnStyle(false), fontSize: 10, padding: '2px 6px' }}
                          onClick={() => setHistorySearchQuery('')}
                        >
                          清除
                        </button>
                      )}
                    </div>
                    <div style={s.historyList as CSSProperties}>
                      {historyRecords.length === 0 ? (
                        <div style={s.historyEmpty as CSSProperties}>
                          {historySearchQuery ? '未找到匹配记录' : '暂无历史记录'}
                        </div>
                      ) : (
                        historyRecords.map((record) => {
                          const isExpanded = expandedRecordId === record.id;
                          return (
                            <div key={record.id} style={s.historyItem}
                              onClick={() => setExpandedRecordId(isExpanded ? null : record.id)}>
                              <div style={s.historyItemHeader}>
                                <span style={s.historySkillBadge}>{record.skillLabel}</span>
                                <span style={s.historyTime}>{formatTime(record.timestamp)}</span>
                                {record.tokenUsage && (
                                  <span style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>
                                    {record.tokenUsage.estimatedInputTokens} tokens
                                  </span>
                                )}
                              </div>
                              {!isExpanded && (
                                <div style={s.historySummary}>
                                  {record.generatedContent.slice(0, 60)}{record.generatedContent.length > 60 ? '...' : ''}
                                </div>
                              )}
                              {isExpanded && (
                                <>
                                  <div style={s.historyExpanded}>{record.generatedContent}</div>
                                  <div style={s.historyActions} onClick={(e) => e.stopPropagation()}>
                                    <Button variant="primary" onClick={() => handleHistoryInsert(record.generatedContent)}
                                      style={{ height: 26, fontSize: 11, padding: '0 10px' }}>插入</Button>
                                    <Button variant="secondary" onClick={() => handleHistoryRegenerate(record)}
                                      style={{ height: 26, fontSize: 11, padding: '0 10px' }} disabled={isGenerating}>重新生成</Button>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={s.footer}>
          当前模型：{modelName}
          {conversationMode && messages.length > 0 && ` · ${messages.length / 2} 轮对话`}
        </div>
      </div>
    </div>
  );
}

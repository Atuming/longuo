import { useState, useRef, type CSSProperties } from 'react';
import type { AIAssistantStore } from '../../types/stores';
import type { AIConfig, AIProvider, PromptTemplate, WritingSkill, SkillParameter, ContextHint } from '../../types/ai';
import {
  GENRE_OPTIONS,
  POV_OPTIONS,
  LANGUAGE_STYLE_OPTIONS,
  TONE_OPTIONS,
} from '../../types/ai';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Input } from '../ui/Input';
import { TextArea } from '../ui/TextArea';
import { Button } from '../ui/Button';
import { showToast } from '../ui/Toast';
import { parseSkillMarkdown, serializeSkillToZip, parseSkillZip } from '../../lib/skill-parser';

const s: Record<string, CSSProperties> = {
  tabs: { display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: 12 },
  tab: {
    padding: '8px 16px', fontSize: 13, cursor: 'pointer', border: 'none',
    background: 'none', color: 'var(--color-text-secondary)', borderBottom: '2px solid transparent',
  },
  tabActive: {
    color: 'var(--color-accent)', borderBottomColor: 'var(--color-accent)', fontWeight: 600,
  },
  splitLayout: { display: 'flex', gap: 12, minHeight: 300 },
  listCol: {
    width: 160, borderRight: '1px solid var(--color-border)', paddingRight: 12,
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  listItem: {
    padding: '6px 8px', borderRadius: 'var(--radius)', cursor: 'pointer',
    fontSize: 13, color: 'var(--color-text)', border: '1px solid transparent',
  },
  listItemActive: { background: '#EBF8FF', borderColor: 'var(--color-accent)', fontWeight: 500 },
  formCol: { flex: 1, display: 'flex', flexDirection: 'column', gap: 10 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' },
  select: {
    width: '100%', height: 36, borderRadius: 'var(--radius)',
    border: '1px solid var(--color-border)', fontSize: 14, padding: '0 8px',
  },
  btnRow: { display: 'flex', gap: 6, marginTop: 4 },
  hint: { fontSize: 11, color: 'var(--color-text-secondary)', fontStyle: 'italic' },
  activeLabel: { fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginTop: 8 },
  skillBadge: {
    fontSize: 10, background: 'var(--color-accent)', color: '#fff',
    borderRadius: 3, padding: '1px 4px', marginLeft: 4, fontWeight: 600,
  },
  subSection: {
    border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
    padding: 8, display: 'flex', flexDirection: 'column', gap: 6,
  },
  subRow: {
    display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap',
  },
  removeBtn: {
    background: 'none', border: 'none', color: 'var(--color-error)',
    cursor: 'pointer', fontSize: 14, padding: '0 4px', lineHeight: '1',
  },
};

const SIGNAL_LABELS: Record<string, string> = {
  wordCount: '字数',
  hasDialogue: '包含对话',
  isNearEnd: '接近结尾',
  hasCharacters: '有角色信息',
  hasWorldEntries: '有世界观设定',
};

const CONDITION_LABELS: Record<string, string> = {
  low: '低', high: '高', true: '是', false: '否',
};

interface AIConfigDialogProps {
  open: boolean;
  aiStore: AIAssistantStore;
  onClose: () => void;
}

export function AIConfigDialog({ open, aiStore, onClose }: AIConfigDialogProps) {
  const [activeTab, setActiveTab] = useState<'providers' | 'templates' | 'skills' | 'writingStyle'>('providers');
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  // Provider form
  const [pName, setPName] = useState('');
  const [pApiKey, setPApiKey] = useState('');
  const [pModel, setPModel] = useState('');
  const [pEndpoint, setPEndpoint] = useState('');
  const [pTimeout, setPTimeout] = useState(30000);
  const [pTemperature, setPTemperature] = useState(0.8);
  const [pMaxTokens, setPMaxTokens] = useState(4096);
  const [pTopP, setPTopP] = useState(1.0);
  const [pPresencePenalty, setPPresencePenalty] = useState(0);
  const [pFrequencyPenalty, setPFrequencyPenalty] = useState(0);

  // Writing style form
  const [wsEnabled, setWsEnabled] = useState(false);
  const [wsGenre, setWsGenre] = useState('xuanhuan');
  const [wsGenreCustom, setWsGenreCustom] = useState('');
  const [wsPov, setWsPov] = useState('third-limited');
  const [wsLanguage, setWsLanguage] = useState('modern');
  const [wsTone, setWsTone] = useState('serious');
  const [wsCustomNotes, setWsCustomNotes] = useState('');

  // Template form
  const [tName, setTName] = useState('');
  const [tSystem, setTSystem] = useState('');
  const [tUser, setTUser] = useState('');

  // Skills state
  const [skills, setSkills] = useState<WritingSkill[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);

  // Skill form
  const [skName, setSkName] = useState('');
  const [skIcon, setSkIcon] = useState('');
  const [skDesc, setSkDesc] = useState('');
  const [skPrompt, setSkPrompt] = useState('');
  const [skEnabled, setSkEnabled] = useState(true);
  const [skParams, setSkParams] = useState<SkillParameter[]>([]);
  const [skHints, setSkHints] = useState<ContextHint[]>([]);

  // Render-phase sync: open changed → reload config from store
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      const config = aiStore.getConfig();
      setProviders(config.providers);
      setTemplates(config.promptTemplates);
      setActiveProviderId(config.activeProviderId);
      setActiveTemplateId(config.activeTemplateId);
      setSelectedProviderId(config.providers[0]?.id ?? null);
      setSelectedTemplateId(config.promptTemplates[0]?.id ?? null);
      const allSkills = aiStore.listSkills();
      setSkills(allSkills);
      setSelectedSkillId(allSkills[0]?.id ?? null);

      // Load writing style
      const ws = aiStore.getWritingStyle();
      setWsEnabled(ws.enabled);
      setWsGenre(ws.genre);
      setWsGenreCustom(ws.genreCustom);
      setWsPov(ws.narrativePov);
      setWsLanguage(ws.languageStyle);
      setWsTone(ws.tone);
      setWsCustomNotes(ws.customNotes);
    }
  }

  // Render-phase sync: selectedProviderId changed → load provider form fields
  const [prevSelectedProviderId, setPrevSelectedProviderId] = useState(selectedProviderId);
  if (selectedProviderId !== prevSelectedProviderId) {
    setPrevSelectedProviderId(selectedProviderId);
    const p = providers.find((x) => x.id === selectedProviderId);
    if (p) {
      setPName(p.name); setPApiKey(p.apiKey); setPModel(p.modelName);
      setPEndpoint(p.apiEndpoint); setPTimeout(p.timeoutMs);
      setPTemperature(p.temperature ?? 0.8);
      setPMaxTokens(p.maxTokens ?? 4096);
      setPTopP(p.topP ?? 1.0);
      setPPresencePenalty(p.presencePenalty ?? 0);
      setPFrequencyPenalty(p.frequencyPenalty ?? 0);
    }
  }

  // Render-phase sync: selectedTemplateId changed → load template form fields
  const [prevSelectedTemplateId, setPrevSelectedTemplateId] = useState(selectedTemplateId);
  if (selectedTemplateId !== prevSelectedTemplateId) {
    setPrevSelectedTemplateId(selectedTemplateId);
    const t = templates.find((x) => x.id === selectedTemplateId);
    if (t) { setTName(t.name); setTSystem(t.systemPrompt); setTUser(t.userPromptTemplate); }
  }

  // Render-phase sync: selectedSkillId changed → load skill form fields
  const [prevSelectedSkillId, setPrevSelectedSkillId] = useState(selectedSkillId);
  if (selectedSkillId !== prevSelectedSkillId) {
    setPrevSelectedSkillId(selectedSkillId);
    const sk = skills.find((x) => x.id === selectedSkillId);
    if (sk) {
      setSkName(sk.name);
      setSkIcon(sk.icon);
      setSkDesc(sk.description);
      setSkPrompt(sk.promptTemplate);
      setSkEnabled(sk.enabled);
      setSkParams(sk.parameters.map((p) => ({ ...p })));
      setSkHints(sk.contextHints.map((h) => ({ ...h })));
    }
  }

  const loadSkillForm = (sk: WritingSkill) => {
    setSkName(sk.name);
    setSkIcon(sk.icon);
    setSkDesc(sk.description);
    setSkPrompt(sk.promptTemplate);
    setSkEnabled(sk.enabled);
    setSkParams(sk.parameters.map((p) => ({ ...p })));
    setSkHints(sk.contextHints.map((h) => ({ ...h })));
  };

  const saveCurrentSkill = () => {
    if (!selectedSkillId) return;
    aiStore.updateSkill(selectedSkillId, {
      name: skName,
      icon: skIcon,
      description: skDesc,
      promptTemplate: skPrompt,
      enabled: skEnabled,
      parameters: skParams,
      contextHints: skHints,
    });
  };

  const handleSave = () => {
    if (selectedProviderId) {
      aiStore.updateProvider(selectedProviderId, {
        name: pName, apiKey: pApiKey, modelName: pModel,
        apiEndpoint: pEndpoint, timeoutMs: pTimeout,
        temperature: pTemperature, maxTokens: pMaxTokens,
        topP: pTopP, presencePenalty: pPresencePenalty,
        frequencyPenalty: pFrequencyPenalty,
      });
    }
    if (selectedTemplateId) {
      aiStore.updateTemplate(selectedTemplateId, {
        name: tName, systemPrompt: tSystem, userPromptTemplate: tUser,
      });
    }
    saveCurrentSkill();
    if (activeProviderId) aiStore.setActiveProvider(activeProviderId);
    if (activeTemplateId) aiStore.setActiveTemplate(activeTemplateId);

    // Save writing style
    aiStore.updateWritingStyle({
      enabled: wsEnabled,
      genre: wsGenre,
      genreCustom: wsGenreCustom,
      narrativePov: wsPov,
      languageStyle: wsLanguage,
      tone: wsTone,
      customNotes: wsCustomNotes,
    });

    onClose();
  };

  const handleAddProvider = () => {
    const p = aiStore.addProvider({
      name: '新提供商', apiKey: '', modelName: '', apiEndpoint: '', timeoutMs: 30000,
      temperature: 0.8, maxTokens: 4096, topP: 1.0,
      presencePenalty: 0, frequencyPenalty: 0,
    });
    setProviders([...providers, p]);
    setSelectedProviderId(p.id);
  };

  const handleDeleteProvider = () => {
    if (!selectedProviderId) return;
    aiStore.deleteProvider(selectedProviderId);
    const next = providers.filter((p) => p.id !== selectedProviderId);
    setProviders(next);
    setSelectedProviderId(next[0]?.id ?? null);
    if (activeProviderId === selectedProviderId) setActiveProviderId(null);
  };

  const handleAddTemplate = () => {
    const t = aiStore.addTemplate({
      name: '新模板', systemPrompt: '', userPromptTemplate: '{user_input}',
    });
    setTemplates([...templates, t]);
    setSelectedTemplateId(t.id);
  };

  const handleDeleteTemplate = () => {
    if (!selectedTemplateId) return;
    aiStore.deleteTemplate(selectedTemplateId);
    const next = templates.filter((t) => t.id !== selectedTemplateId);
    setTemplates(next);
    setSelectedTemplateId(next[0]?.id ?? null);
    if (activeTemplateId === selectedTemplateId) setActiveTemplateId(null);
  };

  const handleAddSkill = () => {
    saveCurrentSkill();
    const newSkill = aiStore.addSkill({
      name: '新技能',
      icon: '🔧',
      description: '',
      promptTemplate: '{user_input}',
      parameters: [],
      contextHints: [],
      sortOrder: skills.length,
      enabled: true,
    });
    const allSkills = aiStore.listSkills();
    setSkills(allSkills);
    setSelectedSkillId(newSkill.id);
  };

  const handleDeleteSkill = () => {
    if (!selectedSkillId) return;
    const sk = skills.find((x) => x.id === selectedSkillId);
    if (sk?.builtIn) return;
    aiStore.deleteSkill(selectedSkillId);
    const allSkills = aiStore.listSkills();
    setSkills(allSkills);
    setSelectedSkillId(allSkills[0]?.id ?? null);
  };

  const handleResetSkill = () => {
    if (!selectedSkillId) return;
    aiStore.resetSkill(selectedSkillId);
    const allSkills = aiStore.listSkills();
    setSkills(allSkills);
    const sk = allSkills.find((x) => x.id === selectedSkillId);
    if (sk) loadSkillForm(sk);
    showToast('success', '已恢复默认设置');
  };

  const handleSelectSkill = (id: string) => {
    if (id === selectedSkillId) return;
    saveCurrentSkill();
    const allSkills = aiStore.listSkills();
    setSkills(allSkills);
    setSelectedSkillId(id);
  };

  const addParam = () => {
    setSkParams([...skParams, {
      key: `param${skParams.length + 1}`, label: '参数', type: 'text',
      defaultValue: '', placeholder: '', required: false,
    }]);
  };
  const removeParam = (idx: number) => setSkParams(skParams.filter((_, i) => i !== idx));
  const updateParam = (idx: number, updates: Partial<SkillParameter>) => {
    setSkParams(skParams.map((p, i) => i === idx ? { ...p, ...updates } : p));
  };

  const addHint = () => {
    setSkHints([...skHints, { signal: 'wordCount', condition: 'low', weight: 1.0 }]);
  };
  const removeHint = (idx: number) => setSkHints(skHints.filter((_, i) => i !== idx));
  const updateHint = (idx: number, updates: Partial<ContextHint>) => {
    setSkHints(skHints.map((h, i) => i === idx ? { ...h, ...updates } : h));
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const skillFileInputRef = useRef<HTMLInputElement>(null);

  const handleExportSkill = () => {
    if (!selectedSkillId) return;
    const sk = skills.find((x) => x.id === selectedSkillId);
    if (!sk) return;
    serializeSkillToZip(sk).then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sk.slug || sk.id}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('success', `已导出技能: ${sk.name}`);
    }).catch((err) => {
      showToast('error', `导出失败: ${err instanceof Error ? err.message : '未知错误'}`);
    });
  };

  const handleImportSkill = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const addParsedSkill = (skill: WritingSkill) => {
      saveCurrentSkill();
      aiStore.addSkill({
        name: skill.name,
        icon: skill.icon,
        description: skill.description,
        promptTemplate: skill.promptTemplate,
        parameters: skill.parameters,
        contextHints: skill.contextHints,
        sortOrder: skill.sortOrder,
        enabled: skill.enabled,
        license: skill.license,
        version: skill.version,
        slug: skill.slug,
        references: skill.references,
      });
      const allSkills = aiStore.listSkills();
      setSkills(allSkills);
      setSelectedSkillId(allSkills[allSkills.length - 1]?.id ?? null);
      showToast('success', `已导入技能: ${skill.name}`);
    };

    if (file.name.endsWith('.zip')) {
      parseSkillZip(file).then(addParsedSkill).catch((err) => {
        showToast('error', `导入失败: ${err instanceof Error ? err.message : '未知错误'}`);
      });
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const skill = parseSkillMarkdown(reader.result as string);
          addParsedSkill(skill);
        } catch (err) {
          showToast('error', `导入失败: ${err instanceof Error ? err.message : '未知错误'}`);
        }
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const handleExportConfig = () => {
    const config = aiStore.getConfig();
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai-config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('success', '配置已导出');
  };

  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result as string) as AIConfig;
        if (!imported.providers || !Array.isArray(imported.providers)) {
          showToast('error', '配置文件格式无效');
          return;
        }
        aiStore.updateConfig(imported);
        const config = aiStore.getConfig();
        setProviders(config.providers);
        setTemplates(config.promptTemplates);
        setActiveProviderId(config.activeProviderId);
        setActiveTemplateId(config.activeTemplateId);
        setSelectedProviderId(config.providers[0]?.id ?? null);
        setSelectedTemplateId(config.promptTemplates[0]?.id ?? null);
        showToast('success', '配置已导入');
      } catch {
        showToast('error', '配置文件解析失败');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const selectedSkill = skills.find((x) => x.id === selectedSkillId);

  return (
    <ConfirmDialog open={open} title="AI 辅助设置" confirmText="保存" onConfirm={handleSave} onCancel={onClose}>
      <div style={s.tabs}>
        <button style={{ ...s.tab, ...(activeTab === 'providers' ? s.tabActive : {}) }}
          onClick={() => setActiveTab('providers')}>模型提供商</button>
        <button style={{ ...s.tab, ...(activeTab === 'templates' ? s.tabActive : {}) }}
          onClick={() => setActiveTab('templates')}>Prompt 模板</button>
        <button style={{ ...s.tab, ...(activeTab === 'skills' ? s.tabActive : {}) }}
          onClick={() => setActiveTab('skills')}>技能管理</button>
        <button style={{ ...s.tab, ...(activeTab === 'writingStyle' ? s.tabActive : {}) }}
          onClick={() => setActiveTab('writingStyle')}>写作风格</button>
      </div>

      {activeTab === 'providers' && (
        <div style={s.splitLayout}>
          <div style={s.listCol}>
            {providers.map((p) => (
              <div key={p.id}
                style={{ ...s.listItem, ...(selectedProviderId === p.id ? s.listItemActive : {}) }}
                onClick={() => setSelectedProviderId(p.id)}>
                {p.name || '未命名'}
              </div>
            ))}
            <div style={s.btnRow}>
              <Button variant="secondary" onClick={handleAddProvider}
                style={{ height: 24, fontSize: 11, flex: 1 }}>添加</Button>
              <Button variant="secondary" onClick={handleDeleteProvider}
                style={{ height: 24, fontSize: 11, flex: 1, color: 'var(--color-error)' }}
                disabled={!selectedProviderId}>删除</Button>
            </div>
            <div style={s.activeLabel}>当前使用：</div>
            <select style={{ ...s.select, height: 28, fontSize: 12 }}
              value={activeProviderId ?? ''}
              onChange={(e) => setActiveProviderId(e.target.value || null)}>
              <option value="">未选择</option>
              {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={s.formCol}>
            {selectedProviderId ? (
              <>
                <div style={s.field}>
                  <span style={s.label}>名称</span>
                  <Input value={pName} onChange={(e) => setPName(e.currentTarget.value)} placeholder="如 OpenAI" />
                </div>
                <div style={s.field}>
                  <span style={s.label}>API Key</span>
                  <Input type="password" value={pApiKey} onChange={(e) => setPApiKey(e.currentTarget.value)} placeholder="sk-..." />
                </div>
                <div style={s.field}>
                  <span style={s.label}>模型名称</span>
                  <Input value={pModel} onChange={(e) => setPModel(e.currentTarget.value)} placeholder="如 gpt-4o" />
                </div>
                <div style={s.field}>
                  <span style={s.label}>API 端点 URL</span>
                  <Input value={pEndpoint} onChange={(e) => setPEndpoint(e.currentTarget.value)} placeholder="https://api.openai.com/v1/chat/completions" />
                </div>
                <div style={s.field}>
                  <span style={s.label}>超时时间 (ms)</span>
                  <Input type="number" value={String(pTimeout)} onChange={(e) => setPTimeout(Number(e.currentTarget.value) || 30000)} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ ...s.field, flex: 1 }}>
                    <span style={s.label}>Temperature (0-2)</span>
                    <Input type="number" step="0.1" min="0" max="2"
                      value={String(pTemperature)} onChange={(e) => setPTemperature(Number(e.currentTarget.value) || 0)} />
                  </div>
                  <div style={{ ...s.field, flex: 1 }}>
                    <span style={s.label}>Max Tokens</span>
                    <Input type="number" step="256" min="0"
                      value={String(pMaxTokens)} onChange={(e) => setPMaxTokens(Number(e.currentTarget.value) || 0)} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ ...s.field, flex: 1 }}>
                    <span style={s.label}>Top P (0-1)</span>
                    <Input type="number" step="0.05" min="0" max="1"
                      value={String(pTopP)} onChange={(e) => setPTopP(Number(e.currentTarget.value) || 1)} />
                  </div>
                  <div style={{ ...s.field, flex: 1 }}>
                    <span style={s.label}>Presence Penalty (-2~2)</span>
                    <Input type="number" step="0.1" min="-2" max="2"
                      value={String(pPresencePenalty)} onChange={(e) => setPPresencePenalty(Number(e.currentTarget.value) || 0)} />
                  </div>
                  <div style={{ ...s.field, flex: 1 }}>
                    <span style={s.label}>Frequency Penalty (-2~2)</span>
                    <Input type="number" step="0.1" min="-2" max="2"
                      value={String(pFrequencyPenalty)} onChange={(e) => setPFrequencyPenalty(Number(e.currentTarget.value) || 0)} />
                  </div>
                </div>
                <div style={s.hint}>
                  Temperature 建议：创意写作 0.7-0.9，改写润色 0.4-0.6。Frequency Penalty 0.1-0.3 可减少用词重复。
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', padding: 16 }}>
                请选择或添加一个提供商
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'templates' && (
        <div style={s.splitLayout}>
          <div style={s.listCol}>
            {templates.map((t) => (
              <div key={t.id}
                style={{ ...s.listItem, ...(selectedTemplateId === t.id ? s.listItemActive : {}) }}
                onClick={() => setSelectedTemplateId(t.id)}>
                {t.name || '未命名'}
              </div>
            ))}
            <div style={s.btnRow}>
              <Button variant="secondary" onClick={handleAddTemplate}
                style={{ height: 24, fontSize: 11, flex: 1 }}>添加</Button>
              <Button variant="secondary" onClick={handleDeleteTemplate}
                style={{ height: 24, fontSize: 11, flex: 1, color: 'var(--color-error)' }}
                disabled={!selectedTemplateId}>删除</Button>
            </div>
            <div style={s.activeLabel}>当前使用：</div>
            <select style={{ ...s.select, height: 28, fontSize: 12 }}
              value={activeTemplateId ?? ''}
              onChange={(e) => setActiveTemplateId(e.target.value || null)}>
              <option value="">默认模板</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div style={s.formCol}>
            {selectedTemplateId ? (
              <>
                <div style={s.field}>
                  <span style={s.label}>模板名称</span>
                  <Input value={tName} onChange={(e) => setTName(e.currentTarget.value)} />
                </div>
                <div style={s.field}>
                  <span style={s.label}>系统提示词</span>
                  <TextArea value={tSystem} onChange={(e) => setTSystem(e.currentTarget.value)}
                    style={{ minHeight: 80 }} />
                </div>
                <div style={s.field}>
                  <span style={s.label}>用户提示词模板</span>
                  <TextArea value={tUser} onChange={(e) => setTUser(e.currentTarget.value)}
                    style={{ minHeight: 80 }} />
                </div>
                <div style={s.hint}>
                  可用占位符：{'{chapter_content}'} {'{prev_chapter_summary}'} {'{next_chapter_summary}'} {'{character_info}'} {'{world_setting}'} {'{timeline_context}'} {'{user_input}'}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', padding: 16 }}>
                请选择或添加一个模板
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'skills' && (
        <div style={s.splitLayout}>
          <div style={s.listCol}>
            {skills.map((sk) => (
              <div key={sk.id}
                style={{
                  ...s.listItem,
                  ...(selectedSkillId === sk.id ? s.listItemActive : {}),
                  opacity: sk.enabled ? 1 : 0.5,
                }}
                onClick={() => handleSelectSkill(sk.id)}>
                {sk.icon} {sk.name}
                {sk.builtIn && <span style={s.skillBadge}>内置</span>}
              </div>
            ))}
            <div style={s.btnRow}>
              <Button variant="secondary" onClick={handleAddSkill}
                style={{ height: 24, fontSize: 11, flex: 1 }}>添加</Button>
              <Button variant="secondary" onClick={handleDeleteSkill}
                style={{ height: 24, fontSize: 11, flex: 1, color: 'var(--color-error)' }}
                disabled={!selectedSkillId || !!selectedSkill?.builtIn}>删除</Button>
            </div>
            <div style={s.btnRow}>
              <Button variant="secondary" onClick={handleExportSkill}
                style={{ height: 24, fontSize: 11, flex: 1 }}
                disabled={!selectedSkillId}>导出</Button>
              <Button variant="secondary" onClick={() => skillFileInputRef.current?.click()}
                style={{ height: 24, fontSize: 11, flex: 1 }}>导入</Button>
              <input ref={skillFileInputRef} type="file" accept=".zip,.md" style={{ display: 'none' }}
                onChange={handleImportSkill} />
            </div>
          </div>
          <div style={{ ...s.formCol, overflowY: 'auto', maxHeight: 420 }}>
            {selectedSkillId && selectedSkill ? (
              <>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ ...s.field, width: 60 }}>
                    <span style={s.label}>图标</span>
                    <Input value={skIcon} onChange={(e) => setSkIcon(e.currentTarget.value)}
                      style={{ textAlign: 'center' }} />
                  </div>
                  <div style={{ ...s.field, flex: 1 }}>
                    <span style={s.label}>名称</span>
                    <Input value={skName} onChange={(e) => setSkName(e.currentTarget.value)} />
                  </div>
                  <div style={{ ...s.field, width: 60, justifyContent: 'flex-end' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                      <input type="checkbox" checked={skEnabled} onChange={(e) => setSkEnabled(e.target.checked)} />
                      启用
                    </label>
                  </div>
                </div>

                <div style={s.field}>
                  <span style={s.label}>描述</span>
                  <Input value={skDesc} onChange={(e) => setSkDesc(e.currentTarget.value)}
                    placeholder="简短描述技能用途" />
                </div>

                <div style={s.field}>
                  <span style={s.label}>提示词模板</span>
                  <TextArea value={skPrompt} onChange={(e) => setSkPrompt(e.currentTarget.value)}
                    style={{ minHeight: 80 }} />
                  <span style={s.hint}>
                    使用 {'{param:key}'} 引用参数，如 {'{param:character1}'}。运行时用户填写的参数值会替换对应占位符。
                  </span>
                </div>

                <div style={s.field}>
                  <span style={s.label}>参数列表</span>
                  <div style={s.subSection}>
                    {skParams.length === 0 && (
                      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>暂无参数</span>
                    )}
                    {skParams.map((p, i) => (
                      <div key={i} style={s.subRow}>
                        <Input value={p.key} onChange={(e) => updateParam(i, { key: e.currentTarget.value })}
                          placeholder="key" style={{ width: 70, height: 28, fontSize: 12 }} />
                        <Input value={p.label} onChange={(e) => updateParam(i, { label: e.currentTarget.value })}
                          placeholder="显示名" style={{ width: 70, height: 28, fontSize: 12 }} />
                        <select style={{ ...s.select, width: 70, height: 28, fontSize: 12 }}
                          value={p.type} onChange={(e) => updateParam(i, { type: e.target.value as SkillParameter['type'] })}>
                          <option value="text">文本</option>
                          <option value="number">数字</option>
                          <option value="select">选择</option>
                        </select>
                        {p.type === 'select' && (
                          <select style={{ ...s.select, width: 90, height: 28, fontSize: 12 }}
                            value={p.source ?? ''}
                            onChange={(e) => updateParam(i, { source: (e.target.value || undefined) as SkillParameter['source'] })}>
                            <option value="">静态选项</option>
                            <option value="characters">角色列表</option>
                          </select>
                        )}
                        <label style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11 }}>
                          <input type="checkbox" checked={p.required ?? false}
                            onChange={(e) => updateParam(i, { required: e.target.checked })} />
                          必填
                        </label>
                        <button style={s.removeBtn} onClick={() => removeParam(i)} title="移除参数">×</button>
                      </div>
                    ))}
                    <Button variant="secondary" onClick={addParam}
                      style={{ height: 24, fontSize: 11, alignSelf: 'flex-start' }}>+ 添加参数</Button>
                  </div>
                </div>

                <div style={s.field}>
                  <span style={s.label}>上下文推荐条件</span>
                  <div style={s.subSection}>
                    {skHints.length === 0 && (
                      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>暂无条件（不参与智能推荐）</span>
                    )}
                    {skHints.map((h, i) => (
                      <div key={i} style={s.subRow}>
                        <select style={{ ...s.select, width: 110, height: 28, fontSize: 12 }}
                          value={h.signal} onChange={(e) => updateHint(i, { signal: e.target.value as ContextHint['signal'] })}>
                          {Object.entries(SIGNAL_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                        <select style={{ ...s.select, width: 60, height: 28, fontSize: 12 }}
                          value={h.condition} onChange={(e) => updateHint(i, { condition: e.target.value as ContextHint['condition'] })}>
                          {Object.entries(CONDITION_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                        <Input type="number" value={String(h.weight ?? 1)}
                          onChange={(e) => updateHint(i, { weight: Number(e.currentTarget.value) || 1 })}
                          placeholder="权重" style={{ width: 50, height: 28, fontSize: 12 }} />
                        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>权重</span>
                        <button style={s.removeBtn} onClick={() => removeHint(i)} title="移除条件">×</button>
                      </div>
                    ))}
                    <Button variant="secondary" onClick={addHint}
                      style={{ height: 24, fontSize: 11, alignSelf: 'flex-start' }}>+ 添加条件</Button>
                  </div>
                </div>

                {selectedSkill.builtIn && (
                  <Button variant="secondary" onClick={handleResetSkill}
                    style={{ height: 28, fontSize: 12, alignSelf: 'flex-start' }}>
                    恢复默认
                  </Button>
                )}
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', padding: 16 }}>
                请选择或添加一个技能
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'writingStyle' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 300 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            <input type="checkbox" checked={wsEnabled} onChange={(e) => setWsEnabled(e.target.checked)} />
            启用写作风格注入（AI 生成时将参考以下风格设定）
          </label>

          {wsEnabled && (
            <>
              <div style={s.field}>
                <span style={s.label}>小说流派</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {GENRE_OPTIONS.map((g) => (
                    <label key={g.value} style={{
                      display: 'flex', alignItems: 'center', gap: 4, fontSize: 13,
                      padding: '4px 8px', borderRadius: 'var(--radius)',
                      border: '1px solid var(--color-border)',
                      background: wsGenre === g.value ? 'var(--color-accent)' : 'transparent',
                      color: wsGenre === g.value ? '#fff' : 'var(--color-text)',
                      cursor: 'pointer',
                    }}>
                      <input type="radio" name="genre" value={g.value}
                        checked={wsGenre === g.value}
                        onChange={(e) => setWsGenre(e.target.value)}
                        style={{ display: 'none' }} />
                      {g.label}
                    </label>
                  ))}
                </div>
                {wsGenre === 'other' && (
                  <Input value={wsGenreCustom} onChange={(e) => setWsGenreCustom(e.currentTarget.value)}
                    placeholder="输入自定义流派名称" style={{ marginTop: 4 }} />
                )}
              </div>

              <div style={s.field}>
                <span style={s.label}>叙事视角</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {POV_OPTIONS.map((o) => (
                    <label key={o.value} style={{
                      display: 'flex', alignItems: 'center', gap: 4, fontSize: 13,
                      padding: '4px 8px', borderRadius: 'var(--radius)',
                      border: '1px solid var(--color-border)',
                      background: wsPov === o.value ? 'var(--color-accent)' : 'transparent',
                      color: wsPov === o.value ? '#fff' : 'var(--color-text)',
                      cursor: 'pointer',
                    }}>
                      <input type="radio" name="pov" value={o.value}
                        checked={wsPov === o.value}
                        onChange={(e) => setWsPov(e.target.value)}
                        style={{ display: 'none' }} />
                      {o.label}
                    </label>
                  ))}
                </div>
              </div>

              <div style={s.field}>
                <span style={s.label}>语言风格</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {LANGUAGE_STYLE_OPTIONS.map((o) => (
                    <label key={o.value} style={{
                      display: 'flex', alignItems: 'center', gap: 4, fontSize: 13,
                      padding: '4px 8px', borderRadius: 'var(--radius)',
                      border: '1px solid var(--color-border)',
                      background: wsLanguage === o.value ? 'var(--color-accent)' : 'transparent',
                      color: wsLanguage === o.value ? '#fff' : 'var(--color-text)',
                      cursor: 'pointer',
                    }}>
                      <input type="radio" name="language" value={o.value}
                        checked={wsLanguage === o.value}
                        onChange={(e) => setWsLanguage(e.target.value)}
                        style={{ display: 'none' }} />
                      {o.label}
                    </label>
                  ))}
                </div>
              </div>

              <div style={s.field}>
                <span style={s.label}>整体基调</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {TONE_OPTIONS.map((o) => (
                    <label key={o.value} style={{
                      display: 'flex', alignItems: 'center', gap: 4, fontSize: 13,
                      padding: '4px 8px', borderRadius: 'var(--radius)',
                      border: '1px solid var(--color-border)',
                      background: wsTone === o.value ? 'var(--color-accent)' : 'transparent',
                      color: wsTone === o.value ? '#fff' : 'var(--color-text)',
                      cursor: 'pointer',
                    }}>
                      <input type="radio" name="tone" value={o.value}
                        checked={wsTone === o.value}
                        onChange={(e) => setWsTone(e.target.value)}
                        style={{ display: 'none' }} />
                      {o.label}
                    </label>
                  ))}
                </div>
              </div>

              <div style={s.field}>
                <span style={s.label}>额外风格描述</span>
                <TextArea value={wsCustomNotes} onChange={(e) => setWsCustomNotes(e.currentTarget.value)}
                  placeholder="描述更多写作风格要求，例如：多用短句、少用成语、对白占比高、注重打斗场面的节奏感..."
                  style={{ minHeight: 60 }} />
                <span style={s.hint}>此内容将原样注入 AI 写作 Prompt，帮助 AI 更准确地把握你的文风偏好。</span>
              </div>
            </>
          )}

          {!wsEnabled && (
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', padding: 16 }}>
              启用后，AI 将根据你的风格设定生成更符合预期的内容。推荐开启以获得更一致的写作体验。
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
        <Button variant="secondary" onClick={handleExportConfig}
          style={{ height: 28, fontSize: 12 }}>导出配置</Button>
        <Button variant="secondary" onClick={() => fileInputRef.current?.click()}
          style={{ height: 28, fontSize: 12 }}>导入配置</Button>
        <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }}
          onChange={handleImportConfig} />
      </div>
    </ConfirmDialog>
  );
}

import { useState, useRef, type CSSProperties } from 'react';
import type { AIAssistantStore } from '../../types/stores';
import type { AIConfig, AIProvider, PromptTemplate } from '../../types/ai';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Input } from '../ui/Input';
import { TextArea } from '../ui/TextArea';
import { Button } from '../ui/Button';
import { showToast } from '../ui/Toast';

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
};

interface AIConfigDialogProps {
  open: boolean;
  aiStore: AIAssistantStore;
  onClose: () => void;
}

export function AIConfigDialog({ open, aiStore, onClose }: AIConfigDialogProps) {
  const [activeTab, setActiveTab] = useState<'providers' | 'templates'>('providers');
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

  // Template form
  const [tName, setTName] = useState('');
  const [tSystem, setTSystem] = useState('');
  const [tUser, setTUser] = useState('');

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
    }
  }

  // Render-phase sync: selectedTemplateId changed → load template form fields
  const [prevSelectedTemplateId, setPrevSelectedTemplateId] = useState(selectedTemplateId);
  if (selectedTemplateId !== prevSelectedTemplateId) {
    setPrevSelectedTemplateId(selectedTemplateId);
    const t = templates.find((x) => x.id === selectedTemplateId);
    if (t) { setTName(t.name); setTSystem(t.systemPrompt); setTUser(t.userPromptTemplate); }
  }

  const handleSave = () => {
    // Save provider changes
    if (selectedProviderId) {
      aiStore.updateProvider(selectedProviderId, {
        name: pName, apiKey: pApiKey, modelName: pModel,
        apiEndpoint: pEndpoint, timeoutMs: pTimeout,
      });
    }
    // Save template changes
    if (selectedTemplateId) {
      aiStore.updateTemplate(selectedTemplateId, {
        name: tName, systemPrompt: tSystem, userPromptTemplate: tUser,
      });
    }
    if (activeProviderId) aiStore.setActiveProvider(activeProviderId);
    if (activeTemplateId) aiStore.setActiveTemplate(activeTemplateId);
    onClose();
  };

  const handleAddProvider = () => {
    const p = aiStore.addProvider({
      name: '新提供商', apiKey: '', modelName: '', apiEndpoint: '', timeoutMs: 30000,
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

  const fileInputRef = useRef<HTMLInputElement>(null);

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
        // Reload local state
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
    // Reset input so same file can be re-imported
    e.target.value = '';
  };

  return (
    <ConfirmDialog open={open} title="AI 辅助设置" confirmText="保存" onConfirm={handleSave} onCancel={onClose}>
      <div style={s.tabs}>
        <button style={{ ...s.tab, ...(activeTab === 'providers' ? s.tabActive : {}) }}
          onClick={() => setActiveTab('providers')}>模型提供商</button>
        <button style={{ ...s.tab, ...(activeTab === 'templates' ? s.tabActive : {}) }}
          onClick={() => setActiveTab('templates')}>Prompt 模板</button>
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

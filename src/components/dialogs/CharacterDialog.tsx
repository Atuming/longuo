import { useState, type CSSProperties } from 'react';
import type { Character } from '../../types/character';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Input } from '../ui/Input';
import { TextArea } from '../ui/TextArea';
import { Button } from '../ui/Button';

const styles: Record<string, CSSProperties> = {
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' },
  kvSection: { display: 'flex', flexDirection: 'column', gap: 6 },
  kvRow: { display: 'flex', gap: 6, alignItems: 'center' },
  removeBtn: {
    background: 'none', border: 'none', color: 'var(--color-error)',
    cursor: 'pointer', fontSize: 16, padding: '0 4px', flexShrink: 0,
  },
};

type CharacterFormData = Omit<Character, 'id' | 'projectId'>;

interface CharacterDialogProps {
  open: boolean;
  initialData?: Character;
  onConfirm: (data: CharacterFormData) => void;
  onCancel: () => void;
}

const emptyForm: CharacterFormData = {
  name: '', aliases: [], appearance: '', personality: '', backstory: '', customAttributes: {},
};

export function CharacterDialog({ open, initialData, onConfirm, onCancel }: CharacterDialogProps) {
  const [form, setForm] = useState<CharacterFormData>(emptyForm);
  const [aliasInput, setAliasInput] = useState('');
  const [kvKey, setKvKey] = useState('');
  const [kvValue, setKvValue] = useState('');

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      if (initialData) {
        const { id: _, projectId: __, ...rest } = initialData; // eslint-disable-line @typescript-eslint/no-unused-vars
        setForm(rest);
      } else {
        setForm(emptyForm);
      }
      setAliasInput('');
      setKvKey('');
      setKvValue('');
    }
  }

  const handleAddAlias = () => {
    const trimmed = aliasInput.trim();
    if (trimmed && !form.aliases.includes(trimmed)) {
      setForm({ ...form, aliases: [...form.aliases, trimmed] });
      setAliasInput('');
    }
  };

  const handleRemoveAlias = (idx: number) => {
    setForm({ ...form, aliases: form.aliases.filter((_, i) => i !== idx) });
  };

  const handleAddKv = () => {
    if (kvKey.trim()) {
      setForm({ ...form, customAttributes: { ...form.customAttributes, [kvKey.trim()]: kvValue } });
      setKvKey('');
      setKvValue('');
    }
  };

  const handleRemoveKv = (key: string) => {
    const next = { ...form.customAttributes };
    delete next[key];
    setForm({ ...form, customAttributes: next });
  };

  return (
    <ConfirmDialog
      open={open}
      title={initialData ? '编辑角色' : '新建角色'}
      confirmText={initialData ? '保存' : '创建'}
      onConfirm={() => onConfirm(form)}
      onCancel={onCancel}
      confirmDisabled={!form.name.trim()}
    >
      <div style={styles.form}>
        <div style={styles.field}>
          <span style={styles.label}>姓名 *</span>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} placeholder="角色姓名" />
        </div>
        <div style={styles.field}>
          <span style={styles.label}>别名</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <Input value={aliasInput} onChange={(e) => setAliasInput(e.currentTarget.value)} placeholder="输入别名后回车"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddAlias(); } }} style={{ flex: 1 }} />
            <Button variant="secondary" style={{ height: 36, fontSize: 12 }} onClick={handleAddAlias}>添加</Button>
          </div>
          {form.aliases.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
              {form.aliases.map((a, i) => (
                <span key={i} style={{ fontSize: 11, padding: '1px 8px', borderRadius: 10, background: '#EDF2F7', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {a} <button style={styles.removeBtn} onClick={() => handleRemoveAlias(i)}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div style={styles.field}>
          <span style={styles.label}>外貌</span>
          <TextArea value={form.appearance} onChange={(e) => setForm({ ...form, appearance: e.currentTarget.value })} placeholder="描述角色外貌" style={{ minHeight: 60 }} />
        </div>
        <div style={styles.field}>
          <span style={styles.label}>性格</span>
          <TextArea value={form.personality} onChange={(e) => setForm({ ...form, personality: e.currentTarget.value })} placeholder="描述角色性格" style={{ minHeight: 60 }} />
        </div>
        <div style={styles.field}>
          <span style={styles.label}>背景故事</span>
          <TextArea value={form.backstory} onChange={(e) => setForm({ ...form, backstory: e.currentTarget.value })} placeholder="角色背景故事" style={{ minHeight: 80 }} />
        </div>
        <div style={styles.field}>
          <span style={styles.label}>自定义属性</span>
          <div style={styles.kvSection}>
            {Object.entries(form.customAttributes).map(([k, v]) => (
              <div key={k} style={styles.kvRow}>
                <span style={{ fontSize: 13, fontWeight: 500, minWidth: 60 }}>{k}</span>
                <span style={{ fontSize: 13, flex: 1 }}>{v}</span>
                <button style={styles.removeBtn} onClick={() => handleRemoveKv(k)}>×</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 6 }}>
              <Input value={kvKey} onChange={(e) => setKvKey(e.currentTarget.value)} placeholder="属性名" style={{ flex: 1 }} />
              <Input value={kvValue} onChange={(e) => setKvValue(e.currentTarget.value)} placeholder="属性值" style={{ flex: 1 }} />
              <Button variant="secondary" style={{ height: 36, fontSize: 12 }} onClick={handleAddKv}>添加</Button>
            </div>
          </div>
        </div>
      </div>
    </ConfirmDialog>
  );
}

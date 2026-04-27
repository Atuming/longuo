import { useState, useEffect, type CSSProperties } from 'react';
import type { WorldEntry, CustomWorldCategory } from '../../types/world';
import { BUILT_IN_CATEGORIES } from '../../types/world';
import type { Character } from '../../types/character';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Input } from '../ui/Input';
import { TextArea } from '../ui/TextArea';

const styles: Record<string, CSSProperties> = {
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' },
  typeGroup: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  typeBtn: {
    height: 32, paddingLeft: 12, paddingRight: 12, fontSize: 12, borderRadius: 'var(--radius)',
    border: '1px solid var(--color-border)', background: '#fff',
    cursor: 'pointer', color: 'var(--color-text-secondary)', transition: 'all 0.15s',
  },
  typeActive: { background: 'var(--color-accent)', color: '#fff', borderColor: 'var(--color-accent)' },
  addCustomRow: { display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 },
  addCustomInput: { flex: 1 },
  addCustomBtn: {
    height: 32, paddingLeft: 10, paddingRight: 10, fontSize: 12, borderRadius: 'var(--radius)',
    border: '1px dashed var(--color-border)', background: '#fff',
    cursor: 'pointer', color: 'var(--color-text-secondary)', transition: 'all 0.15s',
  },
  charList: { display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflow: 'auto' },
  charItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 },
};

type WorldFormData = Omit<WorldEntry, 'id'>;

interface WorldDialogProps {
  open: boolean;
  initialData?: WorldEntry;
  projectId: string;
  characters: Character[];
  customCategories: CustomWorldCategory[];
  onConfirm: (data: WorldFormData) => void;
  onCancel: () => void;
  onAddCustomCategory?: (label: string) => void;
}

export function WorldDialog({ open, initialData, projectId, characters, customCategories, onConfirm, onCancel, onAddCustomCategory }: WorldDialogProps) {
  const [form, setForm] = useState<WorldFormData>({
    projectId, type: 'location', name: '', description: '', category: '', associatedCharacterIds: [],
  });

  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newCustomLabel, setNewCustomLabel] = useState('');

  const [prevOpen, setPrevOpen] = useState(false);

  useEffect(() => {
    if (open && !prevOpen) {
      setForm(initialData ? { ...initialData } : { projectId, type: 'location', name: '', description: '', category: '', associatedCharacterIds: [] });
      setShowAddCustom(false);
      setNewCustomLabel('');
    }
    setPrevOpen(open);
  }, [open, initialData]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCharacter = (cid: string) => {
    const ids = form.associatedCharacterIds.includes(cid)
      ? form.associatedCharacterIds.filter((id) => id !== cid)
      : [...form.associatedCharacterIds, cid];
    setForm({ ...form, associatedCharacterIds: ids });
  };

  return (
    <ConfirmDialog
      open={open}
      title={initialData ? '编辑世界观' : '新建世界观'}
      confirmText={initialData ? '保存' : '创建'}
      onConfirm={() => onConfirm(form)}
      onCancel={onCancel}
      confirmDisabled={!form.name.trim()}
    >
      <div style={styles.form}>
        <div style={styles.field}>
          <span style={styles.label}>类型</span>
          <div style={styles.typeGroup}>
            {BUILT_IN_CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                style={{ ...styles.typeBtn, ...(form.type === cat.key ? styles.typeActive : {}) }}
                onClick={() => setForm({ ...form, type: cat.key })}
              >
                {cat.label}
              </button>
            ))}
            {customCategories.map((cat) => (
              <button
                key={cat.key}
                style={{ ...styles.typeBtn, ...(form.type === cat.key ? styles.typeActive : {}) }}
                onClick={() => setForm({ ...form, type: cat.key })}
              >
                {cat.label}
              </button>
            ))}
          </div>
          {!showAddCustom && onAddCustomCategory && (
            <button
              style={styles.addCustomBtn}
              onClick={() => setShowAddCustom(true)}
            >
              + 添加自定义分类
            </button>
          )}
          {showAddCustom && onAddCustomCategory && (
            <div style={styles.addCustomRow}>
              <Input
                style={styles.addCustomInput}
                value={newCustomLabel}
                onChange={(e) => setNewCustomLabel(e.currentTarget.value)}
                placeholder="输入分类名称"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newCustomLabel.trim()) {
                    onAddCustomCategory(newCustomLabel.trim());
                    setNewCustomLabel('');
                    setShowAddCustom(false);
                  }
                }}
              />
              <button
                style={{ ...styles.typeBtn, opacity: newCustomLabel.trim() ? 1 : 0.5 }}
                disabled={!newCustomLabel.trim()}
                onClick={() => {
                  if (newCustomLabel.trim()) {
                    onAddCustomCategory(newCustomLabel.trim());
                    setNewCustomLabel('');
                    setShowAddCustom(false);
                  }
                }}
              >
                确定
              </button>
              <button
                style={styles.typeBtn}
                onClick={() => { setShowAddCustom(false); setNewCustomLabel(''); }}
              >
                取消
              </button>
            </div>
          )}
        </div>
        <div style={styles.field}>
          <span style={styles.label}>名称 *</span>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} placeholder="条目名称" />
        </div>
        <div style={styles.field}>
          <span style={styles.label}>描述</span>
          <TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.currentTarget.value })} placeholder="详细描述" />
        </div>
        {form.type === 'rule' && (
          <div style={styles.field}>
            <span style={styles.label}>类别</span>
            <Input value={form.category || ''} onChange={(e) => setForm({ ...form, category: e.currentTarget.value })} placeholder="规则类别" />
          </div>
        )}
        <div style={styles.field}>
          <span style={styles.label}>关联角色</span>
          <div style={styles.charList}>
            {characters.length === 0 && <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>暂无角色</span>}
            {characters.map((ch) => (
              <label key={ch.id} style={styles.charItem}>
                <input
                  type="checkbox"
                  checked={form.associatedCharacterIds.includes(ch.id)}
                  onChange={() => toggleCharacter(ch.id)}
                />
                {ch.name}
              </label>
            ))}
          </div>
        </div>
      </div>
    </ConfirmDialog>
  );
}

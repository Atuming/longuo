import { useState, useEffect, type CSSProperties } from 'react';
import type { PlotThread } from '../../types/plot';
import type { Chapter } from '../../types/chapter';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Input } from '../ui/Input';
import { TextArea } from '../ui/TextArea';

const styles: Record<string, CSSProperties> = {
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' },
  statusGroup: { display: 'flex', gap: 6 },
  statusBtn: {
    flex: 1, height: 32, fontSize: 12, borderRadius: 'var(--radius)',
    border: '1px solid var(--color-border)', background: '#fff',
    cursor: 'pointer', color: 'var(--color-text-secondary)', transition: 'all 0.15s',
  },
  statusActive: { background: 'var(--color-accent)', color: '#fff', borderColor: 'var(--color-accent)' },
  checkList: { display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflow: 'auto' },
  checkItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 },
};

const STATUS_LABELS: Record<string, string> = {
  pending: '未展开', in_progress: '进行中', resolved: '已回收',
};

type PlotFormData = Omit<PlotThread, 'id'>;

interface PlotDialogProps {
  open: boolean;
  initialData?: PlotThread;
  projectId: string;
  chapters: Chapter[];
  onConfirm: (data: PlotFormData) => void;
  onCancel: () => void;
}

export function PlotDialog({ open, initialData, projectId, chapters, onConfirm, onCancel }: PlotDialogProps) {
  const [form, setForm] = useState<PlotFormData>({
    projectId, name: '', description: '', status: 'pending', associatedChapterIds: [],
  });

  const [prevOpen, setPrevOpen] = useState(false);

  useEffect(() => {
    if (open && !prevOpen) {
      setForm(initialData ? { ...initialData } : { projectId, name: '', description: '', status: 'pending', associatedChapterIds: [] });
    }
    setPrevOpen(open);
  }, [open, initialData]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleChapter = (cid: string) => {
    const ids = form.associatedChapterIds.includes(cid)
      ? form.associatedChapterIds.filter((id) => id !== cid)
      : [...form.associatedChapterIds, cid];
    setForm({ ...form, associatedChapterIds: ids });
  };

  return (
    <ConfirmDialog
      open={open}
      title={initialData ? '编辑情节线索' : '新建情节线索'}
      confirmText={initialData ? '保存' : '创建'}
      onConfirm={() => onConfirm(form)}
      onCancel={onCancel}
      confirmDisabled={!form.name.trim()}
    >
      <div style={styles.form}>
        <div style={styles.field}>
          <span style={styles.label}>名称 *</span>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} placeholder="线索名称" />
        </div>
        <div style={styles.field}>
          <span style={styles.label}>描述</span>
          <TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.currentTarget.value })} placeholder="线索描述" />
        </div>
        <div style={styles.field}>
          <span style={styles.label}>状态</span>
          <div style={styles.statusGroup}>
            {(['pending', 'in_progress', 'resolved'] as const).map((s) => (
              <button
                key={s}
                style={{ ...styles.statusBtn, ...(form.status === s ? styles.statusActive : {}) }}
                onClick={() => setForm({ ...form, status: s })}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
        <div style={styles.field}>
          <span style={styles.label}>关联章节</span>
          <div style={styles.checkList}>
            {chapters.length === 0 && <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>暂无章节</span>}
            {chapters.map((ch) => (
              <label key={ch.id} style={styles.checkItem}>
                <input type="checkbox" checked={form.associatedChapterIds.includes(ch.id)} onChange={() => toggleChapter(ch.id)} />
                {ch.title}
              </label>
            ))}
          </div>
        </div>
      </div>
    </ConfirmDialog>
  );
}

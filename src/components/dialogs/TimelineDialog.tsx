import { useState, useEffect, type CSSProperties } from 'react';
import type { TimelinePoint } from '../../types/timeline';
import type { Chapter } from '../../types/chapter';
import type { Character } from '../../types/character';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Input } from '../ui/Input';
import { TextArea } from '../ui/TextArea';

const styles: Record<string, CSSProperties> = {
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' },
  checkList: { display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflow: 'auto' },
  checkItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 },
};

type TimelineFormData = Omit<TimelinePoint, 'id'>;

interface TimelineDialogProps {
  open: boolean;
  initialData?: TimelinePoint;
  projectId: string;
  chapters: Chapter[];
  characters: Character[];
  onConfirm: (data: TimelineFormData) => void;
  onCancel: () => void;
}

export function TimelineDialog({ open, initialData, projectId, chapters, characters, onConfirm, onCancel }: TimelineDialogProps) {
  const [form, setForm] = useState<TimelineFormData>({
    projectId, label: '', description: '', sortOrder: 0,
    associatedChapterIds: [], associatedCharacterIds: [],
  });

  const [prevOpen, setPrevOpen] = useState(false);

  useEffect(() => {
    if (open && !prevOpen) {
      setForm(initialData ? { ...initialData } : {
        projectId, label: '', description: '', sortOrder: 0,
        associatedChapterIds: [], associatedCharacterIds: [],
      });
    }
    setPrevOpen(open);
  }, [open, initialData]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleChapter = (cid: string) => {
    const ids = form.associatedChapterIds.includes(cid)
      ? form.associatedChapterIds.filter((id) => id !== cid)
      : [...form.associatedChapterIds, cid];
    setForm({ ...form, associatedChapterIds: ids });
  };

  const toggleCharacter = (cid: string) => {
    const ids = form.associatedCharacterIds.includes(cid)
      ? form.associatedCharacterIds.filter((id) => id !== cid)
      : [...form.associatedCharacterIds, cid];
    setForm({ ...form, associatedCharacterIds: ids });
  };

  return (
    <ConfirmDialog
      open={open}
      title={initialData ? '编辑时间节点' : '新建时间节点'}
      confirmText={initialData ? '保存' : '创建'}
      onConfirm={() => onConfirm(form)}
      onCancel={onCancel}
      confirmDisabled={!form.label.trim()}
    >
      <div style={styles.form}>
        <div style={styles.field}>
          <span style={styles.label}>时间标签 *</span>
          <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.currentTarget.value })} placeholder="如：第一年春" />
        </div>
        <div style={styles.field}>
          <span style={styles.label}>事件描述</span>
          <TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.currentTarget.value })} placeholder="描述该时间节点的事件" />
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
        <div style={styles.field}>
          <span style={styles.label}>关联角色</span>
          <div style={styles.checkList}>
            {characters.length === 0 && <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>暂无角色</span>}
            {characters.map((ch) => (
              <label key={ch.id} style={styles.checkItem}>
                <input type="checkbox" checked={form.associatedCharacterIds.includes(ch.id)} onChange={() => toggleCharacter(ch.id)} />
                {ch.name}
              </label>
            ))}
          </div>
        </div>
      </div>
    </ConfirmDialog>
  );
}

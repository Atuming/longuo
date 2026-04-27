import { useState, useEffect, type CSSProperties } from 'react';
import type { CharacterRelationship } from '../../types/relationship';
import type { Character } from '../../types/character';
import type { TimelinePoint } from '../../types/timeline';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Input } from '../ui/Input';
import { TextArea } from '../ui/TextArea';

const styles: Record<string, CSSProperties> = {
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' },
  select: {
    width: '100%', height: 36, borderRadius: 'var(--radius)',
    border: '1px solid var(--color-border)', fontSize: 14, padding: '0 8px',
  },
  sliderRow: { display: 'flex', alignItems: 'center', gap: 8 },
  slider: { flex: 1 },
  sliderValue: { fontSize: 14, fontWeight: 600, color: 'var(--color-accent)', minWidth: 24, textAlign: 'center' as const },
};

const REL_TYPES: { value: CharacterRelationship['relationshipType']; label: string }[] = [
  { value: 'family', label: '亲属' },
  { value: 'friend', label: '朋友' },
  { value: 'enemy', label: '敌人' },
  { value: 'mentor', label: '师徒' },
  { value: 'lover', label: '恋人' },
  { value: 'ally', label: '盟友' },
  { value: 'superior', label: '上下级' },
  { value: 'custom', label: '自定义' },
];

type RelFormData = Omit<CharacterRelationship, 'id'>;

interface RelationshipDialogProps {
  open: boolean;
  initialData?: CharacterRelationship;
  projectId: string;
  sourceCharacterId: string;
  characters: Character[];
  timelinePoints: TimelinePoint[];
  onConfirm: (data: RelFormData) => void;
  onCancel: () => void;
}

export function RelationshipDialog({
  open, initialData, projectId, sourceCharacterId, characters, timelinePoints,
  onConfirm, onCancel,
}: RelationshipDialogProps) {
  const [form, setForm] = useState<RelFormData>({
    projectId, sourceCharacterId, targetCharacterId: '',
    relationshipType: 'friend', customTypeName: '', description: '',
    startTimelinePointId: '', strength: 5,
  });

  const [prevOpen, setPrevOpen] = useState(false);

  useEffect(() => {
    if (open && !prevOpen) {
      setForm(initialData ? { ...initialData } : {
        projectId, sourceCharacterId, targetCharacterId: '',
        relationshipType: 'friend', customTypeName: '', description: '',
        startTimelinePointId: timelinePoints[0]?.id || '', strength: 5,
      });
    }
    setPrevOpen(open);
  }, [open, initialData]); // eslint-disable-line react-hooks/exhaustive-deps

  const otherCharacters = characters.filter((c) => c.id !== sourceCharacterId);

  return (
    <ConfirmDialog
      open={open}
      title={initialData ? '编辑关系' : '创建角色关系'}
      confirmText={initialData ? '保存' : '创建'}
      onConfirm={() => onConfirm(form)}
      onCancel={onCancel}
      confirmDisabled={!form.targetCharacterId || !form.startTimelinePointId}
    >
      <div style={styles.form}>
        <div style={styles.field}>
          <span style={styles.label}>目标角色 *</span>
          <select
            style={styles.select}
            value={form.targetCharacterId}
            onChange={(e) => setForm({ ...form, targetCharacterId: e.target.value })}
          >
            <option value="">请选择角色</option>
            {otherCharacters.map((ch) => (
              <option key={ch.id} value={ch.id}>{ch.name}</option>
            ))}
          </select>
        </div>
        <div style={styles.field}>
          <span style={styles.label}>关系类型</span>
          <select
            style={styles.select}
            value={form.relationshipType}
            onChange={(e) => setForm({ ...form, relationshipType: e.target.value as CharacterRelationship['relationshipType'] })}
          >
            {REL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        {form.relationshipType === 'custom' && (
          <div style={styles.field}>
            <span style={styles.label}>自定义类型名</span>
            <Input value={form.customTypeName || ''} onChange={(e) => setForm({ ...form, customTypeName: e.currentTarget.value })} placeholder="自定义关系类型" />
          </div>
        )}
        <div style={styles.field}>
          <span style={styles.label}>描述</span>
          <TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.currentTarget.value })} placeholder="关系描述" style={{ minHeight: 60 }} />
        </div>
        <div style={styles.field}>
          <span style={styles.label}>起始时间节点 *</span>
          <select
            style={styles.select}
            value={form.startTimelinePointId}
            onChange={(e) => setForm({ ...form, startTimelinePointId: e.target.value })}
          >
            <option value="">请选择时间节点</option>
            {timelinePoints.map((tp) => (
              <option key={tp.id} value={tp.id}>{tp.label}</option>
            ))}
          </select>
        </div>
        <div style={styles.field}>
          <span style={styles.label}>关系强度</span>
          <div style={styles.sliderRow}>
            <input
              type="range" min={1} max={10} step={1}
              value={form.strength}
              onChange={(e) => setForm({ ...form, strength: Number(e.target.value) })}
              style={styles.slider}
            />
            <span style={styles.sliderValue}>{form.strength}</span>
          </div>
        </div>
      </div>
    </ConfirmDialog>
  );
}

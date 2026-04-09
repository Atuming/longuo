import { useState, type CSSProperties } from 'react';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Input } from '../ui/Input';
import { TextArea } from '../ui/TextArea';

const styles: Record<string, CSSProperties> = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-sm)',
  },
  label: {
    font: 'var(--font-body)',
    fontWeight: 500,
    marginBottom: '4px',
    display: 'block',
  },
  required: {
    color: 'var(--color-error)',
    marginLeft: '2px',
  },
};

interface NewProjectDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: (name: string, description: string) => void;
}

export function NewProjectDialog({ open, onCancel, onConfirm }: NewProjectDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleConfirm = () => {
    if (!name.trim()) return;
    onConfirm(name.trim(), description.trim());
    setName('');
    setDescription('');
  };

  const handleCancel = () => {
    setName('');
    setDescription('');
    onCancel();
  };

  return (
    <ConfirmDialog
      open={open}
      title="新建小说项目"
      confirmText="创建"
      cancelText="取消"
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      confirmDisabled={!name.trim()}
    >
      <div style={styles.form}>
        <div>
          <label style={styles.label}>
            项目名称<span style={styles.required}>*</span>
          </label>
          <Input
            placeholder="请输入项目名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label style={styles.label}>项目简介</label>
          <TextArea
            placeholder="请输入项目简介（可选）"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
      </div>
    </ConfirmDialog>
  );
}

import { useState, type CSSProperties } from 'react';
import type { ExportOptions } from '../../types/export';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Input } from '../ui/Input';

const styles: Record<string, CSSProperties> = {
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' },
  radioGroup: { display: 'flex', flexDirection: 'column', gap: 8 },
  radioItem: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' },
  radioDesc: { fontSize: 12, color: 'var(--color-text-secondary)' },
};

const FORMAT_OPTIONS: { value: ExportOptions['format']; label: string; desc: string }[] = [
  { value: 'pdf', label: 'PDF', desc: '适合打印和分享' },
  { value: 'epub', label: 'EPUB', desc: '适合电子书阅读器' },
  { value: 'markdown', label: 'Markdown', desc: '纯文本格式，方便编辑' },
  { value: 'chapter-txt', label: '按章节 TXT', desc: '每章一个 TXT 文件，打包为 ZIP' },
];

interface ExportDialogProps {
  open: boolean;
  projectName: string;
  onConfirm: (options: ExportOptions) => void;
  onCancel: () => void;
}

export function ExportDialog({ open, projectName, onConfirm, onCancel }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportOptions['format']>('markdown');
  const [author, setAuthor] = useState('');

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setFormat('markdown');
      setAuthor('');
    }
  }

  return (
    <ConfirmDialog
      open={open}
      title="导出设置"
      confirmText="导出"
      onConfirm={() => onConfirm({ format, title: projectName, author })}
      onCancel={onCancel}
    >
      <div style={styles.form}>
        <div style={styles.field}>
          <span style={styles.label}>导出格式</span>
          <div style={styles.radioGroup}>
            {FORMAT_OPTIONS.map((opt) => (
              <label key={opt.value} style={styles.radioItem}>
                <input
                  type="radio"
                  name="exportFormat"
                  checked={format === opt.value}
                  onChange={() => setFormat(opt.value)}
                />
                <div>
                  <div>{opt.label}</div>
                  <div style={styles.radioDesc}>{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
        <div style={styles.field}>
          <span style={styles.label}>作者名</span>
          <Input value={author} onChange={(e) => setAuthor(e.currentTarget.value)} placeholder="输入作者名（可选）" />
        </div>
      </div>
    </ConfirmDialog>
  );
}

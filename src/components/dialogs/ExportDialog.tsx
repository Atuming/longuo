import { useState, type CSSProperties } from 'react';
import type { ExportOptions, TypographyOptions } from '../../types/export';
import { DEFAULT_TYPOGRAPHY } from '../../types/export';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Input } from '../ui/Input';

const TYPOGRAPHY_STORAGE_KEY = 'novel-export-typography';

function loadTypography(): TypographyOptions {
  try {
    const raw = localStorage.getItem(TYPOGRAPHY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as TypographyOptions;
      return { ...DEFAULT_TYPOGRAPHY, ...parsed };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_TYPOGRAPHY };
}

function saveTypography(opts: TypographyOptions): void {
  try {
    localStorage.setItem(TYPOGRAPHY_STORAGE_KEY, JSON.stringify(opts));
  } catch { /* ignore */ }
}

const styles: Record<string, CSSProperties> = {
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' },
  radioGroup: { display: 'flex', flexDirection: 'column', gap: 8 },
  radioItem: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' },
  radioDesc: { fontSize: 12, color: 'var(--color-text-secondary)' },
  typographySection: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 },
  typographyGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: 600, color: 'var(--color-text)' },
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

function showTypographyFields(format: ExportOptions['format']): boolean {
  return format === 'pdf' || format === 'epub';
}

export function ExportDialog({ open, projectName, onConfirm, onCancel }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportOptions['format']>('markdown');
  const [author, setAuthor] = useState('');
  const [typography, setTypography] = useState<TypographyOptions>(() => loadTypography());

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setFormat('markdown');
      setAuthor('');
      setTypography(loadTypography());
    }
  }

  const handleConfirm = () => {
    const options: ExportOptions = { format, title: projectName, author };
    if (showTypographyFields(format)) {
      options.typography = typography;
      saveTypography(typography);
    }
    onConfirm(options);
  };

  const updateTypography = <K extends keyof TypographyOptions>(key: K, value: TypographyOptions[K]) => {
    setTypography((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <ConfirmDialog
      open={open}
      title="导出设置"
      confirmText="导出"
      onConfirm={handleConfirm}
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

        {showTypographyFields(format) && (
          <div style={styles.typographySection}>
            <span style={styles.sectionTitle}>排版选项</span>
            <div style={styles.field}>
              <span style={styles.label}>字体名称</span>
              <Input
                value={typography.fontFamily}
                onChange={(e) => updateTypography('fontFamily', e.currentTarget.value)}
                placeholder="宋体"
              />
            </div>
            <div style={styles.typographyGrid}>
              <div style={styles.field}>
                <span style={styles.label}>字号 (pt)</span>
                <Input
                  type="number"
                  min={1}
                  value={typography.fontSize}
                  onChange={(e) => updateTypography('fontSize', Number(e.currentTarget.value) || DEFAULT_TYPOGRAPHY.fontSize)}
                />
              </div>
              <div style={styles.field}>
                <span style={styles.label}>行距</span>
                <Input
                  type="number"
                  min={0.5}
                  step={0.1}
                  value={typography.lineHeight}
                  onChange={(e) => updateTypography('lineHeight', Number(e.currentTarget.value) || DEFAULT_TYPOGRAPHY.lineHeight)}
                />
              </div>
            </div>
            <div style={styles.field}>
              <span style={styles.label}>页边距 (mm)</span>
              <Input
                type="number"
                min={0}
                value={typography.marginMm}
                onChange={(e) => updateTypography('marginMm', Number(e.currentTarget.value) || DEFAULT_TYPOGRAPHY.marginMm)}
              />
            </div>
          </div>
        )}
      </div>
    </ConfirmDialog>
  );
}

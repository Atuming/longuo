import type { CSSProperties, ReactNode } from 'react';
import { Button } from './Button';

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  dialog: {
    background: 'var(--color-card)',
    borderRadius: 'var(--radius)',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    padding: 'var(--spacing-md)',
    minWidth: '400px',
    maxWidth: '520px',
  },
  title: {
    font: 'var(--font-h2)',
    marginBottom: 'var(--spacing-sm)',
  },
  content: {
    fontSize: '14px',
    color: 'var(--color-text-secondary)',
    marginBottom: 'var(--spacing-md)',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 'var(--spacing-xs)',
  },
};

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmDisabled?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel,
  confirmDisabled,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div style={styles.title}>{title}</div>
        <div style={styles.content}>{children}</div>
        <div style={styles.footer}>
          <Button variant="secondary" onClick={onCancel}>{cancelText}</Button>
          <Button variant="primary" onClick={onConfirm} disabled={confirmDisabled}>{confirmText}</Button>
        </div>
      </div>
    </div>
  );
}

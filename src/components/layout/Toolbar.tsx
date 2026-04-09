import type { CSSProperties } from 'react';

const styles: Record<string, CSSProperties> = {
  toolbar: {
    height: 'var(--toolbar-height)',
    background: 'var(--color-primary)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 var(--spacing-sm)',
    gap: 'var(--spacing-sm)',
    color: '#FFFFFF',
    fontSize: '14px',
    flexShrink: 0,
  },
  title: {
    font: 'var(--font-h2)',
    color: '#FFFFFF',
  },
};

interface ToolbarProps {
  children?: React.ReactNode;
}

export function Toolbar({ children }: ToolbarProps) {
  return (
    <header style={styles.toolbar}>
      {children}
    </header>
  );
}

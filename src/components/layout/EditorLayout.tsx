import type { CSSProperties, ReactNode } from 'react';

const styles: Record<string, CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  sidebar: {
    width: 'var(--sidebar-width)',
    minWidth: 'var(--sidebar-width)',
    background: 'var(--color-card)',
    borderRight: '1px solid var(--color-border)',
    overflow: 'auto',
  },
  main: {
    flex: 1,
    minWidth: '720px',
    overflow: 'auto',
    background: 'var(--color-card)',
  },
  panel: {
    width: 'var(--panel-width)',
    minWidth: 'var(--panel-width)',
    background: 'var(--color-card)',
    borderLeft: '1px solid var(--color-border)',
    overflow: 'auto',
  },
};

interface EditorLayoutProps {
  toolbar?: ReactNode;
  sidebar?: ReactNode;
  children?: ReactNode;
  panel?: ReactNode;
}

export function EditorLayout({ toolbar, sidebar, children, panel }: EditorLayoutProps) {
  return (
    <div style={styles.wrapper}>
      {toolbar}
      <div style={styles.body}>
        <aside style={styles.sidebar}>{sidebar}</aside>
        <main style={styles.main}>{children}</main>
        <aside style={styles.panel}>{panel}</aside>
      </div>
    </div>
  );
}

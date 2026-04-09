import { useState, type CSSProperties, type ReactNode } from 'react';

export type SidebarTabKey = 'outline' | 'characters' | 'world' | 'timeline' | 'plot';

const TAB_LABELS: { key: SidebarTabKey; label: string }[] = [
  { key: 'outline', label: '大纲' },
  { key: 'characters', label: '角色' },
  { key: 'world', label: '世界观' },
  { key: 'timeline', label: '时间线' },
  { key: 'plot', label: '情节线索' },
];

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  tabBar: {
    display: 'flex',
    height: 40,
    minHeight: 40,
    borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-card)',
  },
  tab: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    color: 'var(--color-text-secondary)',
    borderBottom: '2px solid transparent',
    background: 'none',
    border: 'none',
    borderBottomWidth: 2,
    borderBottomStyle: 'solid',
    borderBottomColor: 'transparent',
    padding: 0,
    transition: 'color 0.15s',
  },
  tabActive: {
    color: '#3182CE',
    borderBottomColor: '#3182CE',
  },
  content: {
    flex: 1,
    overflow: 'auto',
  },
  footer: {
    borderTop: '1px solid var(--color-border)',
    padding: 'var(--spacing-xs)',
    background: 'var(--color-card)',
  },
};

interface SidebarTabsProps {
  children: (activeTab: SidebarTabKey) => ReactNode;
  footer?: (activeTab: SidebarTabKey) => ReactNode;
}

export function SidebarTabs({ children, footer }: SidebarTabsProps) {
  const [activeTab, setActiveTab] = useState<SidebarTabKey>('outline');

  return (
    <div style={styles.container}>
      <div style={styles.tabBar}>
        {TAB_LABELS.map(({ key, label }) => (
          <button
            key={key}
            style={{
              ...styles.tab,
              ...(activeTab === key ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={styles.content}>{children(activeTab)}</div>
      {footer && <div style={styles.footer}>{footer(activeTab)}</div>}
    </div>
  );
}

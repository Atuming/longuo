import { useState, useEffect, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, showToast } from '../components/ui';
import { NewProjectDialog } from '../components/dialogs/NewProjectDialog';
import type { ProjectStore, RecentProject } from '../types';

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100%',
    background: 'var(--color-bg)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 var(--spacing-lg)',
    height: '60px',
    background: 'var(--color-card)',
    borderBottom: '1px solid var(--color-border)',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-xs)',
  },
  logoIcon: {
    width: '28px',
    height: '28px',
    borderRadius: 'var(--radius)',
    objectFit: 'contain' as const,
  },
  logoText: {
    font: 'var(--font-h2)',
    color: 'var(--color-text)',
  },
  headerActions: {
    display: 'flex',
    gap: 'var(--spacing-xs)',
  },
  content: {
    maxWidth: '960px',
    margin: '0 auto',
    padding: 'var(--spacing-lg)',
  },
  sectionTitle: {
    font: 'var(--font-h1)',
    marginBottom: 'var(--spacing-md)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 'var(--spacing-sm)',
  },
  card: {
    cursor: 'pointer',
    position: 'relative' as const,
    transition: 'box-shadow 0.15s',
  },
  cardName: {
    font: 'var(--font-h2)',
    marginBottom: '6px',
  },
  cardDesc: {
    font: 'var(--font-body)',
    color: 'var(--color-text-secondary)',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden',
    marginBottom: 'var(--spacing-xs)',
  },
  cardMeta: {
    font: 'var(--font-small)',
    color: 'var(--color-text-secondary)',
    display: 'flex',
    justifyContent: 'space-between',
  },
  cardActions: {
    position: 'absolute' as const,
    top: 'var(--spacing-xs)',
    right: 'var(--spacing-xs)',
    display: 'flex',
    gap: '4px',
    opacity: 0,
    transition: 'opacity 0.15s',
  },
  iconBtn: {
    width: '28px',
    height: '28px',
    border: '1px solid var(--color-border)',
    borderRadius: '4px',
    background: 'var(--color-card)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    color: 'var(--color-text-secondary)',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 0',
    color: 'var(--color-text-secondary)',
    gap: 'var(--spacing-sm)',
  },
  emptyIcon: {
    fontSize: '48px',
    opacity: 0.3,
  },
  emptyText: {
    font: 'var(--font-body)',
  },
};

interface ProjectListPageProps {
  projectStore: ProjectStore;
}

export function ProjectListPage({ projectStore }: ProjectListPageProps) {
  const navigate = useNavigate();
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);

  useEffect(() => {
    setRecentProjects(projectStore.getRecentProjects());
  }, [projectStore]);

  const handleCreate = () => {
    setShowNewDialog(true);
  };

  const handleCreateConfirm = async (name: string, description: string) => {
    try {
      await projectStore.createProject(name, description);
      setShowNewDialog(false);
      navigate('/editor');
    } catch {
      showToast('error', '创建项目失败，请重试');
    }
  };

  const handleOpen = async () => {
    try {
      await projectStore.openProject();
      navigate('/editor');
    } catch {
      // User cancelled or error — silently ignore
    }
  };

  const handleOpenRecent = async (filePath: string) => {
    try {
      await projectStore.openRecentProject(filePath);
      navigate('/editor');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'HANDLE_NOT_FOUND' || msg === 'PERMISSION_DENIED') {
        // 句柄丢失或权限被拒，回退到文件选择器
        showToast('warning', '需要重新选择文件');
        try {
          await projectStore.openProject();
          navigate('/editor');
        } catch {
          // 用户取消
        }
      }
      // 其他错误静默忽略（用户取消等）
    }
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logo}>
          <img src="/logo.png" alt="火龙果编辑器" style={styles.logoIcon} />
          <span style={styles.logoText}>火龙果编辑器</span>
        </div>
        <div style={styles.headerActions}>
          <Button variant="primary" onClick={handleCreate}>新建项目</Button>
          <Button variant="secondary" onClick={handleOpen}>打开项目</Button>
        </div>
      </header>

      {/* Content */}
      <div style={styles.content}>
        {recentProjects.length > 0 ? (
          <>
            <h2 style={styles.sectionTitle}>最近项目</h2>
            <div style={styles.grid}>
              {recentProjects.map((project) => (
                <Card
                  key={project.filePath}
                  style={{
                    ...styles.card,
                    boxShadow: hoveredCard === project.filePath
                      ? '0 4px 12px rgba(0,0,0,0.12)'
                      : 'var(--shadow-card)',
                  }}
                  onMouseEnter={() => setHoveredCard(project.filePath)}
                  onMouseLeave={() => setHoveredCard(null)}
                  onClick={() => handleOpenRecent(project.filePath)}
                >
                  <div style={styles.cardName}>{project.name}</div>
                  <div style={styles.cardMeta}>
                    <span>{formatDate(project.lastOpenedAt)}</span>
                  </div>
                  {/* Hover actions */}
                  <div style={{
                    ...styles.cardActions,
                    opacity: hoveredCard === project.filePath ? 1 : 0,
                  }}>
                    <button style={styles.iconBtn} title="打开" onClick={(e) => { e.stopPropagation(); handleOpenRecent(project.filePath); }}>📂</button>
                    <button style={styles.iconBtn} title="删除" onClick={(e) => { e.stopPropagation(); }}>🗑</button>
                  </div>
                </Card>
              ))}
            </div>
          </>
        ) : (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>📝</div>
            <div style={styles.emptyText}>暂无项目，点击新建开始写作</div>
            <Button variant="primary" onClick={handleCreate}>新建项目</Button>
          </div>
        )}
      </div>

      {/* New Project Dialog */}
      <NewProjectDialog
        open={showNewDialog}
        onCancel={() => setShowNewDialog(false)}
        onConfirm={handleCreateConfirm}
      />
    </div>
  );
}

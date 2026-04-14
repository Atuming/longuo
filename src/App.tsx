import React, { Suspense, useMemo } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ToastContainer, ErrorBoundary } from './components/ui';
import { ProjectListPage } from './pages/ProjectListPage';
import { createFileManager } from './lib/file-manager';
import { createProjectStore } from './stores/project-store';
import type { CSSProperties } from 'react';

const LazyEditorPage = React.lazy(() => import('./pages/EditorPage'));

const loadingStyles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    color: 'var(--color-text-secondary, #666)',
    fontSize: 16,
  },
};

function LoadingIndicator() {
  return <div style={loadingStyles.container}>加载中...</div>;
}

function App() {
  const projectStore = useMemo(() => {
    const fileManager = createFileManager();
    return createProjectStore(fileManager);
  }, []);

  return (
    <HashRouter>
      <ToastContainer />
      <ErrorBoundary fallbackTitle="页面加载失败">
        <Routes>
          <Route path="/" element={<ProjectListPage projectStore={projectStore} />} />
          <Route path="/editor" element={
            <Suspense fallback={<LoadingIndicator />}>
              <LazyEditorPage projectStore={projectStore} />
            </Suspense>
          } />
        </Routes>
      </ErrorBoundary>
    </HashRouter>
  );
}

export default App;

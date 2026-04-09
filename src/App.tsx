import { useMemo } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ToastContainer } from './components/ui';
import { ProjectListPage } from './pages/ProjectListPage';
import { EditorPage } from './pages/EditorPage';
import { createFileManager } from './lib/file-manager';
import { createProjectStore } from './stores/project-store';

function App() {
  const projectStore = useMemo(() => {
    const fileManager = createFileManager();
    return createProjectStore(fileManager);
  }, []);

  return (
    <HashRouter>
      <ToastContainer />
      <Routes>
        <Route path="/" element={<ProjectListPage projectStore={projectStore} />} />
        <Route path="/editor" element={<EditorPage projectStore={projectStore} />} />
      </Routes>
    </HashRouter>
  );
}

export default App;

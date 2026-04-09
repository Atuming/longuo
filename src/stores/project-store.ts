import type { ProjectStore } from '../types/stores';
import type { FileManager } from '../types/engines';
import type { NovelFileData, NovelProject, RecentProject } from '../types/project';
import { saveHandle, getHandle } from '../lib/handle-store';
import { deserialize } from '../lib/file-manager';

const RECENT_PROJECTS_KEY = 'novel-assistant-recent-projects';
const MAX_RECENT_PROJECTS = 10;

function createEmptyFileData(project: NovelProject): NovelFileData {
  return {
    version: 1,
    project,
    chapters: [],
    characters: [],
    characterSnapshots: [],
    relationships: [],
    timelinePoints: [],
    worldEntries: [],
    plotThreads: [],
  };
}

/**
 * Create a ProjectStore backed by a FileManager.
 *
 * The store keeps the current project data and file handle in memory.
 * Recent projects are persisted to localStorage.
 */
export function createProjectStore(fileManager: FileManager): ProjectStore {
  let currentData: NovelFileData | null = null;
  let currentHandle: FileSystemFileHandle | null = null;

  /** Read the recent-projects list from localStorage. */
  function readRecentProjects(): RecentProject[] {
    try {
      const raw = localStorage.getItem(RECENT_PROJECTS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Array<{ name: string; filePath: string; lastOpenedAt: string }>;
      return parsed.map((r) => ({
        name: r.name,
        filePath: r.filePath,
        lastOpenedAt: new Date(r.lastOpenedAt),
      }));
    } catch {
      return [];
    }
  }

  /** Persist the recent-projects list to localStorage. */
  function writeRecentProjects(list: RecentProject[]): void {
    const serializable = list.map((r) => ({
      name: r.name,
      filePath: r.filePath,
      lastOpenedAt: r.lastOpenedAt.toISOString(),
    }));
    localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(serializable));
  }

  /** Add or bump a project to the top of the recent list. */
  function addToRecentProjects(name: string, filePath: string): void {
    let list = readRecentProjects();
    // Remove existing entry with the same filePath
    list = list.filter((r) => r.filePath !== filePath);
    // Prepend new entry
    list.unshift({ name, filePath, lastOpenedAt: new Date() });
    // Trim to max
    if (list.length > MAX_RECENT_PROJECTS) {
      list = list.slice(0, MAX_RECENT_PROJECTS);
    }
    writeRecentProjects(list);
  }

  return {
    async createProject(name: string, description: string): Promise<NovelProject> {
      const project: NovelProject = {
        id: crypto.randomUUID(),
        name,
        description,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const data = createEmptyFileData(project);
      const handle = await fileManager.createNewFile(data);

      currentData = data;
      currentHandle = handle;

      addToRecentProjects(project.name, handle.name);
      saveHandle(handle.name, handle).catch(() => {});

      return project;
    },

    async openProject(): Promise<NovelProject> {
      const { handle, data } = await fileManager.openFile();

      currentData = data;
      currentHandle = handle;

      addToRecentProjects(data.project.name, handle.name);
      saveHandle(handle.name, handle).catch(() => {});

      return data.project;
    },

    async openRecentProject(filePath: string): Promise<NovelProject> {
      const handle = await getHandle(filePath);
      if (!handle) {
        throw new Error('HANDLE_NOT_FOUND');
      }

      // 请求权限
      const permission = await (handle as FileSystemFileHandle & { requestPermission: (opts: { mode: string }) => Promise<string> }).requestPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        throw new Error('PERMISSION_DENIED');
      }

      const file = await handle.getFile();
      const text = await file.text();
      const data = deserialize(text);

      currentData = data;
      currentHandle = handle;

      addToRecentProjects(data.project.name, handle.name);

      return data.project;
    },

    async saveProject(): Promise<void> {
      if (!currentData || !currentHandle) {
        throw new Error('没有打开的项目，无法保存');
      }

      currentData.project.updatedAt = new Date();
      await fileManager.saveFile(currentHandle, currentData);
    },

    async closeProject(): Promise<void> {
      currentData = null;
      currentHandle = null;
    },

    getCurrentProject(): NovelProject | null {
      return currentData?.project ?? null;
    },

    getRecentProjects(): RecentProject[] {
      return readRecentProjects();
    },

    async updateProject(updates: Partial<Pick<NovelProject, 'name' | 'description'>>): Promise<void> {
      if (!currentData) {
        throw new Error('没有打开的项目，无法更新');
      }

      if (updates.name !== undefined) {
        currentData.project.name = updates.name;
      }
      if (updates.description !== undefined) {
        currentData.project.description = updates.description;
      }
      currentData.project.updatedAt = new Date();
    },
  };
}



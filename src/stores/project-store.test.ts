import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createProjectStore } from './project-store';
import type { FileManager } from '../types/engines';
import type { NovelFileData, NovelProject } from '../types/project';

const RECENT_PROJECTS_KEY = 'novel-assistant-recent-projects';

/** Build a minimal mock FileManager. */
function mockFileManager(overrides: Partial<FileManager> = {}): FileManager {
  return {
    isSupported: () => true,
    createNewFile: vi.fn(async (data: NovelFileData) => ({ name: `${data.project.name}.novel` }) as unknown as FileSystemFileHandle),
    openFile: vi.fn(async () => {
      throw new Error('not configured');
    }),
    saveFile: vi.fn(async () => {}),
    ...overrides,
  };
}

function sampleFileData(project: Partial<NovelProject> = {}): NovelFileData {
  return {
    version: 1,
    project: {
      id: 'proj-1',
      name: '测试小说',
      description: '一段描述',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      ...project,
    },
    chapters: [],
    characters: [],
    characterSnapshots: [],
    relationships: [],
    timelinePoints: [],
    worldEntries: [],
    plotThreads: [],
  };
}

describe('ProjectStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // --- createProject ---
  describe('createProject', () => {
    it('creates a project with the given name and description', async () => {
      const fm = mockFileManager();
      const store = createProjectStore(fm);

      const project = await store.createProject('我的小说', '一段简介');

      expect(project.name).toBe('我的小说');
      expect(project.description).toBe('一段简介');
      expect(project.id).toBeTruthy();
      expect(project.createdAt).toBeInstanceOf(Date);
    });

    it('calls fileManager.createNewFile with correct data', async () => {
      const fm = mockFileManager();
      const store = createProjectStore(fm);

      await store.createProject('小说A', '描述A');

      expect(fm.createNewFile).toHaveBeenCalledTimes(1);
      const arg = (fm.createNewFile as ReturnType<typeof vi.fn>).mock.calls[0][0] as NovelFileData;
      expect(arg.project.name).toBe('小说A');
      expect(arg.chapters).toEqual([]);
    });

    it('sets the current project after creation', async () => {
      const fm = mockFileManager();
      const store = createProjectStore(fm);

      const project = await store.createProject('小说B', '');
      expect(store.getCurrentProject()).toEqual(project);
    });

    it('adds the project to recent projects', async () => {
      const fm = mockFileManager();
      const store = createProjectStore(fm);

      await store.createProject('小说C', '');
      const recent = store.getRecentProjects();
      expect(recent).toHaveLength(1);
      expect(recent[0].name).toBe('小说C');
    });
  });


  // --- openProject ---
  describe('openProject', () => {
    it('loads project data from file', async () => {
      const data = sampleFileData();
      const handle = { name: '测试小说.novel' } as unknown as FileSystemFileHandle;
      const fm = mockFileManager({
        openFile: vi.fn(async () => ({ handle, data })),
      });
      const store = createProjectStore(fm);

      const project = await store.openProject();

      expect(project.name).toBe('测试小说');
      expect(store.getCurrentProject()).toEqual(data.project);
    });

    it('adds the opened project to recent projects', async () => {
      const data = sampleFileData();
      const handle = { name: '测试小说.novel' } as unknown as FileSystemFileHandle;
      const fm = mockFileManager({
        openFile: vi.fn(async () => ({ handle, data })),
      });
      const store = createProjectStore(fm);

      await store.openProject();
      const recent = store.getRecentProjects();
      expect(recent).toHaveLength(1);
      expect(recent[0].name).toBe('测试小说');
      expect(recent[0].filePath).toBe('测试小说.novel');
    });
  });

  // --- saveProject ---
  describe('saveProject', () => {
    it('saves the current data via fileManager', async () => {
      const fm = mockFileManager();
      const store = createProjectStore(fm);

      await store.createProject('小说D', '');
      await store.saveProject();

      expect(fm.saveFile).toHaveBeenCalledTimes(1);
    });

    it('updates updatedAt on save', async () => {
      const fm = mockFileManager();
      const store = createProjectStore(fm);

      const project = await store.createProject('小说E', '');
      const before = project.updatedAt;

      // Small delay to ensure Date differs
      await new Promise((r) => setTimeout(r, 5));
      await store.saveProject();

      const current = store.getCurrentProject()!;
      expect(current.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('throws when no project is open', async () => {
      const fm = mockFileManager();
      const store = createProjectStore(fm);

      await expect(store.saveProject()).rejects.toThrow('没有打开的项目');
    });
  });

  // --- closeProject ---
  describe('closeProject', () => {
    it('clears the current project', async () => {
      const fm = mockFileManager();
      const store = createProjectStore(fm);

      await store.createProject('小说F', '');
      expect(store.getCurrentProject()).not.toBeNull();

      await store.closeProject();
      expect(store.getCurrentProject()).toBeNull();
    });
  });

  // --- updateProject ---
  describe('updateProject', () => {
    it('updates name and description', async () => {
      const fm = mockFileManager();
      const store = createProjectStore(fm);

      await store.createProject('旧名', '旧描述');
      await store.updateProject({ name: '新名', description: '新描述' });

      const p = store.getCurrentProject()!;
      expect(p.name).toBe('新名');
      expect(p.description).toBe('新描述');
    });

    it('updates only provided fields', async () => {
      const fm = mockFileManager();
      const store = createProjectStore(fm);

      await store.createProject('名字', '描述');
      await store.updateProject({ name: '改名' });

      const p = store.getCurrentProject()!;
      expect(p.name).toBe('改名');
      expect(p.description).toBe('描述');
    });

    it('throws when no project is open', async () => {
      const fm = mockFileManager();
      const store = createProjectStore(fm);

      await expect(store.updateProject({ name: 'x' })).rejects.toThrow('没有打开的项目');
    });
  });

  // --- getRecentProjects / localStorage ---
  describe('recent projects', () => {
    it('returns empty array when localStorage is empty', () => {
      const fm = mockFileManager();
      const store = createProjectStore(fm);
      expect(store.getRecentProjects()).toEqual([]);
    });

    it('limits to 10 entries', async () => {
      const fm = mockFileManager({
        createNewFile: vi.fn(async (data: NovelFileData) => {
          return { name: `${data.project.name}.novel` } as unknown as FileSystemFileHandle;
        }),
      });
      const store = createProjectStore(fm);

      for (let i = 0; i < 12; i++) {
        await store.createProject(`小说${i}`, '');
      }

      const recent = store.getRecentProjects();
      expect(recent).toHaveLength(10);
      // Most recent first
      expect(recent[0].name).toBe('小说11');
    });

    it('bumps existing entry to top on re-open', async () => {
      const fm = mockFileManager();
      const store = createProjectStore(fm);

      // Create two projects
      await store.createProject('A', '');
      await store.createProject('B', '');

      // Re-open A
      const dataA = sampleFileData({ name: 'A' });
      const handleA = { name: 'A.novel' } as unknown as FileSystemFileHandle;
      const store2 = createProjectStore(
        mockFileManager({ openFile: vi.fn(async () => ({ handle: handleA, data: dataA })) }),
      );
      await store2.openProject();

      const recent = store2.getRecentProjects();
      expect(recent[0].name).toBe('A');
    });

    it('handles corrupted localStorage gracefully', () => {
      localStorage.setItem(RECENT_PROJECTS_KEY, 'not-json!!!');
      const fm = mockFileManager();
      const store = createProjectStore(fm);
      expect(store.getRecentProjects()).toEqual([]);
    });
  });
});

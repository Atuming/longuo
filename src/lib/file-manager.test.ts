import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFileManager, serialize, deserialize } from './file-manager';
import type { NovelFileData } from '../types/project';

/** Helper: build a minimal valid NovelFileData */
function makeFileData(overrides?: Partial<NovelFileData>): NovelFileData {
  return {
    version: 1,
    project: {
      id: 'p1',
      name: '测试小说',
      description: '一个测试项目',
      createdAt: new Date('2024-01-15T08:00:00.000Z'),
      updatedAt: new Date('2024-06-20T12:30:00.000Z'),
    },
    chapters: [],
    characters: [],
    characterSnapshots: [],
    relationships: [],
    timelinePoints: [],
    worldEntries: [],
    plotThreads: [],
    ...overrides,
  };
}

// ─── serialize / deserialize ────────────────────────────────────────

describe('serialize / deserialize', () => {
  it('should round-trip NovelFileData preserving all fields', () => {
    const data = makeFileData();
    const json = serialize(data);
    const restored = deserialize(json);

    expect(restored.version).toBe(data.version);
    expect(restored.project.id).toBe(data.project.id);
    expect(restored.project.name).toBe(data.project.name);
    expect(restored.chapters).toEqual(data.chapters);
  });

  it('should revive Date fields on project', () => {
    const data = makeFileData();
    const json = serialize(data);
    const restored = deserialize(json);

    expect(restored.project.createdAt).toBeInstanceOf(Date);
    expect(restored.project.updatedAt).toBeInstanceOf(Date);
    expect(restored.project.createdAt.getTime()).toBe(data.project.createdAt.getTime());
    expect(restored.project.updatedAt.getTime()).toBe(data.project.updatedAt.getTime());
  });

  it('should preserve optional aiConfig when present', () => {
    const data = makeFileData({
      aiConfig: {
        providers: [],
        activeProviderId: null,
        promptTemplates: [],
        activeTemplateId: null,
        defaultTemplate: {
          id: 'default',
          name: '默认模板',
          systemPrompt: 'sys',
          userPromptTemplate: 'user',
        },
      },
    });
    const restored = deserialize(serialize(data));
    expect(restored.aiConfig).toEqual(data.aiConfig);
  });

  it('should preserve optional tagData when present', () => {
    const data = makeFileData({
      tagData: {
        tags: [
          { id: 'tag-1', projectId: 'p1', name: '草稿', color: '#A0AEC0' },
          { id: 'tag-2', projectId: 'p1', name: '已完稿', color: '#48BB78' },
        ],
        chapterTagMap: {
          'ch-1': ['tag-1', 'tag-2'],
          'ch-2': ['tag-1'],
        },
      },
    });
    const restored = deserialize(serialize(data));
    expect(restored.tagData).toEqual(data.tagData);
  });

  it('should handle old project files without tagData (backward compatibility)', () => {
    const data = makeFileData();
    // Ensure tagData is not set
    delete (data as Record<string, unknown>)['tagData'];
    const json = serialize(data);
    const restored = deserialize(json);
    expect(restored.tagData).toBeUndefined();
  });

  it('should throw on invalid JSON', () => {
    expect(() => deserialize('not json')).toThrow();
  });
});

// ─── createFileManager ──────────────────────────────────────────────

describe('createFileManager', () => {
  // Shared mock helpers
  let mockWritable: { write: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };

  function mockHandle(fileContent?: string): FileSystemFileHandle {
    return {
      createWritable: vi.fn().mockResolvedValue(mockWritable),
      getFile: vi.fn().mockResolvedValue({
        text: vi.fn().mockResolvedValue(fileContent ?? ''),
      }),
    } as unknown as FileSystemFileHandle;
  }

  beforeEach(() => {
    mockWritable = {
      write: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
  });

  // ── isSupported ──

  describe('isSupported', () => {
    it('should return true when File System Access API is available', () => {
      // jsdom doesn't have these by default, so we stub them
      vi.stubGlobal('showSaveFilePicker', vi.fn());
      vi.stubGlobal('showOpenFilePicker', vi.fn());

      const fm = createFileManager();
      expect(fm.isSupported()).toBe(true);

      vi.unstubAllGlobals();
    });

    it('should return false when showSaveFilePicker is missing', () => {
      // In jsdom, these globals don't exist by default
      const fm = createFileManager();
      // Remove if they were stubbed
      if ('showSaveFilePicker' in window) {
        delete (window as unknown as Record<string, unknown>)['showSaveFilePicker'];
      }
      if ('showOpenFilePicker' in window) {
        delete (window as unknown as Record<string, unknown>)['showOpenFilePicker'];
      }
      expect(fm.isSupported()).toBe(false);
    });
  });

  // ── createNewFile ──

  describe('createNewFile', () => {
    it('should call showSaveFilePicker and write serialized data', async () => {
      const data = makeFileData();
      const handle = mockHandle();

      vi.stubGlobal('showSaveFilePicker', vi.fn().mockResolvedValue(handle));

      const fm = createFileManager();
      const result = await fm.createNewFile(data);

      expect(window.showSaveFilePicker).toHaveBeenCalledWith(
        expect.objectContaining({
          suggestedName: '测试小说.novel',
        }),
      );
      expect(mockWritable.write).toHaveBeenCalledWith(serialize(data));
      expect(mockWritable.close).toHaveBeenCalled();
      expect(result).toBe(handle);

      vi.unstubAllGlobals();
    });

    it('should propagate AbortError when user cancels', async () => {
      const abort = new DOMException('User cancelled', 'AbortError');
      vi.stubGlobal('showSaveFilePicker', vi.fn().mockRejectedValue(abort));

      const fm = createFileManager();
      await expect(fm.createNewFile(makeFileData())).rejects.toThrow(abort);

      vi.unstubAllGlobals();
    });

    it('should close writable even if write fails', async () => {
      const handle = mockHandle();
      mockWritable.write.mockRejectedValue(new Error('disk full'));
      vi.stubGlobal('showSaveFilePicker', vi.fn().mockResolvedValue(handle));

      const fm = createFileManager();
      await expect(fm.createNewFile(makeFileData())).rejects.toThrow('disk full');
      expect(mockWritable.close).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });
  });

  // ── openFile ──

  describe('openFile', () => {
    it('should read and deserialize a .novel file', async () => {
      const data = makeFileData();
      const json = serialize(data);
      const handle = mockHandle(json);

      vi.stubGlobal('showOpenFilePicker', vi.fn().mockResolvedValue([handle]));

      const fm = createFileManager();
      const result = await fm.openFile();

      expect(result.handle).toBe(handle);
      expect(result.data.project.name).toBe('测试小说');
      expect(result.data.project.createdAt).toBeInstanceOf(Date);

      vi.unstubAllGlobals();
    });

    it('should throw a friendly error on invalid file content', async () => {
      const handle = mockHandle('this is not json');
      vi.stubGlobal('showOpenFilePicker', vi.fn().mockResolvedValue([handle]));

      const fm = createFileManager();
      await expect(fm.openFile()).rejects.toThrow('文件格式错误');

      vi.unstubAllGlobals();
    });

    it('should propagate AbortError when user cancels', async () => {
      const abort = new DOMException('User cancelled', 'AbortError');
      vi.stubGlobal('showOpenFilePicker', vi.fn().mockRejectedValue(abort));

      const fm = createFileManager();
      await expect(fm.openFile()).rejects.toThrow(abort);

      vi.unstubAllGlobals();
    });
  });

  // ── saveFile ──

  describe('saveFile', () => {
    it('should write serialized data to existing handle', async () => {
      const data = makeFileData();
      const handle = mockHandle();

      const fm = createFileManager();
      await fm.saveFile(handle, data);

      expect(mockWritable.write).toHaveBeenCalledWith(serialize(data));
      expect(mockWritable.close).toHaveBeenCalled();
    });

    it('should close writable even if write fails', async () => {
      const handle = mockHandle();
      mockWritable.write.mockRejectedValue(new Error('permission denied'));

      const fm = createFileManager();
      await expect(fm.saveFile(handle, makeFileData())).rejects.toThrow('permission denied');
      expect(mockWritable.close).toHaveBeenCalled();
    });
  });
});

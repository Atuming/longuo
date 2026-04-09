import type { FileManager, } from '../types/engines';
import type { NovelFileData } from '../types/project';

/** File type filter for .novel files */
const NOVEL_FILE_TYPE: FilePickerAcceptType = {
  description: '小说项目文件',
  accept: { 'application/json': ['.novel'] },
};

/**
 * Serialize NovelFileData to JSON string.
 * Date objects are converted to ISO strings automatically by JSON.stringify.
 */
function serialize(data: NovelFileData): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Deserialize JSON string to NovelFileData.
 * Revives `createdAt` and `updatedAt` on the project object back to Date instances.
 */
function deserialize(json: string): NovelFileData {
  const raw = JSON.parse(json) as NovelFileData;

  // Revive Date fields on project
  if (raw.project) {
    raw.project.createdAt = new Date(raw.project.createdAt as unknown as string);
    raw.project.updatedAt = new Date(raw.project.updatedAt as unknown as string);
  }

  return raw;
}

/**
 * Create a concrete FileManager that wraps the File System Access API.
 */
export function createFileManager(): FileManager {
  return {
    isSupported(): boolean {
      return (
        typeof window !== 'undefined' &&
        'showSaveFilePicker' in window &&
        'showOpenFilePicker' in window
      );
    },

    async createNewFile(data: NovelFileData): Promise<FileSystemFileHandle> {
      const handle = await window.showSaveFilePicker({
        suggestedName: `${data.project.name || '未命名小说'}.novel`,
        types: [NOVEL_FILE_TYPE],
      });

      const writable = await handle.createWritable();
      try {
        await writable.write(serialize(data));
      } finally {
        await writable.close();
      }

      return handle;
    },

    async openFile(): Promise<{ handle: FileSystemFileHandle; data: NovelFileData }> {
      const [handle] = await window.showOpenFilePicker({
        types: [NOVEL_FILE_TYPE],
        multiple: false,
      });

      const file = await handle.getFile();
      const text = await file.text();

      let data: NovelFileData;
      try {
        data = deserialize(text);
      } catch {
        throw new Error('文件格式错误：无法解析 .novel 文件内容');
      }

      return { handle, data };
    },

    async saveFile(handle: FileSystemFileHandle, data: NovelFileData): Promise<void> {
      const writable = await handle.createWritable();
      try {
        await writable.write(serialize(data));
      } finally {
        await writable.close();
      }
    },
  };
}

// Export helpers for testing
export { serialize, deserialize };

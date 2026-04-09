/**
 * IndexedDB 存储 FileSystemFileHandle，用于跨会话保留文件访问权限。
 * 浏览器允许将 FileHandle 存入 IndexedDB（结构化克隆），
 * 下次打开时通过 requestPermission 重新获取权限。
 */

const DB_NAME = 'novel-assistant-handles';
const STORE_NAME = 'file-handles';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** 保存 FileHandle，以 filePath（handle.name）为 key */
export async function saveHandle(filePath: string, handle: FileSystemFileHandle): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(handle, filePath);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** 读取 FileHandle */
export async function getHandle(filePath: string): Promise<FileSystemFileHandle | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(filePath);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

/** 删除 FileHandle */
export async function removeHandle(filePath: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(filePath);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

type Attachment = File | Uint8Array | string;
const objectKeys = new WeakMap<File | Uint8Array, string>();
const dataKeys = new Map<string, string>();
export const clearAttachmentKeys = () => dataKeys.clear();

function remember(file: Attachment, key: string) {
  if (typeof file === 'string') dataKeys.set(file, key);
  else objectKeys.set(file, key);
}

function openFiles(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('deedcraft-account-attachments', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function localFiles<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openFiles();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('files', mode);
      const request = operation(tx.objectStore('files'));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error || new Error('Device storage was interrupted.'));
    });
  } finally { db.close(); }
}

export function detachFiles<T>(value: T, files: Map<string, Attachment>): T {
  if (value instanceof File || value instanceof Uint8Array || (typeof value === 'string' && value.startsWith('data:'))) {
    const key = (typeof value === 'string' ? dataKeys.get(value) : objectKeys.get(value)) ?? crypto.randomUUID();
    remember(value, key);
    files.set(key, value);
    return { deviceFile: key } as T;
  }
  if (Array.isArray(value)) return value.map(item => detachFiles(item, files)) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .map(([key, item]) => [key, detachFiles(item, files)])) as T;
  return value;
}

export function attachFiles<T>(value: T, files: Map<string, Attachment>): T {
  if (Array.isArray(value)) return value.map(item => attachFiles(item, files)).filter(item => item !== undefined) as T;
  if (value && typeof value === 'object') {
    if ('deviceFile' in value) {
      const key = String(value.deviceFile);
      const file = files.get(key);
      if (file !== undefined) remember(file, key);
      return file as T;
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, attachFiles(item, files)])) as T;
  }
  return value;
}


import type { SavedRecord } from './types/forms';

type RecordInput = Omit<SavedRecord, 'id' | 'createdAt' | 'updatedAt'>;
type RecordPatch = Partial<Omit<RecordInput, 'formType'>>;
const STORE = 'records';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('deedcraft-saved-applications', 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore, complete: (result: T) => void) => void): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      let result: T;
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(tx.error || new Error('Application storage operation was interrupted.'));
      run(tx.objectStore(STORE), value => { result = value; });
    });
  } finally {
    db.close();
  }
}

export function listSavedApplications() {
  return transaction<SavedRecord[]>('readonly', (store, complete) => {
    const request = store.getAll();
    request.onsuccess = () => complete(request.result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  });
}

export function createSavedApplication(input: RecordInput) {
  const now = new Date().toISOString();
  const record = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
  return transaction<SavedRecord>('readwrite', (store, complete) => {
    store.add(record);
    complete(record);
  });
}

export async function updateSavedApplication(id: string, patch: RecordPatch) {
  const record = await transaction<SavedRecord | undefined>('readwrite', (store, complete) => {
    const request = store.get(id);
    request.onsuccess = () => {
      const previous: SavedRecord | undefined = request.result;
      if (!previous) return;
      const next = { ...previous, ...patch, updatedAt: new Date().toISOString() };
      store.put(next);
      complete(next);
    };
  });
  if (!record) throw new Error('This application is no longer in the saved entries.');
  return record;
}

export const deleteSavedApplication = (id: string) => transaction<void>('readwrite', store => { store.delete(id); });
export const clearSavedApplications = () => transaction<void>('readwrite', store => { store.clear(); });

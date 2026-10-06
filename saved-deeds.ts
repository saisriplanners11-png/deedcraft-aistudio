import type { Draft } from './source-draft';
import type { PlanDocument } from './plan-sketch-types';
import type { PlanDocument as ReferencePlanDocument } from './reference-plan/src/types';
import type { PlanDocument as ExactPlanDocument } from './exact-reference-plan/src/types';
import type { DeedTemplateSource } from './docx';

export type SavedDeed = {
  id: string;
  updatedAt: string;
  claimantNames: string[];
  deedType: string;
  draft: Draft;
  sourceFiles: Record<string, File[]>;
  planDrafts: Record<string, PlanDocument>;
  exactPlanDrafts?: Record<string, ExactPlanDocument>;
  exactPlanSelectedSvgs?: Record<string, string>;
  referencePlanDrafts: Record<string, ReferencePlanDocument>;
  selectedPlanSvgs: Record<string, string>;
  extraPartyRecords: { executant: string[]; claimant: string[] };
  templateMode: 'built-in' | 'custom';
  customTemplate: Extract<DeedTemplateSource, { kind: 'custom' }> | null;
};

const DATABASE = 'deedcraft-saved-deeds';
const STORE = 'deeds';

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error('Browser storage is unavailable.')); return; }
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open saved deed storage.'));
  });
}

function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason: unknown) => void) => void): Promise<T> {
  return database().then(db => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let value: T;
    tx.oncomplete = () => { db.close(); resolve(value); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error('Saved deed storage failed.')); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('Saved deed storage was interrupted.')); };
    run(store, result => { value = result; }, reject);
  }));
}

export const listSavedDeeds = () => transaction<SavedDeed[]>('readonly', (store, resolve, reject) => {
  const request = store.getAll();
  request.onsuccess = () => resolve((request.result as SavedDeed[]).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  request.onerror = () => reject(request.error);
});

export const saveDeed = (deed: SavedDeed) => transaction<void>('readwrite', (store, resolve, reject) => {
  const request = store.put(deed);
  request.onsuccess = () => resolve(undefined);
  request.onerror = () => reject(request.error);
});

export const deleteDeed = (id: string) => transaction<void>('readwrite', (store, resolve, reject) => {
  const request = store.delete(id);
  request.onsuccess = () => resolve(undefined);
  request.onerror = () => reject(request.error);
});

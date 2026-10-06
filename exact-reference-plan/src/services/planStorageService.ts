import { PlanDocument } from '../types';

const DB_NAME = 'DeedCraftExactReferencePlanDB';
const DB_VERSION = 1;
const STORE_NAME = 'saved_plans';
const LOCAL_STORAGE_KEY = 'deedcraft_exact_plans_saved';
const DRAFT_SNAPSHOT_KEY = 'deedcraft_exact_plan_active_draft';

// IndexedDB Helper
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('title', 'title', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Ensure plan structure is properly sanitized
function sanitizePlan(plan: any): PlanDocument {
  return {
    ...plan,
    id: plan.id || `plan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title: plan.title || 'Untitled Registration Plan',
    createdAt: plan.createdAt || new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString().split('T')[0],
    executant: Array.isArray(plan.executant) ? plan.executant : (plan.executant ? [plan.executant] : []),
    claimant: Array.isArray(plan.claimant) ? plan.claimant : (plan.claimant ? [plan.claimant] : []),
  };
}

// Helper to generate a descriptive title with Claimant Name upfront
export function generatePlanTitle(doc: PlanDocument): string {
  const claimants = Array.isArray(doc.claimant) ? doc.claimant : (doc.claimant ? [doc.claimant] : []);
  const validClaimants = claimants
    .filter((c) => c && c.name && c.name.trim())
    .map((c) => c.name.trim().toUpperCase());

  const executants = Array.isArray(doc.executant) ? doc.executant : (doc.executant ? [doc.executant] : []);
  const validExecutants = executants
    .filter((e) => e && e.name && e.name.trim())
    .map((e) => e.name.trim().toUpperCase());

  const p = doc.property || ({} as any);
  const propParts: string[] = [];
  if (p.propertyType) propParts.push(p.propertyType);
  if (p.areaSqYards) propParts.push(`${p.areaSqYards} Sq.Yds`);
  if (p.surveyNo) propParts.push(`Sy.No. ${p.surveyNo}`);
  if (p.plotNo) propParts.push(`Plot ${p.plotNo}`);
  if (p.houseNo) propParts.push(`H.No. ${p.houseNo}`);
  if (p.village) propParts.push(p.village);

  const propSummary = propParts.length > 0 ? propParts.join(' - ') : 'Registration Plan';

  // 1. Claimant Name Priority
  if (validClaimants.length > 0) {
    const claimantStr = validClaimants.join(' & ');
    return `${claimantStr} (Claimant) - ${propSummary}`;
  }

  // 2. Executant Name Secondary
  if (validExecutants.length > 0) {
    const execStr = validExecutants.join(' & ');
    return `${execStr} (Executant) - ${propSummary}`;
  }

  return propSummary;
}

export const planStorageService = {
  // 1. Get all saved plans (Unlimited capacity via IndexedDB with LocalStorage fallback/sync)
  async getAllPlans(): Promise<PlanDocument[]> {
    let plans: PlanDocument[] = [];

    // Try IndexedDB first
    try {
      const db = await openDB();
      plans = await new Promise<PlanDocument[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('IndexedDB read failed, falling back to localStorage:', e);
    }

    // If IndexedDB returned empty, check localStorage and auto-migrate
    if (plans.length === 0) {
      try {
        const local = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) {
            plans = parsed.map(sanitizePlan);
            // Migrate to IndexedDB
            this.syncToIndexedDB(plans).catch(console.error);
          }
        }
      } catch (err) {
        console.error('LocalStorage read error:', err);
      }
    }

    // Sort by updatedAt descending by default
    return plans.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  },

  // 2. Synchronous quick read for initial React states
  getPlansSynchronous(): PlanDocument[] {
    try {
      const local = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) {
          return parsed.map(sanitizePlan);
        }
      }
    } catch {
      // ignore
    }
    return [];
  },

  // 3. Save a plan (Supports unlimited plans, save as new copy, or update existing)
  async savePlan(
    doc: PlanDocument,
    options?: { asNewCopy?: boolean; customTitle?: string }
  ): Promise<{ savedPlan: PlanDocument; totalCount: number }> {
    const isNew = options?.asNewCopy || !doc.id || doc.id.startsWith('sample-');
    const newId = isNew ? `plan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}` : doc.id;
    
    let planTitle = options?.customTitle || doc.title;
    const autoTitle = generatePlanTitle(doc);

    if (!options?.customTitle) {
      const hasGenericTitle =
        !planTitle ||
        planTitle === 'Untitled Registration Plan' ||
        planTitle === 'Registration Plan' ||
        planTitle.startsWith('Registration Plan (') ||
        planTitle.startsWith('R.C.C. Building House') ||
        planTitle.startsWith('Standard Residential Plot') ||
        planTitle.startsWith('Corner Property with') ||
        planTitle.startsWith('Open Place (');

      const claimants = Array.isArray(doc.claimant) ? doc.claimant : (doc.claimant ? [doc.claimant] : []);
      const primaryClaimant = claimants.find((c) => c && c.name && c.name.trim())?.name?.trim();

      // If generic title or if a claimant exists and is not yet in the title
      if (hasGenericTitle || (primaryClaimant && !planTitle.toUpperCase().includes(primaryClaimant.toUpperCase())) || isNew) {
        planTitle = isNew && doc.title && !hasGenericTitle && !doc.id.startsWith('sample-')
          ? `${doc.title} (Copy)`
          : autoTitle;
      }
    }

    const toSave: PlanDocument = {
      ...doc,
      id: newId,
      title: planTitle,
      createdAt: isNew ? new Date().toISOString().split('T')[0] : (doc.createdAt || new Date().toISOString().split('T')[0]),
      updatedAt: new Date().toISOString().split('T')[0],
      executant: Array.isArray(doc.executant) ? doc.executant : (doc.executant ? [doc.executant] : []),
      claimant: Array.isArray(doc.claimant) ? doc.claimant : (doc.claimant ? [doc.claimant] : []),
    };

    // Save to IndexedDB
    try {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(toSave);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('IndexedDB write error:', e);
    }

    // Mirror to LocalStorage (with safety truncate for huge counts if local quota exceeded)
    let allPlans = await this.getAllPlans();
    const existingIdx = allPlans.findIndex(p => p.id === toSave.id);
    if (existingIdx >= 0) {
      allPlans[existingIdx] = toSave;
    } else {
      allPlans = [toSave, ...allPlans];
    }

    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(allPlans));
    } catch (quotaErr) {
      console.warn('LocalStorage quota limit reached, data is safe in IndexedDB unlimited storage:', quotaErr);
      // Keep recent 50 in localStorage for fast sync, full database is safe in IndexedDB
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(allPlans.slice(0, 50)));
      } catch {
        // IDB handles the rest
      }
    }

    return { savedPlan: toSave, totalCount: allPlans.length };
  },

  // 4. Delete a plan
  async deletePlan(id: string): Promise<PlanDocument[]> {
    try {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('IndexedDB delete error:', e);
    }

    const current = await this.getAllPlans();
    const remaining = current.filter(p => p.id !== id);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(remaining));
    } catch {
      // ignore
    }
    return remaining;
  },

  // 5. Duplicate / Clone a plan with 1-click
  async duplicatePlan(id: string): Promise<PlanDocument | null> {
    const all = await this.getAllPlans();
    const target = all.find(p => p.id === id);
    if (!target) return null;

    const cloned: PlanDocument = {
      ...JSON.parse(JSON.stringify(target)),
      id: `plan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: `${target.title || 'Plan'} (Copy)`,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    await this.savePlan(cloned, { asNewCopy: true, customTitle: cloned.title });
    return cloned;
  },

  // 6. Bulk Import plans
  async importPlans(newPlans: PlanDocument[]): Promise<PlanDocument[]> {
    const existing = await this.getAllPlans();
    const existingMap = new Map<string, PlanDocument>(existing.map(p => [p.id, p]));

    for (const plan of newPlans) {
      const sanitized = sanitizePlan(plan);
      existingMap.set(sanitized.id, sanitized);
    }

    const merged = Array.from(existingMap.values()).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

    // Save to IndexedDB
    await this.syncToIndexedDB(merged);

    // Save to LocalStorage
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
    } catch {
      // ignore
    }

    return merged;
  },

  // 7. Internal helper to bulk sync to IndexedDB
  async syncToIndexedDB(plans: PlanDocument[]): Promise<void> {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const p of plans) {
        store.put(p);
      }
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('Sync to IndexedDB failed:', err);
    }
  },

  // 8. Auto Draft Snapshot (Save work in progress instantly)
  saveDraftSnapshot(doc: PlanDocument): void {
    try {
      sessionStorage.setItem(DRAFT_SNAPSHOT_KEY, JSON.stringify(doc));
    } catch {
      // ignore
    }
  },

  getDraftSnapshot(): PlanDocument | null {
    try {
      const raw = sessionStorage.getItem(DRAFT_SNAPSHOT_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return null;
  }
};

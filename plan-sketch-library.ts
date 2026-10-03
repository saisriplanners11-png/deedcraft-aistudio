import type { PlanDocument, PartyDetails } from './plan-sketch-types';

const DB_NAME = 'deedcraft-plan-library';
const STORE = 'plans';
const blankParty = (): PartyDetails => ({ name: '', relation: 'S/o', relativeName: '', age: '', occupation: '', address: '' });

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open the plan library.'));
  });
}

async function transact<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore, done: (value: T) => void) => void): Promise<T> {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    let result: T;
    const transaction = db.transaction(STORE, mode);
    transaction.oncomplete = () => { db.close(); resolve(result); };
    transaction.onerror = () => { db.close(); reject(transaction.error || new Error('Plan library operation failed.')); };
    run(transaction.objectStore(STORE), value => { result = value; });
  });
}

export function validateImportedPlan(value: unknown): PlanDocument {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('A plan must be a JSON object.');
  const source = value as Record<string, any>;
  if (JSON.stringify(value).length > 1_000_000) throw new Error('This plan JSON is too large.');
  if (!source.property || typeof source.property !== 'object' || !source.boundaries || typeof source.boundaries !== 'object')
    throw new Error('Plan property and boundaries are required.');
  if (!['Open Place','House','Plot','Open Plot','Demolished House','Part Open Place','Flat','Commercial Building','Agricultural Land','Other'].includes(source.property.propertyType))
    throw new Error('Property type is invalid.');
  for (const key of ['propertyType','surveyNo','nearHNo','locality','village','mandal','district']) {
    if (typeof source.property[key] !== 'string') throw new Error(`Plan property ${key} is invalid.`);
  }
  for (const key of ['customPropertyType','plotNo','houseNo','houseAuthority','nearAdjacent','locationTemplateType']) {
    if (source.property[key] != null && typeof source.property[key] !== 'string') throw new Error(`Plan property ${key} is invalid.`);
  }
  for (const key of ['areaSqYards','areaSqMtrs']) {
    const value = source.property[key];
    if (value !== '' && (typeof value !== 'number' || !Number.isFinite(value) || value < 0))
      throw new Error(`Plan ${key} is invalid.`);
  }
  for (const side of ['north', 'south', 'east', 'west']) {
    const dim = source.boundaries[`${side}Dim`];
    if (!dim || typeof dim.raw !== 'string' || typeof dim.normalized !== 'number' || !Number.isFinite(dim.normalized) || dim.normalized < 0 || !['Feet','Metres'].includes(dim.unit))
      throw new Error(`The ${side} dimension is invalid.`);
    if (typeof source.boundaries[`${side}Boundary`] !== 'string') throw new Error(`The ${side} boundary is invalid.`);
  }
  if (!Array.isArray(source.boundaries.roadSides)) throw new Error('Road sides must be an array.');
  if (!source.boundaries.roadSides.every((side: unknown) => typeof side === 'string' && ['North','South','East','West','None'].includes(side)))
    throw new Error('Road side names are invalid.');
  if (!['Feet','Metres'].includes(source.boundaries.dimensionUnit) || typeof source.boundaries.roadWidth !== 'string')
    throw new Error('Road width or measurement unit is invalid.');
  if (typeof source.boundaries.cornerProperty !== 'boolean') throw new Error('Corner property setting is invalid.');
  for (const key of ['northRotation','mapRotation','sketchScale','textScale']) {
    const setting = source.boundaries[key];
    if (setting != null && (typeof setting !== 'number' || !Number.isFinite(setting) || Math.abs(setting) > 1000))
      throw new Error(`Drawing setting ${key} is invalid.`);
  }
  for (const key of ['northRoadDirectionLeft','northRoadDirectionRight','southRoadDirectionLeft','southRoadDirectionRight',
    'eastRoadDirectionTop','eastRoadDirectionBottom','westRoadDirectionTop','westRoadDirectionBottom']) {
    if (source.boundaries[key] != null && typeof source.boundaries[key] !== 'string')
      throw new Error(`Road direction ${key} is invalid.`);
  }
  if (source.property.houses != null && (!Array.isArray(source.property.houses) || !source.property.houses.every((house: any) =>
    house && typeof house === 'object' && ['widthRaw','lengthRaw','name','structureType','roofType','houseAuthority','position','setbackNorth','setbackSouth','setbackEast','setbackWest'].every(key => house[key] == null || typeof house[key] === 'string') &&
    ['widthFeet','lengthFeet','plinthAreaSqFt','plinthAreaSqMtrs','plinthAreaSqYds'].every(key => house[key] == null || house[key] === '' || typeof house[key] === 'number' && Number.isFinite(house[key]) && house[key] >= 0))))
    throw new Error('Plan structures are invalid.');
  const executants = Array.isArray(source.executants) ? source.executants : Array.isArray(source.executant) ? source.executant : source.executant ? [source.executant] : [];
  const claimants = Array.isArray(source.claimants) ? source.claimants : Array.isArray(source.claimant) ? source.claimant : source.claimant ? [source.claimant] : [];
  const validParty = (party: any) => party && ['name','relation','relativeName','age','occupation','address'].every(key => typeof party[key] === 'string');
  if (!executants.every(validParty) || !claimants.every(validParty))
    throw new Error('Plan parties are invalid.');
  const now = new Date().toISOString();
  return {
    ...source,
    id: typeof source.id === 'string' && source.id ? source.id : crypto.randomUUID(),
    title: typeof source.title === 'string' && source.title ? source.title : 'Untitled Registration Plan',
    createdAt: typeof source.createdAt === 'string' ? source.createdAt : now,
    updatedAt: now,
    executant: executants[0] || blankParty(), claimant: claimants[0] || blankParty(), executants, claimants,
    witnesses: source.witnesses && typeof source.witnesses.witness1 === 'string' && typeof source.witnesses.witness2 === 'string'
      ? source.witnesses : { witness1: '', witness2: '' },
  } as PlanDocument;
}

export const planSketchLibrary = {
  async list(): Promise<PlanDocument[]> {
    return (await transact<PlanDocument[]>('readonly', (store, done) => {
      const request = store.getAll();
      request.onsuccess = () => done(request.result as PlanDocument[]);
    })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async save(plan: PlanDocument, asCopy = false): Promise<PlanDocument> {
    const valid = validateImportedPlan(plan);
    const now = new Date().toISOString();
    const saved = { ...valid, id: asCopy || valid.id.startsWith('sample-') || valid.id.startsWith('plan-sketch-') ? crypto.randomUUID() : valid.id,
      title: asCopy ? `${valid.title} (Copy)` : valid.title, createdAt: asCopy ? now : valid.createdAt, updatedAt: now };
    await transact<void>('readwrite', (store, done) => { store.put(saved); done(); });
    return saved;
  },
  async remove(id: string): Promise<void> { await transact<void>('readwrite', (store, done) => { store.delete(id); done(); }); },
  async import(value: unknown): Promise<number> {
    const plans = Array.isArray(value) ? value : [value];
    if (!plans.length || plans.length > 1000) throw new Error('The backup must contain 1 to 1000 plans.');
    const valid = plans.map(validateImportedPlan);
    await transact<void>('readwrite', (store, done) => { valid.forEach(plan => store.put(plan)); done(); });
    return valid.length;
  },
};

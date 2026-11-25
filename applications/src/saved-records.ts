import { accountStore } from '../../account';
import type { SavedRecord } from './types/forms';

type RecordInput = Omit<SavedRecord, 'id' | 'createdAt' | 'updatedAt'>;
type RecordPatch = Partial<Omit<RecordInput, 'formType'>>;

const records = accountStore<SavedRecord>('application');
export const listSavedApplications = async () => (await records.list()).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
export async function createSavedApplication(input: RecordInput) {
  const now = new Date().toISOString();
  const record = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
  await records.save(record.id, record);
  return record;
}
export async function updateSavedApplication(id: string, patch: RecordPatch) {
  const previous = (await records.list()).find(record => record.id === id);
  if (!previous) throw new Error('This application no longer exists.');
  const record = { ...previous, ...patch, updatedAt: new Date().toISOString() };
  await records.save(id, record);
  return record;
}
export const deleteSavedApplication = records.remove;
export async function clearSavedApplications() {
  for (const record of await records.list()) await records.remove(record.id);
}

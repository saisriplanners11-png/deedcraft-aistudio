import { expect, it } from 'vitest';
import { createDeedBackup, readDeedBackup } from './deed-backup';
import { newDraft } from './source-draft';
import type { SavedDeed } from './saved-deeds';

function sample(): SavedDeed {
  const draft = newDraft();
  draft.manual['property|primary|boundaryNorth'] = 'North Road';
  return {
    id: draft.id, updatedAt: '2026-11-17T10:00:00.000Z', name: 'Example', claimantNames: ['Asha'], deedType: 'Sale', draft,
    sourceFiles: { evidence: [new File(['source fact'], 'title.txt', { type: 'text/plain', lastModified: 1000 })] },
    planDrafts: {}, referencePlanDrafts: {}, selectedPlanSvgs: {}, extraPartyRecords: { executant: [], claimant: [] },
    templateMode: 'custom', customTemplate: {
      kind: 'custom', name: 'edited.docx', hash: 'test-hash', bytes: new Uint8Array([0, 1, 2, 255]),
      validation: { valid: true, errors: [], detectedPlaceholders: [], omittedPlaceholders: [] },
    },
  };
}

it('moves saved facts, source files and custom Word bytes to another browser', async () => {
  const original = sample();
  const backup = await createDeedBackup([original]);
  const imported = await readDeedBackup(backup, []);
  expect(imported.deeds).toHaveLength(1);
  expect(imported.deeds[0].draft.manual).toEqual(original.draft.manual);
  expect(imported.deeds[0].customTemplate?.bytes).toEqual(original.customTemplate?.bytes);
  expect(imported.deeds[0].sourceFiles.evidence[0]).toBeInstanceOf(File);
  expect(await imported.deeds[0].sourceFiles.evidence[0].text()).toBe('source fact');
  expect(imported.deeds[0].sourceFiles.evidence[0].name).toBe('title.txt');
});

it('preserves both drafts when the same ID has different work', async () => {
  const original = sample();
  const backup = await createDeedBackup([original]);
  const old = { ...original, updatedAt: '2026-11-17T11:00:00.000Z' };
  const duplicate = await readDeedBackup(backup, [old]);
  expect(duplicate.copies).toBe(1);
  expect(duplicate.deeds[0].id).not.toBe(original.id);
  expect(duplicate.deeds[0].draft.id).toBe(duplicate.deeds[0].id);
  expect(duplicate.deeds[0].draft.manual).toEqual(original.draft.manual);
  expect((await readDeedBackup(backup, [original])).skipped).toBe(1);
});

it('rejects an invalid backup before importing any deed', async () => {
  await expect(readDeedBackup(new Blob(['{}']), [])).rejects.toThrow(/supported/);
  const broken = new Blob([JSON.stringify({ format: 'deedcraft-saved-deeds', version: 1, deeds: [{ id: 'incomplete' }] })]);
  await expect(readDeedBackup(broken, [])).rejects.toThrow(/incomplete/);
});

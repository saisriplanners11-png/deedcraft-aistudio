import { describe, expect, it } from 'vitest';
import { appStateFor, draftReducer, fieldKey, newDraft, resolveDraft, type Source } from './source-draft';

describe('new party cards and scoped identity uploads', () => {
  it.each(['executant', 'claimant'] as const)('allows extracted %s names into newly registered cards and preserves explicit corrections', role => {
    let draft = newDraft();
    for (const record of ['primary', 'second']) {
      draft = draftReducer(draft, { type: 'add-party', role, record });
      const source: Source = { id: `id-${record}`, revision: 0, name: 'ID.txt', hash: record, status: 'done', profile: `party:${role}`, assignment: { role, record }, result: { candidates: [
        { id: `name-${record}`, field: role + 'Name', value: `${record} PERSON`, role, record: 'primary', quote: `${record} PERSON`, page: 1, region: 'ID', handwritten: false, historical: false, status: 'accepted' },
      ], plans: [], notes: [] } };
      draft = draftReducer(draft, { type: 'add', source });
    }
    expect(resolveDraft(draft).values[fieldKey(role, 'primary', role + 'Name')]).toBe('PRIMARY PERSON');
    expect(resolveDraft(draft).values[fieldKey(role, 'second', role + 'Name')]).toBe('SECOND PERSON');
    expect(draft.manual[fieldKey(role, 'second', role + 'Name')]).toBeUndefined();
    draft = draftReducer(draft, { type: 'manual', key: fieldKey(role, 'second', role + 'Name'), value: 'MANUAL CORRECTION' });
    const restored = draftReducer(newDraft(), { type: 'load', draft: JSON.parse(JSON.stringify(draft)) });
    expect(resolveDraft(restored).values[fieldKey(role, 'second', role + 'Name')]).toBe('MANUAL CORRECTION');
    expect(appStateFor(restored).form[role + 'Name']).toBe('PRIMARY PERSON');
    const cleared = draftReducer(restored, { type: 'manual', key: fieldKey(role, 'second', role + 'Name'), value: '' });
    expect(resolveDraft(cleared).values[fieldKey(role, 'second', role + 'Name')]).toBe('');
  });
  it('preserves an existing legal capacity when registering a blank primary card', () => {
    const draft = draftReducer(newDraft(), { type: 'manual', key: 'executant|primary|executantPartyType', value: 'Minor' });
    expect(draftReducer(draft, { type: 'add-party', role: 'executant', record: 'primary' }).manual['executant|primary|executantPartyType']).toBe('Minor');
  });
});

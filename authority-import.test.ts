import { describe, expect, it } from 'vitest';
import { applyAuthorityPerson, applyGpaExtraction, cleanAuthorityRead } from './authority-import';
import { appStateFor, draftReducer, newDraft } from './source-draft';
import { emptySaleAuthority, type AuthorityPerson } from './sale-options';

const person = (id: string, role: AuthorityPerson['role'], name: string, patch = {}): AuthorityPerson => ({ id, role, values: { Name: name, Relation: 'W/O', RelativeName: 'PARENT', Aadhaar: '111122223333', Village: 'SOURCE VILLAGE', ...patch }, quote: `${name} is the ${role}`, page: 1, sourceName: 'Synthetic GPA', principalNames: [] });

describe('Authority role extraction and selection', () => {
  it('separates principals and holders, fills defaults from evidence and links represented principals', () => {
    const principal = person('owner', 'principal', 'SYNTHETIC OWNER');
    const attorney = { ...person('agent', 'attorney', 'SYNTHETIC AGENT'), principalNames: ['SYNTHETIC OWNER'] };
    let draft = { ...newDraft(), variantId: 'sale-deed-by-gpa-holder', saleAuthority: { ...emptySaleAuthority(), extractions: [{ id: 'read', documentIds: ['doc'], people: [principal, attorney], details: {}, notes: [] }] } };
    draft = applyAuthorityPerson(draft, attorney, 'attorney', 'agent') as typeof draft;
    draft = applyAuthorityPerson(draft, principal, 'principal', 'primary') as typeof draft;
    expect(appStateFor(draft).form.executantName).toBe('SYNTHETIC OWNER');
    expect(appStateFor(draft).form.executantRelation).toBe('W/O');
    expect(draft.saleAuthority.attorneys[0].values.Name).toBe('SYNTHETIC AGENT');
    expect(draft.saleAuthority.attorneys[0].principalIds).toEqual(['primary']);
    const restored = draftReducer(newDraft(), { type: 'load', draft: JSON.parse(JSON.stringify(draft)) });
    expect(restored.saleAuthority).toEqual(draft.saleAuthority);
    expect(restored.manual).toEqual(draft.manual);
  });
  it('preserves entered details and prevents mixed identities', () => {
    let draft = draftReducer(newDraft(), { type: 'manual', key: 'executant|primary|executantName', value: 'SYNTHETIC OWNER' });
    draft = draftReducer(draft, { type: 'manual', key: 'executant|primary|executantVillage', value: 'MANUAL VILLAGE' });
    draft = applyAuthorityPerson(draft, person('owner', 'principal', 'SYNTHETIC OWNER'), 'principal', 'primary');
    expect(appStateFor(draft).form.executantVillage).toBe('MANUAL VILLAGE');
    expect(() => applyAuthorityPerson(draft, person('other', 'principal', 'OTHER OWNER'), 'principal', 'primary')).toThrow(/different person/);
    expect(() => applyAuthorityPerson(draft, person('owner', 'principal', 'SYNTHETIC OWNER', { Aadhaar: '999988887777' }), 'principal', 'primary')).toThrow(/different identity/);
  });
  it('keeps unknown roles selectable, drops unsupported values and does not treat ID cards as GPA documents', () => {
    const read = cleanAuthorityRead({ kind: 'identity', details: { documentNo: 'AADHAAR-IS-NOT-GPA' }, people: [{ role: 'invented', values: { Name: 'HOLDER', Aadhaar: '123', Dob: '2026-02-31', Pan: 'invalid', arbitrary: 'discard' }, quote: 'HOLDER' }, { role: 'principal', values: { Name: 'NO QUOTE' } }] }, 'ID card', 3);
    expect(read.details).toEqual({});
    expect(read.people).toHaveLength(1);
    expect(read.people[0].role).toBe('unknown');
    expect(read.people[0].values).toEqual({ Name: 'HOLDER' });
    expect(read.people[0].page).toBe(3);
  });
});

describe('Automatic GPA replacement', () => {
  it('replaces old parties, deduplicates pages, fills authority and survives reload', () => {
    let draft = newDraft();
    draft.manual = { 'executant|primary|executantName': 'OLD', 'executant|primary|executantMobile': '9999999999', 'executant|old2|executantName': 'OTHER' };
    draft.sources = [{ id: 'old', name: 'old', hash: '', revision: 0, status: 'done', result: { candidates: [{ id: 'c', role: 'executant', record: 'primary', field: 'executantName', value: 'STALE', quote: 'STALE', page: 1, region: '', handwritten: false, status: 'accepted', historical: false }], plans: [], notes: [] } }];
    const owner = person('one', 'principal', 'OWNER');
    const second = person('two', 'principal', 'SECOND', { Aadhaar: '999988887777' });
    const result = { id: 'read', documentIds: ['doc'], people: [owner, { ...owner, id: 'duplicate' }, second, person('agent', 'attorney', 'AGENT')], details: { documentNo: '42', bookNumber: '1', documentDate: '2026-10-01', sro: 'TEST', sroCode: '123' }, notes: [] };
    const authority = { ...emptySaleAuthority(), extractions: [result] };
    const next = applyGpaExtraction(draft, authority, result);
    const restored = draftReducer(newDraft(), { type: 'load', draft: JSON.parse(JSON.stringify(next)) });
    const state = appStateFor(restored);
    expect(state.form.executantName).toBe('OWNER');
    expect(state.form.executantPartyType).toMatch(/^Principal/);
    expect(state.form.executantMobile).toBe('');
    expect(state.additionalExecutants).toHaveLength(1);
    expect(state.additionalExecutants[0].values.executantName).toBe('SECOND');
    for (const [key, value] of Object.entries(result.details)) expect((restored.saleAuthority as any)[key]).toBe(value);
  });
  it('preserves draft when no verified principal exists and blanks missing particulars', () => {
    const draft = newDraft();
    const result = { id: 'read', documentIds: [], people: [], details: {}, notes: [] };
    expect(() => applyGpaExtraction(draft, emptySaleAuthority(), result)).toThrow(/retained/);
    const next = applyGpaExtraction(draft, { ...emptySaleAuthority(), documentNo: 'OLD' }, { ...result, people: [person('one', 'principal', 'OWNER', { Relation: '' })] });
    expect(() => applyGpaExtraction(draft, emptySaleAuthority(), { ...result, incomplete: true, people: [person('one', 'principal', 'OWNER')] })).toThrow(/retained/);
    expect(() => applyGpaExtraction(draft, emptySaleAuthority(), { ...result, people: [person('one', 'principal', 'OWNER'), person('two', 'principal', 'OWNER', { Village: 'CONFLICT' })] })).toThrow(/Conflicting/);
    expect(next.saleAuthority?.documentNo).toBe('');
    expect(appStateFor(next).form.executantRelation).toBe('');
  });
});

describe('GPA and AGPA principal defaults', () => {
  for (const variantId of ['sale-deed-by-gpa-holder', 'sale-through-existing-agpa']) {
    it('defaults primary and additional executants to Principal for ' + variantId, () => {
      const draft = { ...newDraft(), variantId, manual: { 'executant|primary|executantName': '', 'executant|second|executantName': 'SECOND' } };
      const state = appStateFor(draft);
      expect(state.form.executantPartyType).toMatch(/^Principal/);
      expect(state.additionalExecutants.every(p => p.values.executantPartyType.startsWith('Principal'))).toBe(true);
      const read = { id: 'review', documentIds: ['scan'], people: [{ id: 'owner', role: 'principal' as const, values: { Name: 'MALAVATH SARITHA', Relation: 'W/O', RelativeName: 'SANGYA', Age: '45', Occupation: 'Agriculture', HNo: '1-6/1', Locality: 'Pakala', Village: 'Thumapalle', Mandal: 'Sirikonda', District: 'Nizamabad' }, quote: 'MALAVATH SARITHA W/o SANGYA', page: 1, sourceName: 'Visually reviewed scan fixture', principalNames: [] }], details: { documentNo: '6003/2023', documentDate: '2023-07-18' }, notes: [] };
      const next = applyGpaExtraction(draft, emptySaleAuthority(), read);
      expect(appStateFor(next).form.executantName).toBe('MALAVATH SARITHA');
      expect(appStateFor(next).additionalExecutants).toHaveLength(0);
      expect(next.saleAuthority).toMatchObject({ documentNo: '6003/2023', documentDate: '2023-07-18', bookNumber: '', sro: '', sroCode: '' });
    });
  }
});

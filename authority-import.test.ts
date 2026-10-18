import { describe, expect, it } from 'vitest';
import { applyAuthorityPerson, cleanAuthorityRead } from './authority-import';
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

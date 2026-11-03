import { expect, it } from 'vitest';
import { displaySro, findSro, resolveSroSelection, sroLabel, SRO_OFFICES, sroFieldPair } from './sro-directory';
import { initialState } from './logic';
import { mergeValues } from './merge';
import { emptySaleAuthority } from './sale-options';
import { draftReducer, fieldKey, newDraft } from './source-draft';

it('resolves supplied names and codes while requiring a choice for ambiguous codes', () => {
  expect(SRO_OFFICES).toHaveLength(140);
  expect(findSro('1906')).toEqual({ name: 'ADILABAD', code: '1906' });
  expect(findSro(' banjara   hills ')).toEqual({ name: 'BANJARA HILLS', code: '1604' });
  expect(findSro('ADILABAD [1906]')?.code).toBe('1906');
  expect(findSro('1410')).toBeUndefined();
  expect(findSro('SHADNAGAR [1410]')?.name).toBe('SHADNAGAR');
  expect(findSro('190')).toBeUndefined();
  expect(displaySro('Unlisted office')).toBe('Unlisted office');
  expect(sroFieldPair('rectificationDeedSroCode')).toEqual({ name: 'rectificationDeedSro', code: 'rectificationDeedSroCode' });
});

it('keeps dashboard labels separate from template office and code bindings', () => {
  const state = { ...initialState, form: { ...initialState.form, sro: 'ADILABAD', sroCode: '1906' }, saleAuthority: { ...emptySaleAuthority(), sro: 'BANJARA HILLS', sroCode: '1604' } };
  expect(displaySro(state.form.sro)).toBe('Adilabad [1906]');
  expect(mergeValues(state)['Sub Registrar']).toBe('Adilabad');
  expect(mergeValues(state)['Authority SRO']).toBe('BANJARA HILLS');
  expect(mergeValues(state)['Authority SRO Code']).toBe('1604');
  expect(state.form.sro).toBe('ADILABAD');
});

it('prints property place names in Title Case while preserving party address casing', () => {
  const state = { ...initialState, form: { ...initialState.form, locality: 'LAKSHMI NAGAR', village: 'KOTHAPETA', mandal: 'RAJANNA MANDAL', sro: 'SIRCILLA SRO', permissionAuthorityName: 'GRAM PANCHAYAT KOTHAPETA', executantLocality: 'OLD TOWN', executantVillage: 'OLD VILLAGE' } };
  const values = mergeValues(state);
  expect(values).toMatchObject({
    Locality: 'Lakshmi Nagar', Village: 'Kothapeta', Mandal: 'Rajanna Mandal', 'Sub Registrar': 'Sircilla SRO',
    'Municipality/Municipal Corporation/Gram Panchayat Name': 'Gram Panchayat Kothapeta',
    'Executant Locality': 'OLD TOWN', 'Executant Village': 'OLD VILLAGE',
  });
});

it('splits the combined SRO selection into each enclosure record’s existing name and code fields', () => {
  const office = SRO_OFFICES.find(item => item.name === 'SHADNAGAR')!;
  const selection = sroLabel(office);
  const records = [
    ['linkSro', 'link', 'title-primary'],
    ['rectificationDeedSro', 'link', 'rectification-primary'],
    ['supplementalDeedSro', 'link', 'supplemental-primary'],
    ['developmentSro', 'property', 'flat-primary'],
    ['supplementalSro', 'property', 'flat-primary'],
  ] as const;
  let draft = newDraft();
  for (const [field, role, record] of records) {
    const resolved = resolveSroSelection(field, selection)!;
    expect(resolved).toMatchObject({ nameField: field, name: office.name, codeField: field + 'Code', code: office.code });
    draft = draftReducer(draft, { type: 'manual', key: fieldKey(role, record, resolved.nameField), value: resolved.name });
    draft = draftReducer(draft, { type: 'manual', key: fieldKey(role, record, resolved.codeField), value: resolved.code });
  }
  for (const [field, role, record] of records) {
    expect(draft.manual[fieldKey(role, record, field)]).toBe('SHADNAGAR');
    expect(draft.manual[fieldKey(role, record, field + 'Code')]).toBe('1410');
  }
  expect(resolveSroSelection('rectificationDeedSro', 'unlisted office [X-7]')).toMatchObject({ name: 'Unlisted Office', code: 'X-7' });
});

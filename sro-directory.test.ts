import { expect, it } from 'vitest';
import { displaySro, findSro, SRO_OFFICES, sroFieldPair } from './sro-directory';
import { initialState } from './logic';
import { mergeValues } from './merge';
import { emptySaleAuthority } from './sale-options';

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
  expect(displaySro(state.form.sro)).toBe('ADILABAD [1906]');
  expect(mergeValues(state)['Sub Registrar']).toBe('ADILABAD');
  expect(mergeValues(state)['Authority SRO']).toBe('BANJARA HILLS');
  expect(mergeValues(state)['Authority SRO Code']).toBe('1604');
  expect(state.form.sro).toBe('ADILABAD');
});

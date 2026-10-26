import { describe, expect, it } from 'vitest';
import { matchingOption, changeLocation } from './registration-location-state';
import { appStateFor, draftReducer, fieldKey, newDraft, resolveDraft } from './source-draft';
import { newStructureDetails } from './fields';

describe('lookup metadata and extracted deed facts', () => {
  it('matches names only when one option matches, including canonical locality text', () => {
    const options = [{ code: '1', label: '[W-B:0-0] ALIZAPUR', value: 'ALIZAPUR' }];
    expect(matchingOption(options, ' alizapur ', 'locality', {})?.code).toBe('1');
    expect(matchingOption([...options, { code: '2', label: 'ALIZAPUR' }], 'ALIZAPUR', 'locality', {})).toBeUndefined();
    expect(matchingOption([...options, { code: '2', label: 'ALIZAPUR' }], 'ALIZAPUR', 'locality', { codes: { locality: '1' }, labels: { locality: 'ALIZAPUR' } })?.code).toBe('1');
    expect(matchingOption(options, 'OLD NAME', 'locality', { codes: { locality: '1' } })).toBeUndefined();
    expect(matchingOption(options, 'ALIZAPUR', 'locality', { needsReview: ['locality'] })).toBeUndefined();
    expect(matchingOption(options, 'ALIZAPUR', 'locality', { manual: ['locality'] })).toBeUndefined();
  });
  it('invalidates descendant selections while retaining independent fields and avoiding input mutation', () => {
    const previous = { codes: { district: '16_1', mandal: '00', village: '1600001', sro: '1602' }, manual: ['mandal' as const] };
    const next = changeLocation(previous, 'district', { code: '15_1', label: 'RANGAREDDY' });
    expect(next.codes).toEqual({ district: '15_1' });
    expect(next.needsReview).toContain('sro'); expect(next.manual).not.toContain('mandal');
    expect(previous.codes.mandal).toBe('00');
    const locality = changeLocation(previous, 'locality', { code: 'local', label: 'NEW' });
    expect(locality.codes.district).toBe('16_1'); expect(locality.codes.sro).toBeUndefined();
  });
  it('preserves all source/manual facts and generation state when metadata changes, including save/reload', () => {
    let draft = newDraft();
    draft.structureDetailsBySchedule = { primary: newStructureDetails() };
    draft = draftReducer(draft, { type: 'manual', key: fieldKey('property', 'primary', 'district'), value: 'HYDERABAD' });
    draft = draftReducer(draft, { type: 'manual', key: fieldKey('link', 'title', 'linkSro'), value: 'DIFFERENT TITLE OFFICE' });
    const before = resolveDraft(draft); const form = appStateFor(draft);
    const changed = draftReducer(draft, { type: 'jurisdiction-lookup', propertyId: 'primary', value: { codes: { district: '16_1' } } });
    expect(resolveDraft(changed)).toEqual(before); expect(appStateFor(changed)).toEqual(form);
    expect(changed.manual).toEqual(draft.manual); expect(changed.sources).toBe(draft.sources);
    const restored = draftReducer(newDraft(), { type: 'load', draft: JSON.parse(JSON.stringify(changed)) });
    expect(restored.jurisdictionLookups.primary.codes.district).toBe('16_1');
    expect(resolveDraft(restored).values[fieldKey('link', 'title', 'linkSro')]).toBe('DIFFERENT TITLE OFFICE');
  });
  it('isolates schedules and removes only the deleted schedule metadata', () => {
    let draft = draftReducer(newDraft(), { type: 'add-property', id: 'second' });
    for (const propertyId of ['primary', 'second']) draft = draftReducer(draft, { type: 'jurisdiction-lookup', propertyId, value: { codes: { district: propertyId === 'primary' ? '16_1' : '15_1' } } });
    expect(draft.jurisdictionLookups.primary.codes.district).toBe('16_1');
    draft = draftReducer(draft, { type: 'remove-record', role: 'property', record: 'second' });
    expect(draft.jurisdictionLookups.second).toBeUndefined(); expect(draft.jurisdictionLookups.primary.codes.district).toBe('16_1');
    expect(draftReducer(newDraft(), { type: 'load', draft: newDraft() }).jurisdictionLookups).toBeUndefined();
  });
});

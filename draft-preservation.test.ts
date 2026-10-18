import { describe, expect, it } from 'vitest';
import { appStateFor, draftReducer, newDraft } from './source-draft';
import { emptySaleAuthority } from './sale-options';

describe('Draft details survive document replacements and reloads', () => {
  it.each(['sale', 'gift'] as const)('preserves %s details when a source draft is replaced', instrumentId => {
    let draft = draftReducer(newDraft(), { type: 'instrument', instrumentId });
    draft = draftReducer(draft, { type: 'manual', key: 'property|primary|giftRelationship', value: 'other' });
    draft = draftReducer(draft, { type: 'manual', key: 'property|primary|giftRelationshipCustom', value: 'son and daughter' });
    draft = draftReducer(draft, { type: 'manual', key: 'executant|primary|executantName', value: 'MANUAL VENDOR' });
    const document = { id: 'authority-doc', name: 'authority.pdf', dataUrl: 'data:application/pdf;base64,dGVzdA==', size: 4 };
    const authority = { ...emptySaleAuthority(), documentNo: 'AUTH-42', documents: [document], attorneys: [{ id: 'agent', principalIds: ['primary'], values: { Name: 'ATTORNEY' }, documents: [{ ...document, id: 'attorney-doc' }] }] };
    draft = draftReducer(draft, { type: 'sale-authority', value: authority });
    draft = draftReducer(draft, { type: 'vendor-share', scheduleId: 'primary', executantId: 'primary', value: '40' });
    draft = draftReducer(draft, { type: 'vendee-share', scheduleId: 'primary', claimantId: 'primary', value: '60' });
    draft = draftReducer(draft, { type: 'add', source: { id: 'source', name: 'old.pdf', revision: 0, hash: 'old', status: 'queued' } });
    const before = structuredClone(draft);
    draft = draftReducer(draft, { type: 'replace', id: 'source', name: 'new.pdf' });
    draft = draftReducer(newDraft(), { type: 'load', draft: JSON.parse(JSON.stringify(draft)) });
    expect(draft.manual).toEqual(before.manual);
    expect(draft.saleAuthority).toEqual(authority);
    expect(draft.vendorSharesBySchedule).toEqual(before.vendorSharesBySchedule);
    expect(draft.vendeeSharesBySchedule).toEqual(before.vendeeSharesBySchedule);
    expect(draft.instrumentId).toBe(instrumentId);
    expect(appStateFor(draft).form.executantName).toBe('MANUAL VENDOR');
    expect(appStateFor(draft).form.giftRelationshipCustom).toBe('son and daughter');
  });
});

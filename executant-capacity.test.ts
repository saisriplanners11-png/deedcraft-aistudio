import { describe, expect, it } from 'vitest';
import { changeExecutantCapacity, withReplacedExecutantOrder } from './executant-capacity';
import { appStateFor, newDraft } from './source-draft';
import { emptySaleAuthority } from './sale-options';

describe('Combined executant roles', () => {
  it('retains mixed positions when authority extraction replaces principal IDs', () => {
    const previous = newDraft(); previous.variantId = 'sale-deed-by-gpa-holder';
    previous.saleAuthority = { ...emptySaleAuthority(), executantOrder: ['primary', 'agent', 'old-second'], attorneys: [{ id: 'agent', values: { Name: 'AGENT' }, principalIds: ['primary'] }] };
    const next = { ...previous, manual: { 'executant|primary|executantName': 'FIRST', 'executant|new-second|executantName': 'SECOND' } };
    expect(withReplacedExecutantOrder(previous, next).saleAuthority!.executantOrder).toEqual(['primary', 'agent', 'new-second']);
  });
  it.each(['sale-deed-by-gpa-holder', 'sale-through-existing-agpa'])('keeps attorney identity out of principals for %s and preserves role round trips', variantId => {
    const draft = newDraft(); draft.variantId = variantId;
    draft.manual = { 'executant|primary|executantName': 'OWNER', 'executant|agent|executantName': 'AGENT', 'executant|agent|executantRelativeName': 'PARENT', 'executant|agent|executantPan': 'ABCDE1234F' };
    draft.saleAuthority = { ...emptySaleAuthority(), attorneys: [{ id: 'other', values: { Name: 'OTHER' }, principalIds: ['primary', 'agent'] }] };
    const next = changeExecutantCapacity(draft, 'agent', 'Attorney / Agent', ['primary', 'agent']);
    expect(appStateFor(next).form.executantName).toBe('OWNER');
    expect(appStateFor(next).additionalExecutants).toHaveLength(0);
    expect(next.saleAuthority!.attorneys[1].values).toMatchObject({ Name: 'AGENT', RelativeName: 'PARENT', Pan: 'ABCDE1234F' });
    expect(next.saleAuthority!.attorneys[0].principalIds).toEqual(['primary']);
    expect(next.saleAuthority!.executantOrder).toEqual(['primary', 'agent', 'other']);
    const document = { id: 'id-doc', name: 'id.txt', size: 3, dataUrl: 'data:text/plain;base64,YWJj' };
    next.saleAuthority!.attorneys[1].documents = [document];
    next.saleAuthority!.attorneys[1].values.Village = 'UPDATED';
    const restored = changeExecutantCapacity(JSON.parse(JSON.stringify(next)), 'agent', 'Principal', ['primary']);
    expect(restored.manual['executant|agent|executantRelativeName']).toBe('PARENT');
    expect(restored.manual['executant|agent|executantVillage']).toBe('UPDATED');
    expect(restored.saleAuthority!.personDocuments!.agent).toEqual([document]);
    expect(appStateFor(restored).additionalExecutants).toHaveLength(1);
    const again = changeExecutantCapacity(restored, 'agent', 'Attorney / Agent', ['primary', 'agent']);
    expect(again.saleAuthority!.attorneys[1].documents).toEqual([document]);
    expect(again.saleAuthority!.executantOrder).toEqual(next.saleAuthority!.executantOrder);
    expect(draft.manual['executant|agent|executantVillage']).toBeUndefined();
  });
});

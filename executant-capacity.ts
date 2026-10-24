import { emptySaleAuthority } from './sale-options';
import { appStateFor, resolveDraft, type Draft } from './source-draft';

/** A refreshed authority document may replace principal IDs; preserve their card positions. */
export function withReplacedExecutantOrder(previous: Draft, next: Draft): Draft {
  if (!next.saleAuthority) return next;
  const state = appStateFor(next);
  const principals = [state.primaryExecutantId || 'primary', ...state.additionalExecutants.map(record => record.id)];
  const attorneys = next.saleAuthority.attorneys.map(attorney => attorney.id);
  const oldAttorneys = new Set(previous.saleAuthority?.attorneys.map(attorney => attorney.id));
  let index = 0;
  const retained = (previous.saleAuthority?.executantOrder || []).flatMap(id => {
    if (oldAttorneys.has(id)) return attorneys.includes(id) ? [id] : [];
    const principal = principals[index++];
    return principal ? [principal] : [];
  });
  return { ...next, saleAuthority: { ...next.saleAuthority, executantOrder: [...new Set([...retained, ...principals, ...attorneys])] } };
}

/** Keep evidence under its original stable ID while changing the active deed role. */
export function changeExecutantCapacity(draft: Draft, id: string, capacity: string, principalIds: string[]): Draft {
  const authority = draft.saleAuthority || emptySaleAuthority();
  const attorney = authority.attorneys.find(item => item.id === id);
  const executantOrder = [...new Set([...(authority.executantOrder || []), ...principalIds, ...authority.attorneys.map(item => item.id)])];
  if (capacity.startsWith('Attorney')) {
    if (attorney) return draft;
    const values: Record<string, string> = {};
    for (const [key, value] of Object.entries(resolveDraft(draft).values)) {
      const prefix = `executant|${id}|executant`;
      if (!key.startsWith(prefix)) continue;
      const suffix = key.slice(prefix.length);
      values[suffix === 'RelationName' ? 'RelativeName' : suffix] = value;
    }
    return { ...draft, revision: draft.revision + 1, saleAuthority: { ...authority, executantOrder,
      attorneys: [...authority.attorneys.map(item => ({ ...item, principalIds: item.principalIds.filter(principal => principal !== id) })),
        { id, values, principalIds: [], documents: authority.personDocuments?.[id] || [] }] } };
  }
  const manual = { ...draft.manual };
  if (attorney) for (const [key, value] of Object.entries(attorney.values)) {
    if (key !== 'PartyType') manual[`executant|${id}|executant${key}`] = value;
  }
  manual[`executant|${id}|executantPartyType`] = capacity;
  return { ...draft, revision: draft.revision + 1, manual, saleAuthority: { ...authority, executantOrder,
    personDocuments: { ...authority.personDocuments, ...(attorney ? { [id]: attorney.documents || [] } : {}) },
    attorneys: authority.attorneys.filter(item => item.id !== id) } };
}

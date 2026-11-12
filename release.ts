import type { AppState } from './logic';
import { partyDisplayName } from './party-entities';
import { claimantRepresentationForOutput, minorClaimantValues } from './minor-parties';
import { formatDeedAmount, moneyPaise as mortgagePaise } from './deed-money';

export interface ReleaseData {
  releasedBySchedule?: Record<string, Record<string, string>>;
  allocatedBySchedule?: Record<string, Record<string, string>>;
  relationships?: { id: string; releasorId: string; releaseeId: string; wording: string }[];
}
export interface ReleasePartyShare { id: string; name: string; share: string; gender?: string }
type Rational = { n: bigint; d: bigint };
const gcd = (a: bigint, b: bigint): bigint => b ? gcd(b, a % b) : a;
const rational = (n: bigint, d: bigint): Rational => { const g = gcd(n,d); return { n:n/g, d:d/g }; };
/** Exact shares of the whole property; decimal entries are percentages. */
export function releaseShare(value: string): Rational | null {
  const text = value.trim();
  let n: bigint, d: bigint;
  const fraction = /^(\d+)\s*\/\s*(\d+)$/.exec(text);
  if (fraction) { n=BigInt(fraction[1]); d=BigInt(fraction[2]); }
  else {
    const percent = /^(\d+)(?:\.(\d{1,6}))?\s*%?$/.exec(text);
    if (!percent) return null;
    const decimals=percent[2] || ''; d=100n*10n**BigInt(decimals.length); n=BigInt(percent[1]+decimals);
  }
  return n>0n && d>0n && n<=d ? rational(n,d) : null;
}
export const releaseShareLabel = (value: string) => value.trim() ? value.includes('/') || value.includes('%') ? value.trim() : value.trim()+'%' : '';
export function releasedTotal(parties: ReleasePartyShare[], legacy = ''): string {
  if (!parties.length || parties.some(p=>!p.share.trim())) return parties.every(p=>!p.share.trim()) && releaseShare(legacy) ? releaseShareLabel(legacy) : '';
  let total: Rational={n:0n,d:1n};
  for (const party of parties) { const v=releaseShare(party.share); if (!v) return ''; total=rational(total.n*v.d+v.n*total.d,total.d*v.d); }
  return total.n<=total.d ? `${total.n}/${total.d}` : '';
}
/** Round only the displayed area, after exact proportional arithmetic. */
export function releasedExtent(extent: string, share: string): string {
  const v=releaseShare(share), clean=extent.replace(/,/g,'').trim();
  if (!v || !/^\d+(?:\.\d+)?$/.test(clean)) return '';
  const [whole,dec='']=clean.split('.');
  const denominator=10n**BigInt(dec.length)*v.d;
  const scaled=BigInt(whole+dec)*v.n*100n;
  const rounded=(scaled*2n+denominator)/(2n*denominator);
  return `${rounded/100n}.${String(rounded%100n).padStart(2,'0')}`;
}
export function releasedSquareMetres(extent: string, share: string): string {
  const v = releaseShare(share);
  return v ? releasedExtent(extent, `${v.n * 836127n}/${v.d * 1000000n}`) : '';
}
export function releaseParties(state: AppState, side: 'executant'|'claimant') {
  const records = side === 'claimant' ? claimantRepresentationForOutput(state).recipients
    : [{ id: state.primaryExecutantId || 'primary', values: state.form }, ...state.additionalExecutants];
  return records.map(({ id, values }) => ({ id, name: partyDisplayName(values, side),
    gender: (side === 'claimant' ? minorClaimantValues(values) : values)[side + 'Gender'] || '' }));
}
export function releaseScheduleValues(state: AppState, scheduleId: string): Record<string,string> {
  const shares=(side:'executant'|'claimant')=>releaseParties(state,side).map(p=>({...p,share:(side==='executant'?state.releaseData?.releasedBySchedule:state.releaseData?.allocatedBySchedule)?.[scheduleId]?.[p.id]||''}));
  return { 'Release Releasor Shares':JSON.stringify(shares('executant')), 'Release Recipient Shares':JSON.stringify(shares('claimant')), 'Release Legacy Share':scheduleId==='primary' ? state.form.releasedShare||'' : '' };
}
export function releaseValues(state: AppState): Record<string,string> {
  const sellers=releaseParties(state,'executant'), buyers=releaseParties(state,'claimant');
  const family=state.draft==='Family Release';
  const relations=(state.releaseData?.relationships||[]).filter(r=>r.wording.trim() && sellers.some(p=>p.id===r.releasorId) && buyers.some(p=>p.id===r.releaseeId));
  const relationship=family ? relations.map(r=>`${sellers.find(p=>p.id===r.releasorId)!.name} is ${r.wording.trim()} of ${buyers.find(p=>p.id===r.releaseeId)!.name}.`).join(' ') : 'The Releasor/s and Releasee/s are co-owners of the Schedule Property.';
  return { 'Release Variant':family?'family-release':'co-owner-release', 'Release Relationship Recital':relationship,
    'Release Errors':JSON.stringify(releaseErrors(state)), 'Total Value of Property Rs./-':formatDeedAmount(state.form.totalPropertyValue||''),
    'Share Value of Property Rs./-':formatDeedAmount(state.form.consid||state.form.releaseConsideration||''),
    'Release Releasor Names':JSON.stringify(sellers.map(p=>p.name)), 'Release Releasee Names':JSON.stringify(buyers.map(p=>p.name)),
    'Release Legacy Share':state.form.releasedShare||'' };
}
export function releaseErrors(state: AppState): string[] {
  const errors:string[]=[];
  const money=state.form.consid||state.form.releaseConsideration||'';
  const paid=state.payments.reduce((sum,p)=>sum+(mortgagePaise(p.amount||'')||0n),0n);
  if (paid>(mortgagePaise(money)||0n)) errors.push('Release: recorded payments exceed the paid consideration.');
  if ((mortgagePaise(money)??0n)<=0n) errors.push('Release: enter a positive paid consideration.');
  if ((mortgagePaise(state.form.totalPropertyValue||'')??0n)<=0n) errors.push('Release: enter the total value of the whole property separately from the release consideration.');
  if (state.form.releasedShare?.trim() && !releaseShare(state.form.releasedShare)) errors.push('Release: correct the saved combined released share.');
  const sellers=releaseParties(state,'executant'), buyers=releaseParties(state,'claimant');
  for (const schedule of [{id:'primary',category:state.category},...state.additionalSchedules]) {
    if (!['Vacant Plot','Open Place','Residential','Flat','Demolished','Part open place'].includes(schedule.category)) errors.push('Release: unsupported property category '+schedule.category+'.');
    for(const [label,parties,map] of [['releasor',sellers,state.releaseData?.releasedBySchedule],['releasee',buyers,state.releaseData?.allocatedBySchedule]] as const) {
      const entered=parties.map(p=>({...p,share:map?.[schedule.id]?.[p.id]||''}));
      let total:Rational={n:0n,d:1n};
      for (const p of entered) if(p.share.trim()) { const v=releaseShare(p.share); if(!v) errors.push(`Release ${schedule.id}: correct ${label} ${p.name||p.id} share (fraction or percentage greater than zero and at most 100%).`); else total=rational(total.n*v.d+v.n*total.d,total.d*v.d); }
      if(total.n>total.d) errors.push(`Release ${schedule.id}: ${label} shares exceed the whole property.`);
    }
  }
  if (state.draft==='Family Release') {
    const relationships=state.releaseData?.relationships||[];
    for(const p of sellers) if(!relationships.some(r=>r.releasorId===p.id && buyers.some(b=>b.id===r.releaseeId) && r.wording.trim())) errors.push(`Release: enter a named family relationship for ${p.name||p.id}.`);
    if(relationships.some(r=>!sellers.some(p=>p.id===r.releasorId)||!buyers.some(p=>p.id===r.releaseeId)||!r.wording.trim())) errors.push('Release: complete or remove unfinished named relationships.');
  }
  return errors;
}
export function releaseBindingErrors(values: Record<string,string>): string[] {
  const parsed=JSON.parse(values['Release Errors']||'[]');
  if(!Array.isArray(parsed)) return ['Invalid Release validation data.'];
  const errors=parsed.map(String);
  for(const key of ['Total Value of Property Rs./-','Share Value of Property Rs./-']) if((mortgagePaise(values[key]||'')??0n)<=0n) errors.push('Release: enter '+key+'.');
  if(!values['Release Relationship Recital']?.trim()) errors.push('Release: enter the named relationship recital.');
  return errors;
}

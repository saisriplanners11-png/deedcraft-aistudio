import './release-fields.css';
import type { AppState } from './logic';
import { releaseParties, releaseErrors, type ReleaseData } from './release';
import type { Draft, Action } from './source-draft';
export function ReleaseFields({state,draft,dispatch,schedules,onValue}:{state:AppState;draft:Draft;dispatch:(a:Action)=>void;schedules:{id:string;category:string}[];onValue:(id:string,value:string)=>void}) {
  const data=draft.releaseData||{}, sellers=releaseParties(state,'executant'), buyers=releaseParties(state,'claimant');
  const update=(value:ReleaseData)=>dispatch({type:'load',draft:{...draft,revision:draft.revision+1,releaseData:value}});
  return <section className="panel release-particulars" aria-label="Release particulars"><h2>Release particulars</h2>
    <label className="field"><span>Total value of the whole property (₹)</span><input inputMode="decimal" value={state.form.totalPropertyValue||''} onChange={e=>onValue('totalPropertyValue',e.target.value)}/></label>
    <label className="field"><span>Paid consideration for the released rights (₹)</span><input inputMode="decimal" value={state.form.consid||''} onChange={e=>onValue('consid',e.target.value)}/></label>
    <label className="field"><span>Stamp value (₹)</span><input inputMode="decimal" value={state.form.stampValue||''} onChange={e=>onValue('stampValue',e.target.value)}/></label>
    <label className="field"><span>First-page stamp-paper margin</span><select value={state.form.stampPaperMargin||'Legacy'} onChange={e=>onValue('stampPaperMargin',e.target.value)}><option value="Legacy">Legacy margin</option><option value="None">Normal margin</option><option value="100">₹100 stamp paper — 5.8 inches</option><option value="50">₹50 stamp paper — 6 inches</option><option value="20">₹20 stamp paper — 6 inches</option></select></label>
    <p>Shares refer to the whole property. Enter a fraction such as 1/3 or a percentage such as 25%. Blank shares remain unspecified. Recipient allocations describe shares of the whole property received under this deed.</p>
    {schedules.map((s,i)=><fieldset key={s.id}><legend>Property {i+1} — {s.category}</legend>
      {sellers.map((p,j)=><label className="field" key={p.id}><span>Releasor {j+1}: {p.name} — released share (optional)</span><input value={data.releasedBySchedule?.[s.id]?.[p.id]||''} onChange={e=>update({...data,releasedBySchedule:{...data.releasedBySchedule,[s.id]:{...data.releasedBySchedule?.[s.id],[p.id]:e.target.value}}})}/></label>)}
      {buyers.map((p,j)=><label className="field" key={p.id}><span>Releasee {j+1}: {p.name} — received share (optional)</span><input value={data.allocatedBySchedule?.[s.id]?.[p.id]||''} onChange={e=>update({...data,allocatedBySchedule:{...data.allocatedBySchedule,[s.id]:{...data.allocatedBySchedule?.[s.id],[p.id]:e.target.value}}})}/></label>)}
    </fieldset>)}
    {!!state.form.releasedShare && <label className="field"><span>Saved combined released share (legacy)</span><input value={state.form.releasedShare} onChange={e=>onValue('releasedShare',e.target.value)}/><small>Retained independently; never assigned to a person.</small></label>}
    {state.draft==='Family Release' && <><h3>Named family relationships</h3>{(data.relationships||[]).map(r=><fieldset key={r.id}>
      <label className="field"><span>Releasor</span><select value={r.releasorId} onChange={e=>update({...data,relationships:data.relationships!.map(x=>x.id===r.id?{...r,releasorId:e.target.value}:x)})}><option value="">Choose releasor</option>{sellers.map(p=><option key={p.id} value={p.id}>{p.name||p.id}</option>)}</select></label>
      <label className="field"><span>Relationship to releasee</span><input placeholder="e.g. brother" value={r.wording} onChange={e=>update({...data,relationships:data.relationships!.map(x=>x.id===r.id?{...r,wording:e.target.value}:x)})}/></label>
      <label className="field"><span>Releasee</span><select value={r.releaseeId} onChange={e=>update({...data,relationships:data.relationships!.map(x=>x.id===r.id?{...r,releaseeId:e.target.value}:x)})}><option value="">Choose releasee</option>{buyers.map(p=><option key={p.id} value={p.id}>{p.name||p.id}</option>)}</select></label>
      <button type="button" onClick={()=>update({...data,relationships:data.relationships!.filter(x=>x.id!==r.id)})}>Remove relationship</button>
    </fieldset>)}<button type="button" onClick={()=>update({...data,relationships:[...(data.relationships||[]),{id:crypto.randomUUID(),releasorId:sellers[0]?.id||'',releaseeId:buyers[0]?.id||'',wording:''}]})}>Add relationship</button></>}
    {!!releaseErrors(state).length && <ul role="status">{releaseErrors(state).map(e=><li key={e}>{e}</li>)}</ul>}
  </section>;
}

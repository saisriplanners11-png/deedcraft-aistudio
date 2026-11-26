import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChartNoAxesCombined, FileText, RefreshCw, Search, Users, X } from 'lucide-react';
import { auth } from './account';
import './account-admin.css';

type Overview = { users: number; verified: number; contributors: number; records: number; kinds: {kind:string;count:number}[]; activity: {day:string; registrations:number; records:number}[] };
type AdminUser = { id:string; email:string; name:string; created_at:string; last_sign_in_at:string|null; email_confirmed_at:string|null; records:number; profile:Record<string,unknown> };
type Work = {owner:string;kind:string;id:string;title:string;email:string;revision:number;updated_at:string|null};
type Page<T> = { total:number; items:T[] };
const kinds: Record<string,string> = {deed:'Deeds',application:'Saved applications','application-work':'Application forms','guided-plan':'Plan library','guided-work':'Plans in progress','legacy-plan':'Reference plans','sketch-plan':'Sketch plans'};
const date = (value:string|null) => value ? new Date(value).toLocaleString('en-IN') : 'Not recorded';
async function read<T>(section:string, args:Record<string,unknown> = {}):Promise<T> {
  const {data,error} = await auth!.rpc('account_admin_data',{section,...args});
  if(error) throw new Error(error.message);
  return data as T;
}
function SavedFields({value,depth=0}:{value:unknown;depth?:number}) {
  if(value===null||value===undefined) return <span>Not entered</span>;
  if(typeof value!=='object') return <span className="dc-admin-field-value">{String(value)}</span>;
  if(depth>12) return <pre>{JSON.stringify(value,null,2)}</pre>;
  const entries=Object.entries(value);
  if(!entries.length) return <span>Empty</span>;
  return <dl className="dc-admin-fields">{entries.map(([key,item])=><div key={key}>
    {item!==null&&typeof item==='object'?<details><summary>{Array.isArray(value)?'Item '+(Number(key)+1):key.replace(/([A-Z])/g,' $1')}</summary><SavedFields value={item} depth={depth+1}/></details>
      :<><dt>{key.replace(/([A-Z])/g,' $1')}</dt><dd><SavedFields value={item} depth={depth+1}/></dd></>}
  </div>)}</dl>;
}
export function AccountAdmin({onBack}:{onBack:()=>void}) {
  const [tab,setTab] = useState<'overview'|'users'|'work'>('overview');
  const [overview,setOverview] = useState<Overview>();
  const [users,setUsers] = useState<Page<AdminUser>>({total:0,items:[]});
  const [work,setWork] = useState<Page<Work>>({total:0,items:[]});
  const [owner,setOwner] = useState<AdminUser>();
  const [kind,setKind] = useState('');
  const [search,setSearch] = useState('');
  const [query,setQuery] = useState('');
  const [offset,setOffset] = useState(0);
  const [refresh,setRefresh] = useState(0);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [detail,setDetail] = useState<{title:string;body:unknown}>();
  const request = useRef(0);
  useEffect(()=> {
    let current=true; setBusy(true); setError(''); setDetail(undefined); request.current++;
    const task = tab==='overview' ? read<Overview>('overview').then(data=>{if(current)setOverview(data);})
      : tab==='users' ? read<Page<AdminUser>>('users',{page_offset:offset,search_text:query}).then(data=>{if(current)setUsers(data);})
      : read<Page<Work>>('work',{page_offset:offset,selected_owner:owner?.id??null,selected_kind:kind||null}).then(data=>{if(current)setWork(data);});
    void task.catch(e=>{if(current)setError(e.message);}).finally(()=>{if(current)setBusy(false);});
    return ()=>{current=false;request.current++;};
  },[tab,offset,query,owner,kind,refresh]);
  function switchTab(next:typeof tab){setTab(next);setOffset(0);setError('');}
  async function open(row:Work){
    const token=++request.current;setBusy(true);setError('');
    try { const data=await read<{body:unknown}>('detail',{selected_owner:row.owner,selected_kind:row.kind,selected_id:row.id});
      if(token===request.current)setDetail({title:row.title,body:data.body});
    } catch(e){if(token===request.current)setError(e instanceof Error?e.message:'Unable to open record.');}
    finally{if(token===request.current)setBusy(false);}
  }
  const total=tab==='users'?users.total:work.total;
  const max=Math.max(1,...(overview?.activity.map(d=>Math.max(d.registrations,d.records))??[]));
  return <main className="dc-admin">
    <header className="dc-admin-header"><div><span className="dc-admin-eyebrow">DEEDCRAFT ADMINISTRATION</span><h1>Workspace overview</h1><p>People, saved work and recent activity across DeedCraft.</p></div>
      <button onClick={onBack}><ArrowLeft size={18} aria-hidden="true"/> My workspace</button></header>
    <div className="dc-admin-tools"><nav aria-label="Admin sections">{(['overview','users','work'] as const).map((item,i)=>{
      const Icon=[ChartNoAxesCombined,Users,FileText][i];return <button key={item} aria-current={tab===item?'page':undefined} onClick={()=>switchTab(item)}><Icon size={18} aria-hidden="true"/>{item==='overview'?'Overview':item==='users'?'Users':'All work'}</button>;})}</nav>
      <button disabled={busy} onClick={()=>setRefresh(v=>v+1)}><RefreshCw size={16} aria-hidden="true"/> Refresh</button></div>
    {busy&&<p role="status">Loading admin data…</p>}{error&&<p role="alert" className="dc-admin-error">{error} Try Refresh. If access is not configured, apply the admin database migration and assign your account.</p>}
    {!error&&tab==='overview'&&overview&&<>
      <div className="dc-admin-stats">{[['Registered users',overview.users],['Email verified',overview.verified],['Users with saved work',overview.contributors],['Saved records',overview.records]].map(([label,value])=><article key={label}><span>{label}</span><strong>{Number(value).toLocaleString('en-IN')}</strong></article>)}</div>
      <div className="dc-admin-charts"><section><h2>Last 30 days</h2><p>Daily registrations and saved records by their latest update. Dates use Indian Standard Time.</p>
        <div className="dc-admin-legend"><span>Registrations</span><span>Records last updated</span></div>
        <p className="dc-admin-chart-scale">Records / registrations per day · scale 0–{max}</p>
        {overview.activity.every(d=>d.registrations===0&&d.records===0)&&<p>No activity recorded in this period.</p>}
        <div className="dc-admin-bars" role="img" aria-label="Daily registrations and records last updated over the past 30 days. Exact values are in the data table below.">{overview.activity.map(d=><div key={d.day} title={`${d.day}: ${d.registrations} registrations, ${d.records} records`}><i style={{height:`${d.registrations/max*100}%`}}/><b style={{height:`${d.records/max*100}%`}}/></div>)}</div>
        <div className="dc-admin-axis"><span>{overview.activity[0]?.day}</span><span>{overview.activity.at(-1)?.day}</span></div>
        <details><summary>View chart data</summary><div className="dc-admin-table-wrap"><table><thead><tr><th aria-sort="descending">Date (newest first)</th><th>Registrations</th><th>Records last updated</th></tr></thead><tbody>{[...overview.activity].sort((a,b)=>b.day.localeCompare(a.day)).map(d=><tr key={d.day}><td>{d.day}</td><td>{d.registrations}</td><td>{d.records}</td></tr>)}</tbody></table></div></details>
        <small>Update tracking starts when the admin migration is installed. These counts are current records, not a history of every save.</small>
      </section><section><h2>Work by category</h2><p>Saved records, including forms and plans still in progress.</p>{!overview.kinds.length&&<p>No saved work yet.</p>}{overview.kinds.map(item=><div className="dc-admin-category" key={item.kind}><div><span>{kinds[item.kind]??item.kind}</span><strong>{item.count}</strong></div><meter min={0} max={Math.max(1,overview.records)} value={item.count}>{item.count}</meter></div>)}</section></div>
    </>}
    {tab==='users'&&<section className="dc-admin-panel"><h2>Users</h2><form className="dc-admin-search" onSubmit={e=>{e.preventDefault();setOffset(0);setQuery(search);}}><label>Search name or email<input value={search} onChange={e=>setSearch(e.target.value)} maxLength={200}/></label><button disabled={busy}><Search size={18} aria-hidden="true"/> Search</button></form>
      <div className="dc-admin-table-wrap"><table><thead><tr><th>User</th><th>Email status</th><th>Joined</th><th>Last sign-in</th><th>Records</th><th>Details</th></tr></thead><tbody>{users.items.map(user=><tr key={user.id}><td><strong>{user.name||'Name not entered'}</strong><span>{user.email}</span></td><td>{user.email_confirmed_at?'Verified':'Pending'}</td><td>{date(user.created_at)}</td><td>{date(user.last_sign_in_at)}</td><td>{user.records}</td><td><button onClick={()=>{setOwner(user);switchTab('work');}}>View work</button><details><summary>Contact profile</summary><dl>{Object.entries(user.profile).filter(([,v])=>typeof v==='string'&&v).map(([k,v])=><div key={k}><dt>{k.replace(/([A-Z])/g,' $1')}</dt><dd>{String(v)}</dd></div>)}</dl></details></td></tr>)}</tbody></table></div>
      {!busy&&!users.items.length&&<p>No users match your search.</p>}</section>}
    {tab==='work'&&<section className="dc-admin-panel"><h2>{owner?`Work by ${owner.name||owner.email}`:'All saved work'}</h2><div className="dc-admin-filters">{owner&&<button onClick={()=>{setOwner(undefined);setOffset(0);}}>Show all users</button>}<label>Category<select value={kind} onChange={e=>{setKind(e.target.value);setOffset(0);}}><option value="">All categories</option>{Object.entries(kinds).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label></div>
      <p>Read-only records. Original uploads remain on their owner’s device.</p><div className="dc-admin-table-wrap"><table><thead><tr><th>Record</th><th>Owner</th><th>Category</th><th>Last saved</th><th>Revision</th><th>Details</th></tr></thead><tbody>{work.items.map(row=><tr key={JSON.stringify([row.owner,row.kind,row.id])}><td>{row.title}</td><td>{row.email}</td><td>{kinds[row.kind]??row.kind}</td><td>{date(row.updated_at)}</td><td>{row.revision}</td><td><button disabled={busy} onClick={()=>void open(row)}>View details</button></td></tr>)}</tbody></table></div>{!busy&&!work.items.length&&<p>No saved work in this selection.</p>}</section>}
    {tab!=='overview'&&<div className="dc-admin-pagination"><span>{total?`${offset+1}–${Math.min(offset+25,total)} of ${total}`:'0 records'}</span><button disabled={busy||offset===0} onClick={()=>setOffset(n=>Math.max(0,n-25))}>Previous</button><button disabled={busy||offset+25>=total} onClick={()=>setOffset(n=>n+25)}>Next</button></div>}
    {detail&&<section className="dc-admin-panel" aria-label="Saved record details"><div className="dc-admin-detail-header"><h2>{detail.title}</h2><button onClick={()=>setDetail(undefined)}><X size={18} aria-hidden="true"/> Close details</button></div><p>Saved draft data, including entered fields and device-file references.</p><SavedFields value={detail.body}/></section>}
  </main>;
}

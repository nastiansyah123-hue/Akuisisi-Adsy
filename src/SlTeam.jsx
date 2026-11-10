import React,{useState}from'react';import{Users,Plus,Trash2,Check}from'lucide-react';import ResponsiveTable from'./ResponsiveTable';
export default function SlTeam({slTeams,allSlTeams,profiles,assignments,busy,error,onAdd,onRemove,role}){
 const isAdmin=role==='admin';
 const slProfiles=(profiles||[]).filter(p=>p.role==='sl'&&p.status==='active').map(p=>p.name).sort();
 const[selectedSL,setSelectedSL]=useState('');
 const[selected,setSelected]=useState(new Set());
 const[open,setOpen]=useState(false);
 const activeSL=isAdmin?selectedSL:null;
 const teams=isAdmin?(allSlTeams||[]):slTeams;
 const displayTeams=isAdmin&&activeSL?teams.filter(t=>t.sl_name===activeSL):isAdmin?teams:slTeams;
 const allTaken=new Set(teams.map(t=>t.cs_name));
 const csFromAssignments=[...new Set((assignments||[]).filter(a=>a.active).map(a=>a.cs))].sort();
 const available=csFromAssignments.filter(name=>!allTaken.has(name));
 const sorted=displayTeams.slice().sort((a,b)=>a.cs_name.localeCompare(b.cs_name));
 const addSL=isAdmin?activeSL:null;
 function toggle(name){setSelected(prev=>{const next=new Set(prev);if(next.has(name))next.delete(name);else next.add(name);return next})}
 async function handleAdd(e){e.preventDefault();if(!selected.size)return;for(const cs of selected){await onAdd(cs,addSL)}setSelected(new Set());setOpen(false);}
 return <section className="card"><div className="card-head"><div><h2>{isAdmin?'Kelola Tim SL':'Tim Saya'} <span className="count">{sorted.length} CS</span></h2><p>{isAdmin?'Atur anggota CS untuk setiap Sales Leader.':'Pilih CS yang menjadi anggota tim Anda. Satu CS hanya bisa masuk satu Sales Leader.'}</p></div></div>
  {isAdmin&&<div className="sl-add-form"><label>Pilih Sales Leader<select value={selectedSL} onChange={e=>{setSelectedSL(e.target.value);setSelected(new Set())}}><option value="">Semua SL</option>{slProfiles.map(n=><option key={n} value={n}>{n}</option>)}</select></label></div>}
  {(isAdmin?!!activeSL:true)&&<form className="sl-add-form" onSubmit={handleAdd}>
   <div className="cs-dropdown" style={{flex:1}}>
    <button type="button" className="cs-dropdown-trigger" onClick={()=>setOpen(!open)}>
     {selected.size?`${selected.size} CS dipilih`:`Pilih CS${isAdmin&&activeSL?' ke '+activeSL:''}...`}
    </button>
    {selected.size>0&&<div className="cs-tags">{[...selected].map(n=><span key={n} className="cs-tag">{n}<button type="button" onClick={()=>toggle(n)}>&times;</button></span>)}</div>}
    {open&&<div className="cs-dropdown-list">{available.length?available.map(n=><label key={n} className="cs-check-item"><input type="checkbox" checked={selected.has(n)} onChange={()=>toggle(n)}/><span className="person"><span className="person-avatar">{n.slice(0,2).toUpperCase()}</span>{n}</span>{selected.has(n)&&<Check size={14}/>}</label>):<div style={{padding:'8px 12px',color:'#888'}}>Semua CS sudah masuk tim</div>}</div>}
   </div>
   <button className="button primary" type="submit" disabled={busy||!selected.size||(isAdmin&&!activeSL)}><Plus size={16}/>Tambahkan {selected.size>1?`(${selected.size})`:''}</button>
  </form>}
  {error&&<div className="error" role="alert">{error}</div>}
  <div className="table-wrap"><ResponsiveTable><thead><tr>{isAdmin&&<th>Sales Leader</th>}<th>Customer Service</th><th>Ditambahkan</th><th>Aksi</th></tr></thead><tbody>{sorted.map(t=><tr key={t.id}>{isAdmin&&<td><span className="person"><span className="person-avatar">{t.sl_name.slice(0,2).toUpperCase()}</span>{t.sl_name}</span></td>}<td><span className="person"><span className="person-avatar">{t.cs_name.slice(0,2).toUpperCase()}</span>{t.cs_name}</span></td><td className="nowrap">{new Date(t.created_at).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}</td><td><button className="text-button correction-link" disabled={busy} onClick={()=>onRemove(t.id)}><Trash2 size={14}/>Hapus</button></td></tr>)}</tbody></ResponsiveTable>{!sorted.length&&<div className="empty"><Users size={28}/><strong>{isAdmin&&!activeSL?'Pilih Sales Leader untuk melihat tim':'Belum ada anggota tim'}</strong><p>{isAdmin&&!activeSL?'Gunakan dropdown di atas untuk memilih SL.':'Tambahkan CS dari daftar di atas untuk mulai memantau laporan mereka.'}</p></div>}</div></section>;
}

import React,{useState}from'react';import{Users,Plus,Trash2}from'lucide-react';import ResponsiveTable from'./ResponsiveTable';
export default function SlTeam({slTeams,profiles,busy,error,onAdd,onRemove}){
 const[csName,setCsName]=useState('');
 const taken=new Set(slTeams.map(t=>t.cs_name));
 const available=(profiles||[]).filter(p=>p.role==='cs'&&p.status==='active'&&!taken.has(p.name)).map(p=>p.name).sort();
 const myTeam=slTeams.sort((a,b)=>a.cs_name.localeCompare(b.cs_name));
 function handleAdd(e){e.preventDefault();if(!csName.trim())return;onAdd(csName.trim());setCsName('');}
 return <section className="card"><div className="card-head"><div><h2>Tim Saya <span className="count">{myTeam.length} CS</span></h2><p>Pilih CS yang menjadi anggota tim Anda. Satu CS hanya bisa masuk satu Sales Leader.</p></div></div>
  <form className="sl-add-form" onSubmit={handleAdd}><label>Tambah CS<select value={csName} onChange={e=>setCsName(e.target.value)}><option value="">Pilih CS...</option>{available.map(n=><option key={n} value={n}>{n}</option>)}</select></label><button className="button primary" type="submit" disabled={busy||!csName}><Plus size={16}/>Tambahkan</button></form>
  {error&&<div className="error" role="alert">{error}</div>}
  <div className="table-wrap"><ResponsiveTable><thead><tr><th>Customer Service</th><th>Ditambahkan</th><th>Aksi</th></tr></thead><tbody>{myTeam.map(t=><tr key={t.id}><td><span className="person"><span className="person-avatar">{t.cs_name.slice(0,2).toUpperCase()}</span>{t.cs_name}</span></td><td className="nowrap">{new Date(t.created_at).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}</td><td><button className="text-button correction-link" disabled={busy} onClick={()=>onRemove(t.id)}><Trash2 size={14}/>Hapus</button></td></tr>)}</tbody></ResponsiveTable>{!myTeam.length&&<div className="empty"><Users size={28}/><strong>Belum ada anggota tim</strong><p>Tambahkan CS dari daftar di atas untuk mulai memantau laporan mereka.</p></div>}</div></section>;
}

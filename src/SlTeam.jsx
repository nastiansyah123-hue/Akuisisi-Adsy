import React,{useState}from'react';import{Users,Plus,Trash2}from'lucide-react';import ResponsiveTable from'./ResponsiveTable';
export default function SlTeam({slTeams,allSlTeams,profiles,busy,error,onAdd,onRemove,role}){
 const isAdmin=role==='admin';
 const slProfiles=(profiles||[]).filter(p=>p.role==='sl'&&p.status==='active').map(p=>p.name).sort();
 const[selectedSL,setSelectedSL]=useState('');
 const activeSL=isAdmin?selectedSL:null;
 const teams=isAdmin?(allSlTeams||[]):slTeams;
 const displayTeams=isAdmin&&activeSL?teams.filter(t=>t.sl_name===activeSL):isAdmin?teams:slTeams;
 const allTaken=new Set(teams.map(t=>t.cs_name));
 const available=(profiles||[]).filter(p=>p.role==='cs'&&p.status==='active'&&!allTaken.has(p.name)).map(p=>p.name).sort();
 const sorted=displayTeams.slice().sort((a,b)=>a.cs_name.localeCompare(b.cs_name));
 const[csName,setCsName]=useState('');
 const addSL=isAdmin?activeSL:null;
 function handleAdd(e){e.preventDefault();if(!csName.trim())return;onAdd(csName.trim(),addSL);setCsName('');}
 return <section className="card"><div className="card-head"><div><h2>{isAdmin?'Kelola Tim SL':'Tim Saya'} <span className="count">{sorted.length} CS</span></h2><p>{isAdmin?'Atur anggota CS untuk setiap Sales Leader.':'Pilih CS yang menjadi anggota tim Anda. Satu CS hanya bisa masuk satu Sales Leader.'}</p></div></div>
  {isAdmin&&<div className="sl-add-form"><label>Pilih Sales Leader<select value={selectedSL} onChange={e=>setSelectedSL(e.target.value)}><option value="">Semua SL</option>{slProfiles.map(n=><option key={n} value={n}>{n}</option>)}</select></label></div>}
  {(isAdmin?!!activeSL:true)&&<form className="sl-add-form" onSubmit={handleAdd}><label>Tambah CS{isAdmin&&activeSL?` ke ${activeSL}`:''}<select value={csName} onChange={e=>setCsName(e.target.value)}><option value="">Pilih CS...</option>{available.map(n=><option key={n} value={n}>{n}</option>)}</select></label><button className="button primary" type="submit" disabled={busy||!csName||(isAdmin&&!activeSL)}><Plus size={16}/>Tambahkan</button></form>}
  {error&&<div className="error" role="alert">{error}</div>}
  <div className="table-wrap"><ResponsiveTable><thead><tr>{isAdmin&&<th>Sales Leader</th>}<th>Customer Service</th><th>Ditambahkan</th><th>Aksi</th></tr></thead><tbody>{sorted.map(t=><tr key={t.id}>{isAdmin&&<td><span className="person"><span className="person-avatar">{t.sl_name.slice(0,2).toUpperCase()}</span>{t.sl_name}</span></td>}<td><span className="person"><span className="person-avatar">{t.cs_name.slice(0,2).toUpperCase()}</span>{t.cs_name}</span></td><td className="nowrap">{new Date(t.created_at).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}</td><td><button className="text-button correction-link" disabled={busy} onClick={()=>onRemove(t.id)}><Trash2 size={14}/>Hapus</button></td></tr>)}</tbody></ResponsiveTable>{!sorted.length&&<div className="empty"><Users size={28}/><strong>{isAdmin&&!activeSL?'Pilih Sales Leader untuk melihat tim':'Belum ada anggota tim'}</strong><p>{isAdmin&&!activeSL?'Gunakan dropdown di atas untuk memilih SL.':'Tambahkan CS dari daftar di atas untuk mulai memantau laporan mereka.'}</p></div>}</div></section>;
}

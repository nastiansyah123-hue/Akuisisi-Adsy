import ResponsiveTable from './ResponsiveTable';
import React,{useState} from 'react';import{Check,Layers,Plus,Loader,Save}from'lucide-react';
const money=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);
const pct=n=>`${(n*100).toFixed(1)}%`;
const DEFAULT_KPI={max_caq:0.35,max_cac:150000,max_cpl:30000,min_cr:0.25,min_cr_cs:0.30,min_upsell:1.50};

function KpiSettings({items,kpiTargets,onSaveKpi}){
 const products=items.map(c=>c.name).sort();
 const[edits,setEdits]=useState(()=>{
  const map={};
  for(const p of products){
   const existing=(kpiTargets||[]).find(k=>k.product===p);
   map[p]=existing?{...existing}:{product:p,...DEFAULT_KPI};
  }
  return map;
 });
 const[saving,setSaving]=useState(null);

 const update=(product,field,value)=>{
  setEdits(prev=>({...prev,[product]:{...prev[product],[field]:value}}));
 };

 const save=async(product)=>{
  setSaving(product);
  const row=edits[product];
  const existing=(kpiTargets||[]).find(k=>k.product===product);
  await onSaveKpi({...row,id:existing?.id||undefined,product,updated_at:new Date().toISOString()});
  setSaving(null);
 };

 if(!products.length)return <div className="empty"><Layers size={28}/><p>Tambahkan produk terlebih dahulu.</p></div>;

 return <section className="card"><div className="card-head"><div><h2>KPI Target per Produk</h2><p>Atur batas metrik untuk evaluasi performa. Advertiser: CAQ, CAC, CPL, CR. CS: CR, Upsell.</p></div></div>
  <div className="table-wrap"><ResponsiveTable className="kpi-table"><thead><tr>
   <th>Produk</th><th>CAQ Max</th><th>CAC Max</th><th>CPL Max</th><th>CR Min (Adv)</th><th>CR Min (CS)</th><th>Upsell Min</th><th></th>
  </tr></thead><tbody>{products.map(p=>{
   const r=edits[p]||{...DEFAULT_KPI};
   return <tr key={p}>
    <td><strong>{p}</strong></td>
    <td><input type="number" step="0.01" min="0" max="1" value={r.max_caq} onChange={e=>update(p,'max_caq',+e.target.value)}/><small>{pct(r.max_caq)}</small></td>
    <td><input type="number" step="1000" min="0" value={r.max_cac} onChange={e=>update(p,'max_cac',+e.target.value)}/><small>{money(r.max_cac)}</small></td>
    <td><input type="number" step="1000" min="0" value={r.max_cpl} onChange={e=>update(p,'max_cpl',+e.target.value)}/><small>{money(r.max_cpl)}</small></td>
    <td><input type="number" step="0.01" min="0" max="1" value={r.min_cr} onChange={e=>update(p,'min_cr',+e.target.value)}/><small>{pct(r.min_cr)}</small></td>
    <td><input type="number" step="0.01" min="0" max="1" value={r.min_cr_cs} onChange={e=>update(p,'min_cr_cs',+e.target.value)}/><small>{pct(r.min_cr_cs)}</small></td>
    <td><input type="number" step="0.1" min="0" value={r.min_upsell} onChange={e=>update(p,'min_upsell',+e.target.value)}/><small>{r.min_upsell}×</small></td>
    <td><button className="button" onClick={()=>save(p)} disabled={saving===p}>{saving===p?<Loader size={13} className="spin"/>:<Save size={13}/>}</button></td>
   </tr>;
  })}</tbody></ResponsiveTable></div>
 </section>;
}

export function Catalog({items,onEdit,kpiTargets,onSaveKpi}){
 const[tab,setTab]=useState('produk');
 return <div>
  <div className="eval-tabs" style={{marginBottom:18}}>
   <button className={tab==='produk'?'active':''} onClick={()=>setTab('produk')}>Produk & Paket</button>
   <button className={tab==='kpi'?'active':''} onClick={()=>setTab('kpi')}>KPI Target</button>
  </div>
  {tab==='produk'?<section className="card"><div className="card-head"><div><h2>Produk & paket penjualan</h2><p>Isi botol/box dan harga total setiap paket menentukan format laporan CS.</p></div></div><div className="table-wrap"><ResponsiveTable><thead><tr><th>Produk</th><th>Satuan</th><th>Paket aktif</th><th></th></tr></thead><tbody>{items.map(p=><tr key={p.id}><td><strong>{p.name}</strong></td><td>{p.unit}</td><td><div className="catalog-packages">{(p.packages||[]).filter(p=>p.active).map(k=><span key={k.id}>{k.name} · {money(k.price)} / paket</span>)}</div></td><td><button className="text-button" onClick={()=>onEdit(p)}>Atur paket</button></td></tr>)}</tbody></ResponsiveTable>{!items.length&&<div className="empty"><Layers size={28}/><p>Tambahkan produk dan paket sebelum membuat penugasan.</p></div>}</div></section>
  :<KpiSettings items={items} kpiTargets={kpiTargets} onSaveKpi={onSaveKpi}/>}
 </div>;
}

export function ProductForm({record,items,onSave,error,onError,busy}){const[f,setF]=useState(record||{id:crypto.randomUUID(),name:'',unit:'box',price:0,resellerPrice:0,packages:[]});const set=(k,v)=>setF(prev=>({...prev,[k]:v}));const update=(id,k,v)=>set('packages',f.packages.map(p=>p.id===id?{...p,[k]:v}:p));function submit(e){e.preventDefault();if(!f.name.trim())return onError('Isi nama produk.');if(items.some(p=>p.id!==f.id&&p.name.toLowerCase()===f.name.trim().toLowerCase()))return onError('Nama produk sudah ada.');if(!f.packages.some(p=>p.active))return onError('Tambahkan minimal satu paket aktif.');for(const p of f.packages)if(!p.name.trim()||!Number.isInteger(+p.units)||+p.units<1||!Number.isFinite(+p.price)||+p.price<=0)return onError('Isi nama, jumlah unit bulat, dan harga total paket lebih dari nol.');onSave('catalog',{...f,name:f.name.trim(),packages:f.packages.map(p=>({...p,name:p.name.trim(),units:+p.units,price:+p.price}))});}return <form className="entry-form" onSubmit={submit}><div className="form-grid"><label>Nama produk<input required disabled={!!record} value={f.name} onChange={e=>set('name',e.target.value)} placeholder="Contoh: Primagold"/></label><label>Satuan<select disabled={!!record} value={f.unit} onChange={e=>set('unit',e.target.value)}><option value="box">Box</option><option value="botol">Botol</option></select></label></div><div className="package-config-heading"><strong>Skema paket penjualan</strong><button type="button" className="text-button" onClick={()=>set('packages',[...f.packages,{id:crypto.randomUUID(),name:'',units:1,price:0,kind:'regular',active:true}])}><Plus size={15}/>Tambah paket</button></div><div className="package-config-list">{f.packages.map(p=><div className="package-config" key={p.id}><label>Nama paket<input required value={p.name} placeholder="Contoh: Beli 2 botol" onChange={e=>update(p.id,'name',e.target.value)}/></label><div className="form-grid"><label>Isi {f.unit} per paket<input required type="number" min="1" step="1" value={p.units} onChange={e=>update(p.id,'units',e.target.value)}/></label><label>Harga total paket (Rp)<input required type="number" min="0.01" step="0.01" value={p.price} onChange={e=>update(p.id,'price',e.target.value)}/></label><label>Jenis<select value={p.kind} onChange={e=>update(p.id,'kind',e.target.value)}><option value="regular">Reguler</option><option value="reseller">Reseller</option></select></label><label>Status<select value={p.active?'active':'inactive'} onChange={e=>update(p.id,'active',e.target.value==='active')}><option value="active">Aktif</option><option value="inactive">Nonaktif</option></select></label></div></div>)}</div><p className="form-hint">Harga adalah total per paket, bukan harga satuan. Nonaktifkan paket yang tidak dipakai. Laporan lama menyimpan isi dan harga paket saat dilaporkan.</p>{error&&<div className="error" role="alert">{error}</div>}<button disabled={busy} className="button primary submit"><Check size={17}/>{busy?'Menyimpan…':'Simpan produk & paket'}</button></form>}

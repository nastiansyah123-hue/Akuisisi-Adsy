import React,{useState}from'react';import{ChevronDown,ChevronRight,Inbox,AlertCircle}from'lucide-react';import ResponsiveTable from'./ResponsiveTable';
const money=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n||0);
const num=n=>new Intl.NumberFormat('id-ID').format(n||0);
const pct=n=>`${(n*100).toFixed(1)}%`;
export default function CSReport({reports,hideSpend,assignments}){
 const[expanded,setExpanded]=useState(new Set());
 const[showMissing,setShowMissing]=useState(true);
 const byCS={};
 for(const r of reports){
  const cs=r.cs;
  if(!byCS[cs])byCS[cs]={cs,leads:0,closing:0,units:0,revenue:0,spend:0,products:{}};
  const a=byCS[cs];
  const leads=Number(r.leads),closing=Number(r.closing)-Number(r.invalid),units=Number(r.units)-Number(r.invalidUnits),revenue=Number(r.revenue);
  a.leads+=leads;a.closing+=closing;a.units+=units;a.revenue+=revenue;
  const pk=r.product;
  if(!a.products[pk])a.products[pk]={product:r.product,leads:0,closing:0,units:0,revenue:0,spend:0};
  const p=a.products[pk];
  p.leads+=leads;p.closing+=closing;p.units+=units;p.revenue+=revenue;
 }
 const rows=Object.values(byCS).sort((a,b)=>b.revenue-a.revenue);
 const reportedCS=new Set(reports.map(r=>r.cs.toLowerCase()));
 const activeAssignments=(assignments||[]).filter(a=>a.active);
 const missingCS=[...new Set(activeAssignments.map(a=>a.cs))].filter(cs=>!reportedCS.has(cs.toLowerCase())).sort();
 function toggle(name){setExpanded(prev=>{const next=new Set(prev);if(next.has(name))next.delete(name);else next.add(name);return next})}
 return <>{missingCS.length>0&&<section className="card" style={{marginBottom:16,borderColor:'#f1d7ce'}}>
  <div className="card-head" style={{cursor:'pointer',paddingBottom:showMissing?0:17}} onClick={()=>setShowMissing(v=>!v)}>
   <div style={{display:'flex',alignItems:'center',gap:8}}><AlertCircle size={16} color="#a35343"/><div><h2 style={{color:'#a35343'}}>Belum laporan <span className="count" style={{background:'#fbefeb',color:'#a35343'}}>{missingCS.length}</span></h2><p>CS yang punya penugasan aktif tapi belum input laporan di periode ini.</p></div></div>
   {showMissing?<ChevronDown size={16}/>:<ChevronRight size={16}/>}
  </div>
  {showMissing&&<div style={{padding:'0 22px 16px',display:'flex',flexWrap:'wrap',gap:8}}>{missingCS.map(cs=><span key={cs} style={{display:'flex',alignItems:'center',gap:6,background:'#fbefeb',border:'1px solid #f1d7ce',borderRadius:6,padding:'6px 12px',fontSize:12,color:'#a35343'}}><span className="person-avatar" style={{width:24,height:24,fontSize:8,background:'#f1d7ce',color:'#a35343'}}>{cs.slice(0,2).toUpperCase()}</span>{cs}</span>)}</div>}
 </section>}
 {!rows.length&&!missingCS.length&&<div className="empty"><Inbox size={30}/><strong>Belum ada data CS</strong><p>Ubah filter atau tunggu laporan masuk.</p></div>}
 {rows.map((r,i)=>{
  const isOpen=expanded.has(r.cs);
  const prods=Object.values(r.products).sort((a,b)=>b.revenue-a.revenue);
  const upsell=r.closing>0?(r.units/r.closing):0;
  return <section key={r.cs} className="card adv-card" style={{marginBottom:12}}>
   <div className="adv-card-header" onClick={()=>toggle(r.cs)}>
    <span className="adv-rank">{i+1}</span>
    <span className="person"><span className="person-avatar">{r.cs.slice(0,2).toUpperCase()}</span><div><strong>{r.cs}</strong><small className="cell-sub">{prods.length} produk</small></div></span>
    <div className="adv-card-metrics">
     <div><small>Leads</small><strong>{num(r.leads)}</strong></div>
     <div><small>Closing</small><strong>{num(r.closing)}</strong></div>
     <div><small>CR</small><strong><span className="rate">{pct(r.leads?r.closing/r.leads:0)}</span></strong></div>
     <div><small>Unit</small><strong>{num(r.units)}</strong></div>
     <div><small>Omzet</small><strong className="money">{money(r.revenue)}</strong></div>
     <div><small>Upsell</small><strong>{upsell?upsell.toFixed(2)+'×':'—'}</strong></div>
    </div>
    {isOpen?<ChevronDown size={16}/>:<ChevronRight size={16}/>}
   </div>
   {isOpen&&<div className="adv-card-detail">
    <div className="table-wrap"><ResponsiveTable><thead><tr><th>Produk</th><th>Leads</th><th>Closing</th><th>CR</th><th>Unit</th><th>Omzet</th><th>Upsell</th></tr></thead><tbody>{prods.map(d=>{
     const u=d.closing>0?(d.units/d.closing):0;
     return <tr key={d.product}>
      <td><strong>{d.product}</strong></td>
      <td>{num(d.leads)}</td>
      <td>{num(d.closing)}</td>
      <td><span className="rate">{pct(d.leads?d.closing/d.leads:0)}</span></td>
      <td>{num(d.units)}</td>
      <td className="money">{money(d.revenue)}</td>
      <td>{u?u.toFixed(2)+'×':'—'}</td>
     </tr>})}</tbody></ResponsiveTable></div>
   </div>}
  </section>})}</>;
}

import React,{useState}from'react';import{ChevronDown,ChevronRight,Inbox,AlertCircle}from'lucide-react';import ResponsiveTable from'./ResponsiveTable';
const money=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n||0);
const num=n=>new Intl.NumberFormat('id-ID').format(n||0);
const pct=n=>`${(n*100).toFixed(1)}%`;
export default function AdvReport({groups,hideSpend,ads,assignments}){
 const[expanded,setExpanded]=useState(new Set());
 const[expandedProds,setExpandedProds]=useState(new Set());
 const[expandedPlats,setExpandedPlats]=useState(new Set());
 const[showMissing,setShowMissing]=useState(true);
 const byAdv={};
 for(const g of groups){
  const k=g.advertiser;
  if(!byAdv[k])byAdv[k]={advertiser:k,leads:0,closing:0,units:0,revenue:0,spend:0,products:{}};
  const a=byAdv[k];
  a.leads+=g.leads;a.closing+=g.closing;a.units+=g.units;a.revenue+=g.revenue;a.spend+=g.spend;
  const pk=g.product;
  if(!a.products[pk])a.products[pk]={product:g.product,leads:0,closing:0,units:0,revenue:0,spend:0,platforms:{}};
  const p=a.products[pk];
  p.leads+=g.leads;p.closing+=g.closing;p.units+=g.units;p.revenue+=g.revenue;p.spend+=g.spend;
  const plat=g.platform||'Meta';
  if(!p.platforms[plat])p.platforms[plat]={platform:plat,leads:0,closing:0,units:0,revenue:0,spend:0,channels:{}};
  const pl=p.platforms[plat];
  pl.leads+=g.leads;pl.closing+=g.closing;pl.units+=g.units;pl.revenue+=g.revenue;pl.spend+=g.spend;
  const ch=g.channel;
  if(!pl.channels[ch])pl.channels[ch]={channel:ch,leads:0,closing:0,units:0,revenue:0,spend:0};
  const c=pl.channels[ch];
  c.leads+=g.leads;c.closing+=g.closing;c.units+=g.units;c.revenue+=g.revenue;c.spend+=g.spend;
 }
 const rows=Object.values(byAdv).sort((a,b)=>b.revenue-a.revenue);
 const reportedAdv=new Set((ads||[]).map(a=>a.advertiser.toLowerCase()));
 const activeAssignments=(assignments||[]).filter(a=>a.active);
 const missingAdv=[...new Set(activeAssignments.map(a=>a.advertiser))].filter(adv=>!reportedAdv.has(adv.toLowerCase())).sort();
 function toggle(name){setExpanded(prev=>{const next=new Set(prev);if(next.has(name))next.delete(name);else next.add(name);return next})}
 function toggleProd(key){setExpandedProds(prev=>{const next=new Set(prev);if(next.has(key))next.delete(key);else next.add(key);return next})}
 function togglePlat(key){setExpandedPlats(prev=>{const next=new Set(prev);if(next.has(key))next.delete(key);else next.add(key);return next})}
 const uniqueProducts=r=>[...new Set(Object.keys(r.products))];
 const dataCells=(d,hs)=><>
  <td>{num(d.leads)}</td>
  <td>{num(d.closing)}</td>
  <td><span className="rate">{pct(d.leads?d.closing/d.leads:0)}</span></td>
  {!hs&&<td>{money(d.spend)}</td>}
  <td className="money">{money(d.revenue)}</td>
  {!hs&&<td>{d.closing&&d.spend?money(d.spend/d.closing):'—'}</td>}
  {!hs&&<td>{d.revenue&&d.spend?pct(d.spend/d.revenue):'—'}</td>}
 </>;
 return <>{missingAdv.length>0&&<section className="card" style={{marginBottom:16,borderColor:'#f1d7ce'}}>
  <div className="card-head" style={{cursor:'pointer',paddingBottom:showMissing?0:17}} onClick={()=>setShowMissing(v=>!v)}>
   <div style={{display:'flex',alignItems:'center',gap:8}}><AlertCircle size={16} color="#a35343"/><div><h2 style={{color:'#a35343'}}>Belum laporan <span className="count" style={{background:'#fbefeb',color:'#a35343'}}>{missingAdv.length}</span></h2><p>Advertiser yang punya penugasan aktif tapi belum input biaya iklan di periode ini.</p></div></div>
   {showMissing?<ChevronDown size={16}/>:<ChevronRight size={16}/>}
  </div>
  {showMissing&&<div style={{padding:'0 22px 16px',display:'flex',flexWrap:'wrap',gap:8}}>{missingAdv.map(adv=><span key={adv} style={{display:'flex',alignItems:'center',gap:6,background:'#fbefeb',border:'1px solid #f1d7ce',borderRadius:6,padding:'6px 12px',fontSize:12,color:'#a35343'}}><span className="person-avatar" style={{width:24,height:24,fontSize:8,background:'#f1d7ce',color:'#a35343'}}>{adv.slice(0,2).toUpperCase()}</span>{adv}</span>)}</div>}
 </section>}
 {!rows.length&&!missingAdv.length&&<div className="empty"><Inbox size={30}/><strong>Belum ada data advertiser</strong><p>Ubah filter atau tunggu laporan masuk.</p></div>}
 {rows.map((r,i)=>{
  const isOpen=expanded.has(r.advertiser);
  const prods=Object.values(r.products).sort((a,b)=>b.revenue-a.revenue);
  return <section key={r.advertiser} className="card adv-card" style={{marginBottom:12}}>
   <div className="adv-card-header" onClick={()=>toggle(r.advertiser)}>
    <span className="adv-rank">{i+1}</span>
    <span className="person"><span className="person-avatar">{r.advertiser.slice(0,2).toUpperCase()}</span><div><strong>{r.advertiser}</strong><small className="cell-sub">{uniqueProducts(r).length} produk</small></div></span>
    <div className="adv-card-metrics">
     <div><small>Leads</small><strong>{num(r.leads)}</strong></div>
     <div><small>Closing</small><strong>{num(r.closing)}</strong></div>
     <div><small>CR</small><strong><span className="rate">{pct(r.leads?r.closing/r.leads:0)}</span></strong></div>
     {!hideSpend&&<div><small>Biaya iklan</small><strong>{money(r.spend)}</strong></div>}
     <div><small>Omzet</small><strong className="money">{money(r.revenue)}</strong></div>
     {!hideSpend&&<div><small>CAC</small><strong>{r.closing&&r.spend?money(r.spend/r.closing):'—'}</strong></div>}
     {!hideSpend&&<div><small>CAQ</small><strong>{r.revenue&&r.spend?pct(r.spend/r.revenue):'—'}</strong></div>}
    </div>
    {isOpen?<ChevronDown size={16}/>:<ChevronRight size={16}/>}
   </div>
   {isOpen&&<div className="adv-card-detail">
    <div className="table-wrap"><ResponsiveTable><thead><tr><th>Produk</th><th>Leads</th><th>Closing</th><th>CR</th>{!hideSpend&&<th>Biaya iklan</th>}<th>Omzet</th>{!hideSpend&&<th>CAC</th>}{!hideSpend&&<th>CAQ</th>}</tr></thead><tbody>{prods.map(d=>{
     const prodKey=r.advertiser+'|'+d.product;
     const isProdOpen=expandedProds.has(prodKey);
     const platforms=Object.values(d.platforms).sort((a,b)=>b.revenue-a.revenue);
     const canExpand=platforms.length>1||(platforms.length===1&&Object.keys(platforms[0].channels).length>1);
     return <React.Fragment key={d.product}>
      <tr onClick={canExpand?()=>toggleProd(prodKey):undefined} style={canExpand?{cursor:'pointer'}:undefined}>
       <td><strong style={{display:'flex',alignItems:'center',gap:4}}>{canExpand&&(isProdOpen?<ChevronDown size={13}/>:<ChevronRight size={13}/>)}{d.product}</strong></td>
       {dataCells(d,hideSpend)}
      </tr>
      {isProdOpen&&platforms.map(pl=>{
       const platKey=prodKey+'|'+pl.platform;
       const isPlatOpen=expandedPlats.has(platKey);
       const channels=Object.values(pl.channels).sort((a,b)=>b.revenue-a.revenue);
       const platCanExpand=channels.length>1;
       return <React.Fragment key={pl.platform}>
        <tr onClick={platCanExpand?()=>togglePlat(platKey):undefined} style={{background:'#f4f9fd',cursor:platCanExpand?'pointer':undefined}}>
         <td style={{paddingLeft:34}}><span style={{display:'flex',alignItems:'center',gap:4}}>{platCanExpand&&(isPlatOpen?<ChevronDown size={11}/>:<ChevronRight size={11}/>)}<span className="badge" style={{fontSize:9}}>{pl.platform}</span></span></td>
         {dataCells(pl,hideSpend)}
        </tr>
        {isPlatOpen&&channels.map(c=><tr key={c.channel} style={{background:'#edf3f8'}}>
         <td style={{paddingLeft:56}}><span className="badge" style={{fontSize:9}}>{c.channel}</span></td>
         {dataCells(c,hideSpend)}
        </tr>)}
       </React.Fragment>})}
     </React.Fragment>})}</tbody></ResponsiveTable></div>
   </div>}
  </section>})}</>;
}

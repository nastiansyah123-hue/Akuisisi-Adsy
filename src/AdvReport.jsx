import React,{useState}from'react';import{ChevronDown,ChevronRight,Inbox}from'lucide-react';import ResponsiveTable from'./ResponsiveTable';
const money=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n||0);
const num=n=>new Intl.NumberFormat('id-ID').format(n||0);
const pct=n=>`${(n*100).toFixed(1)}%`;
export default function AdvReport({groups,hideSpend}){
 const[expanded,setExpanded]=useState(new Set());
 const byAdv={};
 for(const g of groups){
  const k=g.advertiser;
  if(!byAdv[k])byAdv[k]={advertiser:k,leads:0,closing:0,units:0,revenue:0,spend:0,products:{}};
  const a=byAdv[k];
  a.leads+=g.leads;a.closing+=g.closing;a.units+=g.units;a.revenue+=g.revenue;a.spend+=g.spend;
  const pk=g.product;
  if(!a.products[pk])a.products[pk]={product:g.product,leads:0,closing:0,units:0,revenue:0,spend:0};
  const p=a.products[pk];
  p.leads+=g.leads;p.closing+=g.closing;p.units+=g.units;p.revenue+=g.revenue;p.spend+=g.spend;
 }
 const rows=Object.values(byAdv).sort((a,b)=>b.revenue-a.revenue);
 function toggle(name){setExpanded(prev=>{const next=new Set(prev);if(next.has(name))next.delete(name);else next.add(name);return next})}
 if(!rows.length)return <div className="empty"><Inbox size={30}/><strong>Belum ada data advertiser</strong><p>Ubah filter atau tunggu laporan masuk.</p></div>;
 const uniqueProducts=r=>[...new Set(Object.keys(r.products))];
 return <>{rows.map((r,i)=>{
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
    <div className="table-wrap"><ResponsiveTable><thead><tr><th>Produk</th><th>Leads</th><th>Closing</th><th>CR</th>{!hideSpend&&<th>Biaya iklan</th>}<th>Omzet</th>{!hideSpend&&<th>CAC</th>}{!hideSpend&&<th>CAQ</th>}</tr></thead><tbody>{prods.map(d=><tr key={d.product}>
     <td><strong>{d.product}</strong></td>
     <td>{num(d.leads)}</td>
     <td>{num(d.closing)}</td>
     <td><span className="rate">{pct(d.leads?d.closing/d.leads:0)}</span></td>
     {!hideSpend&&<td>{money(d.spend)}</td>}
     <td className="money">{money(d.revenue)}</td>
     {!hideSpend&&<td>{d.closing&&d.spend?money(d.spend/d.closing):'—'}</td>}
     {!hideSpend&&<td>{d.revenue&&d.spend?pct(d.spend/d.revenue):'—'}</td>}
    </tr>)}</tbody></ResponsiveTable></div>
   </div>}
  </section>})}</>;
}

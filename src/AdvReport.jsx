import React,{useState}from'react';import{ChevronDown,ChevronRight,Megaphone,Inbox}from'lucide-react';import ResponsiveTable from'./ResponsiveTable';
const money=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n||0);
const num=n=>new Intl.NumberFormat('id-ID').format(n||0);
const pct=n=>`${(n*100).toFixed(1)}%`;
export default function AdvReport({groups,hideSpend}){
 const[expanded,setExpanded]=useState(new Set());
 // Aggregate by advertiser
 const byAdv={};
 for(const g of groups){
  const k=g.advertiser;
  if(!byAdv[k])byAdv[k]={advertiser:k,leads:0,closing:0,units:0,revenue:0,spend:0,products:{}};
  const a=byAdv[k];
  a.leads+=g.leads;a.closing+=g.closing;a.units+=g.units;a.revenue+=g.revenue;a.spend+=g.spend;
  const pk=[g.product,g.channel].join('|');
  if(!a.products[pk])a.products[pk]={product:g.product,channel:g.channel,leads:0,closing:0,units:0,revenue:0,spend:0};
  const p=a.products[pk];
  p.leads+=g.leads;p.closing+=g.closing;p.units+=g.units;p.revenue+=g.revenue;p.spend+=g.spend;
 }
 const rows=Object.values(byAdv).sort((a,b)=>b.revenue-a.revenue);
 function toggle(name){setExpanded(prev=>{const next=new Set(prev);if(next.has(name))next.delete(name);else next.add(name);return next})}
 if(!rows.length)return <div className="empty"><Inbox size={30}/><strong>Belum ada data advertiser</strong><p>Ubah filter atau tunggu laporan masuk.</p></div>;
 return <div className="table-wrap"><ResponsiveTable><thead><tr><th>#</th><th>Advertiser</th><th>Leads</th><th>Closing</th><th>CR</th><th>Biaya iklan</th><th>Omzet</th><th>CAC</th><th>CAQ</th></tr></thead><tbody>{rows.map((r,i)=>{
  const isOpen=expanded.has(r.advertiser);
  const details=Object.values(r.products).sort((a,b)=>b.revenue-a.revenue);
  return <React.Fragment key={r.advertiser}>
   <tr className="adv-row" style={{cursor:'pointer'}} onClick={()=>toggle(r.advertiser)}>
    <td><strong>{i+1}</strong></td>
    <td><span className="person"><span className="person-avatar">{r.advertiser.slice(0,2).toUpperCase()}</span><strong>{r.advertiser}</strong><small className="cell-sub" style={{marginLeft:4}}>{details.length} produk</small>{isOpen?<ChevronDown size={14}/>:<ChevronRight size={14}/>}</span></td>
    <td>{num(r.leads)}</td>
    <td>{num(r.closing)}</td>
    <td><span className="rate">{pct(r.leads?r.closing/r.leads:0)}</span></td>
    <td>{hideSpend?'—':money(r.spend)}</td>
    <td className="money">{money(r.revenue)}</td>
    <td>{!hideSpend&&r.closing&&r.spend?money(r.spend/r.closing):'—'}</td>
    <td>{!hideSpend&&r.revenue&&r.spend?pct(r.spend/r.revenue):'—'}</td>
   </tr>
   {isOpen&&details.map(d=><tr key={r.advertiser+'|'+d.product+'|'+d.channel} className="adv-detail-row">
    <td></td>
    <td><span style={{paddingLeft:28}}>{d.product} · <span className={`badge ${d.channel==='CTWA'?'ctwa':'web'}`}>{d.channel}</span></span></td>
    <td>{num(d.leads)}</td>
    <td>{num(d.closing)}</td>
    <td><span className="rate">{pct(d.leads?d.closing/d.leads:0)}</span></td>
    <td>{hideSpend?'—':money(d.spend)}</td>
    <td className="money">{money(d.revenue)}</td>
    <td>{!hideSpend&&d.closing&&d.spend?money(d.spend/d.closing):'—'}</td>
    <td>{!hideSpend&&d.revenue&&d.spend?pct(d.spend/d.revenue):'—'}</td>
   </tr>)}
  </React.Fragment>})}</tbody></ResponsiveTable></div>;
}

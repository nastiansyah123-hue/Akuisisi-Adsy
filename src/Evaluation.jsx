import React,{useState,useMemo}from'react';
import{AlertTriangle,CheckCircle2,Zap,Loader,ChevronDown,ChevronUp,Settings,Save}from'lucide-react';
const money=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n||0);
const num=n=>new Intl.NumberFormat('id-ID').format(n||0);
const pct=n=>`${(n*100).toFixed(1)}%`;
const delta=(cur,prev)=>prev?((cur-prev)/prev*100):null;
const DEFAULT_KPI={max_caq:0.35,max_cac:150000,max_cpl:30000,min_cr:0.25,min_cr_cs:0.30,min_upsell:1.50};

function getKpi(kpiTargets,product){
 const found=kpiTargets.find(k=>k.product===product);
 return found||{...DEFAULT_KPI,product};
}

// Weighted average KPI for entity that spans multiple products
function weightedKpi(kpiTargets,productRevenues,type){
 const total=Object.values(productRevenues).reduce((s,v)=>s+v,0);
 if(!total)return DEFAULT_KPI;
 const fields=type==='cs'?['min_cr_cs','min_upsell']:['max_caq','max_cac','max_cpl','min_cr'];
 const result={...DEFAULT_KPI};
 for(const f of fields){
  result[f]=Object.entries(productRevenues).reduce((s,[prod,rev])=>{
   const k=getKpi(kpiTargets,prod);
   return s+(Number(k[f])||Number(DEFAULT_KPI[f]))*rev/total;
  },0);
 }
 return result;
}

function analyzeEntity(name,cur,prev,type,teamAvg,kpi,leadData,correctionCount){
 const insights=[];
 const cr=cur.leads?cur.closing/cur.leads:0;
 const prevCr=prev.leads?prev.closing/prev.leads:0;
 const caq=cur.revenue?cur.spend/cur.revenue:0;
 const prevCaq=prev.revenue?prev.spend/prev.revenue:0;
 const cac=cur.closing?cur.spend/cur.closing:0;
 const prevCac=prev.closing?prev.spend/prev.closing:0;
 const cpl=cur.leads?cur.spend/cur.leads:0;
 const roas=cur.spend?cur.revenue/cur.spend:0;
 const revDelta=delta(cur.revenue,prev.revenue);
 const leadsDelta=delta(cur.leads,prev.leads);
 const spendDelta=delta(cur.spend,prev.spend);
 const crDelta=prevCr?(cr-prevCr)/prevCr*100:null;
 const caqDelta=prevCaq?(caq-prevCaq)/prevCaq*100:null;
 const cacDelta=prevCac?(cac-prevCac)/prevCac*100:null;
 const hasPrev=prev.leads>0||prev.revenue>0;

 // KPI thresholds
 const targetCr=type==='cs'?kpi.min_cr_cs:kpi.min_cr;

 // === Tren (vs periode sebelumnya) ===
 if(hasPrev){
  if(revDelta!==null){
   if(revDelta<=-20)insights.push({level:'danger',text:`Omzet turun drastis ${revDelta.toFixed(1)}% (${money(prev.revenue)} → ${money(cur.revenue)})`});
   else if(revDelta<=-5)insights.push({level:'warning',text:`Omzet turun ${revDelta.toFixed(1)}% (${money(prev.revenue)} → ${money(cur.revenue)})`});
   else if(revDelta>=20)insights.push({level:'success',text:`Omzet naik signifikan +${revDelta.toFixed(1)}% → ${money(cur.revenue)}`});
   else if(revDelta>=5)insights.push({level:'success',text:`Omzet naik +${revDelta.toFixed(1)}%`});
  }
  if(crDelta!==null){
   if(crDelta<=-15)insights.push({level:'danger',text:`CR turun tajam (${pct(prevCr)} → ${pct(cr)})`});
   else if(crDelta<=-5)insights.push({level:'warning',text:`CR menurun (${pct(prevCr)} → ${pct(cr)})`});
   else if(crDelta>=10)insights.push({level:'success',text:`CR membaik (${pct(prevCr)} → ${pct(cr)})`});
  }
  if(cur.spend>0&&prev.spend>0){
   if(caqDelta!==null&&caqDelta>=20)insights.push({level:'danger',text:`CAQ naik signifikan (${pct(prevCaq)} → ${pct(caq)})`});
   else if(caqDelta!==null&&caqDelta>=5)insights.push({level:'warning',text:`CAQ naik (${pct(prevCaq)} → ${pct(caq)})`});
   else if(caqDelta!==null&&caqDelta<=-10)insights.push({level:'success',text:`CAQ membaik (${pct(prevCaq)} → ${pct(caq)})`});
   if(cacDelta!==null&&cacDelta>=20)insights.push({level:'danger',text:`CAC naik (${money(prevCac)} → ${money(cac)})`});
   else if(cacDelta!==null&&cacDelta<=-10)insights.push({level:'success',text:`CAC turun (${money(prevCac)} → ${money(cac)})`});
   if(spendDelta>10&&revDelta!==null&&revDelta<5)
    insights.push({level:'danger',text:`Biaya iklan naik +${spendDelta.toFixed(1)}% tapi omzet ${revDelta>0?'hanya naik '+revDelta.toFixed(1)+'%':'turun '+Math.abs(revDelta).toFixed(1)+'%'}`});
  }
  if(leadsDelta!==null){
   if(leadsDelta<=-20)insights.push({level:'danger',text:`Leads turun drastis ${leadsDelta.toFixed(1)}%`});
   else if(leadsDelta<=-5)insights.push({level:'warning',text:`Leads menurun ${leadsDelta.toFixed(1)}%`});
   else if(leadsDelta>=20)insights.push({level:'success',text:`Leads naik +${leadsDelta.toFixed(1)}%`});
  }
 }

 // === KPI-based thresholds ===
 // CR vs target
 if(cur.leads>0){
  if(cr<targetCr*0.6)insights.push({level:'danger',text:`CR ${pct(cr)} jauh di bawah target ${pct(targetCr)}`});
  else if(cr<targetCr)insights.push({level:'warning',text:`CR ${pct(cr)} di bawah target ${pct(targetCr)}`});
  else if(cr>=targetCr*1.3)insights.push({level:'success',text:`CR ${pct(cr)} melampaui target ${pct(targetCr)}`});
  else insights.push({level:'success',text:`CR ${pct(cr)} memenuhi target ${pct(targetCr)}`});
 }
 // Benchmark vs rata-rata tim
 if(cur.leads>0&&teamAvg.cr>0){
  const diff=(cr-teamAvg.cr)/teamAvg.cr*100;
  if(diff<=-30)insights.push({level:'danger',text:`CR jauh di bawah rata-rata tim (${pct(cr)} vs avg ${pct(teamAvg.cr)})`});
  else if(diff>=30)insights.push({level:'success',text:`CR di atas rata-rata tim (${pct(cr)} vs avg ${pct(teamAvg.cr)})`});
 }
 // CAQ vs target
 if(cur.spend>0&&cur.revenue>0){
  if(caq>kpi.max_caq*1.3)insights.push({level:'danger',text:`CAQ ${pct(caq)} jauh di atas target ${pct(kpi.max_caq)}`});
  else if(caq>kpi.max_caq)insights.push({level:'warning',text:`CAQ ${pct(caq)} di atas target ${pct(kpi.max_caq)}`});
  else if(caq<kpi.max_caq*0.7)insights.push({level:'success',text:`CAQ ${pct(caq)} jauh di bawah target ${pct(kpi.max_caq)}`});
 }
 // CAC vs target
 if(cur.spend>0&&cur.closing>0){
  if(cac>kpi.max_cac*1.3)insights.push({level:'danger',text:`CAC ${money(cac)} jauh di atas target ${money(kpi.max_cac)}`});
  else if(cac>kpi.max_cac)insights.push({level:'warning',text:`CAC ${money(cac)} di atas target ${money(kpi.max_cac)}`});
  else if(cac<kpi.max_cac*0.7)insights.push({level:'success',text:`CAC ${money(cac)} di bawah target ${money(kpi.max_cac)}`});
 }
 // CPL vs target
 if(cur.spend>0&&cur.leads>0){
  if(cpl>kpi.max_cpl*1.3)insights.push({level:'danger',text:`CPL ${money(cpl)} jauh di atas target ${money(kpi.max_cpl)}`});
  else if(cpl>kpi.max_cpl)insights.push({level:'warning',text:`CPL ${money(cpl)} di atas target ${money(kpi.max_cpl)}`});
  else if(cpl<kpi.max_cpl*0.7)insights.push({level:'success',text:`CPL ${money(cpl)} di bawah target ${money(kpi.max_cpl)}`});
 }
 // ROAS
 if(cur.spend>0){
  if(roas<2)insights.push({level:'danger',text:`ROAS rendah: ${roas.toFixed(1)}× — belum balik modal`});
  else if(roas>=5)insights.push({level:'success',text:`ROAS tinggi: ${roas.toFixed(1)}×`});
 }
 // Anomali
 if(cur.spend>0&&cur.closing===0&&cur.leads>0)insights.push({level:'danger',text:`Spend ${money(cur.spend)} tapi 0 closing`});
 if(cur.leads>5&&cur.closing===0)insights.push({level:'danger',text:`${num(cur.leads)} leads tapi 0 closing`});
 if(cur.leads===0&&cur.closing===0)insights.push({level:'warning',text:'Tidak ada aktivitas di periode ini'});

 // === CS-specific ===
 if(type==='cs'){
  const upsell=cur.closing?cur.units/cur.closing:0;
  if(cur.closing>0){
   if(upsell<kpi.min_upsell*0.7)insights.push({level:'danger',text:`Upsell ${upsell.toFixed(2)}× jauh di bawah target ${kpi.min_upsell.toFixed(2)}×`});
   else if(upsell<kpi.min_upsell)insights.push({level:'warning',text:`Upsell ${upsell.toFixed(2)}× di bawah target ${kpi.min_upsell.toFixed(2)}×`});
   else if(upsell>=kpi.min_upsell*1.3)insights.push({level:'success',text:`Upsell ${upsell.toFixed(2)}× melampaui target ${kpi.min_upsell.toFixed(2)}×`});
  }
  if(hasPrev){
   const prevUpsell=prev.closing?prev.units/prev.closing:0;
   if(prevUpsell>0&&upsell>0){
    const upDelta=(upsell-prevUpsell)/prevUpsell*100;
    if(upDelta<=-10)insights.push({level:'warning',text:`Upsell turun (${prevUpsell.toFixed(2)}× → ${upsell.toFixed(2)}×)`});
    else if(upDelta>=10)insights.push({level:'success',text:`Upsell naik (${prevUpsell.toFixed(2)}× → ${upsell.toFixed(2)}×)`});
   }
  }
  if(leadData&&leadData.total>0){
   const p=k=>(leadData[k]||0)/leadData.total;
   if(p('passive')>0.4)insights.push({level:'danger',text:`${pct(p('passive'))} lead pasif — banyak tidak ditindaklanjuti`});
   if(p('ooc')>0.25)insights.push({level:'warning',text:`${pct(p('ooc'))} lead OOC — belum punya budget`});
   if(p('consultation')>0.3&&cr<targetCr)insights.push({level:'warning',text:`${pct(p('consultation'))} konsultasi tapi CR rendah — gagal closing`});
   if(p('boughtElsewhere')>0.1)insights.push({level:'warning',text:`${pct(p('boughtElsewhere'))} beli di tempat lain`});
  }
  if(correctionCount>3)insights.push({level:'warning',text:`${correctionCount} koreksi data — sering salah input`});
 }

 if(!insights.length)insights.push({level:'neutral',text:'Performa stabil.'});

 const score=insights.reduce((s,i)=>s+(i.level==='danger'?-2:i.level==='warning'?-1:i.level==='success'?1:0),0);
 const overall=score<=-2?'danger':score<0?'warning':score>=1?'success':'neutral';

 return {name,cur,prev,insights,overall,cr,caq,cac,cpl,roas,revDelta,leadsDelta};
}

function aggregate(groups,byKey){
 const map={};
 for(const g of groups){
  const keys=byKey==='cs'?g.cs:[g[byKey]];
  for(const k of keys){
   if(!map[k])map[k]={leads:0,closing:0,units:0,revenue:0,spend:0};
   map[k].leads+=g.leads;map[k].closing+=g.closing;map[k].units+=g.units;map[k].revenue+=g.revenue;map[k].spend+=g.spend;
  }
 }
 return map;
}

// Revenue per product per entity (for weighted KPI)
function aggregateByProduct(groups,byKey){
 const map={};
 for(const g of groups){
  const keys=byKey==='cs'?g.cs:[g[byKey]];
  for(const k of keys){
   if(!map[k])map[k]={};
   map[k][g.product]=(map[k][g.product]||0)+g.revenue;
  }
 }
 return map;
}

function renderMarkdown(text){
 return text.split('\n').map((line,i)=>{
  const t=line.trim();
  if(!t)return null;
  const bold=s=>s.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  if(t.startsWith('### '))return <h4 key={i} className="ai-h4" dangerouslySetInnerHTML={{__html:bold(t.slice(4))}}/>;
  if(t.startsWith('## '))return <h3 key={i} className="ai-h3" dangerouslySetInnerHTML={{__html:bold(t.slice(3))}}/>;
  if(t.startsWith('# '))return <h3 key={i} className="ai-h3" dangerouslySetInnerHTML={{__html:bold(t.slice(2))}}/>;
  if(t.startsWith('- ')||t.startsWith('• '))return <li key={i} className="ai-li" dangerouslySetInnerHTML={{__html:bold(t.slice(2))}}/>;
  if(/^\d+\.\s/.test(t))return <li key={i} className="ai-li" dangerouslySetInnerHTML={{__html:bold(t.replace(/^\d+\.\s/,''))}}/>;
  return <p key={i} dangerouslySetInnerHTML={{__html:bold(t)}}/>;
 }).filter(Boolean);
}

function KpiSettings({catalog,kpiTargets,onSave}){
 const products=catalog.map(c=>c.name).sort();
 const[edits,setEdits]=useState(()=>{
  const map={};
  for(const p of products){
   const existing=kpiTargets.find(k=>k.product===p);
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
  const existing=kpiTargets.find(k=>k.product===product);
  await onSave({...row,id:existing?.id||undefined,product,updated_at:new Date().toISOString()});
  setSaving(null);
 };

 return <div className="kpi-settings">
  <div className="table-wrap"><table className="kpi-table">
   <thead><tr>
    <th>Produk</th><th>CAQ Max</th><th>CAC Max</th><th>CPL Max</th><th>CR Min (Adv)</th><th>CR Min (CS)</th><th>Upsell Min</th><th></th>
   </tr></thead>
   <tbody>{products.map(p=>{
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
   })}</tbody>
  </table></div>
 </div>;
}

function Card({analysis,type,hideSpend,aiSummary}){
 const[expanded,setExpanded]=useState(false);
 const bg={danger:'#fbefeb',warning:'#fef8eb',success:'#ebf7f0',neutral:'#f4f9fc'};
 const border={danger:'#f1d7ce',warning:'#f5e6c0',success:'#c8e6d4',neutral:'#cce0ec'};
 const icon={danger:<AlertTriangle size={18} color="#a35343"/>,warning:<AlertTriangle size={18} color="#b59b5b"/>,success:<CheckCircle2 size={18} color="#3a8a5c"/>,neutral:<CheckCircle2 size={18} color="#587488"/>};
 const label={danger:'Perlu Perhatian',warning:'Peringatan',success:'Performa Baik',neutral:'Stabil'};
 const a=analysis;
 return <div className="eval-card" style={{background:bg[a.overall],borderColor:border[a.overall]}}>
  <div className="eval-card-head" onClick={()=>setExpanded(!expanded)}>
   {icon[a.overall]}
   <div style={{flex:1,minWidth:0}}>
    <div className="eval-card-title">
     <strong>{a.name}</strong>
     <span className={`eval-badge eval-badge-${a.overall}`}>{label[a.overall]}</span>
    </div>
    <div className="eval-metrics">
     <span>Omzet <b>{money(a.cur.revenue)}</b>{a.revDelta!==null&&<small className={a.revDelta>=0?'up':'down'}> {a.revDelta>0?'↑':'↓'}{Math.abs(a.revDelta).toFixed(1)}%</small>}</span>
     <span>Leads <b>{num(a.cur.leads)}</b></span>
     <span>Closing <b>{num(a.cur.closing)}</b></span>
     <span>CR <b>{pct(a.cr)}</b></span>
     {!hideSpend&&a.cur.spend>0&&<><span>CAC <b>{money(a.cac)}</b></span><span>CAQ <b>{pct(a.caq)}</b></span><span>CPL <b>{money(a.cpl)}</b></span><span>ROAS <b>{a.roas.toFixed(1)}×</b></span></>}
     {type==='cs'&&a.cur.closing>0&&<span>Upsell <b>{(a.cur.units/a.cur.closing).toFixed(2)}×</b></span>}
    </div>
   </div>
   {expanded?<ChevronUp size={18} color="#587488"/>:<ChevronDown size={18} color="#587488"/>}
  </div>
  {expanded&&<div className="eval-card-body">
   <ul className="eval-insights">
    {a.insights.map((ins,i)=><li key={i} className={`eval-${ins.level}`}>{ins.text}</li>)}
   </ul>
   {aiSummary&&<div className="eval-card-ai-text">{renderMarkdown(aiSummary)}</div>}
  </div>}
 </div>;
}

export default function Evaluation({reports,ads,leadReports,corrections,kpiTargets,catalog,period,hideSpend,role,onSaveKpi}){
 const[tab,setTab]=useState('advertiser');
 const[aiTexts,setAiTexts]=useState({});
 const[aiLoading,setAiLoading]=useState(false);
 const[showKpi,setShowKpi]=useState(false);
 const aiKey=import.meta.env.VITE_CLAUDE_API_KEY||'';

 const {curGroups,prevGroups}=useMemo(()=>{
  const {start,end}=period;
  if(!start||!end)return {curGroups:[],prevGroups:[]};
  const days=Math.round((new Date(end+'T12:00:00Z')-new Date(start+'T12:00:00Z'))/(86400000))+1;
  const prevEnd=new Date(new Date(start+'T12:00:00Z').getTime()-86400000);
  const prevStart=new Date(prevEnd.getTime()-(days-1)*86400000);
  const ps=prevStart.toISOString().slice(0,10),pe=prevEnd.toISOString().slice(0,10);
  const curR=reports.filter(r=>r.date>=start&&r.date<=end);
  const curA=ads.filter(a=>a.date>=start&&a.date<=end);
  const prevR=reports.filter(r=>r.date>=ps&&r.date<=pe);
  const prevA=ads.filter(a=>a.date>=ps&&a.date<=pe);
  const summarizeLocal=(reps,adsList)=>{
   const map={};
   for(const r of reps){
    const k=[r.date,r.product,r.advertiser,r.channel].join('|');
    if(!map[k])map[k]={date:r.date,product:r.product,advertiser:r.advertiser,channel:r.channel,leads:0,closing:0,units:0,revenue:0,spend:0,cs:[]};
    map[k].leads+=Number(r.leads);map[k].closing+=Number(r.closing)-Number(r.invalid||0);
    map[k].units+=Number(r.units)-Number(r.invalidUnits||0);map[k].revenue+=Number(r.revenue);
    if(!map[k].cs.includes(r.cs))map[k].cs.push(r.cs);
   }
   for(const a of adsList){
    const k=[a.date,a.product,a.advertiser,a.channel].join('|');
    if(!map[k])map[k]={date:a.date,product:a.product,advertiser:a.advertiser,channel:a.channel,leads:0,closing:0,units:0,revenue:0,spend:0,cs:[]};
    map[k].spend+=Number(a.budget)*(1+Number(a.tax)/100);
   }
   return Object.values(map);
  };
  return {curGroups:summarizeLocal(curR,curA),prevGroups:summarizeLocal(prevR,prevA)};
 },[reports,ads,period]);

 const csLeadData=useMemo(()=>{
  if(!leadReports||!leadReports.length)return {};
  const {start,end}=period;
  const reportMap=new Map(reports.filter(r=>r.date>=start&&r.date<=end).map(r=>[r.id,r]));
  const map={};
  for(const lr of leadReports){
   const r=reportMap.get(lr.reportId);
   if(!r)continue;
   if(!map[r.cs])map[r.cs]={total:0,passive:0,consultation:0,priceShipping:0,ooc:0,casual:0,boughtElsewhere:0,other:0};
   const c=lr.counts||{};
   for(const k of Object.keys(map[r.cs])){
    if(k==='total')continue;
    map[r.cs][k]+=Number(c[k]||0);
    map[r.cs].total+=Number(c[k]||0);
   }
  }
  return map;
 },[leadReports,reports,period]);

 const csCorrectionCount=useMemo(()=>{
  if(!corrections||!corrections.length)return {};
  const {start,end}=period;
  const reportIds=new Set(reports.filter(r=>r.date>=start&&r.date<=end).map(r=>r.id));
  const reportCS=new Map(reports.map(r=>[r.id,r.cs]));
  const map={};
  for(const c of corrections){
   if(!reportIds.has(c.reportId))continue;
   const cs=reportCS.get(c.reportId);
   if(cs)map[cs]=(map[cs]||0)+1;
  }
  return map;
 },[corrections,reports,period]);

 const teamAvg=useMemo(()=>{
  const key=tab==='advertiser'?'advertiser':'cs';
  const curMap=aggregate(curGroups,key);
  const vals=Object.values(curMap);
  if(!vals.length)return {cr:0};
  const totalLeads=vals.reduce((s,v)=>s+v.leads,0);
  const totalClosing=vals.reduce((s,v)=>s+v.closing,0);
  return {cr:totalLeads?totalClosing/totalLeads:0};
 },[curGroups,tab]);

 const analyses=useMemo(()=>{
  const key=tab==='advertiser'?'advertiser':'cs';
  const curMap=aggregate(curGroups,key);
  const prevMap=aggregate(prevGroups,key);
  const prodRevMap=aggregateByProduct(curGroups,key);
  const allNames=[...new Set([...Object.keys(curMap),...Object.keys(prevMap)])];
  const zero={leads:0,closing:0,units:0,revenue:0,spend:0};
  const targets=kpiTargets||[];
  return allNames
   .map(n=>{
    const kpi=weightedKpi(targets,prodRevMap[n]||{},key);
    return analyzeEntity(n,curMap[n]||zero,prevMap[n]||zero,key,teamAvg,kpi,
     key==='cs'?csLeadData[n]:null,
     key==='cs'?(csCorrectionCount[n]||0):0);
   })
   .sort((a,b)=>{
    const order={danger:0,warning:1,neutral:2,success:3};
    return (order[a.overall]-order[b.overall])||b.cur.revenue-a.cur.revenue;
   });
 },[curGroups,prevGroups,tab,teamAvg,csLeadData,csCorrectionCount,kpiTargets]);

 const dangerCount=analyses.filter(a=>a.overall==='danger').length;
 const warnCount=analyses.filter(a=>a.overall==='warning').length;
 const goodCount=analyses.filter(a=>a.overall==='success').length;

 async function generateAll(){
  if(!aiKey||!analyses.length)return;
  setAiLoading(true);
  try{
   const dataBlock=analyses.map(a=>{
    let line=`[${a.name}] Omzet: ${money(a.cur.revenue)}`;
    if(a.revDelta!==null)line+=` (${a.revDelta>0?'+':''}${a.revDelta.toFixed(1)}% vs sebelumnya)`;
    line+=`, Leads: ${num(a.cur.leads)}, Closing: ${num(a.cur.closing)}, CR: ${pct(a.cr)}`;
    if(a.cur.spend>0)line+=`, CAC: ${money(a.cac)}, CAQ: ${pct(a.caq)}, CPL: ${money(a.cpl)}, ROAS: ${a.roas.toFixed(1)}×`;
    if(a.cur.closing>0&&tab==='cs')line+=`, Upsell: ${(a.cur.units/a.cur.closing).toFixed(2)}×`;
    line+=` | Status: ${a.overall} | ${a.insights.map(i=>i.text).join('; ')}`;
    return line;
   }).join('\n');

   const names=analyses.map(a=>a.name);
   const prompt=`Kamu analis performa akuisisi digital marketing. Data ${tab==='advertiser'?'per advertiser':'per CS'} periode ini (rata-rata CR tim: ${pct(teamAvg.cr)}):\n\n${dataBlock}\n\n`+
    `Berikan evaluasi untuk SETIAP ${tab==='advertiser'?'advertiser':'CS'} dengan format:\n\n`+
    names.map(n=>`[${n}]\n(tulis 2-3 kalimat evaluasi + 1 rekomendasi aksi)`).join('\n\n')+
    `\n\nAturan:\n- Format: [Nama] diikuti paragraf evaluasi\n- Bahasa Indonesia, to the point\n- Jangan pakai heading (#), bullet (-), atau numbering\n- Sebutkan angka penting, bandingkan dengan target KPI dan rata-rata tim\n- Rekomendasi harus spesifik dan actionable`;

   const res=await fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{'Content-Type':'application/json','x-api-key':aiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
    body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:2048,messages:[{role:'user',content:prompt}]})
   });
   if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error?.message||`HTTP ${res.status}`);}
   const data=await res.json();
   const text=data.content?.[0]?.text||'';
   const result={};
   for(let i=0;i<names.length;i++){
    const marker=`[${names[i]}]`;
    const idx=text.indexOf(marker);
    if(idx===-1)continue;
    const start=idx+marker.length;
    let end=text.length;
    for(let j=i+1;j<names.length;j++){
     const nextIdx=text.indexOf(`[${names[j]}]`,start);
     if(nextIdx!==-1){end=nextIdx;break;}
    }
    result[`${tab}-${names[i]}`]=text.slice(start,end).trim();
   }
   setAiTexts(prev=>({...prev,...result}));
  }catch(e){console.error('AI error:',e);}
  finally{setAiLoading(false);}
 }

 return <div className="eval-page">
  <div className="eval-summary-bar">
   <div className="eval-summary-item eval-danger-bg"><AlertTriangle size={16}/><strong>{dangerCount}</strong> Perlu perhatian</div>
   <div className="eval-summary-item eval-warning-bg"><AlertTriangle size={16}/><strong>{warnCount}</strong> Peringatan</div>
   <div className="eval-summary-item eval-success-bg"><CheckCircle2 size={16}/><strong>{goodCount}</strong> Performa baik</div>
  </div>

  <div className="eval-controls">
   <div className="eval-tabs">
    <button className={tab==='advertiser'?'active':''} onClick={()=>setTab('advertiser')}>Advertiser ({analyses.length})</button>
    <button className={tab==='cs'?'active':''} onClick={()=>setTab('cs')}>CS ({analyses.length})</button>
   </div>
   <div className="eval-actions">
    {role==='admin'&&<button className={`button ${showKpi?'primary':''}`} onClick={()=>setShowKpi(!showKpi)}><Settings size={15}/>{showKpi?'Tutup KPI':'Atur KPI'}</button>}
    {aiKey&&<button className="button primary" onClick={generateAll} disabled={aiLoading}>
     {aiLoading?<><Loader size={15} className="spin"/>Menganalisis...</>:<><Zap size={15}/>Ringkasan AI</>}
    </button>}
   </div>
  </div>

  {showKpi&&role==='admin'&&<KpiSettings catalog={catalog||[]} kpiTargets={kpiTargets||[]} onSave={onSaveKpi}/>}

  <div className="eval-cards">
   {analyses.map(a=><Card key={a.name} analysis={a} type={tab} hideSpend={hideSpend}
    aiSummary={aiTexts[`${tab}-${a.name}`]}/>)}
  </div>
  {!analyses.length&&<div className="empty" style={{marginTop:20}}><AlertTriangle size={28}/><strong>Belum ada data untuk dievaluasi</strong><p>Pastikan filter periode mencakup data laporan.</p></div>}
 </div>;
}

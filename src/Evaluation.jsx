import React,{useState,useMemo}from'react';
import{TrendingUp,TrendingDown,AlertTriangle,CheckCircle2,Zap,Loader}from'lucide-react';
const money=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n||0);
const num=n=>new Intl.NumberFormat('id-ID').format(n||0);
const pct=n=>`${(n*100).toFixed(1)}%`;
const delta=(cur,prev)=>prev?((cur-prev)/prev*100):null;
const arrow=(d)=>d===null?'':'  '+(d>0?'↑':'↓')+Math.abs(d).toFixed(1)+'%';

function analyzeEntity(name,cur,prev,type){
 const insights=[];
 const cr=cur.leads?cur.closing/cur.leads:0;
 const prevCr=prev.leads?prev.closing/prev.leads:0;
 const caq=cur.revenue?cur.spend/cur.revenue:0;
 const prevCaq=prev.revenue?prev.spend/prev.revenue:0;
 const cac=cur.closing?cur.spend/cur.closing:0;
 const prevCac=prev.closing?prev.spend/prev.closing:0;
 const revDelta=delta(cur.revenue,prev.revenue);
 const leadsDelta=delta(cur.leads,prev.leads);
 const closingDelta=delta(cur.closing,prev.closing);
 const spendDelta=delta(cur.spend,prev.spend);
 const crDelta=prevCr?(cr-prevCr)/prevCr*100:null;
 const caqDelta=prevCaq?(caq-prevCaq)/prevCaq*100:null;
 const cacDelta=prevCac?(cac-prevCac)/prevCac*100:null;

 // Revenue
 if(revDelta!==null){
  if(revDelta<=-20)insights.push({level:'danger',text:`Omzet turun drastis ${revDelta.toFixed(1)}% (${money(prev.revenue)} → ${money(cur.revenue)})`});
  else if(revDelta<=-5)insights.push({level:'warning',text:`Omzet turun ${revDelta.toFixed(1)}% (${money(prev.revenue)} → ${money(cur.revenue)})`});
  else if(revDelta>=20)insights.push({level:'success',text:`Omzet naik signifikan +${revDelta.toFixed(1)}% (${money(cur.revenue)})`});
  else if(revDelta>=5)insights.push({level:'success',text:`Omzet naik +${revDelta.toFixed(1)}%`});
 }

 // Closing rate
 if(crDelta!==null){
  if(crDelta<=-15)insights.push({level:'danger',text:`Closing rate turun tajam (${pct(prevCr)} → ${pct(cr)})`});
  else if(crDelta<=-5)insights.push({level:'warning',text:`Closing rate menurun (${pct(prevCr)} → ${pct(cr)})`});
  else if(crDelta>=10)insights.push({level:'success',text:`Closing rate membaik (${pct(prevCr)} → ${pct(cr)})`});
 }

 // CAQ (only for advertiser or when spend available)
 if(cur.spend>0&&prev.spend>0){
  if(caqDelta!==null){
   if(caqDelta>=20)insights.push({level:'danger',text:`CAQ naik signifikan (${pct(prevCaq)} → ${pct(caq)}) — biaya makin besar vs omzet`});
   else if(caqDelta>=5)insights.push({level:'warning',text:`CAQ naik (${pct(prevCaq)} → ${pct(caq)})`});
   else if(caqDelta<=-10)insights.push({level:'success',text:`CAQ membaik (${pct(prevCaq)} → ${pct(caq)}) — efisiensi naik`});
  }
  if(cacDelta!==null){
   if(cacDelta>=20)insights.push({level:'danger',text:`CAC naik (${money(prevCac)} → ${money(cac)}) — cost per closing makin mahal`});
   else if(cacDelta<=-10)insights.push({level:'success',text:`CAC turun (${money(prevCac)} → ${money(cac)})`});
  }
  // Spend up but revenue flat/down
  if(spendDelta>10&&revDelta!==null&&revDelta<5){
   insights.push({level:'danger',text:`Biaya iklan naik +${spendDelta.toFixed(1)}% tapi omzet ${revDelta>0?'hanya naik '+revDelta.toFixed(1)+'%':'turun '+Math.abs(revDelta).toFixed(1)+'%'} — perlu evaluasi iklan`});
  }
 }

 // Leads
 if(leadsDelta!==null){
  if(leadsDelta<=-20)insights.push({level:'danger',text:`Leads turun drastis ${leadsDelta.toFixed(1)}% (${num(prev.leads)} → ${num(cur.leads)})`});
  else if(leadsDelta<=-5)insights.push({level:'warning',text:`Leads menurun ${leadsDelta.toFixed(1)}%`});
  else if(leadsDelta>=20)insights.push({level:'success',text:`Leads naik +${leadsDelta.toFixed(1)}%`});
 }

 // Upsell (for CS)
 if(type==='cs'){
  const upsell=cur.closing?cur.units/cur.closing:0;
  const prevUpsell=prev.closing?prev.units/prev.closing:0;
  if(prevUpsell>0&&upsell>0){
   const upDelta=(upsell-prevUpsell)/prevUpsell*100;
   if(upDelta<=-10)insights.push({level:'warning',text:`Upsell turun (${prevUpsell.toFixed(2)}× → ${upsell.toFixed(2)}×)`});
   else if(upDelta>=10)insights.push({level:'success',text:`Upsell naik (${prevUpsell.toFixed(2)}× → ${upsell.toFixed(2)}×)`});
  }
 }

 if(!insights.length)insights.push({level:'neutral',text:'Performa stabil, tidak ada perubahan signifikan.'});

 const score=insights.reduce((s,i)=>s+(i.level==='danger'?-2:i.level==='warning'?-1:i.level==='success'?1:0),0);
 const overall=score<=-2?'danger':score<0?'warning':score>=2?'success':'neutral';

 return {name,cur,prev,insights,overall,cr,caq,cac,revDelta,leadsDelta,closingDelta};
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

function Card({analysis,type,hideSpend}){
 const bg={danger:'#fbefeb',warning:'#fef8eb',success:'#ebf7f0',neutral:'#f4f9fc'};
 const border={danger:'#f1d7ce',warning:'#f5e6c0',success:'#c8e6d4',neutral:'#cce0ec'};
 const icon={danger:<AlertTriangle size={18} color="#a35343"/>,warning:<AlertTriangle size={18} color="#b59b5b"/>,success:<CheckCircle2 size={18} color="#3a8a5c"/>,neutral:<CheckCircle2 size={18} color="#587488"/>};
 const a=analysis;
 return <div className="eval-card" style={{background:bg[a.overall],borderColor:border[a.overall]}}>
  <div className="eval-card-head">
   {icon[a.overall]}
   <div>
    <strong>{a.name}</strong>
    <div className="eval-metrics">
     <span>Omzet <b>{money(a.cur.revenue)}</b>{a.revDelta!==null&&<small className={a.revDelta>=0?'up':'down'}>{arrow(a.revDelta)}</small>}</span>
     <span>Leads <b>{num(a.cur.leads)}</b></span>
     <span>Closing <b>{num(a.cur.closing)}</b></span>
     <span>CR <b>{pct(a.cr)}</b></span>
     {!hideSpend&&a.cur.spend>0&&<><span>CAC <b>{money(a.cac)}</b></span><span>CAQ <b>{pct(a.caq)}</b></span></>}
     {type==='cs'&&a.cur.closing>0&&<span>Upsell <b>{(a.cur.units/a.cur.closing).toFixed(2)}×</b></span>}
    </div>
   </div>
  </div>
  <ul className="eval-insights">
   {a.insights.map((ins,i)=><li key={i} className={`eval-${ins.level}`}>{ins.text}</li>)}
  </ul>
 </div>;
}

export default function Evaluation({reports,ads,period,hideSpend}){
 const[tab,setTab]=useState('advertiser');
 const[aiText,setAiText]=useState('');
 const[aiLoading,setAiLoading]=useState(false);
 const aiKey=import.meta.env.VITE_CLAUDE_API_KEY||'';

 // Calculate previous period of same length
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

 const analyses=useMemo(()=>{
  const key=tab==='advertiser'?'advertiser':'cs';
  const curMap=aggregate(curGroups,key);
  const prevMap=aggregate(prevGroups,key);
  const allNames=[...new Set([...Object.keys(curMap),...Object.keys(prevMap)])];
  const zero={leads:0,closing:0,units:0,revenue:0,spend:0};
  return allNames
   .map(n=>analyzeEntity(n,curMap[n]||zero,prevMap[n]||zero,key))
   .sort((a,b)=>{
    const order={danger:0,warning:1,neutral:2,success:3};
    return (order[a.overall]-order[b.overall])||b.cur.revenue-a.cur.revenue;
   });
 },[curGroups,prevGroups,tab]);

 const dangerCount=analyses.filter(a=>a.overall==='danger').length;
 const warnCount=analyses.filter(a=>a.overall==='warning').length;
 const goodCount=analyses.filter(a=>a.overall==='success').length;

 async function generateAI(){
  if(!aiKey){setAiText('Error: VITE_CLAUDE_API_KEY belum diatur di environment variable Vercel.');return;}
  setAiLoading(true);setAiText('');
  try{
   const summary=analyses.map(a=>`${a.name}: omzet ${money(a.cur.revenue)}${a.revDelta!==null?' ('+a.revDelta.toFixed(1)+'%)':''},`+
    ` leads ${a.cur.leads}, closing ${a.cur.closing}, CR ${pct(a.cr)}`+
    (a.cur.spend>0?`, CAC ${money(a.cac)}, CAQ ${pct(a.caq)}`:'')+
    ` | ${a.insights.map(i=>i.text).join('; ')}`).join('\n');
   const prompt=`Kamu adalah analis performa tim akuisisi digital marketing. Berikut data evaluasi ${tab==='advertiser'?'per advertiser':'per CS'} periode ini vs periode sebelumnya:\n\n${summary}\n\nBuatkan ringkasan evaluasi dalam Bahasa Indonesia yang:\n1. Highlight 2-3 masalah utama yang perlu ditindak segera\n2. Apresiasi performa yang bagus\n3. Rekomendasi aksi konkret untuk minggu depan\n4. Gunakan format yang ringkas dan mudah dipahami tim\n\nJangan ulangi semua angka, fokus pada insight dan rekomendasi aksi.`;
   const res=await fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{'Content-Type':'application/json','x-api-key':aiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
    body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:1024,messages:[{role:'user',content:prompt}]})
   });
   if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error?.message||`HTTP ${res.status}`);}
   const data=await res.json();
   setAiText(data.content?.[0]?.text||'Tidak ada respons.');
  }catch(e){setAiText('Error: '+e.message);}finally{setAiLoading(false);}
 }

 return <div className="eval-page">
  <div className="eval-summary-bar">
   <div className="eval-summary-item eval-danger-bg"><AlertTriangle size={16}/><strong>{dangerCount}</strong> Perlu perhatian</div>
   <div className="eval-summary-item eval-warning-bg"><AlertTriangle size={16}/><strong>{warnCount}</strong> Peringatan</div>
   <div className="eval-summary-item eval-success-bg"><CheckCircle2 size={16}/><strong>{goodCount}</strong> Performa baik</div>
  </div>

  <div className="eval-tabs">
   <button className={tab==='advertiser'?'active':''} onClick={()=>setTab('advertiser')}>Advertiser ({analyses.length})</button>
   <button className={tab==='cs'?'active':''} onClick={()=>setTab('cs')}>CS ({analyses.length})</button>
  </div>

  <div className="eval-ai-section">
   <button className="button primary" onClick={generateAI} disabled={aiLoading}>
    {aiLoading?<><Loader size={15} className="spin"/>Menganalisis...</>:<><Zap size={15}/>Ringkasan AI</>}
   </button>
   {aiText&&<div className="eval-ai-result"><div className="eval-ai-label"><Zap size={14}/>Insight AI</div><div className="eval-ai-text">{aiText.split('\n').map((line,i)=><p key={i}>{line}</p>)}</div></div>}
  </div>

  <div className="eval-cards">
   {analyses.map(a=><Card key={a.name} analysis={a} type={tab} hideSpend={hideSpend}/>)}
  </div>
  {!analyses.length&&<div className="empty" style={{marginTop:20}}><AlertTriangle size={28}/><strong>Belum ada data untuk dievaluasi</strong><p>Pastikan filter periode mencakup data laporan.</p></div>}
 </div>;
}

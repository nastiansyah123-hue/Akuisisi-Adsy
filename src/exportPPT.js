let PptxGenJS;
async function loadLib(){
 if(PptxGenJS)return;
 const mod=await import('https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/+esm');
 PptxGenJS=mod.default;
}

const B={dark:'#073b56',mid:'#1d5c7b',light:'#eaf4fa',accent:'#587488',white:'#ffffff',green:'#0d9488',orange:'#d97706',blue:'#3b82f6'};
const COLORS=['#1d5c7b','#0d9488','#d97706','#3b82f6','#8b5cf6','#ec4899','#f97316','#06b6d4','#84cc16','#ef4444'];
const money=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n||0);
const moneyShort=n=>{if(n>=1e9)return'Rp '+(n/1e9).toFixed(1)+'M';if(n>=1e6)return'Rp '+(n/1e6).toFixed(1)+'jt';return money(n)};
const pct=n=>`${(n*100).toFixed(1)}%`;
const num=n=>new Intl.NumberFormat('id-ID').format(n||0);

const KIE_API='https://adsy-autopilot.vercel.app/api/ai-copy';

// ── Canvas helpers ──
function createCanvas(w,h){const c=document.createElement('canvas');c.width=w*2;c.height=h*2;const ctx=c.getContext('2d');ctx.scale(2,2);return{canvas:c,ctx,w,h};}
function canvasToBase64(c){return c.toDataURL('image/png').split(',')[1];}
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}

// ── kie.ai integration (parallel) ──
const SLIDE_PROMPTS={
 'Cover':`Redesign this cover slide into a stunning, premium presentation cover. Use a deep dark teal (#073b56) background with elegant geometric shapes, subtle light gradients, and a modern asymmetric layout. Keep ALL text exactly as shown — do not change any words or numbers. Add sophisticated visual elements like abstract flowing lines, soft bokeh lights, or geometric patterns in the background. The typography should feel like a Fortune 500 company annual report. 16:9 widescreen.`,
 'Ringkasan Performa':`Redesign this summary dashboard slide into a beautiful infographic-style layout. Keep ALL numbers and text exactly as shown — do not change any values. Use modern card design with subtle shadows, rounded corners, and a clean white background. Each metric card should have a distinct accent color (teal, orange, blue, purple). Add thin decorative lines or subtle icons near each metric. Make it look like a premium SaaS analytics dashboard screenshot. 16:9 widescreen.`,
 'Temuan & Evaluasi':`Redesign this findings/insights slide into a visually engaging executive summary. Keep ALL text and bullet points exactly as shown — do not change any words. Use a clean white background with colored accent bars on the left of each finding. Add subtle icons matching each insight. Use professional typography with clear hierarchy. Make each finding feel like an actionable insight card. The overall look should be like a McKinsey or BCG consulting deck. 16:9 widescreen.`,
 'Performa Advertiser':`Redesign this bar chart slide into a beautiful, modern data visualization. Keep ALL numbers, names, and bar values exactly as shown — do not change any data. Make the bars have subtle 3D depth or gradient fills. Use a clean white background with soft grid lines. Add rounded bar corners and value labels above each bar. The color palette should use teal, emerald, amber, and blue tones. Make it look like a Dribbble-worthy analytics chart. 16:9 widescreen.`,
 'Detail Advertiser':`Redesign this data table slide into an elegant, well-structured table layout. Keep ALL numbers, names, and values exactly as shown — do not change any data. Use alternating row colors with very subtle teal tint. The header row should be dark teal with white text. Add clean borders and good spacing. Make the typography crisp and easy to read. It should look like a premium financial report table. 16:9 widescreen.`,
 'Performa CS':`Redesign this horizontal bar chart and ranking slide into a polished team performance visualization. Keep ALL names, numbers, and values exactly as shown — do not change any data. Use colorful gradient bars with rounded edges. The CS ranking section should have clean numbered badges. Add subtle background patterns. Make it look like a gamified leaderboard from a modern SaaS platform. 16:9 widescreen.`,
 'Kontribusi Produk':`Redesign this donut chart and product breakdown slide into a stunning product portfolio visualization. Keep ALL product names, numbers, and percentages exactly as shown — do not change any data. Make the donut chart have subtle 3D depth with clean segment separations. The legend should be well-organized with colored dots. Use a clean white background with soft shadows. Make it look like an Apple keynote product slide. 16:9 widescreen.`,
 'Tren Harian':`Redesign this daily trend chart into a beautiful, modern time-series visualization. Keep ALL numbers, dates, and data exactly as shown — do not change any values. Make the bar chart have gradient fills and the line chart smooth with glowing dots. Use a clean white background with subtle grid lines. The legend should be minimal and elegant. Make it look like a Bloomberg terminal chart redesigned by Apple. 16:9 widescreen.`,
 'Perbandingan Channel':`Redesign this channel comparison slide into elegant side-by-side comparison cards. Keep ALL numbers and labels exactly as shown — do not change any data. Each channel card should have a distinct color accent, clean metric layout with clear hierarchy. Add subtle shadows and rounded corners. Make it look like a premium A/B test results dashboard. 16:9 widescreen.`,
 'Perbandingan Platform':`Redesign this platform comparison slide into beautiful branded comparison cards. Keep ALL numbers and labels exactly as shown — do not change any data. Use each platform's brand color (Meta blue, Google green). Clean card layout with clear metric hierarchy. Add subtle platform logos or icons. Make it feel like a cross-platform advertising analytics report. 16:9 widescreen.`,
 'Highlight Hari Terbaik':`Redesign this best days highlight slide into an engaging infographic with ranking cards. Keep ALL dates, numbers, and values exactly as shown — do not change any data. Use trophy/medal icons for rankings, color-coded sections (green for best, orange for worst). Each section should feel like an achievement card. Clean, modern layout with subtle shadows. 16:9 widescreen.`,
};
const BREAKDOWN_PROMPT=`Redesign this product breakdown slide into a clean, professional two-column comparison layout. Keep ALL names, numbers, and values exactly as shown — do not change any data. Left side shows Advertiser contributors, right side shows CS contributors. Use clean table styling with colored indicator dots, alternating row backgrounds, and a prominent product title. The design should feel like a detailed portfolio analysis from a top consulting firm. 16:9 widescreen.`;

function slidePrompt(title){
 if(title.startsWith('Breakdown:'))return BREAKDOWN_PROMPT;
 return SLIDE_PROMPTS[title]||`Redesign this slide into a professional, modern PowerPoint presentation slide. Keep ALL text and numbers exactly as shown. Use dark teal (#073b56) as primary color. Clean, corporate design. 16:9 widescreen format.`;
}

async function submitTask(base64,title){
 const resp=await fetch(KIE_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'generate_image',images:[{base64,mime_type:'image/png'}],prompt:slidePrompt(title),aspect_ratio:'16:9',resolution:'1K',background:'auto'})});
 if(!resp.ok)throw new Error(`API error ${resp.status}`);
 const data=await resp.json();
 console.log(`Task created for "${title}":`,data);
 if(!data.ok)throw new Error(data.error||'Gagal memulai generate');
 return {taskId:data.task_id,refFiles:data.ref_files||[]};
}

async function pollAllTasks(tasks,onStatus){
 // tasks = [{title, taskId, refFiles, base64(fallback)}, ...]
 const results=new Array(tasks.length).fill(null);
 const done=new Set();
 for(let attempt=0;attempt<80;attempt++){
  await new Promise(r=>setTimeout(r,4000));
  const pending=tasks.filter((_,i)=>!done.has(i));
  if(!pending.length)break;
  const doneCount=done.size;
  onStatus?.(`⏳ AI generate: ${doneCount}/${tasks.length} selesai, ${pending.length} proses... (${(attempt+1)*4}s)`);
  // Poll all pending in parallel
  await Promise.all(pending.map(async(t)=>{
   const idx=tasks.indexOf(t);
   try{
    const pr=await fetch(KIE_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'check_image_task',task_id:t.taskId,ref_files:t.refFiles})});
    const pd=await pr.json();
    console.log(`Poll ${attempt+1} "${t.title}":`,pd);
    if(pd.state==='success'&&pd.result_urls?.length){
     results[idx]=pd.result_urls[0];
     done.add(idx);
     onStatus?.(`✅ ${t.title} selesai! (${done.size}/${tasks.length})`);
    }else if(pd.state==='fail'){
     console.warn(`"${t.title}" failed:`,pd.fail_msg);
     results[idx]=null;
     done.add(idx);
    }
   }catch(e){console.warn(`Poll error "${t.title}":`,e.message);}
  }));
 }
 return results;
}

async function fetchImageAsBase64(url){
 try{
  const resp=await fetch(url);
  if(!resp.ok)throw new Error(`HTTP ${resp.status}`);
  const blob=await resp.blob();
  return new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result.split(',')[1]);fr.readAsDataURL(blob);});
 }catch(e){
  console.warn('Direct fetch failed, trying proxy:',e.message);
  const resp=await fetch(KIE_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'proxy_image',url})});
  const data=await resp.json();
  if(data.ok&&data.base64)return data.base64;
  throw new Error('Gagal download gambar: '+e.message);
 }
}

// ── Render slide canvases ──
function renderCoverCanvas(period){
 const{canvas,ctx,w,h}=createCanvas(960,540);
 // bg
 ctx.fillStyle=B.dark;ctx.fillRect(0,0,w,h);
 // decorative
 ctx.fillStyle='#0a4d6d';ctx.beginPath();ctx.arc(w+50,h+50,300,0,Math.PI*2);ctx.fill();
 ctx.fillStyle=B.mid;ctx.fillRect(0,0,8,h);
 // text
 ctx.fillStyle=B.accent;ctx.font='600 13px Arial';ctx.fillText('AKUISISI ADSY TEAM',60,180);
 ctx.fillStyle=B.white;ctx.font='bold 44px Arial';ctx.fillText('Laporan',60,240);ctx.fillText('Akuisisi',60,290);
 ctx.fillStyle=B.green;ctx.fillRect(60,310,80,4);
 ctx.fillStyle=B.accent;ctx.font='16px Arial';ctx.fillText(period,60,345);
 ctx.fillStyle='#456070';ctx.font='10px Arial';ctx.fillText('Generated by Akuisisi Adsy Dashboard',60,h-30);
 return canvasToBase64(canvas);
}

function renderSummaryCanvas(total,kpis,hideSpend,period){
 const{canvas,ctx,w,h}=createCanvas(960,540);
 ctx.fillStyle=B.white;ctx.fillRect(0,0,w,h);
 ctx.fillStyle=B.mid;ctx.fillRect(0,0,w,5);
 ctx.fillStyle=B.dark;ctx.font='bold 24px Arial';ctx.fillText('Ringkasan Performa',50,50);
 ctx.fillStyle=B.accent;ctx.font='12px Arial';ctx.fillText(period,50,72);
 const cards=[
  {label:'Total Omzet',value:money(total.revenue),color:B.green},
  ...(!hideSpend?[{label:'Biaya Iklan + Pajak',value:money(total.spend),color:B.orange}]:[]),
  {label:'Total Closing',value:num(total.closing),color:B.blue},
  {label:'Closing Rate',value:pct(total.leads?total.closing/total.leads:0),color:'#8b5cf6'},
  ...(!hideSpend&&kpis.caq!==null?[{label:'CAQ',value:pct(kpis.caq),color:B.green}]:[]),
 ];
 const cw=(w-100)/cards.length,startX=50;
 cards.forEach((c,i)=>{
  const x=startX+i*(cw+8);
  ctx.fillStyle='#f8fafb';roundRect(ctx,x,100,cw-8,120,8);ctx.fill();
  ctx.fillStyle=c.color;ctx.fillRect(x,100,cw-8,4);
  ctx.fillStyle=B.accent;ctx.font='11px Arial';ctx.fillText(c.label,x+12,132);
  ctx.fillStyle=B.dark;ctx.font='bold 22px Arial';ctx.fillText(c.value,x+12,170);
 });
 // summary bar
 const leads=total.leads,closing=total.closing,units=total.units;
 ctx.fillStyle='#f4f9fd';roundRect(ctx,50,250,w-100,50,8);ctx.fill();
 ctx.fillStyle=B.dark;ctx.font='13px Arial';
 ctx.fillText(`${num(leads)} leads  ·  ${num(closing)} closing  ·  ${num(units)} unit terjual  ·  Upsell ${closing>0?(units/closing).toFixed(2)+'×':'—'}`,70,280);
 return canvasToBase64(canvas);
}

function renderAdvBarCanvas(rows){
 const{canvas,ctx,w,h}=createCanvas(960,540);
 ctx.fillStyle=B.white;ctx.fillRect(0,0,w,h);
 ctx.fillStyle=B.mid;ctx.fillRect(0,0,w,5);
 ctx.fillStyle=B.dark;ctx.font='bold 24px Arial';ctx.fillText('Performa Advertiser',50,50);
 ctx.fillStyle=B.accent;ctx.font='12px Arial';ctx.fillText(`Top ${Math.min(rows.length,10)} berdasarkan omzet`,50,72);
 const top=rows.slice(0,10);
 const maxVal=Math.max(...top.map(r=>r.revenue),1);
 const pad={top:100,bottom:70,left:50,right:50};
 const barArea=w-pad.left-pad.right;
 const gap=barArea/top.length;
 const barW=Math.min(55,gap*0.65);
 const chartH=h-pad.top-pad.bottom;
 // grid
 ctx.strokeStyle='#e8eef2';ctx.lineWidth=0.5;
 for(let i=0;i<=4;i++){const y=pad.top+chartH*(1-i/4);ctx.beginPath();ctx.moveTo(pad.left,y);ctx.lineTo(w-pad.right,y);ctx.stroke();}
 top.forEach((r,i)=>{
  const x=pad.left+i*gap+(gap-barW)/2;
  const barH=(r.revenue/maxVal)*chartH;
  const y=pad.top+chartH-barH;
  ctx.fillStyle=COLORS[i%COLORS.length];roundRect(ctx,x,y,barW,barH,4);ctx.fill();
  ctx.fillStyle=B.dark;ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.fillText(moneyShort(r.revenue),x+barW/2,y-8);
  ctx.fillStyle=B.accent;ctx.font='9px Arial';
  const label=r.advertiser.length>10?r.advertiser.slice(0,9)+'…':r.advertiser;
  ctx.fillText(label,x+barW/2,h-pad.bottom+18);
  ctx.textAlign='left';
 });
 return canvasToBase64(canvas);
}

function renderAdvTableCanvas(rows,hideSpend){
 const rowH=28,headerH=32;
 const cols=hideSpend?['Advertiser','Leads','Closing','Omzet','CAQ']:['Advertiser','Leads','Closing','Biaya Iklan','Omzet','CAQ'];
 const totalH=Math.min(100+headerH+rows.length*rowH,540);
 const{canvas,ctx,w,h}=createCanvas(960,totalH);
 ctx.fillStyle=B.white;ctx.fillRect(0,0,w,h);
 ctx.fillStyle=B.mid;ctx.fillRect(0,0,w,5);
 ctx.fillStyle=B.dark;ctx.font='bold 24px Arial';ctx.fillText('Detail Advertiser',50,50);
 const colW=hideSpend?[260,120,120,200,120]:[220,110,110,140,180,120];
 const startY=80;let cx=40;
 // header
 ctx.fillStyle=B.dark;roundRect(ctx,30,startY,w-60,headerH,4);ctx.fill();
 cx=40;
 cols.forEach((c,i)=>{ctx.fillStyle=B.white;ctx.font='bold 10px Arial';ctx.textAlign=i===0?'left':'center';ctx.fillText(c,i===0?cx:cx+colW[i]/2,startY+20);cx+=colW[i];});
 // rows
 rows.forEach((r,ri)=>{
  const y=startY+headerH+ri*rowH;
  if(y+rowH>h)return;
  ctx.fillStyle=ri%2===0?B.white:'#f8fafb';ctx.fillRect(30,y,w-60,rowH);
  const caq=r.revenue&&r.spend?pct(r.spend/r.revenue):'—';
  const vals=hideSpend?[r.advertiser,num(r.leads),num(r.closing),money(r.revenue),caq]:[r.advertiser,num(r.leads),num(r.closing),money(r.spend),money(r.revenue),caq];
  cx=40;
  vals.forEach((v,i)=>{ctx.fillStyle=B.dark;ctx.font='10px Arial';ctx.textAlign=i===0?'left':'center';ctx.fillText(String(v),i===0?cx:cx+colW[i]/2,y+18);cx+=colW[i];});
 });
 ctx.textAlign='left';
 return canvasToBase64(canvas);
}

function renderCSCanvas(rows){
 const{canvas,ctx,w,h}=createCanvas(960,540);
 ctx.fillStyle=B.white;ctx.fillRect(0,0,w,h);
 ctx.fillStyle=B.mid;ctx.fillRect(0,0,w,5);
 ctx.fillStyle=B.dark;ctx.font='bold 24px Arial';ctx.fillText('Performa CS',50,50);
 ctx.fillStyle=B.accent;ctx.font='12px Arial';ctx.fillText(`${rows.length} CS aktif`,50,72);
 // horizontal bars
 const top=rows.slice(0,12);
 const maxVal=Math.max(...top.map(r=>r.revenue),1);
 const barAreaW=420,startX=180,startY=100,rowH=32;
 top.forEach((r,i)=>{
  const y=startY+i*rowH;
  const barW=(r.revenue/maxVal)*barAreaW;
  // label
  ctx.fillStyle=B.dark;ctx.font='11px Arial';ctx.textAlign='right';
  const label=r.cs.length>16?r.cs.slice(0,15)+'…':r.cs;
  ctx.fillText(label,startX-12,y+20);
  // bar
  ctx.fillStyle=COLORS[i%COLORS.length];roundRect(ctx,startX,y+4,Math.max(barW,3),rowH-8,4);ctx.fill();
  // value
  ctx.fillStyle=B.dark;ctx.font='bold 10px Arial';ctx.textAlign='left';ctx.fillText(moneyShort(r.revenue),startX+barW+8,y+20);
 });
 ctx.textAlign='left';
 // CR ranking on right
 const crTop=rows.filter(r=>r.leads>=10).sort((a,b)=>(b.closing/b.leads)-(a.closing/a.leads)).slice(0,8);
 ctx.fillStyle=B.dark;ctx.font='bold 14px Arial';ctx.fillText('Top CR (min 10 leads)',660,110);
 crTop.forEach((r,i)=>{
  const y=135+i*30;
  const cr=r.leads?r.closing/r.leads:0;
  ctx.fillStyle=B.accent;ctx.font='10px Arial';ctx.fillText(`${i+1}.`,665,y+12);
  ctx.fillStyle=B.dark;ctx.font='11px Arial';ctx.fillText(r.cs,685,y+12);
  ctx.fillStyle=B.green;ctx.font='bold 11px Arial';ctx.fillText(pct(cr),870,y+12);
 });
 return canvasToBase64(canvas);
}

function renderProductCanvas(rows){
 const{canvas,ctx,w,h}=createCanvas(960,540);
 ctx.fillStyle=B.white;ctx.fillRect(0,0,w,h);
 ctx.fillStyle=B.mid;ctx.fillRect(0,0,w,5);
 ctx.fillStyle=B.dark;ctx.font='bold 24px Arial';ctx.fillText('Kontribusi Produk',50,50);
 // donut
 const cx2=200,cy2=280,r=110,inner=r*0.6;
 const total=rows.reduce((s,d)=>s+d.revenue,0);
 let angle=-Math.PI/2;
 rows.forEach((d,i)=>{
  const sweep=(d.revenue/total)*Math.PI*2;
  ctx.beginPath();ctx.moveTo(cx2+inner*Math.cos(angle),cy2+inner*Math.sin(angle));
  ctx.arc(cx2,cy2,r,angle,angle+sweep);ctx.arc(cx2,cy2,inner,angle+sweep,angle,true);ctx.closePath();
  ctx.fillStyle=COLORS[i%COLORS.length];ctx.fill();
  if(sweep>0.25){const mid=angle+sweep/2;const lx=cx2+(r+inner)/2*Math.cos(mid);const ly=cy2+(r+inner)/2*Math.sin(mid);ctx.fillStyle='#fff';ctx.font='bold 11px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(pct(d.revenue/total),lx,ly);}
  angle+=sweep;
 });
 ctx.fillStyle=B.dark;ctx.font='bold 20px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(num(total),cx2,cy2-6);
 ctx.fillStyle=B.accent;ctx.font='10px Arial';ctx.fillText('Total Omzet',cx2,cy2+14);
 ctx.textAlign='left';ctx.textBaseline='alphabetic';
 // legend + table
 rows.forEach((r2,i)=>{
  const y=110+i*38;
  if(y>470)return;
  ctx.fillStyle=COLORS[i%COLORS.length];roundRect(ctx,400,y,14,14,3);ctx.fill();
  ctx.fillStyle=B.dark;ctx.font='12px Arial';ctx.fillText(r2.product,424,y+12);
  ctx.fillStyle=B.dark;ctx.font='bold 12px Arial';ctx.fillText(money(r2.revenue),620,y+12);
  ctx.fillStyle=B.accent;ctx.font='11px Arial';ctx.fillText(pct(r2.revenue/total),800,y+12);
  const cr=r2.leads?r2.closing/r2.leads:0;
  ctx.fillText('CR '+pct(cr),860,y+12);
 });
 return canvasToBase64(canvas);
}

// ── 1. Tren Harian ──
function renderDailyTrendCanvas(groups,period){
 const{canvas,ctx,w,h}=createCanvas(960,540);
 ctx.fillStyle=B.white;ctx.fillRect(0,0,w,h);
 ctx.fillStyle=B.mid;ctx.fillRect(0,0,w,5);
 ctx.fillStyle=B.dark;ctx.font='bold 24px Arial';ctx.fillText('Tren Harian',50,50);
 ctx.fillStyle=B.accent;ctx.font='12px Arial';ctx.fillText(period,50,72);
 // aggregate by date
 const byDate={};
 for(const g of groups){
  if(!byDate[g.date])byDate[g.date]={date:g.date,revenue:0,leads:0,closing:0};
  const d=byDate[g.date];d.revenue+=g.revenue;d.leads+=g.leads;d.closing+=g.closing;
 }
 const dates=Object.values(byDate).sort((a,b)=>a.date.localeCompare(b.date));
 if(!dates.length){ctx.fillStyle=B.accent;ctx.font='13px Arial';ctx.fillText('Tidak ada data',50,200);return canvasToBase64(canvas);}
 const maxRev=Math.max(...dates.map(d=>d.revenue),1);
 const maxLeads=Math.max(...dates.map(d=>d.leads),1);
 const pad={top:100,bottom:80,left:70,right:50};
 const chartW=w-pad.left-pad.right,chartH=h-pad.top-pad.bottom;
 // grid
 ctx.strokeStyle='#e8eef2';ctx.lineWidth=0.5;
 for(let i=0;i<=4;i++){const y=pad.top+chartH*(1-i/4);ctx.beginPath();ctx.moveTo(pad.left,y);ctx.lineTo(w-pad.right,y);ctx.stroke();
  ctx.fillStyle=B.accent;ctx.font='9px Arial';ctx.textAlign='right';ctx.fillText(moneyShort(maxRev*i/4),pad.left-8,y+4);ctx.textAlign='left';
 }
 const gap=chartW/dates.length;
 const barW=Math.min(40,gap*0.55);
 // bars (revenue)
 dates.forEach((d,i)=>{
  const x=pad.left+i*gap+(gap-barW)/2;
  const barH=(d.revenue/maxRev)*chartH;
  const y=pad.top+chartH-barH;
  const grad=ctx.createLinearGradient(x,y,x,y+barH);
  grad.addColorStop(0,B.mid);grad.addColorStop(1,'#0d9488');
  ctx.fillStyle=grad;roundRect(ctx,x,y,barW,barH,3);ctx.fill();
  // value on top
  if(dates.length<=15){ctx.fillStyle=B.dark;ctx.font='bold 8px Arial';ctx.textAlign='center';ctx.fillText(moneyShort(d.revenue),x+barW/2,y-6);}
  // date label
  ctx.fillStyle=B.accent;ctx.font='8px Arial';ctx.textAlign='center';
  const lbl=d.date.slice(8);// just day
  ctx.fillText(lbl,x+barW/2,h-pad.bottom+16);
  ctx.textAlign='left';
 });
 // line (leads) overlay
 ctx.strokeStyle='#d97706';ctx.lineWidth=2;ctx.beginPath();
 dates.forEach((d,i)=>{
  const x=pad.left+i*gap+gap/2;
  const y=pad.top+chartH-(d.leads/maxLeads)*chartH;
  if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
 });
 ctx.stroke();
 // dots
 dates.forEach((d,i)=>{
  const x=pad.left+i*gap+gap/2;
  const y=pad.top+chartH-(d.leads/maxLeads)*chartH;
  ctx.fillStyle='#d97706';ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();
 });
 // legend
 ctx.fillStyle=B.mid;roundRect(ctx,pad.left,h-35,10,10,2);ctx.fill();
 ctx.fillStyle=B.dark;ctx.font='10px Arial';ctx.fillText('Omzet',pad.left+16,h-26);
 ctx.fillStyle='#d97706';roundRect(ctx,pad.left+80,h-35,10,10,2);ctx.fill();
 ctx.fillStyle=B.dark;ctx.fillText('Leads',pad.left+96,h-26);
 // summary
 const totalRev=dates.reduce((s,d)=>s+d.revenue,0);
 const avgRev=totalRev/dates.length;
 ctx.fillStyle=B.accent;ctx.font='10px Arial';
 ctx.fillText(`Rata-rata harian: ${money(avgRev)}  ·  ${dates.length} hari`,pad.left+180,h-26);
 return canvasToBase64(canvas);
}

// ── 2. Perbandingan Channel ──
function renderChannelCompareCanvas(groups,period){
 const{canvas,ctx,w,h}=createCanvas(960,540);
 ctx.fillStyle=B.white;ctx.fillRect(0,0,w,h);
 ctx.fillStyle=B.mid;ctx.fillRect(0,0,w,5);
 ctx.fillStyle=B.dark;ctx.font='bold 24px Arial';ctx.fillText('Perbandingan Channel',50,50);
 ctx.fillStyle=B.accent;ctx.font='12px Arial';ctx.fillText(period,50,72);
 // aggregate by channel
 const byCh={};
 for(const g of groups){
  const ch=g.channel||'Lainnya';
  if(!byCh[ch])byCh[ch]={channel:ch,leads:0,closing:0,units:0,revenue:0,spend:0};
  const c=byCh[ch];c.leads+=g.leads;c.closing+=g.closing;c.units+=g.units;c.revenue+=g.revenue;c.spend+=g.spend;
 }
 const channels=Object.values(byCh).sort((a,b)=>b.revenue-a.revenue);
 const totalRev=channels.reduce((s,c)=>s+c.revenue,0);
 if(!channels.length){ctx.fillStyle=B.accent;ctx.font='13px Arial';ctx.fillText('Tidak ada data',50,200);return canvasToBase64(canvas);}
 // cards layout
 const cardW=Math.min(380,(w-120)/channels.length);
 const startX=(w-channels.length*cardW-(channels.length-1)*20)/2;
 channels.forEach((ch,i)=>{
  const x=startX+i*(cardW+20),y=110;
  const cr=ch.leads?ch.closing/ch.leads:0;
  const share=totalRev?ch.revenue/totalRev:0;
  // card bg
  ctx.fillStyle='#f8fafb';roundRect(ctx,x,y,cardW,350,10);ctx.fill();
  ctx.strokeStyle='#e8eef2';ctx.lineWidth=1;roundRect(ctx,x,y,cardW,350,10);ctx.stroke();
  // top accent
  ctx.fillStyle=COLORS[i%COLORS.length];ctx.fillRect(x,y,cardW,5);
  // channel name
  ctx.fillStyle=B.dark;ctx.font='bold 18px Arial';ctx.textAlign='center';ctx.fillText(ch.channel,x+cardW/2,y+40);
  // share badge
  ctx.fillStyle=COLORS[i%COLORS.length];roundRect(ctx,x+cardW/2-30,y+50,60,22,11);ctx.fill();
  ctx.fillStyle=B.white;ctx.font='bold 11px Arial';ctx.fillText(pct(share),x+cardW/2,y+65);
  // metrics
  const metrics=[
   {label:'Omzet',value:money(ch.revenue)},
   {label:'Leads',value:num(ch.leads)},
   {label:'Closing',value:num(ch.closing)},
   {label:'Closing Rate',value:pct(cr)},
   {label:'Unit',value:num(ch.units)},
  ];
  metrics.forEach((m,mi)=>{
   const my=y+95+mi*48;
   ctx.fillStyle=B.accent;ctx.font='10px Arial';ctx.textAlign='center';ctx.fillText(m.label,x+cardW/2,my);
   ctx.fillStyle=B.dark;ctx.font='bold 16px Arial';ctx.fillText(m.value,x+cardW/2,my+20);
  });
  ctx.textAlign='left';
 });
 return canvasToBase64(canvas);
}

// ── 3. Perbandingan Platform ──
function renderPlatformCompareCanvas(groups,period){
 const{canvas,ctx,w,h}=createCanvas(960,540);
 ctx.fillStyle=B.white;ctx.fillRect(0,0,w,h);
 ctx.fillStyle=B.mid;ctx.fillRect(0,0,w,5);
 ctx.fillStyle=B.dark;ctx.font='bold 24px Arial';ctx.fillText('Perbandingan Platform',50,50);
 ctx.fillStyle=B.accent;ctx.font='12px Arial';ctx.fillText(period,50,72);
 const byPlat={};
 for(const g of groups){
  const pl=g.platform||'Meta';
  if(!byPlat[pl])byPlat[pl]={platform:pl,leads:0,closing:0,units:0,revenue:0,spend:0};
  const p=byPlat[pl];p.leads+=g.leads;p.closing+=g.closing;p.units+=g.units;p.revenue+=g.revenue;p.spend+=g.spend;
 }
 const platforms=Object.values(byPlat).sort((a,b)=>b.revenue-a.revenue);
 const totalRev=platforms.reduce((s,p)=>s+p.revenue,0);
 if(!platforms.length){ctx.fillStyle=B.accent;ctx.font='13px Arial';ctx.fillText('Tidak ada data',50,200);return canvasToBase64(canvas);}
 const cardW=Math.min(380,(w-120)/platforms.length);
 const startX=(w-platforms.length*cardW-(platforms.length-1)*20)/2;
 const platColors={'Meta':'#1877F2','Google':'#34A853','TikTok':'#010101'};
 platforms.forEach((pl,i)=>{
  const x=startX+i*(cardW+20),y=110;
  const cr=pl.leads?pl.closing/pl.leads:0;
  const share=totalRev?pl.revenue/totalRev:0;
  ctx.fillStyle='#f8fafb';roundRect(ctx,x,y,cardW,350,10);ctx.fill();
  ctx.strokeStyle='#e8eef2';ctx.lineWidth=1;roundRect(ctx,x,y,cardW,350,10);ctx.stroke();
  ctx.fillStyle=platColors[pl.platform]||COLORS[i%COLORS.length];ctx.fillRect(x,y,cardW,5);
  ctx.fillStyle=B.dark;ctx.font='bold 18px Arial';ctx.textAlign='center';ctx.fillText(pl.platform,x+cardW/2,y+40);
  const accent=platColors[pl.platform]||COLORS[i%COLORS.length];
  ctx.fillStyle=accent;roundRect(ctx,x+cardW/2-30,y+50,60,22,11);ctx.fill();
  ctx.fillStyle=B.white;ctx.font='bold 11px Arial';ctx.fillText(pct(share),x+cardW/2,y+65);
  const metrics=[
   {label:'Omzet',value:money(pl.revenue)},
   {label:'Leads',value:num(pl.leads)},
   {label:'Closing',value:num(pl.closing)},
   {label:'Closing Rate',value:pct(cr)},
   {label:'Biaya Iklan',value:money(pl.spend)},
  ];
  metrics.forEach((m,mi)=>{
   const my=y+95+mi*48;
   ctx.fillStyle=B.accent;ctx.font='10px Arial';ctx.textAlign='center';ctx.fillText(m.label,x+cardW/2,my);
   ctx.fillStyle=B.dark;ctx.font='bold 16px Arial';ctx.fillText(m.value,x+cardW/2,my+20);
  });
  ctx.textAlign='left';
 });
 return canvasToBase64(canvas);
}

// ── 5. Highlight Hari Terbaik ──
function renderBestDaysCanvas(groups,period){
 const{canvas,ctx,w,h}=createCanvas(960,540);
 ctx.fillStyle=B.white;ctx.fillRect(0,0,w,h);
 ctx.fillStyle=B.mid;ctx.fillRect(0,0,w,5);
 ctx.fillStyle=B.dark;ctx.font='bold 24px Arial';ctx.fillText('Highlight Hari Terbaik',50,50);
 ctx.fillStyle=B.accent;ctx.font='12px Arial';ctx.fillText(period,50,72);
 const byDate={};
 for(const g of groups){
  if(!byDate[g.date])byDate[g.date]={date:g.date,revenue:0,leads:0,closing:0,units:0};
  const d=byDate[g.date];d.revenue+=g.revenue;d.leads+=g.leads;d.closing+=g.closing;d.units+=g.units;
 }
 const dates=Object.values(byDate);
 if(!dates.length){ctx.fillStyle=B.accent;ctx.font='13px Arial';ctx.fillText('Tidak ada data',50,200);return canvasToBase64(canvas);}
 const fmtDate=d=>{const p=d.split('-');return `${p[2]}/${p[1]}/${p[0]}`;};
 const topRevenue=[...dates].sort((a,b)=>b.revenue-a.revenue).slice(0,3);
 const topLeads=[...dates].sort((a,b)=>b.leads-a.leads).slice(0,3);
 const topClosing=[...dates].sort((a,b)=>b.closing-a.closing).slice(0,3);
 const worstRevenue=[...dates].sort((a,b)=>a.revenue-b.revenue).slice(0,3);
 // Layout: 2x2 grid
 const sections=[
  {title:'🏆 Omzet Tertinggi',items:topRevenue.map((d,i)=>({rank:i+1,date:fmtDate(d.date),main:money(d.revenue),sub:`${num(d.leads)} leads · ${num(d.closing)} closing`})),color:B.green},
  {title:'📊 Leads Terbanyak',items:topLeads.map((d,i)=>({rank:i+1,date:fmtDate(d.date),main:num(d.leads)+' leads',sub:`${num(d.closing)} closing · ${money(d.revenue)}`})),color:B.blue},
  {title:'✅ Closing Terbanyak',items:topClosing.map((d,i)=>({rank:i+1,date:fmtDate(d.date),main:num(d.closing)+' closing',sub:`CR ${pct(d.leads?d.closing/d.leads:0)} · ${money(d.revenue)}`})),color:'#8b5cf6'},
  {title:'⚠️ Omzet Terendah',items:worstRevenue.map((d,i)=>({rank:i+1,date:fmtDate(d.date),main:money(d.revenue),sub:`${num(d.leads)} leads · ${num(d.closing)} closing`})),color:'#d97706'},
 ];
 sections.forEach((sec,si)=>{
  const col=si%2,row=Math.floor(si/2);
  const bx=50+col*450,by=100+row*210;
  // section bg
  ctx.fillStyle='#f8fafb';roundRect(ctx,bx,by,420,190,8);ctx.fill();
  ctx.fillStyle=sec.color;ctx.fillRect(bx,by,420,4);
  // title
  ctx.fillStyle=B.dark;ctx.font='bold 14px Arial';ctx.fillText(sec.title,bx+14,by+28);
  // items
  sec.items.forEach((item,ii)=>{
   const iy=by+48+ii*46;
   // rank badge
   ctx.fillStyle=sec.color;roundRect(ctx,bx+14,iy,24,24,12);ctx.fill();
   ctx.fillStyle=B.white;ctx.font='bold 11px Arial';ctx.textAlign='center';ctx.fillText(item.rank,bx+26,iy+16);ctx.textAlign='left';
   // date
   ctx.fillStyle=B.accent;ctx.font='10px Arial';ctx.fillText(item.date,bx+48,iy+10);
   // main value
   ctx.fillStyle=B.dark;ctx.font='bold 13px Arial';ctx.fillText(item.main,bx+130,iy+10);
   // sub
   ctx.fillStyle=B.accent;ctx.font='9px Arial';ctx.fillText(item.sub,bx+48,iy+24);
  });
 });
 return canvasToBase64(canvas);
}

// ── Insights / Evaluasi ──
function generateInsights(groups,filtered,advRows,csRows,prodRows,total,hideSpend){
 const findings=[];
 // 1. Top & bottom advertiser by revenue
 if(advRows.length>=2){
  const top=advRows[0];
  findings.push({icon:'🏆',color:B.green,text:`Advertiser terbaik: ${top.advertiser} dengan omzet ${money(top.revenue)} (${pct(top.revenue/total.revenue)} dari total).`});
  const bot=advRows[advRows.length-1];
  findings.push({icon:'📉',color:'#d97706',text:`Advertiser terendah: ${bot.advertiser} dengan omzet ${money(bot.revenue)} (${pct(bot.revenue/total.revenue)} dari total).`});
 }
 // 2. Top & bottom CS by CR (min 5 leads)
 const csWithCR=csRows.filter(c=>c.leads>=5).map(c=>({...c,cr:c.closing/c.leads}));
 if(csWithCR.length>=2){
  const best=csWithCR.sort((a,b)=>b.cr-a.cr)[0];
  findings.push({icon:'⭐',color:B.green,text:`CS closing rate tertinggi: ${best.cs} dengan CR ${pct(best.cr)} (${num(best.closing)}/${num(best.leads)} leads).`});
  const worst=csWithCR[csWithCR.length-1];
  findings.push({icon:'⚠️',color:'#d97706',text:`CS closing rate terendah: ${worst.cs} dengan CR ${pct(worst.cr)} (${num(worst.closing)}/${num(worst.leads)} leads). Perlu evaluasi.`});
 }
 // 3. CS with most leads
 if(csRows.length){
  const topLeads=[...csRows].sort((a,b)=>b.leads-a.leads)[0];
  findings.push({icon:'📊',color:B.blue,text:`CS paling banyak leads: ${topLeads.cs} menangani ${num(topLeads.leads)} leads dengan omzet ${money(topLeads.revenue)}.`});
 }
 // 4. Product dominance
 if(prodRows.length>=2){
  const topProd=prodRows[0];
  findings.push({icon:'📦',color:B.mid,text:`Produk unggulan: ${topProd.product} menyumbang ${pct(topProd.revenue/total.revenue)} total omzet (${money(topProd.revenue)}).`});
  const lowProd=prodRows[prodRows.length-1];
  if(lowProd.revenue<total.revenue*0.05){
   findings.push({icon:'💡',color:'#d97706',text:`Produk ${lowProd.product} hanya ${pct(lowProd.revenue/total.revenue)} dari total. Pertimbangkan strategi boost.`});
  }
 }
 // 5. CR overall
 const overallCR=total.leads?total.closing/total.leads:0;
 if(overallCR<0.05)findings.push({icon:'🔴',color:'#ef4444',text:`Closing rate keseluruhan rendah: ${pct(overallCR)}. Target minimal 5-10%.`});
 else if(overallCR>=0.15)findings.push({icon:'🟢',color:B.green,text:`Closing rate keseluruhan sangat baik: ${pct(overallCR)}.`});
 else findings.push({icon:'🟡',color:'#d97706',text:`Closing rate keseluruhan ${pct(overallCR)}. Masih ada ruang untuk ditingkatkan.`});
 // 6. CAQ (if applicable)
 if(!hideSpend&&total.spend&&total.revenue){
  const caq=total.spend/total.revenue;
  if(caq>0.3)findings.push({icon:'💸',color:'#ef4444',text:`CAQ ${pct(caq)} cukup tinggi. Biaya iklan sudah ${pct(caq)} dari omzet — evaluasi efisiensi.`});
  else if(caq<=0.15)findings.push({icon:'💰',color:B.green,text:`CAQ ${pct(caq)} sangat efisien. Biaya iklan hanya ${pct(caq)} dari omzet.`});
 }
 // 7. Upsell analysis
 if(total.closing>0){
  const upsell=total.units/total.closing;
  if(upsell>=1.5)findings.push({icon:'🔥',color:B.green,text:`Upsell rate ${upsell.toFixed(2)}× — tim berhasil mendorong pembelian lebih dari 1 unit.`});
  else if(upsell<1.1)findings.push({icon:'📌',color:'#d97706',text:`Upsell rate ${upsell.toFixed(2)}× — hampir semua beli 1 unit saja. Dorong strategi bundling/upsell.`});
 }
 // 8. Daily trend (first half vs second half of period)
 const byDate={};
 for(const g of groups){if(!byDate[g.date])byDate[g.date]=0;byDate[g.date]+=g.revenue;}
 const dates=Object.keys(byDate).sort();
 if(dates.length>=4){
  const mid=Math.floor(dates.length/2);
  const first=dates.slice(0,mid).reduce((s,d)=>s+byDate[d],0)/mid;
  const second=dates.slice(mid).reduce((s,d)=>s+byDate[d],0)/(dates.length-mid);
  const change=(second-first)/first;
  if(change>0.1)findings.push({icon:'📈',color:B.green,text:`Tren positif: omzet harian naik ~${pct(change)} di paruh kedua periode.`});
  else if(change<-0.1)findings.push({icon:'📉',color:'#ef4444',text:`Tren menurun: omzet harian turun ~${pct(Math.abs(change))} di paruh kedua periode. Perlu perhatian.`});
  else findings.push({icon:'➡️',color:B.accent,text:`Tren stabil: omzet harian relatif konsisten sepanjang periode.`});
 }
 return findings;
}

function renderInsightsCanvas(findings,period){
 const rowH=42;
 const totalH=Math.max(540,120+findings.length*rowH);
 const{canvas,ctx,w,h}=createCanvas(960,totalH);
 ctx.fillStyle=B.white;ctx.fillRect(0,0,w,h);
 ctx.fillStyle=B.mid;ctx.fillRect(0,0,w,5);
 // title
 ctx.fillStyle=B.dark;ctx.font='bold 24px Arial';ctx.fillText('Temuan & Evaluasi',50,50);
 ctx.fillStyle=B.accent;ctx.font='12px Arial';ctx.fillText(period,50,72);
 // subtitle
 ctx.fillStyle=B.accent;ctx.font='11px Arial';ctx.fillText('Analisis otomatis berdasarkan data periode ini',50,92);
 // findings
 findings.forEach((f,i)=>{
  const y=115+i*rowH;
  // card bg
  ctx.fillStyle=i%2===0?'#f8fafb':'#ffffff';
  roundRect(ctx,40,y,w-80,rowH-4,6);ctx.fill();
  // left color bar
  ctx.fillStyle=f.color;ctx.fillRect(40,y,4,rowH-4);
  // icon
  ctx.font='16px Arial';ctx.fillText(f.icon,56,y+24);
  // text
  ctx.fillStyle=B.dark;ctx.font='12px Arial';
  // word wrap
  const maxW=w-140;
  const words=f.text.split(' ');
  let line='',ly=y+20;
  for(const word of words){
   const test=line+word+' ';
   if(ctx.measureText(test).width>maxW&&line){
    ctx.fillText(line.trim(),80,ly);ly+=15;line=word+' ';
   }else{line=test;}
  }
  if(line)ctx.fillText(line.trim(),80,ly);
 });
 return canvasToBase64(canvas);
}

// ── Aggregate helpers ──
function aggregateAdv(groups){
 const byAdv={};
 for(const g of groups){
  if(!byAdv[g.advertiser])byAdv[g.advertiser]={advertiser:g.advertiser,leads:0,closing:0,units:0,revenue:0,spend:0};
  const a=byAdv[g.advertiser];a.leads+=g.leads;a.closing+=g.closing;a.units+=g.units;a.revenue+=g.revenue;a.spend+=g.spend;
 }
 return Object.values(byAdv).sort((a,b)=>b.revenue-a.revenue);
}

function aggregateCS(reports){
 const byCS={};
 for(const r of reports){
  if(!byCS[r.cs])byCS[r.cs]={cs:r.cs,leads:0,closing:0,units:0,revenue:0};
  const a=byCS[r.cs];a.leads+=Number(r.leads);a.closing+=Number(r.closing)-Number(r.invalid);a.units+=Number(r.units)-Number(r.invalidUnits);a.revenue+=Number(r.revenue);
 }
 return Object.values(byCS).sort((a,b)=>b.revenue-a.revenue);
}

function aggregateProductBreakdown(groups,filtered){
 const byProd={};
 // advertiser per product (from groups/ads)
 for(const g of groups){
  if(!byProd[g.product])byProd[g.product]={product:g.product,revenue:0,leads:0,closing:0,advertisers:{},csMap:{}};
  const p=byProd[g.product];
  p.revenue+=g.revenue;p.leads+=g.leads;p.closing+=g.closing;
  if(!p.advertisers[g.advertiser])p.advertisers[g.advertiser]={name:g.advertiser,revenue:0,spend:0,leads:0,closing:0};
  const a=p.advertisers[g.advertiser];a.revenue+=g.revenue;a.spend+=g.spend;a.leads+=g.leads;a.closing+=g.closing;
 }
 // CS per product (from filtered reports)
 for(const r of filtered){
  const pk=r.product;
  if(!byProd[pk])byProd[pk]={product:pk,revenue:0,leads:0,closing:0,advertisers:{},csMap:{}};
  const p=byProd[pk];
  const cs=r.cs;
  if(!p.csMap[cs])p.csMap[cs]={name:cs,revenue:0,leads:0,closing:0,units:0};
  const c=p.csMap[cs];
  c.revenue+=Number(r.revenue);c.leads+=Number(r.leads);c.closing+=Number(r.closing)-Number(r.invalid);c.units+=Number(r.units)-Number(r.invalidUnits);
 }
 return Object.values(byProd).sort((a,b)=>b.revenue-a.revenue).map(p=>({
  ...p,
  advList:Object.values(p.advertisers).sort((a,b)=>b.revenue-a.revenue),
  csList:Object.values(p.csMap).sort((a,b)=>b.revenue-a.revenue),
 }));
}

function renderProductBreakdownCanvases(breakdowns,period){
 const canvases=[];
 for(const prod of breakdowns){
  const advCount=prod.advList.length;
  const csCount=prod.csList.length;
  const maxRows=Math.max(advCount,csCount,1);
  const h=Math.max(540,130+maxRows*28+20);
  const{canvas,ctx,w}=createCanvas(960,h);
  ctx.fillStyle=B.white;ctx.fillRect(0,0,w,h);
  ctx.fillStyle=B.mid;ctx.fillRect(0,0,w,5);
  // title
  ctx.fillStyle=B.dark;ctx.font='bold 22px Arial';ctx.fillText(prod.product,50,45);
  ctx.fillStyle=B.accent;ctx.font='12px Arial';
  const cr=prod.leads?prod.closing/prod.leads:0;
  ctx.fillText(`Omzet ${money(prod.revenue)}  ·  ${num(prod.leads)} leads  ·  ${num(prod.closing)} closing  ·  CR ${pct(cr)}`,50,68);
  // Two columns: Advertiser (left) | CS (right)
  const colW=430,leftX=30,rightX=490,startY=95,rowH=28,headerH=30;
  // ── Left: Advertiser ──
  ctx.fillStyle=B.dark;roundRect(ctx,leftX,startY,colW,headerH,4);ctx.fill();
  ctx.fillStyle=B.white;ctx.font='bold 10px Arial';
  ctx.fillText('Advertiser',leftX+12,startY+19);
  ctx.textAlign='center';ctx.fillText('Omzet',leftX+260,startY+19);ctx.fillText('Leads',leftX+340,startY+19);ctx.fillText('CAQ',leftX+400,startY+19);
  ctx.textAlign='left';
  prod.advList.forEach((a,i)=>{
   const y=startY+headerH+i*rowH;
   ctx.fillStyle=i%2===0?'#f8fafb':B.white;ctx.fillRect(leftX,y,colW,rowH);
   ctx.fillStyle=COLORS[i%COLORS.length];roundRect(ctx,leftX+8,y+8,12,12,3);ctx.fill();
   ctx.fillStyle=B.dark;ctx.font='11px Arial';
   const label=a.name.length>18?a.name.slice(0,17)+'…':a.name;
   ctx.fillText(label,leftX+28,y+18);
   ctx.font='bold 10px Arial';ctx.textAlign='center';
   ctx.fillText(moneyShort(a.revenue),leftX+260,y+18);
   ctx.font='10px Arial';
   ctx.fillText(num(a.leads),leftX+340,y+18);
   ctx.fillText(a.revenue&&a.spend?pct(a.spend/a.revenue):'—',leftX+400,y+18);
   ctx.textAlign='left';
  });
  if(!advCount){ctx.fillStyle=B.accent;ctx.font='11px Arial';ctx.fillText('Tidak ada data advertiser',leftX+12,startY+headerH+18);}
  // ── Right: CS ──
  ctx.fillStyle=B.dark;roundRect(ctx,rightX,startY,colW,headerH,4);ctx.fill();
  ctx.fillStyle=B.white;ctx.font='bold 10px Arial';
  ctx.fillText('Customer Service',rightX+12,startY+19);
  ctx.textAlign='center';ctx.fillText('Omzet',rightX+230,startY+19);ctx.fillText('Leads',rightX+310,startY+19);ctx.fillText('CR',rightX+360,startY+19);ctx.fillText('Upsell',rightX+410,startY+19);
  ctx.textAlign='left';
  prod.csList.forEach((c,i)=>{
   const y=startY+headerH+i*rowH;
   ctx.fillStyle=i%2===0?'#f8fafb':B.white;ctx.fillRect(rightX,y,colW,rowH);
   ctx.fillStyle=COLORS[(i+3)%COLORS.length];roundRect(ctx,rightX+8,y+8,12,12,3);ctx.fill();
   ctx.fillStyle=B.dark;ctx.font='11px Arial';
   const label=c.name.length>18?c.name.slice(0,17)+'…':c.name;
   ctx.fillText(label,rightX+28,y+18);
   ctx.font='bold 10px Arial';ctx.textAlign='center';
   ctx.fillText(moneyShort(c.revenue),rightX+230,y+18);
   ctx.font='10px Arial';
   ctx.fillText(num(c.leads),rightX+310,y+18);
   ctx.fillText(pct(c.leads?c.closing/c.leads:0),rightX+360,y+18);
   const upsell=c.closing>0?(c.units/c.closing):0;
   ctx.fillText(upsell?upsell.toFixed(2)+'×':'—',rightX+410,y+18);
   ctx.textAlign='left';
  });
  if(!csCount){ctx.fillStyle=B.accent;ctx.font='11px Arial';ctx.fillText('Tidak ada data CS',rightX+12,startY+headerH+18);}
  canvases.push({title:`Breakdown: ${prod.product}`,base64:canvasToBase64(canvas)});
 }
 return canvases;
}

function aggregateProducts(groups){
 const byProd={};
 for(const g of groups){
  if(!byProd[g.product])byProd[g.product]={product:g.product,leads:0,closing:0,units:0,revenue:0,spend:0};
  const p=byProd[g.product];p.leads+=g.leads;p.closing+=g.closing;p.units+=g.units;p.revenue+=g.revenue;p.spend+=g.spend;
 }
 return Object.values(byProd).sort((a,b)=>b.revenue-a.revenue);
}

// ── Main export ──
export async function exportPPT({groups,filtered,total,kpis,hideSpend,period,onStatus}){
 await loadLib();

 const advRows=aggregateAdv(groups);
 const csRows=aggregateCS(filtered);
 const prodRows=aggregateProducts(groups);
 const prodBreakdowns=aggregateProductBreakdown(groups,filtered);

 // Step 1: Render all slides to canvas
 onStatus?.('Menyiapkan slide...');
 const findings=generateInsights(groups,filtered,advRows,csRows,prodRows,total,hideSpend);
 const breakdownSlides=renderProductBreakdownCanvases(prodBreakdowns,period);
 const slides=[
  {title:'Cover',base64:renderCoverCanvas(period)},
  {title:'Ringkasan Performa',base64:renderSummaryCanvas(total,kpis,hideSpend,period)},
  {title:'Temuan & Evaluasi',base64:renderInsightsCanvas(findings,period)},
  {title:'Tren Harian',base64:renderDailyTrendCanvas(groups,period)},
  {title:'Highlight Hari Terbaik',base64:renderBestDaysCanvas(groups,period)},
  {title:'Perbandingan Channel',base64:renderChannelCompareCanvas(groups,period)},
  {title:'Perbandingan Platform',base64:renderPlatformCompareCanvas(groups,period)},
  {title:'Performa Advertiser',base64:renderAdvBarCanvas(advRows)},
  {title:'Detail Advertiser',base64:renderAdvTableCanvas(advRows,hideSpend)},
  {title:'Performa CS',base64:renderCSCanvas(csRows)},
  {title:'Kontribusi Produk',base64:renderProductCanvas(prodRows)},
  ...breakdownSlides,
 ];

 // Step 2: Submit ALL tasks in parallel
 onStatus?.(`🚀 Mengirim ${slides.length} slide ke AI sekaligus...`);
 const tasks=await Promise.all(slides.map(async(s,i)=>{
  try{
   const{taskId,refFiles}=await submitTask(s.base64,s.title);
   onStatus?.(`📤 Slide ${i+1}/${slides.length} terkirim (${s.title})`);
   return {title:s.title,taskId,refFiles,fallback:s.base64};
  }catch(e){
   console.warn(`Submit "${s.title}" failed:`,e.message);
   return {title:s.title,taskId:null,refFiles:[],fallback:s.base64,failed:true};
  }
 }));

 // Step 3: Poll all tasks together until done
 const activeTasks=tasks.filter(t=>!t.failed);
 const resultUrls=activeTasks.length?await pollAllTasks(activeTasks,onStatus):[];

 // Step 4: Download result images in parallel
 onStatus?.(`📥 Mengunduh ${activeTasks.length} gambar hasil...`);
 const aiImages=[];
 let aiOk=0,aiFail=0;
 for(let i=0;i<slides.length;i++){
  const t=tasks[i];
  if(t.failed||!resultUrls.length){aiImages.push(t.fallback);aiFail++;continue;}
  const activeIdx=activeTasks.indexOf(t);
  const url=activeIdx>=0?resultUrls[activeIdx]:null;
  if(url){
   try{
    const b64=await fetchImageAsBase64(url);
    aiImages.push(b64);aiOk++;
   }catch(e){
    console.warn(`Download "${t.title}" failed:`,e.message);
    aiImages.push(t.fallback);aiFail++;
   }
  }else{aiImages.push(t.fallback);aiFail++;}
 }
 onStatus?.(`📊 Hasil: ${aiOk} slide AI, ${aiFail} fallback. Menyusun PPT...`);

 // Step 3: Build PPT with AI images
 onStatus?.('Menyusun file PPT...');
 const pres=new PptxGenJS();
 pres.layout='LAYOUT_WIDE';
 pres.author='Akuisisi Adsy Team';
 pres.title='Laporan Akuisisi';

 for(const imgB64 of aiImages){
  const sl=pres.addSlide();
  sl.addImage({data:'image/png;base64,'+imgB64,x:0,y:0,w:'100%',h:'100%'});
 }

 await pres.writeFile({fileName:`Laporan-Akuisisi-${period.replace(/\s/g,'_')}.pptx`});
 onStatus?.('Selesai!');
}

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
function slidePrompt(title){
 return `Transform this data visualization into a professional, modern PowerPoint presentation slide. Keep all text, numbers, and data exactly as shown - do not change any values. Make the design clean, corporate, and visually appealing with subtle gradients, clean typography, and professional color scheme using dark teal (#073b56) as primary color. The slide title is "${title}". Make it look like a premium consulting firm's presentation. 16:9 widescreen format.`;
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
 const cols=hideSpend?['Advertiser','Leads','Closing','CR','Omzet']:['Advertiser','Leads','Closing','CR','Biaya Iklan','Omzet','CAC','CAQ'];
 const totalH=Math.min(100+headerH+rows.length*rowH,540);
 const{canvas,ctx,w,h}=createCanvas(960,totalH);
 ctx.fillStyle=B.white;ctx.fillRect(0,0,w,h);
 ctx.fillStyle=B.mid;ctx.fillRect(0,0,w,5);
 ctx.fillStyle=B.dark;ctx.font='bold 24px Arial';ctx.fillText('Detail Advertiser',50,50);
 const colW=hideSpend?[240,100,100,90,200]:[200,85,85,75,120,120,100,100];
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
  const cr=r.leads?r.closing/r.leads:0;
  const vals=hideSpend?[r.advertiser,num(r.leads),num(r.closing),pct(cr),money(r.revenue)]:[r.advertiser,num(r.leads),num(r.closing),pct(cr),money(r.spend),money(r.revenue),r.closing&&r.spend?money(r.spend/r.closing):'—',r.revenue&&r.spend?pct(r.spend/r.revenue):'—'];
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

 // Step 1: Render all slides to canvas
 onStatus?.('Menyiapkan slide...');
 const slides=[
  {title:'Cover',base64:renderCoverCanvas(period)},
  {title:'Ringkasan Performa',base64:renderSummaryCanvas(total,kpis,hideSpend,period)},
  {title:'Performa Advertiser',base64:renderAdvBarCanvas(advRows)},
  {title:'Detail Advertiser',base64:renderAdvTableCanvas(advRows,hideSpend)},
  {title:'Performa CS',base64:renderCSCanvas(csRows)},
  {title:'Kontribusi Produk',base64:renderProductCanvas(prodRows)},
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

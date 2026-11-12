let PptxGenJS;
async function loadLib(){
 if(PptxGenJS)return;
 const mod=await import('https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/+esm');
 PptxGenJS=mod.default;
}

const B={dark:'#073b56',mid:'#1d5c7b',light:'#eaf4fa',accent:'#587488',white:'#ffffff',card:'#f4f9fd',green:'#0d9488',orange:'#d97706',blue:'#3b82f6',red:'#ef4444'};
const COLORS=['#1d5c7b','#0d9488','#d97706','#3b82f6','#8b5cf6','#ec4899','#f97316','#06b6d4','#84cc16','#ef4444'];
const money=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n||0);
const moneyShort=n=>{if(n>=1e9)return'Rp '+( n/1e9).toFixed(1)+'M';if(n>=1e6)return'Rp '+(n/1e6).toFixed(1)+'jt';return money(n)};
const pct=n=>`${(n*100).toFixed(1)}%`;
const num=n=>new Intl.NumberFormat('id-ID').format(n||0);

// ── Canvas helpers ──
function createCanvas(w,h){const c=document.createElement('canvas');c.width=w*2;c.height=h*2;const ctx=c.getContext('2d');ctx.scale(2,2);return{canvas:c,ctx,w,h};}
function canvasToBase64(c){return c.toDataURL('image/png').split(',')[1];}
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}

// ── Chart generators ──
function drawBarChart(data,{width=800,height=340,labelKey='name',valueKey='value',color=B.mid,showValue=true}={}){
 const{canvas,ctx,w,h}=createCanvas(width,height);
 const maxVal=Math.max(...data.map(d=>d[valueKey]),1);
 const pad={top:30,bottom:50,left:20,right:20};
 const barW=Math.min(50,((w-pad.left-pad.right)/data.length)*0.65);
 const gap=((w-pad.left-pad.right)/data.length);
 const chartH=h-pad.top-pad.bottom;
 // grid lines
 ctx.strokeStyle='#e5e7eb';ctx.lineWidth=0.5;
 for(let i=0;i<=4;i++){const y=pad.top+chartH*(1-i/4);ctx.beginPath();ctx.moveTo(pad.left,y);ctx.lineTo(w-pad.right,y);ctx.stroke();}
 // bars
 data.forEach((d,i)=>{
  const x=pad.left+i*gap+(gap-barW)/2;
  const barH=(d[valueKey]/maxVal)*chartH;
  const y=pad.top+chartH-barH;
  const ci=typeof color==='string'?color:COLORS[i%COLORS.length];
  // gradient bar
  const grad=ctx.createLinearGradient(x,y,x,y+barH);
  grad.addColorStop(0,ci);grad.addColorStop(1,ci+'99');
  roundRect(ctx,x,y,barW,barH,3);ctx.fillStyle=grad;ctx.fill();
  // value on top
  if(showValue){ctx.fillStyle=B.dark;ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.fillText(d.display||num(d[valueKey]),x+barW/2,y-6);}
  // label below
  ctx.fillStyle=B.accent;ctx.font='9px Arial';ctx.textAlign='center';
  const label=d[labelKey].length>10?d[labelKey].slice(0,9)+'…':d[labelKey];
  ctx.fillText(label,x+barW/2,h-pad.bottom+15);
 });
 return canvasToBase64(canvas);
}

function drawDonutChart(data,{width=300,height=300}={}){
 const{canvas,ctx,w,h}=createCanvas(width,height);
 const cx=w/2,cy=h/2,r=Math.min(w,h)/2-20,inner=r*0.6;
 const total=data.reduce((s,d)=>s+d.value,0);
 let angle=-Math.PI/2;
 data.forEach((d,i)=>{
  const sweep=(d.value/total)*Math.PI*2;
  ctx.beginPath();ctx.moveTo(cx+inner*Math.cos(angle),cy+inner*Math.sin(angle));
  ctx.arc(cx,cy,r,angle,angle+sweep);ctx.arc(cx,cy,inner,angle+sweep,angle,true);ctx.closePath();
  ctx.fillStyle=COLORS[i%COLORS.length];ctx.fill();
  // label on slice
  const mid=angle+sweep/2;
  const lx=cx+(r+inner)/2*Math.cos(mid);
  const ly=cy+(r+inner)/2*Math.sin(mid);
  if(sweep>0.25){ctx.fillStyle='#fff';ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(pct(d.value/total),lx,ly);}
  angle+=sweep;
 });
 // center text
 ctx.fillStyle=B.dark;ctx.font='bold 18px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.fillText(num(total),cx,cy-6);
 ctx.fillStyle=B.accent;ctx.font='10px Arial';ctx.fillText('Total Omzet',cx,cy+12);
 return canvasToBase64(canvas);
}

function drawHBarChart(data,{width=460,height=0,valueKey='value',labelKey='name',color=B.mid}={}){
 const rowH=32,pad={top:10,bottom:10,left:130,right:80};
 const h2=pad.top+data.length*rowH+pad.bottom;
 const{canvas,ctx,w,h:ch}=createCanvas(width,height||h2);
 const maxVal=Math.max(...data.map(d=>d[valueKey]),1);
 const barArea=w-pad.left-pad.right;
 data.forEach((d,i)=>{
  const y=pad.top+i*rowH;
  const barW=(d[valueKey]/maxVal)*barArea;
  const ci=typeof color==='string'?color:COLORS[i%COLORS.length];
  // label
  ctx.fillStyle=B.dark;ctx.font='11px Arial';ctx.textAlign='right';ctx.textBaseline='middle';
  const label=d[labelKey].length>16?d[labelKey].slice(0,15)+'…':d[labelKey];
  ctx.fillText(label,pad.left-10,y+rowH/2);
  // bar
  const grad=ctx.createLinearGradient(pad.left,y,pad.left+barW,y);
  grad.addColorStop(0,ci);grad.addColorStop(1,ci+'88');
  roundRect(ctx,pad.left,y+4,Math.max(barW,2),rowH-8,4);ctx.fillStyle=grad;ctx.fill();
  // value
  ctx.fillStyle=B.dark;ctx.font='bold 10px Arial';ctx.textAlign='left';ctx.textBaseline='middle';
  ctx.fillText(d.display||num(d[valueKey]),pad.left+barW+8,y+rowH/2);
 });
 return canvasToBase64(canvas);
}

// ── Slide builders ──
function slideBase(pres,title,subtitle){
 const s=pres.addSlide();
 s.addShape('rect',{x:0,y:0,w:'100%',h:0.06,fill:{color:B.mid}});
 s.addText(title,{x:0.6,y:0.25,w:8,fontSize:22,bold:true,color:B.dark,fontFace:'Arial'});
 if(subtitle)s.addText(subtitle,{x:0.6,y:0.6,w:8,fontSize:11,color:B.accent,fontFace:'Arial'});
 return s;
}

function addCover(pres,period){
 const s=pres.addSlide();
 s.background={color:B.dark};
 // decorative shapes
 s.addShape('rect',{x:8.5,y:0,w:5,h:7.5,fill:{color:B.mid},rotate:15});
 s.addShape('ellipse',{x:-1,y:4,w:4,h:4,fill:{color:'#0a4d6d'}});
 s.addText('AKUISISI ADSY TEAM',{x:0.8,y:1.5,w:7,fontSize:13,color:B.accent,letterSpacing:4,fontFace:'Arial'});
 s.addText('Laporan\nAkuisisi',{x:0.8,y:2.1,w:7,fontSize:44,bold:true,color:B.white,fontFace:'Arial',lineSpacingMultiple:1.1});
 s.addShape('rect',{x:0.8,y:4.0,w:2,h:0.06,fill:{color:'#0d9488'}});
 s.addText(period,{x:0.8,y:4.3,w:7,fontSize:16,color:B.accent,fontFace:'Arial'});
 s.addText('Generated by Akuisisi Adsy Dashboard',{x:0.8,y:6.8,w:7,fontSize:9,color:'#456070',fontFace:'Arial'});
}

function addSummary(pres,total,kpis,hideSpend,period){
 const s=slideBase(pres,'Ringkasan Performa',period);
 const cards=[
  {label:'Total Omzet',value:money(total.revenue),color:B.green,icon:'$'},
  ...(!hideSpend?[{label:'Biaya Iklan + Pajak',value:money(total.spend),color:B.orange,icon:'*'}]:[]),
  {label:'Total Closing',value:num(total.closing),color:B.blue,icon:'#'},
  {label:'Closing Rate',value:pct(total.leads?total.closing/total.leads:0),color:'#8b5cf6',icon:'%'},
  ...(!hideSpend&&kpis.caq!==null?[{label:'CAQ',value:pct(kpis.caq),color:B.green,icon:'~'}]:[]),
 ];
 const cols=cards.length,cw=8.6/cols,startX=0.7;
 cards.forEach((c,i)=>{
  const x=startX+i*(cw+0.1);
  // card bg
  s.addShape('roundRect',{x,y:1.15,w:cw,h:1.6,fill:{color:B.white},shadow:{type:'outer',blur:6,offset:2,color:'#00000011'},rectRadius:0.1});
  // color accent bar
  s.addShape('rect',{x,y:1.15,w:cw,h:0.06,fill:{color:c.color},rectRadius:0.1});
  // label
  s.addText(c.label,{x:x+0.15,y:1.4,w:cw-0.3,fontSize:10,color:B.accent,fontFace:'Arial'});
  // value
  s.addText(c.value,{x:x+0.15,y:1.75,w:cw-0.3,fontSize:22,bold:true,color:B.dark,fontFace:'Arial'});
 });
 // summary row
 const leads=total.leads,closing=total.closing,units=total.units;
 s.addShape('roundRect',{x:0.7,y:3.1,w:8.8,h:0.7,fill:{color:B.card},rectRadius:0.08});
 s.addText(`${num(leads)} leads  ·  ${num(closing)} closing  ·  ${num(units)} unit terjual  ·  Upsell ${closing>0?(units/closing).toFixed(2)+'×':'—'}`,
  {x:0.9,y:3.2,w:8.4,fontSize:12,color:B.dark,fontFace:'Arial'});
}

function addAdvSlide(pres,groups,hideSpend){
 const byAdv={};
 for(const g of groups){
  if(!byAdv[g.advertiser])byAdv[g.advertiser]={advertiser:g.advertiser,leads:0,closing:0,units:0,revenue:0,spend:0};
  const a=byAdv[g.advertiser];a.leads+=g.leads;a.closing+=g.closing;a.units+=g.units;a.revenue+=g.revenue;a.spend+=g.spend;
 }
 const rows=Object.values(byAdv).sort((a,b)=>b.revenue-a.revenue);
 // Slide: bar chart
 const s=slideBase(pres,'Performa Advertiser',`${rows.length} advertiser aktif`);
 const top10=rows.slice(0,10);
 const barImg=drawBarChart(top10.map(r=>({name:r.advertiser,value:r.revenue,display:moneyShort(r.revenue)})),{width:880,height:320,color:COLORS,valueKey:'value'});
 s.addImage({data:'image/png;base64,'+barImg,x:0.4,y:1.0,w:9.4,h:3.8});
 s.addText('Omzet per Advertiser (Top 10)',{x:0.6,y:4.85,w:5,fontSize:9,color:B.accent,fontFace:'Arial'});
 // Slide: table
 const s2=slideBase(pres,'Detail Advertiser');
 const cols=hideSpend?['Advertiser','Leads','Closing','CR','Omzet']:['Advertiser','Leads','Closing','CR','Biaya Iklan','Omzet','CAC','CAQ'];
 const hdr=cols.map(c=>({text:c,options:{bold:true,fontSize:9,color:B.white,fill:{color:B.dark},align:'center',fontFace:'Arial',margin:[4,4,4,4]}}));
 const tRows=[hdr];
 rows.forEach((r,i)=>{
  const cr=r.leads?r.closing/r.leads:0;
  const vals=hideSpend
   ?[r.advertiser,num(r.leads),num(r.closing),pct(cr),money(r.revenue)]
   :[r.advertiser,num(r.leads),num(r.closing),pct(cr),money(r.spend),money(r.revenue),r.closing&&r.spend?money(r.spend/r.closing):'—',r.revenue&&r.spend?pct(r.spend/r.revenue):'—'];
  tRows.push(vals.map((v,ci)=>({text:String(v),options:{fontSize:8,color:B.dark,fill:{color:i%2===0?B.white:'#f8fafb'},align:ci===0?'left':'center',fontFace:'Arial',margin:[3,4,3,4]}})));
 });
 const cw=hideSpend?[2.5,1.3,1.3,1.2,2.2]:[2.2,1.05,1.05,0.85,1.35,1.35,1.05,1.05];
 s2.addTable(tRows,{x:0.3,y:0.9,border:{type:'solid',pt:0.5,color:'#e8eef2'},autoPage:true,autoPageRepeatHeader:true,colW:cw});
}

function addCSSlide(pres,reports){
 const byCS={};
 for(const r of reports){
  if(!byCS[r.cs])byCS[r.cs]={cs:r.cs,leads:0,closing:0,units:0,revenue:0};
  const a=byCS[r.cs];a.leads+=Number(r.leads);a.closing+=Number(r.closing)-Number(r.invalid);a.units+=Number(r.units)-Number(r.invalidUnits);a.revenue+=Number(r.revenue);
 }
 const rows=Object.values(byCS).sort((a,b)=>b.revenue-a.revenue);
 // Slide: horizontal bar chart
 const s=slideBase(pres,'Performa CS',`${rows.length} CS aktif`);
 const top10=rows.slice(0,12);
 const hbarImg=drawHBarChart(top10.map(r=>({name:r.cs,value:r.revenue,display:moneyShort(r.revenue)})),{width:480,height:top10.length*32+20,color:COLORS});
 s.addImage({data:'image/png;base64,'+hbarImg,x:0.3,y:1.0,w:5.2,h:top10.length*0.36+0.3});
 // CR ranking on right
 const crTop=rows.filter(r=>r.leads>=10).sort((a,b)=>(b.closing/b.leads)-(a.closing/a.leads)).slice(0,8);
 s.addText('Top CR (min 10 leads)',{x:6,y:1.0,w:3.5,fontSize:11,bold:true,color:B.dark,fontFace:'Arial'});
 crTop.forEach((r,i)=>{
  const cr=r.leads?r.closing/r.leads:0;
  const y=1.4+i*0.35;
  s.addText(`${i+1}`,{x:6,y,w:0.3,fontSize:10,bold:true,color:B.accent,fontFace:'Arial'});
  s.addText(r.cs,{x:6.3,y,w:2,fontSize:10,color:B.dark,fontFace:'Arial'});
  s.addText(pct(cr),{x:8.5,y,w:0.8,fontSize:10,bold:true,color:B.green,align:'right',fontFace:'Arial'});
 });
 // Slide: table
 const s2=slideBase(pres,'Detail CS');
 const cols=['CS','Leads','Closing','CR','Unit','Omzet','Upsell'];
 const hdr=cols.map(c=>({text:c,options:{bold:true,fontSize:9,color:B.white,fill:{color:B.dark},align:'center',fontFace:'Arial',margin:[4,4,4,4]}}));
 const tRows=[hdr];
 rows.forEach((r,i)=>{
  const cr=r.leads?r.closing/r.leads:0;
  const upsell=r.closing>0?(r.units/r.closing):0;
  const vals=[r.cs,num(r.leads),num(r.closing),pct(cr),num(r.units),money(r.revenue),upsell?upsell.toFixed(2)+'×':'—'];
  tRows.push(vals.map((v,ci)=>({text:String(v),options:{fontSize:8,color:B.dark,fill:{color:i%2===0?B.white:'#f8fafb'},align:ci===0?'left':'center',fontFace:'Arial',margin:[3,4,3,4]}})));
 });
 s2.addTable(tRows,{x:0.3,y:0.9,border:{type:'solid',pt:0.5,color:'#e8eef2'},autoPage:true,autoPageRepeatHeader:true,colW:[2.2,1.1,1.1,0.9,1.1,1.6,1.1]});
}

function addProductSlide(pres,groups){
 const byProd={};
 for(const g of groups){
  if(!byProd[g.product])byProd[g.product]={product:g.product,leads:0,closing:0,units:0,revenue:0,spend:0};
  const p=byProd[g.product];p.leads+=g.leads;p.closing+=g.closing;p.units+=g.units;p.revenue+=g.revenue;p.spend+=g.spend;
 }
 const rows=Object.values(byProd).sort((a,b)=>b.revenue-a.revenue);
 const s=slideBase(pres,'Kontribusi Produk',`${rows.length} produk`);
 // donut chart
 const donutImg=drawDonutChart(rows.map(r=>({name:r.product,value:r.revenue})),{width:280,height:280});
 s.addImage({data:'image/png;base64,'+donutImg,x:0.5,y:1.1,w:3.2,h:3.2});
 // legend
 rows.forEach((r,i)=>{
  const y=1.2+i*0.4;
  if(y>4.5)return;
  s.addShape('rect',{x:3.9,y:y+0.05,w:0.2,h:0.2,fill:{color:COLORS[i%COLORS.length]},rectRadius:0.03});
  s.addText(r.product,{x:4.2,y,w:2,fontSize:11,color:B.dark,fontFace:'Arial'});
  s.addText(money(r.revenue),{x:6.2,y,w:1.8,fontSize:11,bold:true,color:B.dark,align:'right',fontFace:'Arial'});
  const total=rows.reduce((s,r2)=>s+r2.revenue,0);
  s.addText(pct(r.revenue/total),{x:8.1,y,w:0.8,fontSize:10,color:B.accent,align:'right',fontFace:'Arial'});
 });
 // table below or next slide
 const s2=slideBase(pres,'Detail Produk');
 const cols=['Produk','Leads','Closing','CR','Unit','Omzet'];
 const hdr=cols.map(c=>({text:c,options:{bold:true,fontSize:9,color:B.white,fill:{color:B.dark},align:'center',fontFace:'Arial',margin:[4,4,4,4]}}));
 const tRows=[hdr];
 rows.forEach((r,i)=>{
  const cr=r.leads?r.closing/r.leads:0;
  const vals=[r.product,num(r.leads),num(r.closing),pct(cr),num(r.units),money(r.revenue)];
  tRows.push(vals.map((v,ci)=>({text:String(v),options:{fontSize:8,color:B.dark,fill:{color:i%2===0?B.white:'#f8fafb'},align:ci===0?'left':'center',fontFace:'Arial',margin:[3,4,3,4]}})));
 });
 s2.addTable(tRows,{x:0.5,y:0.9,border:{type:'solid',pt:0.5,color:'#e8eef2'},autoPage:true,autoPageRepeatHeader:true,colW:[2.5,1.3,1.3,1.2,1.2,1.8]});
}

export async function exportPPT({groups,filtered,total,kpis,hideSpend,period}){
 await loadLib();
 const pres=new PptxGenJS();
 pres.layout='LAYOUT_WIDE';
 pres.author='Akuisisi Adsy Team';
 pres.title='Laporan Akuisisi';

 addCover(pres,period);
 addSummary(pres,total,kpis,hideSpend,period);
 addAdvSlide(pres,groups,hideSpend);
 addCSSlide(pres,filtered);
 addProductSlide(pres,groups);

 await pres.writeFile({fileName:`Laporan-Akuisisi-${period.replace(/\s/g,'_')}.pptx`});
}

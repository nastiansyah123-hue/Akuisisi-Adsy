let PptxGenJS;
async function loadLib(){
 if(PptxGenJS)return;
 const mod=await import('https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/+esm');
 PptxGenJS=mod.default;
}

const BRAND={dark:'#073b56',mid:'#1d5c7b',light:'#eaf4fa',accent:'#587488',white:'#ffffff'};
const money=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n||0);
const pct=n=>`${(n*100).toFixed(1)}%`;
const num=n=>new Intl.NumberFormat('id-ID').format(n||0);

function addCover(pres,period){
 const s=pres.addSlide();
 s.background={color:BRAND.dark};
 s.addText('AKUISISI ADSY TEAM',{x:0.8,y:1.2,w:8.4,fontSize:12,color:BRAND.accent,letterSpacing:3,fontFace:'Arial'});
 s.addText('Laporan Akuisisi',{x:0.8,y:1.7,w:8.4,fontSize:36,bold:true,color:BRAND.white,fontFace:'Arial'});
 s.addText(`Periode: ${period}`,{x:0.8,y:2.6,w:8.4,fontSize:14,color:BRAND.accent,fontFace:'Arial'});
 s.addShape('rect',{x:0.8,y:3.2,w:1.5,h:0.05,fill:{color:BRAND.mid}});
}

function addSummary(pres,total,kpis,hideSpend){
 const s=pres.addSlide();
 s.addText('Ringkasan Performa',{x:0.5,y:0.3,w:9,fontSize:22,bold:true,color:BRAND.dark,fontFace:'Arial'});
 const cards=[];
 cards.push({label:'Total Omzet',value:money(total.revenue)});
 if(!hideSpend)cards.push({label:'Biaya Iklan + Pajak',value:money(total.spend)});
 cards.push({label:'Total Closing',value:num(total.closing)});
 cards.push({label:'Closing Rate',value:pct(total.leads?total.closing/total.leads:0)});
 if(!hideSpend&&kpis.caq!==null)cards.push({label:'CAQ',value:pct(kpis.caq)});
 const cols=cards.length;
 const cw=(9/(cols)),startX=0.5;
 cards.forEach((c,i)=>{
  const x=startX+i*cw;
  s.addShape('roundRect',{x,y:1.1,w:cw-0.15,h:1.3,fill:{color:BRAND.light},rectRadius:0.08});
  s.addText(c.label,{x,y:1.2,w:cw-0.15,fontSize:10,color:BRAND.accent,align:'center',fontFace:'Arial'});
  s.addText(c.value,{x,y:1.55,w:cw-0.15,fontSize:20,bold:true,color:BRAND.dark,align:'center',fontFace:'Arial'});
 });
 return s;
}

function tableOpts(){
 return {
  border:{type:'solid',pt:0.5,color:BRAND.light},
  autoPage:true,autoPageRepeatHeader:true,
  colW:[2.2,1.1,1.1,0.9,1.4,1.4,1.1,1.1],
 };
}

function headerRow(cols){
 return cols.map(c=>({text:c,options:{bold:true,fontSize:9,color:BRAND.white,fill:{color:BRAND.dark},align:'center',fontFace:'Arial'}}));
}

function dataRow(vals,i){
 return vals.map((v,ci)=>({text:String(v),options:{fontSize:9,color:BRAND.dark,fill:{color:i%2===0?BRAND.white:'#f4f9fd'},align:ci===0?'left':'center',fontFace:'Arial'}}));
}

function addAdvTable(pres,groups,hideSpend){
 const s=pres.addSlide();
 s.addText('Performa Advertiser',{x:0.5,y:0.3,w:9,fontSize:22,bold:true,color:BRAND.dark,fontFace:'Arial'});
 const byAdv={};
 for(const g of groups){
  if(!byAdv[g.advertiser])byAdv[g.advertiser]={advertiser:g.advertiser,leads:0,closing:0,units:0,revenue:0,spend:0};
  const a=byAdv[g.advertiser];
  a.leads+=g.leads;a.closing+=g.closing;a.units+=g.units;a.revenue+=g.revenue;a.spend+=g.spend;
 }
 const rows=Object.values(byAdv).sort((a,b)=>b.revenue-a.revenue);
 const cols=hideSpend?['Advertiser','Leads','Closing','CR','Omzet']:['Advertiser','Leads','Closing','CR','Biaya Iklan','Omzet','CAC','CAQ'];
 const tRows=[headerRow(cols)];
 rows.forEach((r,i)=>{
  const cr=r.leads?r.closing/r.leads:0;
  const vals=hideSpend
   ?[r.advertiser,num(r.leads),num(r.closing),pct(cr),money(r.revenue)]
   :[r.advertiser,num(r.leads),num(r.closing),pct(cr),money(r.spend),money(r.revenue),r.closing&&r.spend?money(r.spend/r.closing):'—',r.revenue&&r.spend?pct(r.spend/r.revenue):'—'];
  tRows.push(dataRow(vals,i));
 });
 const cw=hideSpend?[2.5,1.3,1.3,1.2,2.2]:[2.2,1.1,1.1,0.9,1.4,1.4,1.1,1.1];
 s.addTable(tRows,{x:0.3,y:1.0,border:{type:'solid',pt:0.5,color:BRAND.light},autoPage:true,autoPageRepeatHeader:true,colW:cw});
}

function addCSTable(pres,reports){
 const s=pres.addSlide();
 s.addText('Performa CS',{x:0.5,y:0.3,w:9,fontSize:22,bold:true,color:BRAND.dark,fontFace:'Arial'});
 const byCS={};
 for(const r of reports){
  if(!byCS[r.cs])byCS[r.cs]={cs:r.cs,leads:0,closing:0,units:0,revenue:0};
  const a=byCS[r.cs];
  a.leads+=Number(r.leads);a.closing+=Number(r.closing)-Number(r.invalid);a.units+=Number(r.units)-Number(r.invalidUnits);a.revenue+=Number(r.revenue);
 }
 const rows=Object.values(byCS).sort((a,b)=>b.revenue-a.revenue);
 const cols=['CS','Leads','Closing','CR','Unit','Omzet','Upsell'];
 const tRows=[headerRow(cols)];
 rows.forEach((r,i)=>{
  const cr=r.leads?r.closing/r.leads:0;
  const upsell=r.closing>0?(r.units/r.closing):0;
  tRows.push(dataRow([r.cs,num(r.leads),num(r.closing),pct(cr),num(r.units),money(r.revenue),upsell?upsell.toFixed(2)+'×':'—'],i));
 });
 s.addTable(tRows,{x:0.3,y:1.0,border:{type:'solid',pt:0.5,color:BRAND.light},autoPage:true,autoPageRepeatHeader:true,colW:[2.2,1.1,1.1,0.9,1.1,1.6,1.1]});
}

function addProductTable(pres,groups){
 const s=pres.addSlide();
 s.addText('Kontribusi Produk',{x:0.5,y:0.3,w:9,fontSize:22,bold:true,color:BRAND.dark,fontFace:'Arial'});
 const byProd={};
 for(const g of groups){
  if(!byProd[g.product])byProd[g.product]={product:g.product,leads:0,closing:0,units:0,revenue:0,spend:0};
  const p=byProd[g.product];
  p.leads+=g.leads;p.closing+=g.closing;p.units+=g.units;p.revenue+=g.revenue;p.spend+=g.spend;
 }
 const rows=Object.values(byProd).sort((a,b)=>b.revenue-a.revenue);
 const cols=['Produk','Leads','Closing','CR','Unit','Omzet'];
 const tRows=[headerRow(cols)];
 rows.forEach((r,i)=>{
  const cr=r.leads?r.closing/r.leads:0;
  tRows.push(dataRow([r.product,num(r.leads),num(r.closing),pct(cr),num(r.units),money(r.revenue)],i));
 });
 s.addTable(tRows,{x:0.5,y:1.0,border:{type:'solid',pt:0.5,color:BRAND.light},autoPage:true,autoPageRepeatHeader:true,colW:[2.5,1.3,1.3,1.2,1.2,1.8]});
}

export async function exportPPT({groups,filtered,total,kpis,hideSpend,period}){
 await loadLib();
 const pres=new PptxGenJS();
 pres.layout='LAYOUT_WIDE';
 pres.author='Akuisisi Adsy Team';
 pres.title='Laporan Akuisisi';

 addCover(pres,period);
 addSummary(pres,total,kpis,hideSpend);
 addAdvTable(pres,groups,hideSpend);
 addCSTable(pres,filtered);
 addProductTable(pres,groups);

 await pres.writeFile({fileName:`Laporan-Akuisisi-${period.replace(/\s/g,'_')}.pptx`});
}

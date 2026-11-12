export const key = r => [r.date,r.product,r.advertiser,r.channel,r.platform||'Meta'].join('|');
export function summarize(reports, ads) {
 const map = new Map();
 const get = r => { const k=key(r); if(!map.has(k)) map.set(k,{date:r.date,product:r.product,advertiser:r.advertiser,channel:r.channel,platform:r.platform||'Meta',leads:0,closing:0,units:0,revenue:0,spend:0,cs:new Set()}); return map.get(k); };
 for(const r of reports){const g=get(r);g.leads+=Number(r.leads);g.closing+=Number(r.closing)-Number(r.invalid);g.units+=Number(r.units)-Number(r.invalidUnits);g.revenue+=Number(r.revenue);g.cs.add(r.cs);}
 for(const a of ads) get(a).spend+=Number(a.budget)*(1+Number(a.tax)/100);
 return [...map.values()].map(g=>({...g,cs:[...g.cs],cr:g.leads?g.closing/g.leads:0,cpl:g.leads?g.spend/g.leads:null,cac:g.closing?g.spend/g.closing:null,roas:g.spend?g.revenue/g.spend:null}));
}
export function totals(rows){return rows.reduce((a,r)=>{for(const k of ['leads','closing','units','revenue','spend'])a[k]+=r[k]||0;return a;},{leads:0,closing:0,units:0,revenue:0,spend:0});}
export function validateReport(r){if(!r.date||!r.cs||!r.product||!r.advertiser||!r.channel)return 'Lengkapi identitas laporan.';for(const k of ['leads','closing','units','invalid','invalidUnits','revenue'])if(!Number.isFinite(Number(r[k]))||Number(r[k])<0)return 'Angka laporan harus nol atau lebih.';for(const k of ['leads','closing','units','invalid','invalidUnits'])if(!Number.isInteger(Number(r[k])))return 'Jumlah leads, closing, dan unit harus bilangan bulat.';if(+r.invalid>+r.closing||+r.invalidUnits>+r.units)return 'Koreksi tidak boleh melebihi jumlah awal.';if(+r.units<+r.closing)return 'Jumlah unit tidak boleh kurang dari closing.';return '';}
export function dashboardMetrics(total,hideSpend=false){return {cac:!hideSpend&&total.closing>0?total.spend/total.closing:null,caq:!hideSpend&&total.revenue>0?total.spend/total.revenue:null,upsell:total.closing>0?total.units/total.closing:null};}

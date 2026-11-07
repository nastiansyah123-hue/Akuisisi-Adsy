// Report dates and shortcuts follow the team's Jakarta business calendar.
export function jakartaDate(now=new Date()) {
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const get=type=>parts.find(p=>p.type===type).value;
 return `${get('year')}-${get('month')}-${get('day')}`;
}
export function shiftDate(date,days){const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function inPeriod(date,{mode,month,start,end}){
 if(!date)return false;
 if(mode==='month')return !!month&&date.startsWith(month+'-');
 if(!start)return false;
 if(mode==='day')return date===start;
 return !!end&&start<=end&&date>=start&&date<=end;
}
export function periodFilename({mode,month,start,end}){return mode==='month'?month:mode==='day'?start:`${start}_${end}`;}
export function monthBounds(month){const [year,m]=month.split('-').map(Number);return {start:`${month}-01`,end:new Date(Date.UTC(year,m,0,12)).toISOString().slice(0,10)};}
export function presetRange(label,now=jakartaDate()){
 if(label==='Hari Ini')return {start:now,end:now};
 if(label==='Kemarin'){const date=shiftDate(now,-1);return {start:date,end:date};}
 if(label==='Bulan Ini')return monthBounds(now.slice(0,7));
 if(label==='Bulan Lalu')return monthBounds(shiftDate(now.slice(0,7)+'-01',-1).slice(0,7));
 const days={'7 Hari Terakhir':7,'14 Hari Terakhir':14,'30 Hari Terakhir':30,'90 Hari Terakhir':90}[label];
 return {start:shiftDate(now,1-days),end:now};
}
export function calendarDays(month){const first=month+'-01',weekday=new Date(first+'T12:00:00Z').getUTCDay(),offset=(weekday+6)%7;return Array.from({length:42},(_,i)=>shiftDate(first,i-offset));}

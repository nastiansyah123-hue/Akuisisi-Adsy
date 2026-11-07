export const ALL_ADVERTISERS='Semua advertiser',ALL_CS='Semua CS';
export function filterTeamData(reports,ads,{advertiser=ALL_ADVERTISERS,cs=ALL_CS}={}){
 const matchesAdv=r=>advertiser===ALL_ADVERTISERS||r.advertiser===advertiser;
 return {reports:reports.filter(r=>matchesAdv(r)&&(cs===ALL_CS||r.cs===cs)),ads:ads.filter(matchesAdv),sharedSpend:cs!==ALL_CS};
}

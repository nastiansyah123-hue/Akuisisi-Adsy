export function advertiserAssignmentKey(a){return a?.product&&a?.advertiser&&a?.channel?[a.product,a.advertiser,a.channel].join('|'):'';}
export function assignmentFields(a,includeCS=false){return {...(includeCS?{cs:a?.cs||''}:{}),product:a?.product||'',advertiser:a?.advertiser||'',channel:a?.channel||''};}

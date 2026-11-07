export const ALL_PRODUCTS='Semua produk';
export const inProduct=(row,selected)=>selected===ALL_PRODUCTS||row.product===selected;
export function availableProducts({catalog,assignments,reports,ads},role){const names=[...(role==='admin'?catalog.map(p=>p.name):[]),...assignments.map(a=>a.product),...reports.map(r=>r.product),...ads.map(a=>a.product)];return [...new Set(names)].sort((a,b)=>a.localeCompare(b,'id'));}

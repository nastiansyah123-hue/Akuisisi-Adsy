import {readAllRows} from './remoteRows';
import {createClient} from '@supabase/supabase-js';
export const supabase=import.meta.env.VITE_SUPABASE_URL&&import.meta.env.VITE_SUPABASE_ANON_KEY?createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY):null;
export async function loadRemote(signal){const tables=['reports','ads','assignments','catalog','packageCorrections','leadReports','profiles'];const rows=await Promise.all(tables.map(t=>readAllRows(supabase,t,500,signal)));return Object.fromEntries(tables.map((t,i)=>[t,rows[i]]));}
export async function saveRemote(table,value,existing){const {data,error}=await (existing?supabase.from(table).update(value).eq('id',value.id):supabase.from(table).insert(value)).select().single();if(error)throw error;return data;}

export async function correctRemote({reportId,packageId,delta,reason,expected}){const {error}=await supabase.rpc('correct_package',{p_report_id:reportId,p_package_id:packageId,p_delta:delta,p_reason:reason,p_expected:expected});if(error)throw error;return loadRemote();}
export async function saveDailyRemote(report,counts,notes){const {error}=await supabase.rpc('save_cs_daily_report',{p_report:report,p_counts:counts,p_notes:notes});if(error)throw error;return loadRemote();}

import {readAllRows} from './remoteRows';
import {createClient} from '@supabase/supabase-js';
export const supabase=import.meta.env.VITE_SUPABASE_URL&&import.meta.env.VITE_SUPABASE_ANON_KEY?createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY):null;
export async function loadRemote(){const tables=['reports','ads','assignments','catalog','packageCorrections','leadReports','profiles','sl_teams'];const results=await Promise.all(tables.map(t=>readAllRows(supabase,t)));const obj=Object.fromEntries(tables.map((t,i)=>[t,results[i]]));obj.slTeams=obj.sl_teams;delete obj.sl_teams;return obj;}
export async function saveRemote(table,value,existing){const {data,error}=await (existing?supabase.from(table).update(value).eq('id',value.id):supabase.from(table).insert(value)).select().single();if(error)throw error;return data;}

export async function changeAccountRole(userId,role){const {error}=await supabase.rpc('change_account_role',{p_user_id:userId,p_role:role});if(error)throw error;}
export async function deactivateAccount(userId){const {error}=await supabase.rpc('deactivate_account',{p_user_id:userId});if(error)throw error;}

export async function addSlTeamMember(slName,csName){const {data,error}=await supabase.from('sl_teams').insert({sl_name:slName,cs_name:csName}).select().single();if(error)throw error;return data;}
export async function removeSlTeamMember(id){const {error}=await supabase.from('sl_teams').delete().eq('id',id);if(error)throw error;}

export async function fetchCSNames(){
  if(!supabase)return[];
  try{
    const session=await supabase.auth.getSession();
    const token=session?.data?.session?.access_token;
    if(!token)return[];
    const res=await fetch('/api/laporan-bridge?action=cs-list',{
      headers:{'X-Admin-Token':token,'Content-Type':'application/json'}
    });
    if(!res.ok)return[];
    const data=await res.json();
    return(data.csNames||[]).map(p=>p.nama).filter(Boolean);
  }catch{return[];}
}

export async function fetchAdvNames(){
  if(!supabase)return[];
  try{
    const session=await supabase.auth.getSession();
    const token=session?.data?.session?.access_token;
    if(!token)return[];
    const res=await fetch('/api/laporan-bridge?action=adv-list',{
      headers:{'X-Admin-Token':token,'Content-Type':'application/json'}
    });
    if(!res.ok)return[];
    const data=await res.json();
    return(data.advNames||[]).map(p=>p.name).filter(Boolean);
  }catch{return[];}
}

export async function correctRemote({reportId,packageId,delta,reason,expected}){const {error}=await supabase.rpc('correct_package',{p_report_id:reportId,p_package_id:packageId,p_delta:delta,p_reason:reason,p_expected:expected});if(error)throw error;return loadRemote();}
export async function saveDailyRemote(report,counts,notes){const {error}=await supabase.rpc('save_cs_daily_report',{p_report:report,p_counts:counts,p_notes:notes});if(error)throw error;return loadRemote();}

-- Apply after 004 once. Save order totals and BEF atomically.
begin;
create function public.save_cs_daily_report(p_report jsonb,p_counts jsonb,p_notes text default '') returns void language plpgsql security invoker set search_path=public as $$
declare previous public.reports%rowtype;exists_report boolean;new_total numeric;new_leads integer;report_id text;
begin
 if public.app_role() is distinct from 'cs' or p_report->>'cs' is distinct from public.app_name() then raise exception 'Hanya CS pemilik laporan yang dapat menyimpan laporan harian.';end if;
 report_id:=p_report->>'id';new_leads:=(p_report->>'leads')::integer;
 if report_id is null or new_leads is null or new_leads<0 then raise exception 'Identitas atau jumlah leads tidak valid.';end if;
 select * into previous from public.reports where id=report_id for update;exists_report:=found;
 if exists_report and (previous.cs,previous.date,previous.product,previous.advertiser,previous.channel) is distinct from (p_report->>'cs',(p_report->>'date')::date,p_report->>'product',p_report->>'advertiser',p_report->>'channel') then raise exception 'Identitas laporan tidak dapat dipindahkan.';end if;
 if jsonb_typeof(p_counts) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_counts))<>7 then raise exception 'Isi tujuh kategori BEF yang valid.';end if;
 select sum(value::numeric) into new_total from jsonb_each_text(p_counts);
 if new_total is null then raise exception 'Jumlah kategori wajib diisi.';end if;
 if new_total>new_leads then raise exception 'Total kategori melebihi jumlah leads.';end if;
 -- Lower classification first when decreasing leads; increase leads first otherwise.
 -- Both steps are in one transaction and roll back together on any failure.
 if exists_report and new_total<=previous.leads then
  insert into public."leadReports"(id,"reportId",counts,notes) values(report_id,report_id,p_counts,coalesce(p_notes,'')) on conflict("reportId") do update set counts=excluded.counts,notes=excluded.notes;
 end if;
 if exists_report then
  update public.reports set leads=new_leads,notes=coalesce(p_report->>'notes',''),"packageLines"=p_report->'packageLines' where id=report_id;
 else
  insert into public.reports(id,date,cs,product,advertiser,channel,leads,notes,"packageLines") values(report_id,(p_report->>'date')::date,p_report->>'cs',p_report->>'product',p_report->>'advertiser',p_report->>'channel',new_leads,coalesce(p_report->>'notes',''),p_report->'packageLines');
 end if;
 if not exists_report or new_total>previous.leads then
  insert into public."leadReports"(id,"reportId",counts,notes) values(report_id,report_id,p_counts,coalesce(p_notes,'')) on conflict("reportId") do update set counts=excluded.counts,notes=excluded.notes;
 end if;
end $$;
revoke all on function public.save_cs_daily_report(jsonb,jsonb,text) from public;
grant execute on function public.save_cs_daily_report(jsonb,jsonb,text) to authenticated;
commit;

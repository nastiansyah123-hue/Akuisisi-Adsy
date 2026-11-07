-- Existing installations: apply after 003, once. Fresh installs use schema.sql only.
begin;
create table public."leadReports"(
 id text primary key,"reportId" text not null unique references public.reports(id),
 counts jsonb not null default '{"passive":0,"consultation":0,"priceShipping":0,"ooc":0,"casual":0,"boughtElsewhere":0,"other":0}',
 notes text not null default '' check(length(notes)<=2000),
 "createdAt" timestamptz not null default now(),"updatedAt" timestamptz not null default now()
);
create function public.validate_lead_report() returns trigger language plpgsql security definer set search_path=public as $$
declare r public.reports%rowtype;k text;total numeric:=0;keys text[]:=array['passive','consultation','priceShipping','ooc','casual','boughtElsewhere','other'];
begin
 if public.app_role() is distinct from 'cs' then raise exception 'Report Lead hanya dapat diisi oleh CS pemilik laporan.';end if;
 if TG_OP='UPDATE' and (new.id,new."reportId") is distinct from (old.id,old."reportId") then raise exception 'Identitas Report Lead tidak dapat dipindahkan.';end if;
 select * into r from public.reports where id=new."reportId" for update;
 if not found or r.cs is distinct from public.app_name() then raise exception 'Laporan harian tidak sesuai akses CS.';end if;
 if jsonb_typeof(new.counts)<>'object' then raise exception 'Format kategori tidak valid.';end if;
 if (select count(*) from jsonb_object_keys(new.counts))<>7 then raise exception 'Isi tujuh kategori Report Lead yang tersedia.';end if;
 foreach k in array keys loop
  if coalesce(jsonb_typeof(new.counts->k),'')<>'number' or coalesce(new.counts->>k,'')!~'^[0-9]+$' then raise exception 'Jumlah kategori harus bilangan bulat nol atau lebih.';end if;
  total:=total+(new.counts->>k)::numeric;
 end loop;
 if total>r.leads then raise exception 'Total kategori melebihi jumlah leads; satu lead hanya masuk satu kategori.';end if;
 if TG_OP='INSERT' then new."createdAt":=now();else new."createdAt":=old."createdAt";end if;
 new."updatedAt":=now();return new;
end $$;
create trigger lead_reports_validate before insert or update on public."leadReports" for each row execute function public.validate_lead_report();
create function public.guard_report_leads() returns trigger language plpgsql security definer set search_path=public as $$
declare total numeric;
begin
 select sum(value::numeric) into total from public."leadReports" l cross join lateral jsonb_each_text(l.counts) where l."reportId"=old.id;
 if total>new.leads then raise exception 'Jumlah leads tidak boleh lebih kecil dari total kategori Report Lead. Perbarui kategori lebih dahulu.';end if;
 return new;
end $$;
create trigger reports_lead_count before update on public.reports for each row execute function public.guard_report_leads();
alter table public."leadReports" enable row level security;
create policy lead_reports_read on public."leadReports" for select to authenticated using(exists(select 1 from public.reports r where r.id="reportId"));
create policy lead_reports_insert on public."leadReports" for insert to authenticated with check(public.app_role()='cs' and exists(select 1 from public.reports r where r.id="reportId" and r.cs=public.app_name()));
create policy lead_reports_update on public."leadReports" for update to authenticated using(public.app_role()='cs' and exists(select 1 from public.reports r where r.id="reportId" and r.cs=public.app_name())) with check(public.app_role()='cs' and exists(select 1 from public.reports r where r.id="reportId" and r.cs=public.app_name()));
grant select,insert,update on public."leadReports" to authenticated;
revoke all on public."leadReports" from anon;
create trigger lead_reports_audit after insert or update on public."leadReports" for each row execute function public.audit_changes();
commit;

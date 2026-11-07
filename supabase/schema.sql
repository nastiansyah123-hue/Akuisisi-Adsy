-- Jalankan sekali pada proyek Supabase baru melalui SQL Editor.
begin;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null unique check(length(trim(name))>0),
 role text not null check(role in ('admin','cs','advertiser'))
);
create or replace function public.app_role() returns text language sql stable security definer set search_path=public as $$ select role from profiles where id=auth.uid() $$;
create or replace function public.app_name() returns text language sql stable security definer set search_path=public as $$ select name from profiles where id=auth.uid() $$;
revoke all on function public.app_role() from public;
revoke all on function public.app_name() from public;
grant execute on function public.app_role(),public.app_name() to authenticated;
create table public.assignments(
 id text primary key,cs text not null,product text not null,advertiser text not null,
 channel text not null check(channel in ('Web','CTWA')),active boolean not null default true,
 unique(cs,product,advertiser,channel)
);
create table public.reports(
 id text primary key,date date not null,cs text not null,product text not null,advertiser text not null,
 channel text not null check(channel in ('Web','CTWA')),
 leads integer not null check(leads>=0),closing integer not null check(closing>=0),units integer not null check(units>=closing),
 invalid integer not null default 0 check(invalid>=0 and invalid<=closing),
 "invalidUnits" integer not null default 0 check("invalidUnits">=0 and "invalidUnits"<=units),
 revenue numeric(16,2) not null check(revenue>=0),notes text not null default '',
 unique(date,cs,product,advertiser,channel),
 foreign key(cs,product,advertiser,channel) references public.assignments(cs,product,advertiser,channel)
);
create table public.ads(
 id text primary key,date date not null,product text not null,advertiser text not null,
 channel text not null check(channel in ('Web','CTWA')),
 budget numeric(16,2) not null check(budget>=0),tax numeric(5,2) not null default 11 check(tax between 0 and 100),
 unique(date,product,advertiser,channel)
);
create table public.audit_log(id bigint generated always as identity primary key,table_name text not null,record_id text not null,actor uuid,changed_at timestamptz not null default now(),old_data jsonb,new_data jsonb);
create function public.audit_changes() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into audit_log(table_name,record_id,actor,old_data,new_data) values(TG_TABLE_NAME,coalesce(new.id,old.id),auth.uid(),case when TG_OP='INSERT' then null else to_jsonb(old) end,case when TG_OP='DELETE' then null else to_jsonb(new) end);
 return coalesce(new,old);
end $$;
create trigger reports_audit after insert or update or delete on public.reports for each row execute function public.audit_changes();
create trigger ads_audit after insert or update or delete on public.ads for each row execute function public.audit_changes();
create trigger assignments_audit after insert or update or delete on public.assignments for each row execute function public.audit_changes();
create function public.lock_report_identity() returns trigger language plpgsql set search_path=public as $$
begin
 if TG_TABLE_NAME='reports' then
  if (new.id,new.date,new.cs,new.product,new.advertiser,new.channel) is distinct from (old.id,old.date,old.cs,old.product,old.advertiser,old.channel) then raise exception 'Identitas laporan tidak dapat dipindahkan. Buat laporan baru untuk penugasan berbeda.'; end if;
 else
  if (new.id,new.date,new.product,new.advertiser,new.channel) is distinct from (old.id,old.date,old.product,old.advertiser,old.channel) then raise exception 'Identitas biaya iklan tidak dapat dipindahkan.'; end if;
 end if;
 return new;
end $$;
create trigger reports_identity before update on public.reports for each row execute function public.lock_report_identity();
create trigger ads_identity before update on public.ads for each row execute function public.lock_report_identity();
alter table public.profiles enable row level security;
alter table public.assignments enable row level security;
alter table public.reports enable row level security;
alter table public.ads enable row level security;
alter table public.audit_log enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid() or public.app_role()='admin');
-- Profil dibuat/diubah melalui SQL Editor oleh pemilik proyek, bukan oleh pengguna aplikasi.
create policy assignments_read on public.assignments for select to authenticated using(public.app_role()='admin' or (public.app_role()='cs' and cs=public.app_name()) or (public.app_role()='advertiser' and advertiser=public.app_name()));
create policy assignments_admin on public.assignments for all to authenticated using(public.app_role()='admin') with check(public.app_role()='admin');
create policy reports_read on public.reports for select to authenticated using(public.app_role()='admin' or (public.app_role()='cs' and cs=public.app_name()) or (public.app_role()='advertiser' and advertiser=public.app_name()));
create policy reports_insert on public.reports for insert to authenticated with check((public.app_role()='admin' or (public.app_role()='cs' and cs=public.app_name())) and exists(select 1 from public.assignments a where a.cs=reports.cs and a.product=reports.product and a.advertiser=reports.advertiser and a.channel=reports.channel and a.active));
create policy reports_update on public.reports for update to authenticated using(public.app_role()='admin' or (public.app_role()='cs' and cs=public.app_name())) with check(public.app_role()='admin' or (public.app_role()='cs' and cs=public.app_name()));
create policy ads_read on public.ads for select to authenticated using(public.app_role()='admin' or (public.app_role()='advertiser' and advertiser=public.app_name()));
create policy ads_insert on public.ads for insert to authenticated with check((public.app_role()='admin' or (public.app_role()='advertiser' and advertiser=public.app_name())) and exists(select 1 from public.assignments a where a.product=ads.product and a.advertiser=ads.advertiser and a.channel=ads.channel and a.active));
create policy ads_update on public.ads for update to authenticated using(public.app_role()='admin' or (public.app_role()='advertiser' and advertiser=public.app_name())) with check(public.app_role()='admin' or (public.app_role()='advertiser' and advertiser=public.app_name()));
create policy audit_read on public.audit_log for select to authenticated using(public.app_role()='admin');
grant select on public.profiles,public.audit_log to authenticated;
grant select,insert,update on public.assignments,public.reports,public.ads to authenticated;
revoke all on public.profiles,public.assignments,public.reports,public.ads,public.audit_log from anon;
commit;
-- Setelah membuat user di Authentication > Users, tambahkan profil:
-- insert into public.profiles(id,name,role) values ('UUID-DARI-AUTH','Admin','admin');
-- Nama CS/advertiser pada profil HARUS sama dengan nama pada penugasan.

-- Master produk dan perhitungan omzet otomatis.
-- Jalankan setelah schema.sql untuk instalasi lama maupun baru.
begin;
create table public.catalog(
 id text primary key,name text not null unique check(length(trim(name))>0),
 unit text not null check(unit in ('box','botol')),
 price numeric(16,2) not null check(price>=0),
 "resellerPrice" numeric(16,2) not null check("resellerPrice">=0)
);
-- Nama lama dipertahankan. Admin wajib menentukan harga sebelum laporan baru.
insert into public.catalog(id,name,unit,price,"resellerPrice")
 select 'legacy-'||md5(product),product,'box',0,0 from (select distinct product from public.assignments) p;
alter table public.assignments add constraint assignments_catalog_fk foreign key(product) references public.catalog(name);
alter table public.reports add column "resellerUnits" integer not null default 0,
 add column "resellerInvalidUnits" integer not null default 0,
 add column "unitPrice" numeric not null default 0,
 add column "resellerUnitPrice" numeric not null default 0;
-- Preserve legacy revenue rather than reprice it using today's master prices.
update public.reports set "unitPrice"=case when units-"invalidUnits">0 then revenue/(units-"invalidUnits") else 0 end;
alter table public.reports add constraint reports_reseller_units_check check(
 "resellerUnits">=0 and "resellerUnits"<=units and
 "resellerInvalidUnits">=0 and "resellerInvalidUnits"<="resellerUnits" and
 "resellerInvalidUnits"<="invalidUnits" and
 "resellerUnits"-"resellerInvalidUnits"<=units-"invalidUnits"
), add constraint reports_snapshot_price_check check("unitPrice">=0 and "resellerUnitPrice">=0);
create function public.calculate_report_revenue() returns trigger language plpgsql security definer set search_path=public as $$
declare p public.catalog%rowtype;
begin
 if TG_OP='INSERT' then
  select * into p from public.catalog where name=new.product;
  if not found or p.price<=0 or p."resellerPrice"<=0 then raise exception 'Admin perlu mengatur harga produk terlebih dahulu.'; end if;
  new."unitPrice":=p.price;
  new."resellerUnitPrice":=p."resellerPrice";
 else
  -- Client cannot rewrite a saved price, including via a crafted API call.
  new."unitPrice":=old."unitPrice";
  new."resellerUnitPrice":=old."resellerUnitPrice";
 end if;
 new.revenue:=round(((new.units-new."invalidUnits")-(new."resellerUnits"-new."resellerInvalidUnits"))*new."unitPrice"+(new."resellerUnits"-new."resellerInvalidUnits")*new."resellerUnitPrice",2);
 return new;
end $$;
create trigger reports_pricing before insert or update on public.reports for each row execute function public.calculate_report_revenue();
create function public.lock_catalog_identity() returns trigger language plpgsql set search_path=public as $$
begin
 if (new.id,new.name,new.unit) is distinct from (old.id,old.name,old.unit) then raise exception 'Nama dan satuan produk yang tersimpan tidak dapat diubah. Tambahkan produk baru.'; end if;
 return new;
end $$;
create trigger catalog_identity before update on public.catalog for each row execute function public.lock_catalog_identity();
create trigger catalog_audit after insert or update on public.catalog for each row execute function public.audit_changes();
alter table public.catalog enable row level security;
create policy catalog_read on public.catalog for select to authenticated using(public.app_role() in ('admin','cs','advertiser'));
create policy catalog_admin on public.catalog for all to authenticated using(public.app_role()='admin') with check(public.app_role()='admin');
grant select,insert,update on public.catalog to authenticated;
revoke all on public.catalog from anon;
commit;

-- Paket order dan koreksi admin (003).
-- Existing installations: apply after 002, once. Fresh installs use schema.sql only.
begin;
alter table public.catalog add column packages jsonb not null default '[]';
-- Prior per-unit rates become explicit single-unit packages for future reports.
update public.catalog set packages=jsonb_build_array(
 jsonb_build_object('id',id||'-regular-1','name','Reguler 1 '||unit,'units',1,'price',price,'kind','regular','active',true),
 jsonb_build_object('id',id||'-reseller-1','name','Reseller 1 '||unit,'units',1,'price',"resellerPrice",'kind','reseller','active',true)
) where price>0 and "resellerPrice">0;
alter table public.reports add column "packageLines" jsonb not null default '[]',
 add column "originalPackageLines" jsonb not null default '[]',
 add column "originalLeads" integer;
create table public."packageCorrections"(
 id uuid primary key default gen_random_uuid(),
 "reportId" text not null references public.reports(id),
 "packageId" text not null,delta integer not null check(delta<>0),
 reason text not null check(length(trim(reason)) between 1 and 1000),
 "actorId" uuid not null references public.profiles(id),"actorName" text not null,
 "createdAt" timestamptz not null default now()
);
create index package_corrections_report on public."packageCorrections"("reportId");
alter table public."packageCorrections" enable row level security;
create policy corrections_read on public."packageCorrections" for select to authenticated using(exists(select 1 from public.reports r where r.id="reportId"));
grant select on public."packageCorrections" to authenticated;
revoke all on public."packageCorrections" from anon;
create function public.validate_product_packages() returns trigger language plpgsql set search_path=public as $$
declare p jsonb;seen text[]:=array[]::text[];
begin
 if jsonb_typeof(new.packages)<>'array' or jsonb_array_length(new.packages)>100 then raise exception 'Format paket harus array maksimal 100 paket.';end if;
 for p in select value from jsonb_array_elements(new.packages) loop
  if coalesce(trim(p->>'id'),'')='' or (p->>'id')=any(seen) or coalesce(trim(p->>'name'),'')='' then raise exception 'ID dan nama paket wajib diisi, ID harus unik.';end if;
  if coalesce(p->>'units','')!~'^[0-9]+$' or (p->>'units')::numeric<1 or coalesce(jsonb_typeof(p->'price'),'')<>'number' or (p->>'price')::numeric<=0 or (p->>'price')::numeric<>round((p->>'price')::numeric,2) then raise exception 'Isi paket harus bulat positif, harga total harus positif maksimal dua desimal.';end if;
  if coalesce(p->>'kind','') not in ('regular','reseller') or coalesce(jsonb_typeof(p->'active'),'')<>'boolean' then raise exception 'Jenis dan status paket belum valid.';end if;
  seen:=array_append(seen,p->>'id');
 end loop;
 return new;
end $$;
create trigger catalog_packages before insert or update on public.catalog for each row execute function public.validate_product_packages();
drop trigger reports_pricing on public.reports;
create function public.calculate_package_report() returns trigger language plpgsql security definer set search_path=public as $$
declare line jsonb;prior jsonb;definition jsonb;result jsonb:='[]';seen text[]:=array[]::text[];qty integer;canceled integer;size integer;cost numeric;kind text;gross integer:=0;units integer:=0;bad integer:=0;badunits integer:=0;rs integer:=0;badrs integer:=0;rev numeric:=0;
begin
 if TG_OP='UPDATE' and jsonb_array_length(old."packageLines")=0 then raise exception 'Laporan format lama bersifat baca saja; rincian paket historis tidak boleh ditebak.';end if;
 if jsonb_typeof(new."packageLines")<>'array' or jsonb_array_length(new."packageLines") not between 1 and 100 then raise exception 'Pilih minimal satu paket penjualan.';end if;
 if TG_OP='UPDATE' then
  for prior in select value from jsonb_array_elements(old."packageLines") loop
   if not exists(select 1 from jsonb_array_elements(new."packageLines") n where n->>'id'=prior->>'id') then raise exception 'Paket historis tidak boleh dihapus dari laporan.';end if;
  end loop;
 end if;
 for line in select value from jsonb_array_elements(new."packageLines") loop
  if coalesce(line->>'id','')='' or (line->>'id')=any(seen) then raise exception 'ID paket duplikat atau kosong.';end if;
  seen:=array_append(seen,line->>'id');
  if coalesce(line->>'orders','')!~'^[0-9]+$' then raise exception 'Jumlah order wajib bilangan bulat nol atau lebih.';end if;
  qty:=(line->>'orders')::integer;
  prior:=null;
  if TG_OP='UPDATE' then select value into prior from jsonb_array_elements(old."packageLines") where value->>'id'=line->>'id';end if;
  if prior is not null then definition:=prior;
  else
   select p into definition from public.catalog c cross join lateral jsonb_array_elements(c.packages) p where c.name=new.product and p->>'id'=line->>'id' and (p->>'active')::boolean;
   if definition is null then raise exception 'Paket tidak aktif atau tidak sesuai produk.';end if;
  end if;
  select coalesce(sum(delta),0)::integer into canceled from public."packageCorrections" where "reportId"=new.id and "packageId"=line->>'id';
  if canceled<0 or canceled>qty then raise exception 'Jumlah order tidak boleh lebih kecil dari pembatalan admin.';end if;
  size:=(definition->>'units')::integer;cost:=(definition->>'price')::numeric;kind:=definition->>'kind';
  result:=result||jsonb_build_array(jsonb_build_object('id',line->>'id','name',definition->>'name','units',size,'price',cost,'kind',kind,'orders',qty,'canceled',canceled));
  gross:=gross+qty;units:=units+qty*size;bad:=bad+canceled;badunits:=badunits+canceled*size;rev:=rev+(qty-canceled)*cost;
  if kind='reseller' then rs:=rs+qty*size;badrs:=badrs+canceled*size;end if;
 end loop;
 new."packageLines":=result;new.closing:=gross;new.units:=units;new.invalid:=bad;new."invalidUnits":=badunits;new.revenue:=round(rev,2);new."resellerUnits":=rs;new."resellerInvalidUnits":=badrs;new."unitPrice":=0;new."resellerUnitPrice":=0;
 if TG_OP='INSERT' then new."originalPackageLines":=result;new."originalLeads":=new.leads;else new."originalPackageLines":=old."originalPackageLines";new."originalLeads":=old."originalLeads";end if;
 return new;
end $$;
create trigger reports_pricing before insert or update on public.reports for each row execute function public.calculate_package_report();
create function public.correct_package(p_report_id text,p_package_id text,p_delta integer,p_reason text,p_expected integer) returns void language plpgsql security definer set search_path=public as $$
declare r public.reports%rowtype;p jsonb;current_count integer;
begin
 if public.app_role() is distinct from 'admin' then raise exception 'Hanya admin yang dapat membatalkan atau memulihkan order.';end if;
 if p_delta is null or p_delta=0 or p_reason is null or length(trim(p_reason)) not between 1 and 1000 or p_expected is null then raise exception 'Jumlah koreksi, alasan, dan versi pembatalan wajib valid.';end if;
 select * into r from public.reports where id=p_report_id for update;
 if not found then raise exception 'Laporan tidak ditemukan.';end if;
 select value into p from jsonb_array_elements(r."packageLines") where value->>'id'=p_package_id;
 if p is null then raise exception 'Paket laporan tidak ditemukan.';end if;
 select coalesce(sum(delta),0)::integer into current_count from public."packageCorrections" where "reportId"=p_report_id and "packageId"=p_package_id;
 if current_count<>p_expected then raise exception 'Data berubah. Buka ulang koreksi untuk memuat data terbaru.';end if;
 if current_count+p_delta<0 or current_count+p_delta>(p->>'orders')::integer then raise exception 'Koreksi melebihi order atau pembatalan yang tersedia.';end if;
 insert into public."packageCorrections"("reportId","packageId",delta,reason,"actorId","actorName") values(p_report_id,p_package_id,p_delta,trim(p_reason),auth.uid(),public.app_name());
 update public.reports set "packageLines"="packageLines" where id=p_report_id;
end $$;
revoke all on function public.correct_package(text,text,integer,text,integer) from public;
grant execute on function public.correct_package(text,text,integer,text,integer) to authenticated;
commit;

-- Report Lead harian (004).
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

-- Form CS bersama: order + BEF (005).
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

-- Daftar CS/Advertiser dan aktivasi admin (006).
-- Existing installations: apply after 005. Fresh installs use schema.sql.
begin;
alter table public.profiles add column status text not null default 'active' check(status in ('pending','active','rejected')),
 add column "requestedName" text not null default '',add column email text not null default '';
-- Existing manually provisioned users retain access; pending registrations have no team identity.
create or replace function public.app_role() returns text language sql stable security definer set search_path=public as $$select role from profiles where id=auth.uid() and status='active'$$;
create or replace function public.app_name() returns text language sql stable security definer set search_path=public as $$select name from profiles where id=auth.uid() and status='active'$$;
create function public.register_team_profile() returns trigger language plpgsql security definer set search_path=public as $$
declare chosen text;display_name text;
begin
 chosen:=new.raw_user_meta_data->>'account_role';
 -- Manual Auth user creation without a public registration role still allows owner provisioning.
 if chosen is null then return new;end if;
 if chosen not in ('cs','advertiser') then raise exception 'Pendaftaran hanya untuk CS atau Advertiser.';end if;
 display_name:=trim(coalesce(new.raw_user_meta_data->>'display_name',''));
 if length(display_name) not between 2 and 80 then raise exception 'Nama lengkap harus berisi 2–80 karakter.';end if;
 insert into public.profiles(id,name,role,status,"requestedName",email) values(new.id,'pending:'||new.id::text,chosen,'pending',display_name,coalesce(new.email,''));
 return new;
end $$;
create trigger auth_team_registration after insert on auth.users for each row execute function public.register_team_profile();
create function public.review_team_signup(p_user_id uuid,p_name text,p_action text) returns void language plpgsql security definer set search_path=public as $$
declare p public.profiles%rowtype;
begin
 if public.app_role() is distinct from 'admin' then raise exception 'Hanya admin aktif yang dapat meninjau pendaftaran.';end if;
 select * into p from public.profiles where id=p_user_id for update;
 if not found or p.status<>'pending' or p.role not in ('cs','advertiser') then raise exception 'Pendaftaran tidak ditemukan atau sudah diproses.';end if;
 if p_action='activate' then
  if length(trim(coalesce(p_name,''))) not between 1 and 80 or p_name like 'pending:%' then raise exception 'Isi nama operasional yang valid.';end if;
  if exists(select 1 from public.profiles where name=trim(p_name) and id<>p_user_id) then raise exception 'Nama ini sudah memiliki akun. Periksa identitas anggota tim.';end if;
  update public.profiles set name=trim(p_name),status='active' where id=p_user_id;
 elsif p_action='reject' then update public.profiles set status='rejected' where id=p_user_id;
 else raise exception 'Tindakan pendaftaran tidak valid.';end if;
end $$;
revoke all on function public.review_team_signup(uuid,text,text) from public;
grant execute on function public.review_team_signup(uuid,text,text) to authenticated;
commit;

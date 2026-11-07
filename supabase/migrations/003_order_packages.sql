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

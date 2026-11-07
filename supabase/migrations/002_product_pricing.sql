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

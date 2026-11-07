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

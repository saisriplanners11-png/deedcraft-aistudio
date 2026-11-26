-- DeedCraft admin console v1. Run after account-drafts-v1.sql.
begin;
create table if not exists public.account_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);
alter table public.account_admins enable row level security;
revoke all on public.account_admins from public, anon, authenticated;

alter table public.account_drafts add column if not exists admin_updated_at timestamptz;
create or replace function public.stamp_account_draft() returns trigger
language plpgsql set search_path = '' as $$
begin new.admin_updated_at = now(); return new; end;
$$;
drop trigger if exists stamp_account_draft on public.account_drafts;
create trigger stamp_account_draft before insert or update on public.account_drafts
for each row execute function public.stamp_account_draft();
create index if not exists account_drafts_admin_updated on public.account_drafts(admin_updated_at desc);

create or replace function public.is_account_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.account_admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_account_admin() from public, anon;
grant execute on function public.is_account_admin() to authenticated;

create or replace function public.account_admin_data(
  section text, page_offset integer default 0, search_text text default '',
  selected_owner uuid default null, selected_kind text default null, selected_id text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_account_admin() then raise insufficient_privilege using message = 'Administrator access required.'; end if;
  if page_offset < 0 then raise exception 'Invalid page.'; end if;
  if section = 'overview' then
    select jsonb_build_object(
      'users', (select count(*) from auth.users),
      'verified', (select count(*) from auth.users where email_confirmed_at is not null),
      'contributors', (select count(distinct owner) from public.account_drafts),
      'records', (select count(*) from public.account_drafts),
      'kinds', coalesce((select jsonb_agg(x) from (select kind, count(*) as count from public.account_drafts group by kind order by kind) x), '[]'::jsonb),
      'activity', (select jsonb_agg(x order by x.day) from (
        select day::date as day,
          (select count(*) from auth.users u where (u.created_at at time zone 'Asia/Kolkata')::date = day::date) as registrations,
          (select count(*) from public.account_drafts d where (d.admin_updated_at at time zone 'Asia/Kolkata')::date = day::date) as records
        from generate_series((now() at time zone 'Asia/Kolkata')::date - 29, (now() at time zone 'Asia/Kolkata')::date, interval '1 day') day
      ) x)
    ) into result;
  elsif section = 'users' then
    select jsonb_build_object('total', count(*), 'items', coalesce((
      select jsonb_agg(x) from (
        select u.id, u.email, u.created_at, u.last_sign_in_at, u.email_confirmed_at,
          coalesce(u.raw_user_meta_data->'deedcraft_profile'->>'fullName',u.raw_user_meta_data->>'full_name','') as name,
          coalesce(u.raw_user_meta_data->'deedcraft_profile','{}'::jsonb) as profile,
          (select count(*) from public.account_drafts d where d.owner=u.id) as records
        from auth.users u where concat_ws(' ',u.email,u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->'deedcraft_profile'->>'fullName') ilike '%' || left(search_text,200) || '%'
        order by u.created_at desc, u.id limit 25 offset page_offset
      ) x), '[]'::jsonb)) into result
    from auth.users u where concat_ws(' ',u.email,u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->'deedcraft_profile'->>'fullName') ilike '%' || left(search_text,200) || '%';
  elsif section = 'work' then
    select jsonb_build_object('total', count(*), 'items', coalesce((
      select jsonb_agg(x) from (
        select d.owner,d.kind,d.id,d.revision,d.admin_updated_at as updated_at,u.email,
          coalesce(nullif(d.body->>'name',''),nullif(d.body->>'title',''),d.body->>'deedType',d.body->>'formType',d.kind) as title
        from public.account_drafts d join auth.users u on u.id=d.owner
        where (selected_owner is null or d.owner=selected_owner) and (selected_kind is null or d.kind=selected_kind)
        order by d.admin_updated_at desc nulls last,d.owner,d.kind,d.id limit 25 offset page_offset
      ) x), '[]'::jsonb)) into result from public.account_drafts d
      where (selected_owner is null or d.owner=selected_owner) and (selected_kind is null or d.kind=selected_kind);
  elsif section = 'detail' then
    select jsonb_build_object('body', d.body,'revision',d.revision,'updated_at',d.admin_updated_at)
      into result from public.account_drafts d where d.owner=selected_owner and d.kind=selected_kind and d.id=selected_id;
    if result is null then raise exception 'Record no longer exists.'; end if;
  else raise exception 'Unknown admin section.';
  end if;
  return result;
end;
$$;
revoke all on function public.account_admin_data(text,integer,text,uuid,text,text) from public, anon;
grant execute on function public.account_admin_data(text,integer,text,uuid,text,text) to authenticated;
-- Ownership RLS remains unchanged. Admin access is read-only through the checked RPC.
commit;

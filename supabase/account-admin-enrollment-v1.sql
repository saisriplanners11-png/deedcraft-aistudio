-- One-time enrollment: only a confirmed account for the authorised address receives access.
begin;
create table if not exists public.account_admin_enrollment (
  email text primary key check (email = lower(email)),
  requested_at timestamptz not null default now()
);
alter table public.account_admin_enrollment enable row level security;
revoke all on public.account_admin_enrollment from public, anon, authenticated;
create or replace function public.enroll_account_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is not null and exists (
    select 1 from public.account_admin_enrollment where email = lower(new.email)
  ) then
    insert into public.account_admins(user_id) values(new.id) on conflict do nothing;
    delete from public.account_admin_enrollment where email = lower(new.email);
  end if;
  return new;
end;
$$;
revoke all on function public.enroll_account_admin() from public, anon, authenticated;
drop trigger if exists enroll_deedcraft_admin on auth.users;
create trigger enroll_deedcraft_admin after insert or update of email, email_confirmed_at on auth.users
for each row execute function public.enroll_account_admin();
insert into public.account_admin_enrollment(email) values ('sampath.gundlapelli@gmail.com') on conflict do nothing;
insert into public.account_admins(user_id)
select id from auth.users where lower(email)='sampath.gundlapelli@gmail.com' and email_confirmed_at is not null
on conflict do nothing;
delete from public.account_admin_enrollment e where exists (
  select 1 from auth.users u join public.account_admins a on a.user_id=u.id where lower(u.email)=e.email
);
commit;

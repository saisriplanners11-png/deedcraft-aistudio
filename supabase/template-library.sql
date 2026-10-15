-- Run once in the intended Supabase project's SQL Editor.
-- Files remain private; only the Render server uses the secret/service-role key.
begin;
create table if not exists public.deed_template_library (
  id text primary key check (id = 'shared'),
  revision bigint not null check (revision > 0),
  data jsonb not null check (jsonb_typeof(data) = 'object')
);
alter table public.deed_template_library enable row level security;
revoke all on public.deed_template_library from public, anon, authenticated;
grant select, insert, update on public.deed_template_library to service_role;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('deed-templates', 'deed-templates', false, 20971520,
  array['application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;
commit;
-- No browser/storage policies are needed. Do not make this bucket public.

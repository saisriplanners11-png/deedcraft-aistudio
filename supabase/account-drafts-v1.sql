create table if not exists public.account_drafts (
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('deed','application','application-work','guided-plan','guided-work','legacy-plan','sketch-plan')),
  id text not null,
  body jsonb not null,
  revision integer not null default 1,
  primary key (owner, kind, id)
);
alter table public.account_drafts enable row level security;
revoke all on public.account_drafts from anon, authenticated;
grant select, insert, update, delete on public.account_drafts to authenticated;
drop policy if exists own_drafts on public.account_drafts;
create policy own_drafts on public.account_drafts for all to authenticated
  using ((select auth.uid()) = owner) with check ((select auth.uid()) = owner);

create or replace function public.save_account_draft(draft_kind text, draft_id text, draft_body jsonb, expected_revision integer)
returns integer language plpgsql security invoker set search_path = '' as $$
declare next_revision integer;
begin
  if expected_revision = 0 then
    insert into public.account_drafts (kind, id, body) values (draft_kind, draft_id, draft_body)
    on conflict do nothing returning revision into next_revision;
  else
    update public.account_drafts set body = draft_body, revision = revision + 1
    where owner = auth.uid() and kind = draft_kind and id = draft_id and revision = expected_revision
    returning revision into next_revision;
  end if;
  if next_revision is null then
    raise exception 'This draft changed elsewhere. Reload before replacing it.';
  end if;
  return next_revision;
end;
$$;
revoke all on function public.save_account_draft(text,text,jsonb,integer) from public;
grant execute on function public.save_account_draft(text,text,jsonb,integer) to authenticated;


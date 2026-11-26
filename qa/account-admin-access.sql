-- Run in Supabase SQL editor after both admin migrations. Fixtures never commit.
begin;
insert into public.account_admin_enrollment(email) values('deedcraft-admin-qa@example.invalid');
insert into auth.users(id,email,created_at,raw_user_meta_data) values
('10000000-0000-4000-8000-000000000081','deedcraft-admin-qa@example.invalid',now(),'{"deedcraft_admin":true}'),
('10000000-0000-4000-8000-000000000082','deedcraft-user-qa@example.invalid',now(),'{"deedcraft_admin":true}');
do $$ begin
 if exists(select 1 from public.account_admins where user_id='10000000-0000-4000-8000-000000000081') then raise exception 'Unverified enrollment granted access'; end if;
end $$;
update auth.users set email_confirmed_at=now() where id='10000000-0000-4000-8000-000000000081';
insert into public.account_drafts(owner,kind,id,body) values('10000000-0000-4000-8000-000000000082','deed','admin-qa','{"name":"Admin QA fixture","private":"owner data"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000082',true);
do $$ declare s text; begin
 if public.is_account_admin() then raise exception 'User metadata escalated role'; end if;
 foreach s in array array['overview','users','work','detail'] loop
 begin perform public.account_admin_data(s); raise exception 'Non-admin could read %',s;
 exception when insufficient_privilege then null; end;
 end loop;
 begin insert into public.account_admins(user_id) values('10000000-0000-4000-8000-000000000082'); raise exception 'Self-grant succeeded'; exception when insufficient_privilege then null; end;
 begin insert into public.account_admin_enrollment(email) values('deedcraft-user-qa@example.invalid'); raise exception 'Self-enrollment succeeded'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000081',true);
do $$ declare x jsonb; n integer; begin
 if not public.is_account_admin() then raise exception 'Verified enrollment missing'; end if;
 x:=public.account_admin_data('overview'); if jsonb_array_length(x->'activity')<>30 then raise exception 'Activity days incorrect'; end if;
 x:=public.account_admin_data('users',0,'deedcraft-user-qa'); if (x->>'total')::int<>1 then raise exception 'User search failed'; end if;
 x:=public.account_admin_data('users',25,'deedcraft-user-qa'); if jsonb_array_length(x->'items')<>0 then raise exception 'Pagination failed'; end if;
 x:=public.account_admin_data('work',0,'','10000000-0000-4000-8000-000000000082','deed'); if (x->>'total')::int<>1 then raise exception 'Owner filter failed'; end if;
 x:=public.account_admin_data('detail',0,'','10000000-0000-4000-8000-000000000082','deed','admin-qa'); if x->'body'->>'private'<>'owner data' then raise exception 'Detail read failed'; end if;
 if x->>'updated_at' is null then raise exception 'Update timestamp missing'; end if;
 select count(*) into n from public.account_drafts where owner='10000000-0000-4000-8000-000000000082'; if n<>0 then raise exception 'Owner RLS changed'; end if;
 update public.account_drafts set body='{}' where owner='10000000-0000-4000-8000-000000000082'; get diagnostics n=row_count; if n<>0 then raise exception 'Admin modified another owner'; end if;
 delete from public.account_drafts where owner='10000000-0000-4000-8000-000000000082'; get diagnostics n=row_count; if n<>0 then raise exception 'Admin deleted another owner'; end if;
end $$;
set local role anon;
do $$ begin
 begin perform public.account_admin_data('overview'); raise exception 'Anonymous read succeeded'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: verified-only enrollment; metadata escalation blocked; non-admin/anonymous denial; admin reads/search/pagination; owner RLS unchanged. All fixtures rolled back.' as result;

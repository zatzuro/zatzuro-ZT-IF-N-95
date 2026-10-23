-- Run with: supabase test db. Requires pgTAP in the Supabase test database.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

select has_table('public','movements','movement ledger exists');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.movements'::regclass),'RLS and FORCE RLS are enabled');
select ok((select count(*)=8 from pg_policies where schemaname='public' and tablename in ('accounts','categories','movements','budgets','debts','investments','goals','financial_findings') and policyname='owner_all'),'financial tables have owner policies');
select ok((select count(*)=0 from pg_policies where schemaname='public' and tablename='audit_log' and cmd in ('INSERT','UPDATE','DELETE','ALL')),'audit log has no client write policy');
select ok((select count(*)=0 from information_schema.role_table_grants where grantee='anon' and table_schema='public' and table_name in ('accounts','categories','movements','budgets','debts','investments','goals','financial_findings','audit_log')),'anonymous role has no financial table grants');
select ok((select count(*)=0 from information_schema.role_table_grants where grantee in ('anon','authenticated') and table_schema='public' and table_name='authorized_owners'),'clients cannot edit or read the owner allowlist');
select ok((select reloptions @> array['security_invoker=true'] from pg_class where oid='public.movement_monthly_summary'::regclass),'summary view evaluates base-table RLS as the caller');

-- Seed one approved owner and one signed-in but unapproved user. All data is rolled back.
insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data)
values
 ('00000000-0000-0000-0000-000000000001','authenticated','authenticated','owner-test@example.invalid','','{}','{}'),
 ('00000000-0000-0000-0000-000000000002','authenticated','authenticated','other-test@example.invalid','','{}','{}');
insert into public.authorized_owners(user_id) values('00000000-0000-0000-0000-000000000001');
insert into public.accounts(id,owner_id,name,account_type,currency)
values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Owner account','checking','COP'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','Other account','checking','COP');
insert into public.categories(id,owner_id,name,flow_type)
values('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Food','expense');
insert into public.movements(id,owner_id,account_id,category_id,movement_type,occurred_at,description,amount,currency)
values('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','expense','2026-04-01','Test expense',800,'COP');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select ok(public.is_authorized_owner(),'approved owner is recognized from the current JWT');
select is((select count(*)::int from public.movements),1,'approved owner reads their own movement');
select is((select consumption_expenses from public.movement_monthly_summary where month='2026-04-01'),800::numeric,'summary reports only the owner consumption expense');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select ok(not public.is_authorized_owner(),'signed-in but unapproved user is denied');
select is((select count(*)::int from public.movements),0,'unapproved user cannot read owner data');
select throws_ok(
 $$insert into public.accounts(owner_id,name,account_type,currency) values('00000000-0000-0000-0000-000000000002','Unapproved write','savings','COP')$$,
 '42501',null,'unapproved user cannot write financial data');

reset role;
set local role anon;
select throws_ok('select * from public.movements','42501',null,'anonymous visitors cannot read movements');
reset role;

with sample(kind,amount) as (values ('expense',800::numeric),('transfer',700::numeric),('card_payment',600::numeric),('investment_contribution',500::numeric))
select is((select sum(amount) from sample where public.is_consumption_expense(kind)),800::numeric,'consumption classifier excludes transfers, card settlements and investment deposits');

select * from finish();
rollback;

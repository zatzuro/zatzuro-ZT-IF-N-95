begin;
create extension if not exists pgtap with schema extensions;
select plan(5);
insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data)
values('00000000-0000-0000-0000-000000000081','authenticated','authenticated','factor-fixture@example.invalid','','{}','{}'),
('00000000-0000-0000-0000-000000000082','authenticated','authenticated','factor-outsider@example.invalid','','{}','{}');
insert into public.authorized_owners(user_id) values('00000000-0000-0000-0000-000000000081');
select has_table('public','payroll_commission_factors','private factor table exists');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.payroll_commission_factors'::regclass),'RLS is enabled and forced');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000081',true);
set local role authenticated;
insert into public.payroll_commission_factors(owner_id,compliance,payment_factor,source_name,source_modified_at) 
values('00000000-0000-0000-0000-000000000081',0.8,0.8,'source fixture','2026-10-24T12:15:10Z');
select is((select count(*)::integer from public.payroll_commission_factors),1,'owner can read factor');
select throws_ok($sql$insert into public.payroll_commission_factors(owner_id,compliance,payment_factor,source_name,source_modified_at)
values('00000000-0000-0000-0000-000000000082',0.7,0.7,'source fixture','2026-10-24T12:15:10Z')$sql$,'42501',null,'owner isolation');
select is((select count(*)::integer from public.movements),0,'factor import never posts bank movements');
reset role;
select * from finish();
rollback;
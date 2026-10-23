begin;
create extension if not exists pgtap with schema extensions;
select plan(5);
insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data)
values('00000000-0000-0000-0000-000000000031','authenticated','authenticated','import-fixture@example.invalid','','{}','{}');
insert into public.authorized_owners(user_id) values('00000000-0000-0000-0000-000000000031');
insert into public.accounts(id,owner_id,name,account_type,currency)
values('10000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000031','Checking','checking','COP');
insert into public.categories(id,owner_id,name,flow_type)
values('20000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000031','Food','expense');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000031',true);
set local role authenticated;
select is(public.import_reconciled_movements(
 '[{"external_source":"GASTOS","external_key":"tx1","occurred_at":"2026-10-20","description":"Food","amount":100,"movement_type":"expense","account_id":"10000000-0000-0000-0000-000000000031","category_id":"20000000-0000-0000-0000-000000000031"}]'::jsonb),
 1, 'one audited row inserted');
select is(public.import_reconciled_movements(
 '[{"external_source":"GASTOS","external_key":"tx1","occurred_at":"2026-10-20","description":"Food","amount":100,"movement_type":"expense","account_id":"10000000-0000-0000-0000-000000000031","category_id":"20000000-0000-0000-0000-000000000031"}]'::jsonb),
 0, 'idempotent replay ignored');
select throws_ok(
 $sql$select public.import_reconciled_movements(
 '[{"external_source":"GASTOS","external_key":"tx2","occurred_at":"2026-10-20","description":"Food","amount":200,"movement_type":"expense","account_id":"10000000-0000-0000-0000-000000000031","category_id":"20000000-0000-0000-0000-000000000031"},{"external_source":"GASTOS","external_key":"bad","occurred_at":"2026-10-20","description":"Invalid","amount":50,"movement_type":"income","account_id":"10000000-0000-0000-0000-000000000031","category_id":"20000000-0000-0000-0000-000000000031"}]'::jsonb)$sql$,
 '22023',null,'invalid batch rejected');
select is((select count(*)::integer from public.movements where external_source='GASTOS'),1,'rejected batch leaves no new rows');
select ok((select count(*)=1 from public.audit_log where operation='INSERT' and table_name='movements'), 'only committed row audited');
reset role;
select * from finish();
rollback;

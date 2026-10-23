begin;
create extension if not exists pgtap with schema extensions;
select plan(5);
select has_column('public','accounts','balance_as_of','opening balance has cut-off date');
select has_function('public','validate_movement_category',array[]::text[],'movement classification trigger present');
select ok((select count(*)=1 from pg_constraint where conname='budgets_cop_only'), 'budgets cannot mix unconverted currencies');
insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000021','authenticated','authenticated','category-fixture@example.invalid','','{}','{}');
insert into public.authorized_owners(user_id) values('00000000-0000-0000-0000-000000000021');
insert into public.accounts(id,owner_id,name,account_type,currency)
values('10000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000021','Fixture','checking','COP');
insert into public.categories(id,owner_id,name,flow_type)
values ('20000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000021','Food','expense');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000021',true);
set local role authenticated;
select throws_ok(
 $$insert into public.movements(owner_id,account_id,movement_type,occurred_at,description,amount,currency) values ('00000000-0000-0000-0000-000000000021','10000000-0000-0000-0000-000000000021','expense','2026-10-23','Uncategorized',200,'COP')$$,
 '23514',null,'uncategorized consumption rejected');
select throws_ok(
 $$insert into public.movements(owner_id,account_id,category_id,movement_type,occurred_at,description,amount,currency) values ('00000000-0000-0000-0000-000000000021','10000000-0000-0000-0000-000000000021','20000000-0000-0000-0000-000000000021','income','2026-10-23','Wrong category',300,'COP')$$,
 '23514',null,'income cannot reference expense category');
reset role;
select * from finish();
rollback;

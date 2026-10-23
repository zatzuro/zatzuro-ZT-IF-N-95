begin;
create extension if not exists pgtap with schema extensions;
select plan(6);
insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data)
values('00000000-0000-0000-0000-000000000011','authenticated','authenticated','transfer-test@example.invalid','','{}','{}');
insert into public.authorized_owners(user_id) values('00000000-0000-0000-0000-000000000011');
insert into public.accounts(id,owner_id,name,account_type,currency)
values
('10000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000011','Origin','savings','COP'),
('10000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000011','Destination','savings','COP'),
('10000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000011','Card','credit_card','COP');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000011',true);
set local role authenticated;
select ok(public.create_cash_transfer(
'10000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000012',
123,'2026-10-23','Savings movement') is not null,'RPC creates group');
select is((select count(*)::int from public.movements where movement_type='transfer'),2,'two balanced entries');
select is((select sum(amount) filter(where transfer_direction='out') from public.movements),
(select sum(amount) filter(where transfer_direction='in') from public.movements),'out equals in');
select throws_ok(
$$select public.create_cash_transfer('10000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000011',100,'2026-10-23','bad')$$,
'22023',null,'same-account transfer refused');
select throws_ok(
$$select public.create_cash_transfer('10000000-0000-0000-0000-000000000013','10000000-0000-0000-0000-000000000012',100,'2026-10-23','bad card')$$,
'42501',null,'credit card cannot be used as a cash transfer account');
select throws_ok(
$$delete from public.movements where movement_type='transfer'$$,
'23514',null,'direct deletion of a leg is refused');
set constraints all immediate;
reset role;
select * from finish();
rollback;

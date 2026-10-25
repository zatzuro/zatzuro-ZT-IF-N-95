begin;
create extension if not exists pgtap with schema extensions;
select plan(6);
insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data)
values('00000000-0000-0000-0000-000000000091','authenticated','authenticated','settlement-fixture@example.invalid','','{}','{}');
insert into public.authorized_owners(user_id) values('00000000-0000-0000-0000-000000000091');
insert into public.accounts(id,owner_id,name,account_type,currency)
values('10000000-0000-0000-0000-000000000091','00000000-0000-0000-0000-000000000091','Bank fixture','savings','COP');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000091',true);
set local role authenticated;
insert into public.movements(id,owner_id,account_id,movement_type,occurred_at,description,amount,currency,external_source,external_key)
values('20000000-0000-0000-0000-000000000091','00000000-0000-0000-0000-000000000091',
'10000000-0000-0000-0000-000000000091','card_payment','2026-10-24','Card settlement',100,'COP','test','card1');
select throws_ok($sql$insert into public.financial_calendar_events(owner_id,description,event_kind,due_date,amount_cop,direction,status,linked_movement_id)
values('00000000-0000-0000-0000-000000000091','Wrong amount','card_payment','2026-10-24',120,'out','paid','20000000-0000-0000-0000-000000000091')$sql$,
'23514',null,'reject incorrect amount');
insert into public.financial_calendar_events(owner_id,description,event_kind,due_date,amount_cop,direction,status,linked_movement_id)
values('00000000-0000-0000-0000-000000000091','Matching payment','card_payment','2026-10-24',100,'out','paid','20000000-0000-0000-0000-000000000091');
select is((select count(*)::integer from public.financial_calendar_events where status='paid'),1,'accept matching paid bank event');
select throws_ok($sql$update public.financial_calendar_events set amount_cop=110
 where owner_id='00000000-0000-0000-0000-000000000091' and status='paid'$sql$,
'23514',null,'cannot change amount after paid without reconciling');
select throws_ok($sql$insert into public.financial_calendar_events(owner_id,description,event_kind,due_date,amount_cop,direction,status,linked_movement_id)
values('00000000-0000-0000-0000-000000000091','Wrong kind','expense','2026-10-24',100,'out','paid','20000000-0000-0000-0000-000000000091')$sql$,
'23514',null,'reject unrelated movement type');
select throws_ok($sql$insert into public.financial_calendar_events(owner_id,description,event_kind,due_date,amount_cop,direction,status,channel,linked_movement_id)
values('00000000-0000-0000-0000-000000000091','Payroll deduction','card_payment','2026-10-24',100,'out','paid','payroll_deduction','20000000-0000-0000-0000-000000000091')$sql$,
'23514',null,'cannot close payroll deduction using bank payment');
select is((select count(*)::integer from public.movements),1,'scheduler never inserts extra bank movement');
reset role;
select * from finish();
rollback;
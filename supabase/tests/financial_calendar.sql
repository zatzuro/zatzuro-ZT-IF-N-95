begin;
create extension if not exists pgtap with schema extensions;
select plan(6);
insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data)
values
('00000000-0000-0000-0000-000000000071','authenticated','authenticated','calendar-owner@example.invalid','','{}','{}'),
('00000000-0000-0000-0000-000000000072','authenticated','authenticated','calendar-outsider@example.invalid','','{}','{}');
insert into public.authorized_owners(user_id) values('00000000-0000-0000-0000-000000000071');
select has_table('public','financial_calendar_events','calendar migrated');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.financial_calendar_events'::regclass),'RLS forced');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000071',true);
set local role authenticated;
insert into public.financial_calendar_events
 (owner_id,description,event_kind,due_date,amount_cop,direction,certainty,status,channel,source_reference)
values
 ('00000000-0000-0000-0000-000000000071','Factura futura','card_payment','2026-11-15',100,'out','estimated','pending','bank',null);
select is((select count(*)::integer from public.financial_calendar_events),1,'authorized owner can see one projection');
select throws_ok(
 $sql$insert into public.financial_calendar_events(owner_id,description,event_kind,due_date,amount_cop,direction)
 values('00000000-0000-0000-0000-000000000072','Otro usuario','expense','2026-11-15',100,'out')$sql$,
 '42501',null,'cannot write another owner');
select throws_ok(
 $sql$insert into public.financial_calendar_events(owner_id,description,event_kind,due_date,amount_cop,direction,status)
 values('00000000-0000-0000-0000-000000000071','Pago no acreditado','card_payment','2026-11-15',100,'out','paid')$sql$,
 '23514',null,'paid requires an existing linked movement');
select is((select count(*)::integer from public.movements),0,'schedule never invents a settled movement');
reset role;
select * from finish();
rollback;

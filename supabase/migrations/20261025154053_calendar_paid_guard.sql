-- Only verified, same-owner, same-amount settlement can mark a calendar row paid.
-- A linked unrelated bank movement must never hide a real unpaid obligation.
begin;
create or replace function finance_private.validate_calendar_settlement()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actual public.movements%rowtype;
declare expected_type text;
begin
 if new.status<>'paid' then return new; end if;
 if new.linked_movement_id is null or new.channel<>'bank' then
  raise exception 'A paid bank calendar event requires a linked settled bank movement' using errcode='23514';
 end if;
 expected_type:=case
  when new.event_kind in ('salary','commission','bonus') then 'income'
  when new.event_kind='expense' then 'expense'
  when new.event_kind='card_payment' then 'card_payment'
  when new.event_kind='loan_payment' then 'debt_payment'
  else null end;
 if expected_type is null then
  raise exception 'This kind cannot be marked paid until its settlement classification is supported' using errcode='23514';
 end if;
 select * into actual from public.movements
  where id=new.linked_movement_id and owner_id=new.owner_id;
 if not found or actual.movement_type is distinct from expected_type
    or actual.currency <> 'COP'
    or actual.amount is distinct from new.amount_cop
    or actual.occurred_at > current_date then
  raise exception 'Calendar settlement does not match a documented bank movement' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function finance_private.validate_calendar_settlement() from public,anon,authenticated;
drop trigger if exists financial_calendar_verify_paid on public.financial_calendar_events;
create trigger financial_calendar_verify_paid before insert or update on public.financial_calendar_events
for each row execute function finance_private.validate_calendar_settlement();
commit;
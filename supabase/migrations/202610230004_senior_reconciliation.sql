-- FINANZAS SANTI Senior P0: reconciliation invariants, dated opening balances and category integrity.
begin;
alter table public.accounts add column if not exists balance_as_of date not null default current_date;
comment on column public.accounts.balance_as_of is 'The opening_balance is the actual balance at end of this date; only strictly later movements affect it.';
alter table public.budgets add constraint budgets_cop_only check (currency='COP');

create or replace function public.validate_movement_category() returns trigger
language plpgsql security invoker set search_path='' as $$
declare flow text;
begin
 if new.movement_type in ('income','expense') then
   if new.category_id is null then
     raise exception 'Income/expense needs a verified category' using errcode='23514';
   end if;
   select c.flow_type into flow from public.categories c
   where c.owner_id=new.owner_id and c.id=new.category_id;
   if flow is distinct from new.movement_type then
     raise exception 'Movement category type mismatch' using errcode='23514';
   end if;
 elsif new.category_id is not null then
   raise exception 'Non-consumption movements cannot carry income/expense categories' using errcode='23514';
 end if;
 return new;
end $$;
create trigger validate_movement_category_before_write before insert or update on public.movements
for each row execute function public.validate_movement_category();

create or replace function public.check_transfer_group() returns trigger
language plpgsql security invoker set search_path='' as $$
declare gid uuid;
declare n integer; declare incoming integer; declare outgoing integer;
declare distinct_owners integer; declare distinct_accounts integer;
declare distinct_dates integer; declare distinct_currencies integer;
declare minimum numeric; declare maximum numeric; declare non_cop integer; declare credit_accounts integer;
begin
 if tg_op='DELETE' then gid:=old.transfer_group_id; else gid:=new.transfer_group_id; end if;
 if gid is null then return null; end if;
 select count(*),count(*) filter(where m.transfer_direction='in'),count(*) filter(where m.transfer_direction='out'),
 count(distinct m.owner_id),count(distinct m.account_id),count(distinct m.occurred_at),
 count(distinct m.currency),min(m.amount),max(m.amount),
 count(*) filter(where m.currency<>'COP'),
 count(*) filter(where a.account_type='credit_card' or a.is_active is false)
 into n,incoming,outgoing,distinct_owners,distinct_accounts,distinct_dates,distinct_currencies,
 minimum,maximum,non_cop,credit_accounts
 from public.movements m join public.accounts a on a.id=m.account_id and a.owner_id=m.owner_id
 where m.transfer_group_id=gid;
 if n<>2 or incoming<>1 or outgoing<>1 or distinct_owners<>1 or distinct_accounts<>2
 or distinct_dates<>1 or distinct_currencies<>1 or minimum<>maximum
 or non_cop<>0 or credit_accounts<>0 then
   raise exception 'Transfer pair is incomplete or inconsistent' using errcode='23514';
 end if;
 return null;
end $$;
revoke all on function public.validate_movement_category() from public,anon,authenticated;
revoke all on function public.check_transfer_group() from public,anon,authenticated;
commit;

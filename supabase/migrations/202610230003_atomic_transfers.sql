-- Atomic two-leg transfers. Transfers never enter consumption totals.
begin;
alter table public.movements add column if not exists transfer_direction text;
alter table public.movements add constraint movements_transfer_pair_shape check (
 (movement_type='transfer' and transfer_group_id is not null and transfer_direction in ('out','in') and category_id is null)
 or
 (movement_type<>'transfer' and transfer_group_id is null and transfer_direction is null)
);
create or replace function public.reject_transfer_edits() returns trigger
language plpgsql set search_path='' as $$
begin
 if old.movement_type='transfer' or (tg_op='UPDATE' and new.movement_type='transfer') then
  raise exception 'A transfer pair is immutable; record an explicit reversal instead' using errcode='23514';
 end if;
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
create trigger reject_transfer_edit before update or delete on public.movements
for each row execute function public.reject_transfer_edits();

create or replace function public.check_transfer_group() returns trigger
language plpgsql set search_path='' as $$
declare gid uuid; n int; n_in int; n_out int; owners int; accounts int; minimum numeric; maximum numeric;
begin
 if tg_op='DELETE' then gid:=old.transfer_group_id; else gid:=new.transfer_group_id; end if;
 if gid is null then return null; end if;
 select count(*),count(*) filter(where transfer_direction='in'),count(*) filter(where transfer_direction='out'),
        count(distinct owner_id),count(distinct account_id),min(amount),max(amount)
 into n,n_in,n_out,owners,accounts,minimum,maximum
 from public.movements where transfer_group_id=gid;
 if n<>2 or n_in<>1 or n_out<>1 or owners<>1 or accounts<>2 or minimum<>maximum then
  raise exception 'Transfer must contain two matching entries for one owner' using errcode='23514';
 end if;
 return null;
end $$;
create constraint trigger check_transfer_group_after_write
after insert or update or delete on public.movements
deferrable initially deferred for each row
execute function public.check_transfer_group();

create or replace function public.create_cash_transfer(p_from uuid,p_to uuid,p_amount numeric,p_date date,p_description text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare gid uuid:=gen_random_uuid(); uid uuid:=auth.uid(); matched int;
begin
 if uid is null or not public.is_authorized_owner() then
  raise exception 'Not authorized' using errcode='42501';
 end if;
 if p_from is null or p_to is null or p_from=p_to or p_amount is null or p_amount<=0
    or p_date is null or length(trim(coalesce(p_description,''))) not between 1 and 240 then
  raise exception 'Invalid transfer details' using errcode='22023';
 end if;
 select count(*) into matched from public.accounts
  where owner_id=uid and id in (p_from,p_to) and is_active and currency='COP' and account_type<>'credit_card';
 if matched<>2 then raise exception 'Accounts must belong to the same owner and be active COP accounts' using errcode='42501'; end if;
 insert into public.movements(owner_id,account_id,movement_type,occurred_at,description,amount,currency,transfer_group_id,transfer_direction)
 values (uid,p_from,'transfer',p_date,p_description,p_amount,'COP',gid,'out'),
        (uid,p_to,'transfer',p_date,p_description,p_amount,'COP',gid,'in');
 return gid;
end $$;
revoke all on function public.create_cash_transfer(uuid,uuid,numeric,date,text) from public,anon;
grant execute on function public.create_cash_transfer(uuid,uuid,numeric,date,text) to authenticated;
revoke all on function public.reject_transfer_edits() from public,anon,authenticated;
revoke all on function public.check_transfer_group() from public,anon,authenticated;
commit;

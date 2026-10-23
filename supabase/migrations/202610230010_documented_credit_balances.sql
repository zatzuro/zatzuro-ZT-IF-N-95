-- Owner-only administrative normalization of documented debt snapshots.
-- A current documented balance is NEVER rewritten as original disbursement principal.
begin;
alter table public.debts add column if not exists principal_kind text not null default 'unknown'
 check(principal_kind in ('unknown','documented_disbursement'));
alter table public.debts add column if not exists source_observation_id uuid unique
 references public.financial_source_observations(id) on delete restrict;
comment on column public.debts.principal is '0 when principal_kind=unknown. Never infer principal from remaining loan balance.';

create or replace function finance_private.populate_documented_debts(p_batch uuid)
returns integer language plpgsql security invoker set search_path='' as $$
declare inserted integer;
begin
 if not exists(select 1 from finance_private.source_batches where id=p_batch and status='verified')
 then raise exception 'Unverified source' using errcode='23514'; end if;
 insert into public.debts(owner_id,name,lender,principal,principal_kind,balance,currency,
 annual_rate,minimum_payment,balance_kind,as_of_date,notes,source_observation_id)
 select o.owner_id,o.description,nullif(r.cells->>1,''),0,'unknown',
 o.amount_cop,'COP',
 finance_private.local_number(replace(r.cells->>3,'%',''))/100,
 finance_private.local_number(r.cells->>5),'documented',o.event_date,
 'Saldo a fecha del extracto, no necesariamente vigente hoy. Desembolso original desconocido en esta ficha; cuotas previstas en archivo separado.',
 o.id
 from public.financial_source_observations o
 join finance_private.source_rows r on r.batch_id=o.batch_id and r.sheet_name=o.sheet_name and r.source_row=o.source_row
 where o.batch_id=p_batch and o.kind='credit_balance' and o.amount_cop>0
 and not exists(select 1 from public.debts d where d.owner_id=o.owner_id and d.name=o.description)
 on conflict (source_observation_id) do nothing;
 get diagnostics inserted=row_count;
 return inserted;
end $$;
revoke all on function finance_private.populate_documented_debts(uuid) from public,anon,authenticated;
commit;

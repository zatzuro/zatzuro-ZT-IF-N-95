-- Typed source normalizer: keep transactions, future amortization and USD valuations DISTINCT.
begin;
alter table public.debts add column if not exists as_of_date date;
comment on column public.debts.as_of_date is 'As-of date on the source statement; not necessarily today.';

create or replace function finance_private.local_number(p_text text)
returns numeric language plpgsql immutable security invoker set search_path='' as $$
declare cleaned text;
begin
 if p_text is null then return null; end if;
 cleaned:=regexp_replace(trim(p_text),'[\s$\u00a0]','','g');
 if cleaned !~ '^-?[0-9]{1,3}(\.[0-9]{3})*(,[0-9]+)?$'
    and cleaned !~ '^-?[0-9]+(,[0-9]+)?$'
 then return null; end if;
 return replace(replace(cleaned,'.',''),',','.')::numeric;
exception when others then return null;
end $$;
create or replace function finance_private.local_date(p_text text)
returns date language plpgsql immutable security invoker set search_path='' as $$
declare x date;
begin
 if p_text is null then return null; end if;
 if p_text ~ '^\d{2}/\d{2}/\d{4}$' then
  x:=to_date(p_text,'DD/MM/YYYY');
  if to_char(x,'DD/MM/YYYY')=p_text then return x; end if;
 elsif p_text ~ '^\d{4}-\d{2}-\d{2}$' then
  x:=p_text::date;
  if to_char(x,'YYYY-MM-DD')=p_text then return x; end if;
 end if;
 return null;
exception when others then return null;
end $$;

create or replace function finance_private.materialize_source_observations(p_batch uuid)
returns integer language plpgsql security invoker set search_path='' as $$
declare affected integer; declare affected_extra integer;
begin
 if not exists(select 1 from finance_private.source_batches where id=p_batch and status='verified') then
  raise exception 'Source snapshot is not verified' using errcode='23514';
 end if;
 insert into public.financial_source_observations(
  owner_id,batch_id,sheet_name,source_row,kind,description,event_date,amount_cop,amount_usd,provenance,details)
 select r.owner_id,r.batch_id,r.sheet_name,r.source_row,
 case
  when r.sheet_name='INGRESOS' then 'income_document'
  when r.sheet_name='GASTOS' then 'expense_document'
  when r.sheet_name='CREDITOS' and r.source_row=8 then 'card_statement'
  when r.sheet_name='CREDITOS' then 'credit_balance'
  when r.sheet_name='DEPOSITOS ETORO' then 'investment_deposit'
  when r.sheet_name='OPERACIONES ETORO' then 'investment_position'
  when r.sheet_name='PRESUPUESTO' and coalesce(r.cells->>0,'') ~ '^\d{4}-\d{2}' then 'budget_income'
  when r.sheet_name='PRESUPUESTO' then 'budget_expense'
  else 'loan_projection' end,
 case
  when r.sheet_name='INGRESOS' then coalesce(nullif(r.cells->>3,''),'Ingreso documentado')
  when r.sheet_name='GASTOS' then coalesce(nullif(r.cells->>4,''),'Gasto de origen')
  when r.sheet_name='CREDITOS' then coalesce(r.cells->>0,'Crédito')
  when r.sheet_name='DEPOSITOS ETORO' then 'Depósito eToro'
  when r.sheet_name='OPERACIONES ETORO' then coalesce(r.cells->>2,'Posición eToro')
  when r.sheet_name='PRESUPUESTO' and coalesce(r.cells->>0,'') ~ '^\d{4}-\d{2}' then coalesce(r.cells->>2,'Ingreso presupuestado')
  when r.sheet_name='PRESUPUESTO' then coalesce(r.cells->>11,'Gasto presupuestado')
  else 'Cuota prevista según calendario' end,
 case
  when r.sheet_name='INGRESOS' then finance_private.local_date(r.cells->>1)
  when r.sheet_name='GASTOS' then finance_private.local_date(r.cells->>1)
  when r.sheet_name='CREDITOS' then finance_private.local_date(r.cells->>6)
  when r.sheet_name='DEPOSITOS ETORO' then finance_private.local_date(r.cells->>0)
  when r.sheet_name='OPERACIONES ETORO' then finance_private.local_date(r.cells->>1)
  when r.sheet_name='PRESUPUESTO' then null
  else finance_private.local_date(r.cells->>1) end,
 case
  when r.sheet_name='INGRESOS' then finance_private.local_number(r.cells->>11)
  when r.sheet_name='GASTOS' then finance_private.local_number(r.cells->>10)
  when r.sheet_name='CREDITOS' and r.source_row=8 then finance_private.local_number(r.cells->>5)
  when r.sheet_name='CREDITOS' then finance_private.local_number(r.cells->>2)
  when r.sheet_name='DEPOSITOS ETORO' then finance_private.local_number(r.cells->>1)
  when r.sheet_name='OPERACIONES ETORO' then finance_private.local_number(r.cells->>10)
  when r.sheet_name='PRESUPUESTO' and coalesce(r.cells->>0,'') ~ '^\d{4}-\d{2}' then finance_private.local_number(r.cells->>3)
  when r.sheet_name='PRESUPUESTO' then finance_private.local_number(r.cells->>13)
  else finance_private.local_number(r.cells->>9) end,
 case
  when r.sheet_name='DEPOSITOS ETORO' then finance_private.local_number(r.cells->>2)
  when r.sheet_name='OPERACIONES ETORO' then finance_private.local_number(r.cells->>9)
  else null end,
 case
  when r.sheet_name in ('INGRESOS','CREDITOS','DEPOSITOS ETORO') then 'documented'
  when r.sheet_name='GASTOS' then case when coalesce(r.cells->>5,'') ~* 'por clasificar|verificar' or coalesce(r.cells->>7,'') ~* 'transferencia|deuda|aporte|inversi[oó]n' then 'unverified' else 'documented' end
  when r.sheet_name='OPERACIONES ETORO' then 'unverified'
  else 'estimated' end,
 jsonb_build_object('source_snapshot',r.batch_id,'raw_row_sha256',r.row_digest)
 from finance_private.source_rows r
 where r.batch_id=p_batch
  and (
   (r.sheet_name in ('INGRESOS','GASTOS') and r.source_row>=2)
   or (r.sheet_name='CREDITOS' and r.source_row between 3 and 8)
   or (r.sheet_name='DEPOSITOS ETORO' and r.source_row between 2 and 5)
   or (r.sheet_name='OPERACIONES ETORO' and r.source_row between 3 and 16 and r.cells->>2 is not null)
   or (r.sheet_name='PRESUPUESTO' and r.source_row>=8
       and ((coalesce(r.cells->>0,'') ~ '^\d{4}-\d{2}' and r.cells->>1 is not null)
            or (r.cells->>9 ~ '^\d{4}-\d{2}' and r.cells->>11 is not null)))
   or (r.sheet_name in ('FONDEC - AMOR Y AMISTAD','FONDEC - ORDINARIO','FONDEC - PRIMA','CAJA SOCIAL - VIVIENDA','OCCIDENTE - LIBRANZA')
       and r.source_row>=9 and r.cells->>0 ~ '^\d+$')
   or (r.sheet_name='DAVIVIENDA - TC GZERO' and r.source_row>=9 and r.cells->>0 ~ '^\d+$')
  )
 on conflict(batch_id,sheet_name,source_row,kind) do nothing;
 get diagnostics affected=row_count;
 -- The original budget holds income and expense tables side by side: preserve BOTH.
 insert into public.financial_source_observations(
  owner_id,batch_id,sheet_name,source_row,kind,description,event_date,amount_cop,provenance,details)
 select r.owner_id,r.batch_id,r.sheet_name,r.source_row,'budget_expense',
  coalesce(nullif(r.cells->>11,''),'Partida presupuestada'),
  case when r.cells->>9 ~ '^\d{4}-\d{2}
end $$;

revoke all on function finance_private.local_number(text) from public,anon,authenticated;
revoke all on function finance_private.local_date(text) from public,anon,authenticated;
revoke all on function finance_private.materialize_source_observations(uuid) from public,anon,authenticated;
commit;
 then (r.cells->>9||'-01')::date else null end,
  finance_private.local_number(r.cells->>13),'estimated',
  jsonb_build_object('source_snapshot',r.batch_id,'raw_row_sha256',r.row_digest)
 from finance_private.source_rows r
 where r.batch_id=p_batch and r.sheet_name='PRESUPUESTO'
 and r.source_row>=8 and r.cells->>9 ~ '^\d{4}-\d{2}
end $$;

revoke all on function finance_private.local_number(text) from public,anon,authenticated;
revoke all on function finance_private.local_date(text) from public,anon,authenticated;
revoke all on function finance_private.materialize_source_observations(uuid) from public,anon,authenticated;
commit;

 and nullif(r.cells->>11,'') is not null
 on conflict(batch_id,sheet_name,source_row,kind) do nothing;
 get diagnostics affected_extra=row_count;
 affected:=affected+affected_extra;
 -- A statement is a receivable obligation, NOT an executed card payment.
 insert into public.financial_source_observations(
  owner_id,batch_id,sheet_name,source_row,kind,description,event_date,amount_cop,provenance,details)
 select r.owner_id,r.batch_id,r.sheet_name,r.source_row,'card_statement',
  'Factura tarjeta · pago no verificado',
  finance_private.local_date(r.cells->>1),
  finance_private.local_number(r.cells->>9),'documented',
  jsonb_build_object('source_snapshot',r.batch_id,'raw_row_sha256',r.row_digest)
 from finance_private.source_rows r
 where r.batch_id=p_batch and r.sheet_name='DAVIVIENDA - TC GZERO'
 and r.source_row>=9 and r.cells->>0 ~ '^\d+
end $$;

revoke all on function finance_private.local_number(text) from public,anon,authenticated;
revoke all on function finance_private.local_date(text) from public,anon,authenticated;
revoke all on function finance_private.materialize_source_observations(uuid) from public,anon,authenticated;
commit;

 on conflict(batch_id,sheet_name,source_row,kind) do nothing;
 get diagnostics affected_extra=row_count;
 return affected+affected_extra;
end $$;

revoke all on function finance_private.local_number(text) from public,anon,authenticated;
revoke all on function finance_private.local_date(text) from public,anon,authenticated;
revoke all on function finance_private.materialize_source_observations(uuid) from public,anon,authenticated;
commit;

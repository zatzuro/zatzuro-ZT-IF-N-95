-- FINANZAS SANTI P0: preserve all original source tabs as an owner-only archive.
-- Raw rows live in a non-exposed schema, never in the browser bundle or GitHub.
begin;

create table finance_private.source_batches (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete restrict,
 source_file_id text not null check (length(source_file_id) between 5 and 250),
 source_version text not null check (length(source_version) between 5 and 150),
 status text not null default 'staging' check (status in ('staging','verified','reconciliation_required')),
 expected_sheets integer not null default 13 check (expected_sheets=13),
 created_at timestamptz not null default now(),
 verified_at timestamptz,
 unique(owner_id,source_file_id,source_version),
 unique(id,owner_id)
);
create table finance_private.source_sheets (
 batch_id uuid not null, owner_id uuid not null,
 sheet_name text not null, expected_rows integer not null check(expected_rows>=0),
 stored_rows integer not null default 0 check(stored_rows>=0),
 row_class text not null check(row_class in ('historical','balances','investment_activity','budget','projection','empty')),
 reconcile_state text not null default 'staged' check(reconcile_state in ('staged','complete','review_required')),
 primary key(batch_id,sheet_name),
 foreign key(batch_id,owner_id) references finance_private.source_batches(id,owner_id) on delete restrict,
 check(stored_rows<=expected_rows)
);
create table finance_private.source_rows (
 batch_id uuid not null,owner_id uuid not null,sheet_name text not null,
 source_row integer not null check(source_row>0),
 cells jsonb not null check(jsonb_typeof(cells)='array'),
 row_class text not null,
 row_digest text not null check(length(row_digest)=64),
 imported_at timestamptz not null default now(),
 primary key(batch_id,sheet_name,source_row),
 foreign key(batch_id,sheet_name) references finance_private.source_sheets(batch_id,sheet_name) on delete restrict,
 foreign key(batch_id,owner_id) references finance_private.source_batches(id,owner_id) on delete restrict
);
create table public.financial_source_observations (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete restrict,
 batch_id uuid not null,
 sheet_name text not null,
 source_row integer not null check(source_row>0),
 kind text not null check(kind in (
  'credit_balance','card_statement','investment_deposit','investment_position',
  'budget_income','budget_expense','loan_projection','income_document','expense_document')),
 description text not null,
 event_date date,
 amount_cop numeric(20,4),
 amount_usd numeric(20,8),
 provenance text not null check(provenance in ('documented','estimated','unverified')),
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 unique(batch_id,sheet_name,source_row,kind),
 foreign key(batch_id,sheet_name,source_row)
 references finance_private.source_rows(batch_id,sheet_name,source_row) on delete restrict,
 foreign key(batch_id,owner_id) references finance_private.source_batches(id,owner_id) on delete restrict
);
do $do$
declare tab text;
begin
 foreach tab in array array['source_batches','source_sheets','source_rows'] loop
  execute format('alter table finance_private.%I enable row level security',tab);
  execute format('alter table finance_private.%I force row level security',tab);
  execute format('create policy owner_read on finance_private.%I for select to authenticated using ((select auth.uid())=owner_id and (select public.is_authorized_owner()))',tab);
  execute format('revoke all on finance_private.%I from public,anon,authenticated',tab);
  execute format('grant select on finance_private.%I to authenticated',tab);
 end loop;
end $do$;
alter table public.financial_source_observations enable row level security;
alter table public.financial_source_observations force row level security;
create policy source_owner_read on public.financial_source_observations for select to authenticated
 using ((select auth.uid())=owner_id and (select public.is_authorized_owner()));
revoke all on public.financial_source_observations from public,anon,authenticated;
grant select on public.financial_source_observations to authenticated;

create or replace view public.source_migration_status with (security_invoker=true) as
select s.owner_id, s.batch_id, s.sheet_name, s.expected_rows, s.stored_rows,
 s.row_class,s.reconcile_state,b.status as batch_status,b.verified_at
from finance_private.source_sheets s
join finance_private.source_batches b on b.id=s.batch_id and b.owner_id=s.owner_id
where b.id=(select b2.id from finance_private.source_batches b2
 where b2.owner_id=s.owner_id and b2.status='verified' order by b2.verified_at desc limit 1);
revoke all on public.source_migration_status from public,anon,authenticated;
grant select on public.source_migration_status to authenticated;
commit;

-- FINANZAS SANTI: scheduling is NOT the operational ledger.
-- No historic migration or automatic creation of confirmed bank transactions.
begin;
create table if not exists public.financial_calendar_events (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete restrict,
 description text not null check(length(trim(description)) between 1 and 160),
 event_kind text not null check(event_kind in ('salary','commission','bonus','expense','card_payment','loan_payment','credit_advance','transfer','other')),
 due_date date not null,
 amount_cop numeric(20,4) not null check(amount_cop>0),
 direction text not null check(direction in ('in','out')),
 certainty text not null default 'estimated' check(certainty in ('confirmed','estimated')),
 status text not null default 'pending' check(status in ('pending','paid','cancelled','unverified')),
 channel text not null default 'bank' check(channel in ('bank','payroll_deduction')),
 source_reference text,
 external_source text,
 external_key text,
 linked_movement_id uuid,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key (owner_id,linked_movement_id) references public.movements(owner_id,id) on delete restrict,
 constraint financial_events_external_pair check ((external_source is null)=(external_key is null)),
 constraint financial_events_paid_requires_ledger check (status<>'paid' or linked_movement_id is not null),
 constraint financial_events_confirmed_needs_source check (certainty<>'confirmed' or length(trim(coalesce(source_reference,'')))>0),
 unique(owner_id,external_source,external_key)
);
create index if not exists financial_events_owner_due_idx on public.financial_calendar_events(owner_id,due_date);
comment on table public.financial_calendar_events is
 'Private future commitments and estimated income; no balances or settled transactions are generated from these rows.';
drop trigger if exists financial_calendar_events_updated_at on public.financial_calendar_events;
create trigger financial_calendar_events_updated_at before update on public.financial_calendar_events
for each row execute function public.set_updated_at();
drop trigger if exists financial_calendar_events_audit on public.financial_calendar_events;
create trigger financial_calendar_events_audit after insert or update or delete on public.financial_calendar_events
for each row execute function public.record_financial_change();
alter table public.financial_calendar_events enable row level security;
alter table public.financial_calendar_events force row level security;
drop policy if exists owner_all on public.financial_calendar_events;
create policy owner_all on public.financial_calendar_events for all to authenticated
 using ((select auth.uid())=owner_id and (select public.is_authorized_owner()))
 with check ((select auth.uid())=owner_id and (select public.is_authorized_owner()));
revoke all on public.financial_calendar_events from anon,authenticated;
grant select,insert,update,delete on public.financial_calendar_events to authenticated;
commit;

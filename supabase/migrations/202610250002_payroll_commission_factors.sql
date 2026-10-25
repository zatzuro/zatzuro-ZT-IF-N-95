-- Factor de pago: values are synced privately from NOMINAS/Tabla.xlsx.
-- No salary amount or payroll receipt is stored in this table.
begin;
create table if not exists public.payroll_commission_factors (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete restrict,
 compliance numeric(7,4) not null check(compliance>=0 and compliance<=3),
 payment_factor numeric(10,5) not null check(payment_factor>=0 and payment_factor<=10),
 source_name text not null check(length(trim(source_name)) between 3 and 120),
 source_modified_at timestamptz not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(owner_id,compliance)
);
comment on table public.payroll_commission_factors is 'Private, source-linked commission coefficients; never a confirmed payroll amount.';
drop trigger if exists payroll_commission_factors_updated_at on public.payroll_commission_factors;
create trigger payroll_commission_factors_updated_at before update on public.payroll_commission_factors for each row execute function public.set_updated_at();
drop trigger if exists payroll_commission_factors_audit on public.payroll_commission_factors;
create trigger payroll_commission_factors_audit after insert or update or delete on public.payroll_commission_factors for each row execute function public.record_financial_change();
alter table public.payroll_commission_factors enable row level security;
alter table public.payroll_commission_factors force row level security;
drop policy if exists owner_all on public.payroll_commission_factors;
create policy owner_all on public.payroll_commission_factors for all to authenticated
 using ((select auth.uid())=owner_id and (select public.is_authorized_owner()))
 with check ((select auth.uid())=owner_id and (select public.is_authorized_owner()));
revoke all on public.payroll_commission_factors from anon,authenticated;
grant select,insert,update,delete on public.payroll_commission_factors to authenticated;
commit;

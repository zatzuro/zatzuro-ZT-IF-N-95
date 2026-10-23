-- Patch the initial schema's update triggers and tighten auditing without loosening RLS.
begin;
alter table public.categories add column if not exists updated_at timestamptz not null default now();
alter table public.budgets add column if not exists updated_at timestamptz not null default now();
-- The event trigger is internal: it must never have public HTTP EXECUTE grants.
do $ begin if to_regprocedure('public.rls_auto_enable()') is not null then execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated'; end if; end $;
commit;

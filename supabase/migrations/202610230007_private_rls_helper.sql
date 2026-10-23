-- Keep privileged allowlist lookups outside the publicly exposed Data API schema.
begin;
create schema if not exists finance_private;
revoke all on schema finance_private from public, anon;
grant usage on schema finance_private to authenticated;
create or replace function finance_private.is_authorized_owner()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.authorized_owners where user_id=(select auth.uid()));
$$;
revoke all on function finance_private.is_authorized_owner() from public, anon;
grant execute on function finance_private.is_authorized_owner() to authenticated;
-- Public RPC and existing policies preserve their signature, but run only with caller rights.
create or replace function public.is_authorized_owner()
returns boolean language sql stable security invoker set search_path='' as $$
 select finance_private.is_authorized_owner();
$$;
revoke all on function public.is_authorized_owner() from public, anon;
grant execute on function public.is_authorized_owner() to authenticated;
commit;

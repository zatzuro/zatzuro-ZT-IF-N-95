begin;
create extension if not exists pgtap with schema extensions;
select plan(3);
select has_schema('finance_private','privileged helpers are in a non-API schema');
select ok((select not prosecdef from pg_proc where oid='public.is_authorized_owner()'::regprocedure),'public allowlist RPC uses invoker privileges');
select ok((select prosecdef from pg_proc where oid='finance_private.is_authorized_owner()'::regprocedure),'internal helper has controlled definer access');
select * from finish();
rollback;

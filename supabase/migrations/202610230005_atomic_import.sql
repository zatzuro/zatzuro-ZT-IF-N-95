-- FINANZAS SANTI Senior P0: RLS-aware transactional, idempotent import
begin;
create or replace function public.import_reconciled_movements(p_rows jsonb)
returns integer language plpgsql security invoker set search_path='' as $$
declare v_owner uuid := auth.uid(); v_inserted integer;
begin
 if v_owner is null or not public.is_authorized_owner() then
  raise exception 'Unauthorized importer' using errcode='42501';
 end if;
 if p_rows is null or jsonb_typeof(p_rows)<>'array' then
  raise exception 'Expected JSON array' using errcode='22023';
 end if;
 if jsonb_array_length(p_rows)<1 or jsonb_array_length(p_rows)>1000 then
  raise exception 'Batch size invalid (1..1000)' using errcode='22023';
 end if;
 if exists(
  select 1 from jsonb_array_elements(p_rows) r
  where not (r ?& array['external_source','external_key','occurred_at','description','amount','movement_type','account_id','category_id'])
   or r->>'external_source' not in ('GASTOS','INGRESOS')
   or r->>'movement_type' not in ('income','expense')
   or (r->>'external_source'='GASTOS' and r->>'movement_type'<>'expense')
   or (r->>'external_source'='INGRESOS' and r->>'movement_type'<>'income')
   or length(trim(r->>'external_key')) not between 1 and 160
   or length(trim(r->>'description')) not between 1 and 240
   or r->>'amount' is null
 ) then
  raise exception 'Misclassified or incomplete import row' using errcode='22023';
 end if;
 if exists(
  select 1 from jsonb_array_elements(p_rows) r
  where not exists(select 1 from public.accounts a where a.owner_id=v_owner
      and a.id=(r->>'account_id')::uuid and a.currency='COP'
      and a.account_type<>'credit_card' and a.is_active)
     or not exists(select 1 from public.categories c where c.owner_id=v_owner
      and c.id=(r->>'category_id')::uuid and c.flow_type=r->>'movement_type' and c.is_active)
 ) then
  raise exception 'Account or category is not owned, active or reconciled' using errcode='42501';
 end if;
 insert into public.movements (
   owner_id,account_id,category_id,movement_type,occurred_at,description,amount,currency,external_source,external_key)
 select v_owner,(r->>'account_id')::uuid,(r->>'category_id')::uuid,
    r->>'movement_type',(r->>'occurred_at')::date,r->>'description',
    (r->>'amount')::numeric,'COP',r->>'external_source',r->>'external_key'
 from jsonb_array_elements(p_rows) r
 on conflict(owner_id,external_source,external_key) do nothing;
 get diagnostics v_inserted=row_count;
 return v_inserted;
end $$;
revoke all on function public.import_reconciled_movements(jsonb) from public,anon;
grant execute on function public.import_reconciled_movements(jsonb) to authenticated;
commit;

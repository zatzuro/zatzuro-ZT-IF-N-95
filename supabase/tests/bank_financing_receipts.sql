begin;
create extension if not exists pgtap with schema extensions;
select plan(3);
select ok(
  (select pg_get_constraintdef(oid) like '%financing_inflow%'
   from pg_constraint where conrelid='public.movements'::regclass
    and conname='movements_movement_type_check'),
  'finance receipt is a recognized non-salary movement'
);
select ok(
  (select pg_get_constraintdef(oid) like '%unclassified_inflow%'
   from pg_constraint where conrelid='public.movements'::regclass
    and conname='movements_movement_type_check'),
  'unclassified bank inflows are recognized without false earned income'
);
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.movements'::regclass),
  'ledger retains forced owner RLS'
);
select * from finish();
rollback;

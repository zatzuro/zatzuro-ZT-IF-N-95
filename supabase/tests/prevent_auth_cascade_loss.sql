begin;
create extension if not exists pgtap with schema extensions;
select plan(2);
select is((select count(*)::integer from pg_constraint k join pg_class t on t.oid=k.conrelid
where t.relnamespace='public'::regnamespace and t.relname in ('accounts','categories','movements','budgets','debts','investments','goals','financial_findings','audit_log')
and k.contype='f' and k.confrelid='auth.users'::regclass and k.confdeltype='r'),9,'all nine financial owner references restrict Auth-user deletion');
select ok((select count(*)=0 from pg_constraint k join pg_class t on t.oid=k.conrelid
where t.relnamespace='public'::regnamespace and t.relname in ('accounts','categories','movements','budgets','debts','investments','goals','financial_findings','audit_log')
and k.contype='f' and k.confrelid='auth.users'::regclass and k.confdeltype='c'),'no financial or audit cascade delete exists');
select * from finish();
rollback;

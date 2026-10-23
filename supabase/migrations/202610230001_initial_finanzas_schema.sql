-- Finanzas Santi: private, owner-scoped ledger schema.
begin;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.accounts (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 100),
 account_type text not null check(account_type in ('cash','checking','savings','credit_card','brokerage','other')),
 currency char(3) not null default 'COP' check(currency ~ '^[A-Z]{3}$'), opening_balance numeric(20,4) not null default 0,
 balance_kind text not null default 'documented' check(balance_kind in ('documented','estimated')), is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(owner_id,name), unique(owner_id,id)
);
create table if not exists public.categories (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 80), flow_type text not null check(flow_type in ('income','expense')),
 is_active boolean not null default true, created_at timestamptz not null default now(), unique(owner_id,name,flow_type), unique(owner_id,id)
);
create table if not exists public.movements (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 account_id uuid not null,
 category_id uuid,
 movement_type text not null check(movement_type in ('income','expense','transfer','card_payment','investment_contribution','debt_payment','adjustment')),
 occurred_at date not null, description text not null check(length(trim(description)) between 1 and 240),
 amount numeric(20,4) not null check(amount>0), currency char(3) not null check(currency ~ '^[A-Z]{3}$'),
 fx_rate numeric(20,8) check(fx_rate is null or fx_rate>0), amount_cop numeric(20,4) check(amount_cop is null or amount_cop>0),
 transfer_group_id uuid, external_source text, external_key text, notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((currency='COP' and (fx_rate is null or fx_rate=1)) or currency<>'COP'),
 check((external_source is null)=(external_key is null)), unique(owner_id,external_source,external_key), unique(owner_id,id),
 foreign key(owner_id,account_id) references public.accounts(owner_id,id) on delete restrict,
 foreign key(owner_id,category_id) references public.categories(owner_id,id) on delete restrict
);
create index if not exists movements_owner_date_idx on public.movements(owner_id,occurred_at desc);
create index if not exists movements_owner_type_idx on public.movements(owner_id,movement_type);
create table if not exists public.budgets (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 category_id uuid not null, period_start date not null, period_end date not null,
 amount numeric(20,4) not null check(amount>0), currency char(3) not null default 'COP' check(currency ~ '^[A-Z]{3}$'),
 created_at timestamptz not null default now(), check(period_end>=period_start), unique(owner_id,category_id,period_start,period_end),
 foreign key(owner_id,category_id) references public.categories(owner_id,id) on delete restrict
);
create table if not exists public.debts (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 120), lender text, principal numeric(20,4) not null check(principal>=0),
 balance numeric(20,4) not null check(balance>=0), currency char(3) not null check(currency ~ '^[A-Z]{3}$'),
 annual_rate numeric(9,6) check(annual_rate is null or annual_rate>=0), minimum_payment numeric(20,4) check(minimum_payment is null or minimum_payment>=0),
 due_day smallint check(due_day is null or due_day between 1 and 31),
 balance_kind text not null default 'documented' check(balance_kind in ('documented','estimated')), notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.investments (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 account_id uuid, name text not null check(length(trim(name)) between 1 and 120),
 asset_type text not null, ticker text, units numeric(24,10) check(units is null or units>=0),
 market_value numeric(20,4) not null check(market_value>=0), currency char(3) not null check(currency ~ '^[A-Z]{3}$'),
 valued_at timestamptz not null, value_kind text not null default 'estimated' check(value_kind in ('documented','estimated')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(owner_id,account_id) references public.accounts(owner_id,id) on delete set null (account_id)
);
create table if not exists public.goals (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 120), target_amount numeric(20,4) not null check(target_amount>0),
 current_amount numeric(20,4) not null default 0 check(current_amount>=0), currency char(3) not null default 'COP' check(currency ~ '^[A-Z]{3}$'),
 target_date date, status text not null default 'active' check(status in ('active','completed','paused','archived')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.financial_findings (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 finding_type text not null, title text not null check(length(trim(title)) between 1 and 180), explanation text not null,
 evidence jsonb not null default '{}'::jsonb, recommended_action text,
 priority text not null check(priority in ('low','medium','high','urgent')),
 status text not null default 'pending' check(status in ('pending','reviewed','applied','dismissed')),
 provenance text not null check(provenance in ('rule_engine','user','chatgpt_conversation')),
 analyzed_at timestamptz not null default now(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.audit_log (
 id bigint generated always as identity primary key, owner_id uuid not null references auth.users(id) on delete cascade,
 table_name text not null, record_id uuid not null, operation text not null check(operation in ('INSERT','UPDATE','DELETE')),
 old_data jsonb, new_data jsonb, changed_at timestamptz not null default now()
);

-- No authenticated user is a finance owner by default. Add the approved Auth user
-- from the Supabase SQL editor after sign-in is configured; clients cannot edit this table.
create table if not exists public.authorized_owners (
 user_id uuid primary key references auth.users(id) on delete cascade,
 authorized_at timestamptz not null default now()
);
alter table public.authorized_owners enable row level security;
alter table public.authorized_owners force row level security;

create or replace function public.is_authorized_owner()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.authorized_owners where user_id=(select auth.uid()));
$$;
revoke all on function public.is_authorized_owner() from public,anon;
grant execute on function public.is_authorized_owner() to authenticated;

create or replace function public.is_consumption_expense(kind text)
returns boolean language sql immutable parallel safe set search_path='' as $$
 select kind='expense';
$$;

create or replace view public.movement_monthly_summary with (security_invoker=true) as
 select owner_id, date_trunc('month',occurred_at)::date as month, currency,
  sum(amount) filter(where movement_type='income') as income,
  sum(amount) filter(where public.is_consumption_expense(movement_type)) as consumption_expenses,
  count(*) filter(where movement_type='transfer') as transfer_count,
  count(*) filter(where movement_type='card_payment') as card_payment_count,
  count(*) filter(where movement_type='investment_contribution') as investment_contribution_count
 from public.movements group by owner_id,date_trunc('month',occurred_at)::date,currency;

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end; $$;
create or replace function public.record_financial_change() returns trigger language plpgsql security definer set search_path='' as $$
declare row_data jsonb; previous_data jsonb; next_data jsonb; row_owner uuid; row_id uuid;
begin
 if tg_op='DELETE' then
  row_data:=to_jsonb(old); previous_data:=row_data; next_data:=null;
 elsif tg_op='INSERT' then
  row_data:=to_jsonb(new); previous_data:=null; next_data:=row_data;
 else
  row_data:=to_jsonb(new); previous_data:=to_jsonb(old); next_data:=row_data;
 end if;
 row_owner:=(row_data->>'owner_id')::uuid; row_id:=(row_data->>'id')::uuid;
 insert into public.audit_log(owner_id,table_name,record_id,operation,old_data,new_data)
 values(row_owner,tg_table_name,row_id,tg_op,previous_data,next_data);
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;

do $$
declare t text;
begin
 foreach t in array array['accounts','categories','movements','budgets','debts','investments','goals','financial_findings'] loop
  execute format('drop trigger if exists %I on public.%I',t||'_updated_at',t);
  execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()',t||'_updated_at',t);
  execute format('drop trigger if exists %I on public.%I',t||'_audit',t);
  execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.record_financial_change()',t||'_audit',t);
  execute format('alter table public.%I enable row level security',t);
  execute format('alter table public.%I force row level security',t);
  execute format('drop policy if exists owner_all on public.%I',t);
  execute format('create policy owner_all on public.%I for all to authenticated using ((select auth.uid())=owner_id and (select public.is_authorized_owner())) with check ((select auth.uid())=owner_id and (select public.is_authorized_owner()))',t);
 end loop;
 alter table public.audit_log enable row level security;
 alter table public.audit_log force row level security;
 drop policy if exists owner_read_audit on public.audit_log;
 create policy owner_read_audit on public.audit_log for select to authenticated using ((select auth.uid())=owner_id and (select public.is_authorized_owner()));
end $$;
revoke all on public.accounts,public.categories,public.movements,public.budgets,public.debts,public.investments,public.goals,public.financial_findings,public.audit_log,public.authorized_owners from anon,authenticated;
grant select,insert,update,delete on public.accounts,public.categories,public.movements,public.budgets,public.debts,public.investments,public.goals,public.financial_findings to authenticated;
grant select on public.audit_log to authenticated;
grant select on public.movement_monthly_summary to authenticated;
grant usage,select on sequence public.audit_log_id_seq to authenticated;
revoke all on function public.record_financial_change() from public,anon,authenticated;
revoke all on function public.set_updated_at() from public,anon,authenticated;
commit;

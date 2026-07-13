-- Violet Ledger: independent payments module
-- Run once in Supabase -> SQL Editor after the base schema is installed.

begin;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.requests(id) on delete set null,
  request_number text not null default '',
  supplier_name text not null default '',
  payment_type text not null default 'other'
    check (payment_type in ('prepayment','balance','deferred','logistics','customs','other')),
  amount numeric(16,2) not null check (amount > 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3,4}$'),
  percent_of_order numeric(7,2) check (percent_of_order is null or (percent_of_order >= 0 and percent_of_order <= 100)),
  document_number text not null default '',
  document_date date,
  deferral_days integer not null default 0 check (deferral_days between 0 and 3650),
  submission_lead_days integer not null default 15 check (submission_lead_days between 0 and 365),
  due_date date,
  submit_by_date date,
  status text not null default 'planned'
    check (status in ('planned','waiting_documents','submit','submitted','approved','partial','paid','overdue','cancelled')),
  paid_amount numeric(16,2) not null default 0 check (paid_amount >= 0),
  paid_at date,
  payment_reference text not null default '',
  fee_amount numeric(16,2) not null default 0 check (fee_amount >= 0),
  exchange_rate numeric(18,6) check (exchange_rate is null or exchange_rate > 0),
  attachment_url text not null default '',
  notes text not null default '',
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_request_id_idx on public.payments(request_id);
create index if not exists payments_request_number_idx on public.payments(request_number);
create index if not exists payments_submit_by_date_idx on public.payments(submit_by_date);
create index if not exists payments_due_date_idx on public.payments(due_date);
create index if not exists payments_status_idx on public.payments(status);

create table if not exists public.payment_audit_log (
  id bigint generated always as identity primary key,
  payment_id uuid,
  request_id uuid,
  request_number text,
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  actor_id uuid,
  actor_email text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists payment_audit_payment_id_idx on public.payment_audit_log(payment_id);
create index if not exists payment_audit_created_at_idx on public.payment_audit_log(created_at desc);

create or replace function public.touch_payment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_payment on public.payments;
create trigger touch_payment
before update on public.payments
for each row execute function public.touch_payment();

create or replace function public.audit_payment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p_email text;
begin
  select email into p_email from public.profiles where id = auth.uid();
  insert into public.payment_audit_log(
    payment_id, request_id, request_number, action,
    actor_id, actor_email, old_data, new_data
  ) values (
    coalesce(new.id, old.id),
    coalesce(new.request_id, old.request_id),
    coalesce(new.request_number, old.request_number),
    tg_op,
    auth.uid(),
    p_email,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists audit_payments on public.payments;
create trigger audit_payments
after insert or update or delete on public.payments
for each row execute function public.audit_payment_change();

alter table public.payments enable row level security;
alter table public.payment_audit_log enable row level security;

drop policy if exists "team reads payments" on public.payments;
drop policy if exists "admins create payments" on public.payments;
drop policy if exists "admins update payments" on public.payments;
drop policy if exists "admins delete payments" on public.payments;
drop policy if exists "team reads payment audit" on public.payment_audit_log;

create policy "team reads payments"
on public.payments for select to authenticated
using (public.current_user_role() is not null);

create policy "admins create payments"
on public.payments for insert to authenticated
with check (
  public.current_user_role() = 'admin'
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

create policy "admins update payments"
on public.payments for update to authenticated
using (public.current_user_role() = 'admin')
with check (
  public.current_user_role() = 'admin'
  and updated_by = auth.uid()
);

create policy "admins delete payments"
on public.payments for delete to authenticated
using (public.current_user_role() = 'admin');

create policy "team reads payment audit"
on public.payment_audit_log for select to authenticated
using (public.current_user_role() is not null);

grant select, insert, update, delete on public.payments to authenticated;
grant select on public.payment_audit_log to authenticated;
grant usage, select on sequence public.payment_audit_log_id_seq to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'payments'
  ) then
    alter publication supabase_realtime add table public.payments;
  end if;
end;
$$;

commit;

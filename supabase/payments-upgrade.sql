-- Violet Ledger: independent PI payments module (v2)
-- Safe to run repeatedly in Supabase -> SQL Editor.
-- The module is NOT linked to requests: request_id stays nullable only for legacy rows.

begin;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.requests(id) on delete set null,
  request_number text not null default '',
  pi_number text not null default '',
  supplier_name text not null default '',
  payment_type text not null default 'prepayment',
  amount numeric(16,2) not null check (amount > 0),
  currency text not null default 'CNY' check (currency ~ '^[A-Z]{3,4}$'),
  percent_of_order numeric(7,2) check (percent_of_order is null or (percent_of_order >= 0 and percent_of_order <= 100)),
  document_number text not null default '',
  document_date date,
  deferral_days integer not null default 0 check (deferral_days between 0 and 3650),
  submission_lead_days integer not null default 15 check (submission_lead_days between 0 and 365),
  due_date date,
  submit_by_date date,
  status text not null default 'planned',
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

alter table public.payments add column if not exists pi_number text not null default '';

update public.payments
set pi_number = request_number
where coalesce(pi_number, '') = '' and coalesce(request_number, '') <> '';

update public.payments
set request_number = pi_number
where coalesce(pi_number, '') <> '' and request_number is distinct from pi_number;

update public.payments
set payment_type = case when payment_type = 'prepayment' then 'prepayment' else 'balance' end
where payment_type not in ('prepayment', 'balance');

alter table public.payments drop constraint if exists payments_payment_type_check;
alter table public.payments add constraint payments_payment_type_check
  check (payment_type in ('prepayment', 'balance'));

alter table public.payments alter column payment_type set default 'prepayment';
alter table public.payments alter column currency set default 'CNY';

create index if not exists payments_pi_number_idx on public.payments(pi_number);
create index if not exists payments_due_date_idx on public.payments(due_date);
create index if not exists payments_status_idx on public.payments(status);

create table if not exists public.payment_audit_log (
  id bigint generated always as identity primary key,
  payment_id uuid,
  request_id uuid,
  request_number text,
  pi_number text,
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  actor_id uuid,
  actor_email text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

alter table public.payment_audit_log add column if not exists pi_number text;
update public.payment_audit_log
set pi_number = request_number
where coalesce(pi_number, '') = '' and coalesce(request_number, '') <> '';

create index if not exists payment_audit_payment_id_idx on public.payment_audit_log(payment_id);
create index if not exists payment_audit_created_at_idx on public.payment_audit_log(created_at desc);

create table if not exists public.payment_notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  channel text not null default 'email' check (channel in ('email','telegram','both')),
  email text not null default '',
  telegram_chat_id text not null default '',
  reminder_days integer[] not null default array[15,7,3,0],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_notification_log (
  id bigint generated always as identity primary key,
  payment_id uuid not null references public.payments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('email','telegram')),
  reminder_key text not null,
  sent_at timestamptz not null default now(),
  error_text text not null default '',
  unique(payment_id, user_id, channel, reminder_key)
);

create or replace function public.touch_payment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  new.request_id = null;
  new.request_number = coalesce(new.pi_number, '');
  new.paid_amount = round(new.amount * coalesce(new.percent_of_order, 0) / 100.0, 2);
  new.submit_by_date = case when new.due_date is null then null else new.due_date - 15 end;
  new.status = case
    when new.amount > 0 and new.paid_amount >= new.amount then 'paid'
    when new.due_date is not null and current_date > new.due_date and new.paid_amount < new.amount then 'overdue'
    when new.paid_amount > 0 then 'partial'
    else 'planned'
  end;
  return new;
end;
$$;

drop trigger if exists touch_payment on public.payments;
create trigger touch_payment
before insert or update on public.payments
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
    payment_id, request_id, request_number, pi_number, action,
    actor_id, actor_email, old_data, new_data
  ) values (
    coalesce(new.id, old.id),
    null,
    coalesce(new.pi_number, old.pi_number, new.request_number, old.request_number),
    coalesce(new.pi_number, old.pi_number, new.request_number, old.request_number),
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
alter table public.payment_notification_settings enable row level security;
alter table public.payment_notification_log enable row level security;

drop policy if exists "team reads payments" on public.payments;
drop policy if exists "admins create payments" on public.payments;
drop policy if exists "admins update payments" on public.payments;
drop policy if exists "admins delete payments" on public.payments;
drop policy if exists "team reads payment audit" on public.payment_audit_log;
drop policy if exists "users read own payment notification settings" on public.payment_notification_settings;
drop policy if exists "users manage own payment notification settings" on public.payment_notification_settings;
drop policy if exists "users read own payment notification log" on public.payment_notification_log;

create policy "team reads payments"
on public.payments for select to authenticated
using (public.current_user_role() is not null);

create policy "admins create payments"
on public.payments for insert to authenticated
with check (
  public.current_user_role() = 'admin'
  and created_by = auth.uid()
  and updated_by = auth.uid()
  and request_id is null
);

create policy "admins update payments"
on public.payments for update to authenticated
using (public.current_user_role() = 'admin')
with check (
  public.current_user_role() = 'admin'
  and updated_by = auth.uid()
  and request_id is null
);

create policy "admins delete payments"
on public.payments for delete to authenticated
using (public.current_user_role() = 'admin');

create policy "team reads payment audit"
on public.payment_audit_log for select to authenticated
using (public.current_user_role() is not null);

create policy "users read own payment notification settings"
on public.payment_notification_settings for select to authenticated
using (user_id = auth.uid());

create policy "users manage own payment notification settings"
on public.payment_notification_settings for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "users read own payment notification log"
on public.payment_notification_log for select to authenticated
using (user_id = auth.uid());

grant select, insert, update, delete on public.payments to authenticated;
grant select on public.payment_audit_log to authenticated;
grant select, insert, update, delete on public.payment_notification_settings to authenticated;
grant select on public.payment_notification_log to authenticated;
grant usage, select on sequence public.payment_audit_log_id_seq to authenticated;
grant usage, select on sequence public.payment_notification_log_id_seq to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'payments'
  ) then
    alter publication supabase_realtime add table public.payments;
  end if;
end;
$$;

commit;

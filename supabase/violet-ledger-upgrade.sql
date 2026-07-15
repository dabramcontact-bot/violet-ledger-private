-- Violet Ledger unified workflow upgrade
-- Run once in Supabase -> SQL Editor. The script is repeat-safe.

begin;

create extension if not exists pgcrypto;

-- Requests: only request -> offer -> calculation remains in the active workflow.
alter table public.requests add column if not exists supplier_contact text not null default '';
alter table public.requests add column if not exists product_url text not null default '';
alter table public.requests add column if not exists requested_quantity numeric(16,3);
alter table public.requests add column if not exists unit text not null default 'шт';
alter table public.requests add column if not exists supplier_price numeric(16,4);
alter table public.requests add column if not exists currency text not null default 'CNY';
alter table public.requests add column if not exists minimum_order numeric(16,3);
alter table public.requests add column if not exists production_days integer;
alter table public.requests add column if not exists responsible text not null default '';
alter table public.requests add column if not exists attachments jsonb not null default '[]'::jsonb;

update public.requests set status = case
  when included_calculation then 'calculation'
  when offer_received then 'offer'
  else 'request'
end
where status not in ('request','offer','calculation')
   or status is null;

alter table public.requests drop constraint if exists requests_status_check;
alter table public.requests add constraint requests_status_check check (status in ('request','offer','calculation'));
alter table public.requests drop constraint if exists requests_attachments_array_check;
alter table public.requests add constraint requests_attachments_array_check check (jsonb_typeof(attachments) = 'array');
alter table public.requests drop constraint if exists requests_currency_check;
alter table public.requests add constraint requests_currency_check check (currency in ('USD','EUR','CNY','BYN','RUB'));
create index if not exists requests_status_v3_idx on public.requests(status);
create index if not exists requests_responsible_v3_idx on public.requests(responsible);
create index if not exists requests_request_date_v3_idx on public.requests(request_sent_at desc);

-- PI is a standalone register linked to an optional source request.
create table if not exists public.pi_records (
  id uuid primary key default gen_random_uuid(),
  pi_number text not null unique,
  request_id uuid references public.requests(id) on delete set null,
  pi_date date,
  supplier text not null,
  product_name text not null,
  article text not null default '',
  quantity numeric(16,3),
  unit_price numeric(16,4),
  total_amount numeric(16,2),
  currency text not null default 'CNY' check (currency in ('USD','EUR','CNY','BYN','RUB')),
  payment_terms text not null default '',
  production_days integer,
  characteristics text not null default '',
  packaging text not null default '',
  dimensions text not null default '',
  weight text not null default '',
  status text not null default 'requested' check (status in ('requested','verification','confirmed','signed','ved')),
  requested_at date,
  confirmed_at date,
  signed_at date,
  ved_at date,
  tnved_email_sent boolean not null default false,
  tnved_email_sent_at date,
  nomenclature_email_sent boolean not null default false,
  nomenclature_email_sent_at date,
  responsible text not null default '',
  comment text not null default '',
  attachments jsonb not null default '[]'::jsonb check (jsonb_typeof(attachments) = 'array'),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pi_records_request_id_idx on public.pi_records(request_id);
create index if not exists pi_records_article_idx on public.pi_records(article);
create index if not exists pi_records_supplier_idx on public.pi_records(supplier);
create index if not exists pi_records_status_idx on public.pi_records(status);
create index if not exists pi_records_pi_date_idx on public.pi_records(pi_date desc);

create or replace function public.touch_pi_record()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  if new.status = 'requested' and new.requested_at is null then new.requested_at = current_date; end if;
  if new.status = 'confirmed' and new.confirmed_at is null then new.confirmed_at = current_date; end if;
  if new.status = 'signed' and new.signed_at is null then new.signed_at = current_date; end if;
  if new.status = 'ved' and new.ved_at is null then new.ved_at = current_date; end if;
  if not new.tnved_email_sent then new.tnved_email_sent_at = null; end if;
  if not new.nomenclature_email_sent then new.nomenclature_email_sent_at = null; end if;
  return new;
end;
$$;
drop trigger if exists touch_pi_record on public.pi_records;
create trigger touch_pi_record before insert or update on public.pi_records for each row execute function public.touch_pi_record();

-- Preserve PI milestones from the former request workflow before retiring those columns.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='requests' and column_name='pi_sent') then
    execute $migration$
      insert into public.pi_records (
        pi_number, request_id, pi_date, supplier, product_name, article, status,
        requested_at, signed_at, responsible, comment, created_by, updated_by, created_at, updated_at
      )
      select
        'LEGACY-' || left(regexp_replace(request_number, '[^a-zA-Z0-9_-]+', '-', 'g'), 80),
        id,
        coalesce(pi_sent_at, pi_signed_at, request_sent_at),
        agent_name,
        product_name,
        article_numbers,
        case when pi_signed then 'signed' when pi_revision then 'verification' else 'requested' end,
        coalesce(pi_sent_at, request_sent_at),
        pi_signed_at,
        '',
        'Перенесено из прежнего маршрута запроса',
        created_by,
        updated_by,
        created_at,
        updated_at
      from public.requests
      where (pi_sent or pi_revision or pi_signed)
      on conflict (pi_number) do nothing
    $migration$;
  end if;
end
$$;

-- The old operational route is no longer used by the application.
alter table public.requests drop column if exists proposed_to_nikolai;
alter table public.requests drop column if exists proposed_to_nikolai_at;
alter table public.requests drop column if exists price_not_viable;
alter table public.requests drop column if exists not_approved;
alter table public.requests drop column if exists workflow_steps;
alter table public.requests drop column if exists pi_sent;
alter table public.requests drop column if exists pi_sent_at;
alter table public.requests drop column if exists pi_revision;
alter table public.requests drop column if exists pi_revision_at;
alter table public.requests drop column if exists pi_signed;
alter table public.requests drop column if exists pi_signed_at;
alter table public.requests drop column if exists shipment_status;
alter table public.requests drop column if exists logistics_company;
alter table public.requests drop column if exists transit_started_at;
alter table public.requests drop column if exists expected_warehouse_at;
alter table public.requests drop column if exists warehouse_arrived_at;

-- Upgrade the existing manual logistics register.
create table if not exists public.manual_logistics (
  id uuid primary key default gen_random_uuid(),
  article text not null default '',
  pi_number text not null default '',
  ready_date date,
  departure_date date,
  warehouse_date date,
  logistics_company text not null default '',
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.manual_logistics add column if not exists internal_number text not null default '';
alter table public.manual_logistics add column if not exists pi_id uuid references public.pi_records(id) on delete set null;
alter table public.manual_logistics add column if not exists product_name text not null default '';
alter table public.manual_logistics add column if not exists supplier text not null default '';
alter table public.manual_logistics add column if not exists quantity numeric(16,3) not null default 1;
alter table public.manual_logistics add column if not exists delivery_method text not null default '';
alter table public.manual_logistics add column if not exists transport_document text not null default '';
alter table public.manual_logistics add column if not exists status text not null default 'waiting';
alter table public.manual_logistics add column if not exists logistics_cost numeric(16,2) not null default 0;
alter table public.manual_logistics add column if not exists logistics_currency text not null default 'CNY';
alter table public.manual_logistics add column if not exists additional_cost numeric(16,2) not null default 0;
alter table public.manual_logistics add column if not exists allocation_method text not null default 'quantity';
alter table public.manual_logistics add column if not exists items jsonb not null default '[]'::jsonb;
alter table public.manual_logistics add column if not exists comment text not null default '';
alter table public.manual_logistics add column if not exists responsible text not null default '';

update public.manual_logistics set internal_number = 'LOG-' || upper(left(replace(id::text,'-',''), 10)) where internal_number = '';
update public.manual_logistics set items = jsonb_build_array(jsonb_build_object(
  'product_name', product_name, 'article', article, 'quantity', quantity,
  'product_value', 0, 'manual_cost', 0, 'allocated_cost', logistics_cost,
  'cost_per_unit', case when quantity > 0 then round(logistics_cost / quantity, 2) else 0 end
)) where items = '[]'::jsonb;

alter table public.manual_logistics drop constraint if exists manual_logistics_status_check;
alter table public.manual_logistics add constraint manual_logistics_status_check check (status in ('waiting','ready','transit','arrived','delayed'));
alter table public.manual_logistics drop constraint if exists manual_logistics_currency_check;
alter table public.manual_logistics add constraint manual_logistics_currency_check check (logistics_currency in ('USD','EUR','CNY','BYN','RUB'));
alter table public.manual_logistics drop constraint if exists manual_logistics_allocation_check;
alter table public.manual_logistics add constraint manual_logistics_allocation_check check (allocation_method in ('equal','quantity','value','manual'));
alter table public.manual_logistics drop constraint if exists manual_logistics_items_array_check;
alter table public.manual_logistics add constraint manual_logistics_items_array_check check (jsonb_typeof(items) = 'array');
create unique index if not exists manual_logistics_internal_number_unique on public.manual_logistics(internal_number) where internal_number <> '';
create index if not exists manual_logistics_pi_id_idx on public.manual_logistics(pi_id);
create index if not exists manual_logistics_status_v3_idx on public.manual_logistics(status);
create index if not exists manual_logistics_warehouse_v3_idx on public.manual_logistics(warehouse_date);

create or replace function public.touch_manual_logistics()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  if new.internal_number = '' then new.internal_number = 'LOG-' || upper(left(replace(new.id::text,'-',''), 10)); end if;
  if new.warehouse_date is not null and new.status <> 'delayed' then new.status = 'arrived';
  elsif new.departure_date is not null and new.status in ('waiting','ready') then new.status = 'transit'; end if;
  return new;
end;
$$;
drop trigger if exists touch_manual_logistics on public.manual_logistics;
create trigger touch_manual_logistics before insert or update on public.manual_logistics for each row execute function public.touch_manual_logistics();

-- Extend the payment register and link it to PI.
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.requests(id) on delete set null,
  request_number text not null default '',
  pi_number text not null default '',
  supplier_name text not null default '',
  payment_type text not null default 'prepayment',
  amount numeric(16,2) not null check (amount > 0),
  currency text not null default 'CNY',
  percent_of_order numeric(7,2),
  document_number text not null default '',
  document_date date,
  deferral_days integer not null default 0,
  submission_lead_days integer not null default 15,
  due_date date,
  submit_by_date date,
  status text not null default 'planned',
  paid_amount numeric(16,2) not null default 0,
  paid_at date,
  payment_reference text not null default '',
  fee_amount numeric(16,2) not null default 0,
  exchange_rate numeric(18,6),
  attachment_url text not null default '',
  notes text not null default '',
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.payments add column if not exists payment_number text not null default '';
alter table public.payments add column if not exists pi_id uuid references public.pi_records(id) on delete set null;
alter table public.payments add column if not exists product_name text not null default '';
alter table public.payments add column if not exists purpose text not null default '';
alter table public.payments add column if not exists responsible text not null default '';
alter table public.payments add column if not exists attachments jsonb not null default '[]'::jsonb;

update public.payments set payment_number = 'PAY-' || upper(left(replace(id::text,'-',''), 10)) where payment_number = '';
update public.payments set status = case
  when paid_amount >= amount then 'paid'
  when due_date is not null and due_date < current_date and paid_amount < amount then 'overdue'
  when paid_amount > 0 then 'partial'
  else 'planned'
end where status not in ('planned','partial','paid','overdue','cancelled');

alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check check (status in ('planned','partial','paid','overdue','cancelled'));
alter table public.payments drop constraint if exists payments_attachments_array_check;
alter table public.payments add constraint payments_attachments_array_check check (jsonb_typeof(attachments) = 'array');
create unique index if not exists payments_payment_number_unique on public.payments(payment_number) where payment_number <> '';
create index if not exists payments_pi_id_v3_idx on public.payments(pi_id);

create or replace function public.touch_payment()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  new.request_id = null;
  new.request_number = coalesce(new.pi_number, '');
  new.paid_amount = round(new.amount * coalesce(new.percent_of_order, 0) / 100.0, 2);
  new.submit_by_date = case when new.due_date is null then null else new.due_date - coalesce(new.submission_lead_days, 15) end;
  if new.status <> 'cancelled' then
    new.status = case
      when new.amount > 0 and new.paid_amount >= new.amount then 'paid'
      when new.due_date is not null and current_date > new.due_date and new.paid_amount < new.amount then 'overdue'
      when new.paid_amount > 0 then 'partial'
      else 'planned'
    end;
  end if;
  return new;
end;
$$;
drop trigger if exists touch_payment on public.payments;
create trigger touch_payment before insert or update on public.payments for each row execute function public.touch_payment();

-- Unified activity feed for the dashboard.
create table if not exists public.activity_log (
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_id uuid,
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  object_label text not null default '',
  actor_id uuid,
  actor_email text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_log_created_idx on public.activity_log(created_at desc);
create index if not exists activity_log_entity_idx on public.activity_log(entity_type, entity_id);

create or replace function public.audit_violet_ledger_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  payload jsonb;
  previous jsonb;
  label text;
  email_value text;
begin
  payload = case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  previous = case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end;
  label = coalesce(payload->>'request_number', payload->>'pi_number', payload->>'payment_number', payload->>'internal_number', payload->>'article', payload->>'id', 'Запись');
  select email into email_value from public.profiles where id = auth.uid();
  insert into public.activity_log(entity_type,entity_id,action,object_label,actor_id,actor_email,old_data,new_data)
  values(tg_table_name,(payload->>'id')::uuid,tg_op,label,auth.uid(),email_value,previous,case when tg_op in ('INSERT','UPDATE') then payload else null end);
  return coalesce(new,old);
end;
$$;

drop trigger if exists activity_requests on public.requests;
create trigger activity_requests after insert or update or delete on public.requests for each row execute function public.audit_violet_ledger_change();
drop trigger if exists activity_pi_records on public.pi_records;
create trigger activity_pi_records after insert or update or delete on public.pi_records for each row execute function public.audit_violet_ledger_change();
drop trigger if exists activity_manual_logistics on public.manual_logistics;
create trigger activity_manual_logistics after insert or update or delete on public.manual_logistics for each row execute function public.audit_violet_ledger_change();
drop trigger if exists activity_payments on public.payments;
create trigger activity_payments after insert or update or delete on public.payments for each row execute function public.audit_violet_ledger_change();

-- RLS: viewers read, admins and editors manage operational data.
alter table public.pi_records enable row level security;
alter table public.activity_log enable row level security;
alter table public.manual_logistics enable row level security;
alter table public.payments enable row level security;

drop policy if exists "team reads pi records" on public.pi_records;
drop policy if exists "editors create pi records" on public.pi_records;
drop policy if exists "editors update pi records" on public.pi_records;
drop policy if exists "editors delete pi records" on public.pi_records;
create policy "team reads pi records" on public.pi_records for select to authenticated using (public.current_user_role() is not null);
create policy "editors create pi records" on public.pi_records for insert to authenticated with check (public.current_user_role() in ('admin','editor') and created_by=auth.uid() and updated_by=auth.uid());
create policy "editors update pi records" on public.pi_records for update to authenticated using (public.current_user_role() in ('admin','editor')) with check (public.current_user_role() in ('admin','editor') and updated_by=auth.uid());
create policy "editors delete pi records" on public.pi_records for delete to authenticated using (public.current_user_role() in ('admin','editor'));

drop policy if exists "team reads activity" on public.activity_log;
create policy "team reads activity" on public.activity_log for select to authenticated using (public.current_user_role() is not null);

drop policy if exists "team reads manual logistics" on public.manual_logistics;
create policy "team reads manual logistics" on public.manual_logistics for select to authenticated using (public.current_user_role() is not null);
drop policy if exists "team reads payments" on public.payments;
create policy "team reads payments" on public.payments for select to authenticated using (public.current_user_role() is not null);

drop policy if exists "admins create requests" on public.requests;
drop policy if exists "admins update requests" on public.requests;
drop policy if exists "admins delete requests" on public.requests;
drop policy if exists "editors create requests" on public.requests;
drop policy if exists "editors update requests" on public.requests;
drop policy if exists "editors delete requests" on public.requests;
create policy "editors create requests" on public.requests for insert to authenticated with check (public.current_user_role() in ('admin','editor') and created_by=auth.uid() and updated_by=auth.uid());
create policy "editors update requests" on public.requests for update to authenticated using (public.current_user_role() in ('admin','editor')) with check (public.current_user_role() in ('admin','editor') and updated_by=auth.uid());
create policy "editors delete requests" on public.requests for delete to authenticated using (public.current_user_role() in ('admin','editor'));

drop policy if exists "admins create manual logistics" on public.manual_logistics;
drop policy if exists "admins update manual logistics" on public.manual_logistics;
drop policy if exists "admins delete manual logistics" on public.manual_logistics;
drop policy if exists "editors create manual logistics" on public.manual_logistics;
drop policy if exists "editors update manual logistics" on public.manual_logistics;
drop policy if exists "editors delete manual logistics" on public.manual_logistics;
create policy "editors create manual logistics" on public.manual_logistics for insert to authenticated with check (public.current_user_role() in ('admin','editor') and created_by=auth.uid() and updated_by=auth.uid());
create policy "editors update manual logistics" on public.manual_logistics for update to authenticated using (public.current_user_role() in ('admin','editor')) with check (public.current_user_role() in ('admin','editor') and updated_by=auth.uid());
create policy "editors delete manual logistics" on public.manual_logistics for delete to authenticated using (public.current_user_role() in ('admin','editor'));

drop policy if exists "admins create payments" on public.payments;
drop policy if exists "admins update payments" on public.payments;
drop policy if exists "admins delete payments" on public.payments;
drop policy if exists "editors create payments" on public.payments;
drop policy if exists "editors update payments" on public.payments;
drop policy if exists "editors delete payments" on public.payments;
create policy "editors create payments" on public.payments for insert to authenticated with check (public.current_user_role() in ('admin','editor') and created_by=auth.uid() and updated_by=auth.uid());
create policy "editors update payments" on public.payments for update to authenticated using (public.current_user_role() in ('admin','editor')) with check (public.current_user_role() in ('admin','editor') and updated_by=auth.uid());
create policy "editors delete payments" on public.payments for delete to authenticated using (public.current_user_role() in ('admin','editor'));

grant select,insert,update,delete on public.pi_records to authenticated;
grant select on public.activity_log to authenticated;
grant usage,select on sequence public.activity_log_id_seq to authenticated;

-- Private document storage shared by the authenticated team.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('violet-ledger-files','violet-ledger-files',false,52428800,null)
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit;

drop policy if exists "team reads violet ledger files" on storage.objects;
drop policy if exists "editors create violet ledger files" on storage.objects;
drop policy if exists "editors update violet ledger files" on storage.objects;
drop policy if exists "editors delete violet ledger files" on storage.objects;
create policy "team reads violet ledger files" on storage.objects for select to authenticated using (bucket_id='violet-ledger-files' and public.current_user_role() is not null);
create policy "editors create violet ledger files" on storage.objects for insert to authenticated with check (bucket_id='violet-ledger-files' and public.current_user_role() in ('admin','editor'));
create policy "editors update violet ledger files" on storage.objects for update to authenticated using (bucket_id='violet-ledger-files' and public.current_user_role() in ('admin','editor')) with check (bucket_id='violet-ledger-files' and public.current_user_role() in ('admin','editor'));
create policy "editors delete violet ledger files" on storage.objects for delete to authenticated using (bucket_id='violet-ledger-files' and public.current_user_role() in ('admin','editor'));

do $$
declare table_name_value text;
begin
  foreach table_name_value in array array['pi_records','manual_logistics','payments','activity_log'] loop
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=table_name_value) then
      execute format('alter publication supabase_realtime add table public.%I', table_name_value);
    end if;
  end loop;
end
$$;

commit;

select 'Violet Ledger upgrade completed' as result;

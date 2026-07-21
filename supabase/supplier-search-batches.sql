-- Violet Ledger: supplier search package registry
-- Run in Supabase SQL Editor. Repeat-safe.

create extension if not exists pgcrypto;

create table if not exists public.supplier_search_batches (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null,
  category_level_3 text not null,
  batch_number smallint not null check (batch_number between 1 and 6),
  batch_name text not null,
  links jsonb not null default '[]'::jsonb check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) between 1 and 5),
  source_file_name text not null default '',
  supplier_name text not null default '',
  sent_at date,
  status text not null default 'not_sent' check (status in ('not_sent','sent','response_received')),
  notes text not null default '',
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (import_id, batch_number)
);

create index if not exists supplier_search_batches_import_idx on public.supplier_search_batches(import_id);
create index if not exists supplier_search_batches_category_idx on public.supplier_search_batches(category_level_3);
create index if not exists supplier_search_batches_supplier_idx on public.supplier_search_batches(supplier_name);
create index if not exists supplier_search_batches_status_idx on public.supplier_search_batches(status);
create index if not exists supplier_search_batches_created_idx on public.supplier_search_batches(created_at desc);

create or replace function public.touch_supplier_search_batch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_supplier_search_batch on public.supplier_search_batches;
create trigger touch_supplier_search_batch
before update on public.supplier_search_batches
for each row execute function public.touch_supplier_search_batch();

alter table public.supplier_search_batches enable row level security;

drop policy if exists "team reads supplier search batches" on public.supplier_search_batches;
drop policy if exists "editors create supplier search batches" on public.supplier_search_batches;
drop policy if exists "editors update supplier search batches" on public.supplier_search_batches;
drop policy if exists "editors delete supplier search batches" on public.supplier_search_batches;

create policy "team reads supplier search batches"
on public.supplier_search_batches for select
to authenticated
using (public.current_user_role() is not null);

create policy "editors create supplier search batches"
on public.supplier_search_batches for insert
to authenticated
with check (
  public.current_user_role()::text in ('admin','editor')
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

create policy "editors update supplier search batches"
on public.supplier_search_batches for update
to authenticated
using (public.current_user_role()::text in ('admin','editor'))
with check (
  public.current_user_role()::text in ('admin','editor')
  and updated_by = auth.uid()
);

create policy "editors delete supplier search batches"
on public.supplier_search_batches for delete
to authenticated
using (public.current_user_role()::text in ('admin','editor'));

grant select, insert, update, delete on public.supplier_search_batches to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'supplier_search_batches'
  ) then
    alter publication supabase_realtime add table public.supplier_search_batches;
  end if;
end
$$;

select 'supplier_search_batches ready' as result;

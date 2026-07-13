-- Violet Ledger: independent logistics register
-- Run once in Supabase -> SQL Editor -> New query -> Run.
-- Repeat-safe: the script can be executed again after future updates.

create extension if not exists pgcrypto;

create table if not exists public.logistics_requests (
  id uuid primary key default gen_random_uuid(),
  article text not null,
  pi_number text not null,
  shipping_cost numeric(14,2) not null default 0 check (shipping_cost >= 0),
  transport_type text not null,
  volume_m3 numeric(12,3) not null default 0 check (volume_m3 >= 0),
  carrier text not null,
  supplier_name text not null,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists logistics_requests_pi_number_idx on public.logistics_requests (pi_number);
create index if not exists logistics_requests_article_idx on public.logistics_requests (article);
create index if not exists logistics_requests_supplier_idx on public.logistics_requests (supplier_name);
create index if not exists logistics_requests_transport_idx on public.logistics_requests (transport_type);

create or replace function public.touch_logistics_request()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_logistics_request on public.logistics_requests;
create trigger touch_logistics_request
before update on public.logistics_requests
for each row execute function public.touch_logistics_request();

alter table public.logistics_requests enable row level security;

drop policy if exists "team reads independent logistics" on public.logistics_requests;
drop policy if exists "admins create independent logistics" on public.logistics_requests;
drop policy if exists "admins update independent logistics" on public.logistics_requests;
drop policy if exists "admins delete independent logistics" on public.logistics_requests;

create policy "team reads independent logistics"
on public.logistics_requests for select
to authenticated
using (public.current_user_role() is not null);

create policy "admins create independent logistics"
on public.logistics_requests for insert
to authenticated
with check (
  public.current_user_role() = 'admin'
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

create policy "admins update independent logistics"
on public.logistics_requests for update
to authenticated
using (public.current_user_role() = 'admin')
with check (
  public.current_user_role() = 'admin'
  and updated_by = auth.uid()
);

create policy "admins delete independent logistics"
on public.logistics_requests for delete
to authenticated
using (public.current_user_role() = 'admin');

grant select, insert, update, delete on public.logistics_requests to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'logistics_requests'
  ) then
    alter publication supabase_realtime add table public.logistics_requests;
  end if;
end
$$;

select 'logistics_requests ready' as result;

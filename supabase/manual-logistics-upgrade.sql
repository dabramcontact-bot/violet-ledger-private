-- Independent manual logistics register for Violet Ledger
-- Run in Supabase SQL Editor. Repeat-safe.

create extension if not exists pgcrypto;

create table if not exists public.manual_logistics (
  id uuid primary key default gen_random_uuid(),
  article text not null,
  pi_number text not null,
  ready_date date,
  departure_date date,
  warehouse_date date,
  logistics_company text not null,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists manual_logistics_article_idx on public.manual_logistics(article);
create index if not exists manual_logistics_pi_number_idx on public.manual_logistics(pi_number);
create index if not exists manual_logistics_company_idx on public.manual_logistics(logistics_company);

create or replace function public.touch_manual_logistics()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_manual_logistics on public.manual_logistics;
create trigger touch_manual_logistics
before update on public.manual_logistics
for each row execute function public.touch_manual_logistics();

alter table public.manual_logistics enable row level security;

drop policy if exists "team reads manual logistics" on public.manual_logistics;
drop policy if exists "admins create manual logistics" on public.manual_logistics;
drop policy if exists "admins update manual logistics" on public.manual_logistics;
drop policy if exists "admins delete manual logistics" on public.manual_logistics;

create policy "team reads manual logistics"
on public.manual_logistics for select
to authenticated
using (public.current_user_role() is not null);

create policy "admins create manual logistics"
on public.manual_logistics for insert
to authenticated
with check (
  public.current_user_role() = 'admin'
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

create policy "admins update manual logistics"
on public.manual_logistics for update
to authenticated
using (public.current_user_role() = 'admin')
with check (
  public.current_user_role() = 'admin'
  and updated_by = auth.uid()
);

create policy "admins delete manual logistics"
on public.manual_logistics for delete
to authenticated
using (public.current_user_role() = 'admin');

grant select, insert, update, delete on public.manual_logistics to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'manual_logistics'
  ) then
    alter publication supabase_realtime add table public.manual_logistics;
  end if;
end
$$;

select 'manual_logistics ready' as result;

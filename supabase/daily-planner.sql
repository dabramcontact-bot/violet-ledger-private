-- Violet Ledger: shared daily planner
-- Run in Supabase SQL Editor. Repeat-safe.

create extension if not exists pgcrypto;

create table if not exists public.daily_planner_tasks (
  id uuid primary key default gen_random_uuid(),
  task_date date not null,
  start_time time,
  end_time time,
  title text not null,
  description text not null default '',
  category text not null default '',
  assignee_email text not null default '',
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'planned' check (status in ('planned','in_progress','done','cancelled')),
  completed_at timestamptz,
  sort_order integer not null default 0,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time is null or start_time is null or end_time >= start_time)
);

create index if not exists daily_planner_tasks_date_idx on public.daily_planner_tasks(task_date);
create index if not exists daily_planner_tasks_status_idx on public.daily_planner_tasks(status);
create index if not exists daily_planner_tasks_assignee_idx on public.daily_planner_tasks(assignee_email);
create index if not exists daily_planner_tasks_date_time_idx on public.daily_planner_tasks(task_date, start_time);

create or replace function public.touch_daily_planner_task()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  if new.status = 'done' and old.status is distinct from 'done' and new.completed_at is null then
    new.completed_at = now();
  elsif new.status <> 'done' then
    new.completed_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists touch_daily_planner_task on public.daily_planner_tasks;
create trigger touch_daily_planner_task
before update on public.daily_planner_tasks
for each row execute function public.touch_daily_planner_task();

alter table public.daily_planner_tasks enable row level security;

drop policy if exists "team reads daily planner" on public.daily_planner_tasks;
drop policy if exists "editors create daily planner" on public.daily_planner_tasks;
drop policy if exists "editors update daily planner" on public.daily_planner_tasks;
drop policy if exists "editors delete daily planner" on public.daily_planner_tasks;

create policy "team reads daily planner"
on public.daily_planner_tasks for select
to authenticated
using (public.current_user_role() is not null);

create policy "editors create daily planner"
on public.daily_planner_tasks for insert
to authenticated
with check (
  public.current_user_role()::text in ('admin','editor')
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

create policy "editors update daily planner"
on public.daily_planner_tasks for update
to authenticated
using (public.current_user_role()::text in ('admin','editor'))
with check (
  public.current_user_role()::text in ('admin','editor')
  and updated_by = auth.uid()
);

create policy "editors delete daily planner"
on public.daily_planner_tasks for delete
to authenticated
using (public.current_user_role()::text in ('admin','editor'));

grant select, insert, update, delete on public.daily_planner_tasks to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'daily_planner_tasks'
  ) then
    alter publication supabase_realtime add table public.daily_planner_tasks;
  end if;
end
$$;

select 'daily_planner_tasks ready' as result;

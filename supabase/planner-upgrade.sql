-- Violet Ledger: shared team planner.
-- Run once in Supabase -> SQL Editor. The migration is repeat-safe.

begin;

create extension if not exists pgcrypto;

create table if not exists public.planner_tasks (
  id uuid primary key default gen_random_uuid(),
  task_number text not null default '',
  title text not null,
  description text not null default '',
  status text not null default 'todo',
  priority text not null default 'normal',
  category text not null default 'Общее',
  assignee_id uuid references public.profiles(id) on delete set null,
  start_date date,
  due_date date,
  completed_at timestamptz,
  related_ref text not null default '',
  tags text[] not null default '{}'::text[],
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.planner_tasks drop constraint if exists planner_tasks_status_check;
alter table public.planner_tasks add constraint planner_tasks_status_check
  check (status in ('backlog','todo','in_progress','review','done'));

alter table public.planner_tasks drop constraint if exists planner_tasks_priority_check;
alter table public.planner_tasks add constraint planner_tasks_priority_check
  check (priority in ('low','normal','high','urgent'));

alter table public.planner_tasks drop constraint if exists planner_tasks_dates_check;
alter table public.planner_tasks add constraint planner_tasks_dates_check
  check (start_date is null or due_date is null or due_date >= start_date);

create unique index if not exists planner_tasks_number_unique
  on public.planner_tasks(task_number) where task_number <> '';
create index if not exists planner_tasks_status_idx on public.planner_tasks(status);
create index if not exists planner_tasks_assignee_idx on public.planner_tasks(assignee_id);
create index if not exists planner_tasks_due_date_idx on public.planner_tasks(due_date);
create index if not exists planner_tasks_updated_idx on public.planner_tasks(updated_at desc);
create index if not exists planner_tasks_tags_gin_idx on public.planner_tasks using gin(tags);

create or replace function public.touch_planner_task()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  if new.task_number = '' then
    new.task_number = 'TASK-' || upper(left(replace(new.id::text, '-', ''), 10));
  end if;
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.completed_at = now();
  elsif new.status <> 'done' then
    new.completed_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists touch_planner_task on public.planner_tasks;
create trigger touch_planner_task
  before insert or update on public.planner_tasks
  for each row execute function public.touch_planner_task();

alter table public.planner_tasks enable row level security;

drop policy if exists "team reads planner tasks" on public.planner_tasks;
drop policy if exists "editors create planner tasks" on public.planner_tasks;
drop policy if exists "editors update planner tasks" on public.planner_tasks;
drop policy if exists "editors delete planner tasks" on public.planner_tasks;

create policy "team reads planner tasks" on public.planner_tasks
  for select to authenticated
  using (public.current_user_role() is not null);

create policy "editors create planner tasks" on public.planner_tasks
  for insert to authenticated
  with check (
    public.current_user_role() in ('admin','editor')
    and created_by = auth.uid()
    and updated_by = auth.uid()
  );

create policy "editors update planner tasks" on public.planner_tasks
  for update to authenticated
  using (public.current_user_role() in ('admin','editor'))
  with check (
    public.current_user_role() in ('admin','editor')
    and updated_by = auth.uid()
  );

create policy "editors delete planner tasks" on public.planner_tasks
  for delete to authenticated
  using (public.current_user_role() in ('admin','editor'));

grant select, insert, update, delete on public.planner_tasks to authenticated;

do $$
begin
  if to_regprocedure('public.audit_violet_ledger_change()') is not null
     and not exists (select 1 from pg_trigger where tgname = 'activity_planner_tasks') then
    create trigger activity_planner_tasks
      after insert or update or delete on public.planner_tasks
      for each row execute function public.audit_violet_ledger_change();
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'planner_tasks'
  ) then
    alter publication supabase_realtime add table public.planner_tasks;
  end if;
end
$$;

commit;

select 'Violet Ledger planner upgrade completed' as result;

-- Добавляет детальный чек-лист подготовки и отгрузки из рабочего регламента.
-- Существующие записи, роли и RLS-политики не изменяются.

begin;

alter table public.requests
  add column if not exists workflow_steps jsonb not null default '{}'::jsonb;

alter table public.requests
  drop constraint if exists requests_workflow_steps_object_check;

alter table public.requests
  add constraint requests_workflow_steps_object_check
  check (jsonb_typeof(workflow_steps) = 'object');

commit;

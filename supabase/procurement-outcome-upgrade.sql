-- Добавляет артикулы, этап «Предложено Николаю» и причины неуспешной сделки.
-- Миграция не удаляет и не перезаписывает существующие записи.

begin;

alter table public.requests
  add column if not exists article_numbers text not null default '',
  add column if not exists proposed_to_nikolai boolean not null default false,
  add column if not exists proposed_to_nikolai_at date,
  add column if not exists price_not_viable boolean not null default false,
  add column if not exists not_approved boolean not null default false;

alter table public.requests
  drop constraint if exists requests_status_check;

alter table public.requests
  add constraint requests_status_check
  check (status in (
    'request',
    'offer',
    'calculation',
    'proposed',
    'pi_sent',
    'revision',
    'signed',
    'unsuccessful'
  ));

commit;

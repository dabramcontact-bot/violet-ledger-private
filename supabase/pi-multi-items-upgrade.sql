-- Violet Ledger: several nomenclatures inside one PI.
-- Run once in Supabase -> SQL Editor. The script is repeat-safe.

begin;

alter table public.pi_records
  add column if not exists items jsonb not null default '[]'::jsonb;

-- Convert every existing one-product PI into a PI with one line item.
update public.pi_records pi
set items = jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
  'item_id', 'ITEM-' || upper(left(pi.id::text, 8)),
  'request_id', pi.request_id,
  'request_number', coalesce((select request_number from public.requests where id = pi.request_id), ''),
  'product_name', pi.product_name,
  'article', pi.article,
  'quantity', pi.quantity,
  'unit', 'шт',
  'unit_price', pi.unit_price,
  'total_amount', pi.total_amount,
  'payment_terms', pi.payment_terms,
  'production_days', pi.production_days,
  'characteristics', pi.characteristics,
  'packaging', pi.packaging,
  'dimensions', pi.dimensions,
  'weight', pi.weight
)))
where items = '[]'::jsonb;

alter table public.pi_records
  drop constraint if exists pi_records_items_array_check;

alter table public.pi_records
  add constraint pi_records_items_array_check
  check (jsonb_typeof(items) = 'array');

create index if not exists pi_records_items_gin_idx
  on public.pi_records using gin (items);

comment on column public.pi_records.items is
  'Товарные позиции PI: номенклатура, количество, цена, сумма и индивидуальные условия.';

commit;

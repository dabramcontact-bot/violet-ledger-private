-- Violet Ledger — единое обновление действующей базы.
-- Добавляет логистику и оставляет изменение данных только администраторам.
-- Можно безопасно выполнить повторно.

begin;

alter table public.requests
  add column if not exists shipment_status text not null default 'not_shipped',
  add column if not exists logistics_company text not null default '',
  add column if not exists transit_started_at date,
  add column if not exists expected_warehouse_at date,
  add column if not exists warehouse_arrived_at date;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'requests_shipment_status_check'
  ) then
    alter table public.requests
      add constraint requests_shipment_status_check
      check (shipment_status in ('not_shipped', 'in_transit', 'arrived'));
  end if;
end $$;

create index if not exists requests_shipment_status_idx
  on public.requests (shipment_status);

create index if not exists requests_logistics_company_idx
  on public.requests (logistics_company)
  where logistics_company <> '';

drop policy if exists "editors create requests" on public.requests;
drop policy if exists "editors update requests" on public.requests;
drop policy if exists "editors delete requests" on public.requests;
drop policy if exists "admins create requests" on public.requests;
drop policy if exists "admins update requests" on public.requests;
drop policy if exists "admins delete requests" on public.requests;

create policy "admins create requests"
on public.requests for insert to authenticated
with check (
  public.current_user_role() = 'admin'
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

create policy "admins update requests"
on public.requests for update to authenticated
using (public.current_user_role() = 'admin')
with check (
  public.current_user_role() = 'admin'
  and updated_by = auth.uid()
);

create policy "admins delete requests"
on public.requests for delete to authenticated
using (public.current_user_role() = 'admin');

update public.allowed_users set role = 'viewer' where role = 'editor';
update public.profiles set role = 'viewer', updated_at = now() where role = 'editor';

commit;

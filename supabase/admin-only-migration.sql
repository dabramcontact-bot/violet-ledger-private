-- Violet Ledger — одноразовое обновление действующей базы.
-- После выполнения создавать и изменять запросы сможет только администратор.

begin;

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

-- Старую роль editor переводим в безопасный режим просмотра.
update public.allowed_users set role = 'viewer' where role = 'editor';
update public.profiles set role = 'viewer', updated_at = now() where role = 'editor';

commit;

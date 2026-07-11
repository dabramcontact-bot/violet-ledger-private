-- Violet Ledger: безопасная многопользовательская схема
-- Запустите целиком в Supabase → SQL Editor → New query → Run.

create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'editor', 'viewer');

create table public.allowed_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  role public.app_role not null default 'viewer',
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique,
  category text not null,
  product_name text not null,
  agent_name text not null,
  request_sent_at date not null,
  offer_received boolean not null default false,
  offer_received_at date,
  included_calculation boolean not null default false,
  pi_sent boolean not null default false,
  pi_sent_at date,
  pi_revision boolean not null default false,
  pi_revision_at date,
  pi_signed boolean not null default false,
  pi_signed_at date,
  status text not null default 'request' check (status in ('request','offer','calculation','pi_sent','revision','signed')),
  notes text not null default '',
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  request_id uuid,
  request_number text,
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  actor_id uuid,
  actor_email text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.current_user_role()
returns public.app_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare invited public.allowed_users%rowtype;
begin
  select * into invited from public.allowed_users where email = lower(new.email);
  if invited.id is null then
    raise exception 'Email is not invited';
  end if;
  insert into public.profiles (id,email,role) values (new.id,lower(new.email),invited.role);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.sync_invited_role()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  update public.profiles set role = new.role, updated_at = now() where email = new.email;
  return new;
end;
$$;
create trigger sync_invited_role after update of role on public.allowed_users for each row execute function public.sync_invited_role();

create or replace function public.touch_request()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create trigger touch_request before update on public.requests for each row execute function public.touch_request();

create or replace function public.audit_request_change()
returns trigger language plpgsql security definer set search_path = public
as $$
declare p_email text;
begin
  select email into p_email from public.profiles where id = auth.uid();
  insert into public.audit_log(request_id,request_number,action,actor_id,actor_email,old_data,new_data)
  values(coalesce(new.id,old.id),coalesce(new.request_number,old.request_number),tg_op,auth.uid(),p_email,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end);
  return coalesce(new,old);
end;
$$;
create trigger audit_requests after insert or update or delete on public.requests for each row execute function public.audit_request_change();

alter table public.allowed_users enable row level security;
alter table public.profiles enable row level security;
alter table public.requests enable row level security;
alter table public.audit_log enable row level security;

create policy "profiles readable by team" on public.profiles for select to authenticated using (public.current_user_role() is not null);
create policy "admins update profiles" on public.profiles for update to authenticated using (public.current_user_role()='admin') with check (public.current_user_role()='admin');

create policy "admins manage invitations" on public.allowed_users for all to authenticated using (public.current_user_role()='admin') with check (public.current_user_role()='admin');
create policy "user can see own invitation" on public.allowed_users for select to authenticated using (email=(select email from auth.users where id=auth.uid()));

create policy "team reads requests" on public.requests for select to authenticated using (public.current_user_role() is not null);
create policy "admins create requests" on public.requests for insert to authenticated with check (public.current_user_role()='admin' and created_by=auth.uid() and updated_by=auth.uid());
create policy "admins update requests" on public.requests for update to authenticated using (public.current_user_role()='admin') with check (public.current_user_role()='admin' and updated_by=auth.uid());
create policy "admins delete requests" on public.requests for delete to authenticated using (public.current_user_role()='admin');
create policy "team reads audit" on public.audit_log for select to authenticated using (public.current_user_role() is not null);

grant usage on schema public to authenticated;
grant select on public.profiles, public.audit_log to authenticated;
grant select,insert,update,delete on public.requests to authenticated;
grant select,insert,update,delete on public.allowed_users to authenticated;
grant usage,select on sequence public.audit_log_id_seq to authenticated;

alter publication supabase_realtime add table public.requests;

-- Первый администратор. Перед запуском замените REPLACE_WITH_ADMIN_EMAIL
-- на email администратора (в нижнем регистре).
insert into public.allowed_users(email,role)
values ('REPLACE_WITH_ADMIN_EMAIL','admin')
on conflict (email) do update set role=excluded.role;

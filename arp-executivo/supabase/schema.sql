-- Snapshots imutáveis: as 26 colunas e todas as células originais são preservadas.
create table public.arp_datasets (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  headers jsonb not null check (jsonb_typeof(headers) = 'array' and jsonb_array_length(headers) = 26),
  rows jsonb not null check (jsonb_typeof(rows) = 'array'),
  row_count integer not null check (row_count > 0 and row_count = jsonb_array_length(rows)),
  content_hash text not null unique,
  created_at timestamptz not null default now()
);
create table public.arp_workspace (
  id boolean primary key default true check (id),
  current_dataset uuid not null references public.arp_datasets(id),
  version integer not null default 1 check (version > 0)
);
create index arp_datasets_created_at_idx on public.arp_datasets(created_at desc);
alter table public.arp_datasets enable row level security;
alter table public.arp_workspace enable row level security;
-- Acesso exclusivo pelo backend da Edge Function. Nenhuma leitura ou escrita pública.
revoke all on public.arp_datasets, public.arp_workspace from anon, authenticated;
grant select, insert on public.arp_datasets to service_role;
grant select, insert, update on public.arp_workspace to service_role;
create policy arp_datasets_backend_only on public.arp_datasets for all to service_role using (true) with check (true);
create policy arp_workspace_backend_only on public.arp_workspace for all to service_role using (true) with check (true);


-- Members are managed exclusively by the authenticated server function.
create table if not exists public.arp_members (
 email text primary key check(email=lower(email)),
 role text not null check(role in ('admin','viewer')),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.arp_members enable row level security;
revoke all on public.arp_members from public, anon, authenticated;
grant all on public.arp_members to service_role;
drop policy if exists arp_members_service on public.arp_members;
create policy arp_members_service on public.arp_members for all to service_role using(true) with check(true);

-- Solicitações e limites do acesso por código
create table if not exists public.arp_access_requests (
 email text primary key check (email=lower(email) and char_length(email)<=254),
 status text not null default 'pending' check (status in ('pending','approved','denied')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz, reviewed_by text
);
create table if not exists public.arp_access_limits (
 key text primary key check (char_length(key)<=200), hits integer not null default 1,
 created_at timestamptz not null default now()
);
alter table public.arp_access_requests enable row level security;
alter table public.arp_access_limits enable row level security;
revoke all on public.arp_access_requests,public.arp_access_limits from public,anon,authenticated;
grant all on public.arp_access_requests,public.arp_access_limits to service_role;
create policy arp_requests_service on public.arp_access_requests for all to service_role using (true) with check (true);
create policy arp_limits_service on public.arp_access_limits for all to service_role using (true) with check (true);
create or replace function public.arp_check_access_rate(p_key text,p_limit integer)
returns boolean language plpgsql security invoker set search_path='' as $$
declare v_hits integer;
begin
 if p_limit<1 or p_limit>60 then return false; end if;
 insert into public.arp_access_limits(key) values(p_key)
 on conflict(key) do update set hits=public.arp_access_limits.hits+1 returning hits into v_hits;
 return v_hits<=p_limit;
end;
$$;
create or replace function public.arp_review_access(p_email text,p_decision text,p_actor text)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_decision not in ('approved','denied') then raise exception 'Invalid decision'; end if;
 if exists(select 1 from public.arp_members where email=p_email and role='admin') then raise exception 'Administrator protected'; end if;
 update public.arp_access_requests set status=p_decision,reviewed_at=now(),reviewed_by=p_actor where email=p_email and status='pending';
 if not found then raise exception 'Request not pending'; end if;
 if p_decision='approved' then
  insert into public.arp_members(email,role,active) values(p_email,'viewer',true)
  on conflict(email) do update set active=true where public.arp_members.role='viewer';
 end if;
end;
$$;
revoke all on function public.arp_check_access_rate(text,integer),public.arp_review_access(text,text,text) from public,anon,authenticated;
grant execute on function public.arp_check_access_rate(text,integer),public.arp_review_access(text,text,text) to service_role;

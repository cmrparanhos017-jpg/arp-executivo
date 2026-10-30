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

-- A data só é preenchida por uma importação concluída. Não usar a data do deploy.
alter table public.arp_workspace add column if not exists last_imported_at timestamptz;

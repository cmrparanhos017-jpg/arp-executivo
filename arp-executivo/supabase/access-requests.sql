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

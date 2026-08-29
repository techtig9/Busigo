-- BusiGo Phase 13 — Security, Compliance & Governance
create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade not null,
  event_type text not null, severity text not null default 'info' check (severity in ('info','warning','critical')),
  source text not null default 'application', ip_hash text, user_agent_hash text, metadata jsonb not null default '{}'::jsonb,
  resolved boolean not null default false, created_at timestamptz not null default now()
);
create index if not exists security_events_user_created_idx on public.security_events(user_id,created_at desc);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade not null,
  action text not null, resource_type text, resource_id text, outcome text not null default 'success' check (outcome in ('success','denied','failed')),
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists audit_logs_user_created_idx on public.audit_logs(user_id,created_at desc);

create table if not exists public.governance_policies (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade not null,
  name text not null, policy_type text not null, enabled boolean not null default true,
  rules jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists governance_policies_user_enabled_idx on public.governance_policies(user_id,enabled);

create table if not exists public.data_requests (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade not null,
  request_type text not null check (request_type in ('export','delete','access_review')),
  status text not null default 'requested' check (status in ('requested','processing','completed','rejected')),
  notes text, completed_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists data_requests_user_created_idx on public.data_requests(user_id,created_at desc);

create table if not exists public.access_reviews (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade not null,
  review_type text not null default 'agent_permissions', scope jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','approved','changes_required','closed')),
  reviewed_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists access_reviews_user_status_idx on public.access_reviews(user_id,status);

alter table public.security_events enable row level security;
alter table public.audit_logs enable row level security;
alter table public.governance_policies enable row level security;
alter table public.data_requests enable row level security;
alter table public.access_reviews enable row level security;

create policy "own security events" on public.security_events for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own audit logs" on public.audit_logs for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own governance policies" on public.governance_policies for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own data requests" on public.data_requests for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own access reviews" on public.access_reviews for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

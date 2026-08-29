-- BusiGo Phase 11 — Real-Time Business Intelligence & Business Digital Twin
-- business_events already exists (created by schema.sql, without the columns
-- below) by the time this migration runs in the documented schema.sql-then-
-- migrations deployment order, so `create table if not exists` silently no-ops
-- and the index creation two lines down used to fail with
-- "column occurred_at does not exist". Adding the columns explicitly makes
-- this correct regardless of whether business_events pre-existed or not.
create table if not exists public.business_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  source text,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  entity_type text,
  entity_id text,
  created_at timestamptz not null default now()
);
alter table public.business_events add column if not exists external_id text;
alter table public.business_events add column if not exists occurred_at timestamptz not null default now();
alter table public.business_events add column if not exists processed boolean not null default false;
alter table public.business_events alter column source set not null;
create index if not exists business_events_user_time_idx on public.business_events(user_id, occurred_at desc);
create index if not exists business_events_user_type_idx on public.business_events(user_id, event_type, occurred_at desc);
create unique index if not exists business_events_external_unique on public.business_events(user_id, source, external_id) where external_id is not null;

create table if not exists public.business_intelligence_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  snapshot_at timestamptz not null default now(),
  health_score numeric not null default 0,
  revenue_signal numeric,
  sales_signal numeric,
  customer_signal numeric,
  operations_signal numeric,
  marketing_signal numeric,
  finance_signal numeric,
  summary text,
  drivers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists bi_snapshots_user_time_idx on public.business_intelligence_snapshots(user_id, snapshot_at desc);

create table if not exists public.business_anomalies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  metric text not null,
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  direction text not null default 'down' check (direction in ('up','down','change')),
  observed_value numeric,
  expected_value numeric,
  deviation_pct numeric,
  status text not null default 'open' check (status in ('open','acknowledged','resolved','dismissed')),
  explanation text,
  evidence jsonb not null default '{}',
  detected_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists anomalies_user_status_idx on public.business_anomalies(user_id, status, detected_at desc);

create table if not exists public.business_entity_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  entity_type text not null,
  entity_id text not null,
  state jsonb not null default '{}',
  last_event_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(user_id, entity_type, entity_id)
);
create index if not exists entity_state_user_type_idx on public.business_entity_state(user_id, entity_type);

-- business_alerts is also defined by phase6_autonomous_ops.sql (which runs
-- before this file) with a narrower column set; create-if-not-exists no-ops
-- against that table, so add phase11's extra columns explicitly and make the
-- policy idempotent instead of colliding with phase6's identically-named one.
create table if not exists public.business_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  source text not null default 'business_intelligence',
  created_at timestamptz not null default now()
);
alter table public.business_alerts add column if not exists body text not null default '';
alter table public.business_alerts add column if not exists action_url text;
alter table public.business_alerts add column if not exists acknowledged_at timestamptz;
create index if not exists business_alerts_user_time_idx on public.business_alerts(user_id, created_at desc);

alter table public.business_alerts enable row level security;

drop policy if exists "own business alerts" on public.business_alerts;
create policy "own business alerts" on public.business_alerts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.business_events enable row level security;
alter table public.business_intelligence_snapshots enable row level security;
alter table public.business_anomalies enable row level security;
alter table public.business_entity_state enable row level security;

create policy "own business events" on public.business_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own intelligence snapshots" on public.business_intelligence_snapshots for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own business anomalies" on public.business_anomalies for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own entity state" on public.business_entity_state for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

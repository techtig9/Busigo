-- Phase 14: Scale, reliability and production infrastructure.
create table if not exists public.system_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','dead_letter','cancelled')),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists system_jobs_idempotency_idx on public.system_jobs(user_id, idempotency_key) where idempotency_key is not null;
create index if not exists system_jobs_queue_idx on public.system_jobs(status, available_at);

create table if not exists public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  request_hash text not null,
  response_status integer,
  response_body jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(user_id, key)
);

create table if not exists public.rate_limit_buckets (
  id uuid primary key default gen_random_uuid(),
  subject_key text not null,
  bucket_key text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0,
  limit_count integer not null,
  updated_at timestamptz not null default now(),
  unique(subject_key, bucket_key)
);

create table if not exists public.service_health_checks (
  id uuid primary key default gen_random_uuid(),
  service_name text not null,
  status text not null check (status in ('healthy','degraded','down','unknown')),
  latency_ms integer,
  details jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);
create index if not exists service_health_checks_service_idx on public.service_health_checks(service_name, checked_at desc);

create table if not exists public.dead_letter_jobs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.system_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  payload jsonb not null default '{}'::jsonb,
  replayed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_name text not null,
  metric_value numeric not null,
  dimensions jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);
create index if not exists platform_metrics_name_idx on public.platform_metrics(metric_name, recorded_at desc);

alter table public.system_jobs enable row level security;
alter table public.idempotency_keys enable row level security;
alter table public.rate_limit_buckets enable row level security;
alter table public.service_health_checks enable row level security;
alter table public.dead_letter_jobs enable row level security;
alter table public.platform_metrics enable row level security;

create policy "phase14 jobs owner" on public.system_jobs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "phase14 idempotency owner" on public.idempotency_keys for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "phase14 rate limit owner" on public.rate_limit_buckets for all using (false) with check (false);
create policy "phase14 health read authenticated" on public.service_health_checks for select using (auth.role() = 'authenticated');
create policy "phase14 health service write" on public.service_health_checks for all using (false) with check (false);
create policy "phase14 dead letter owner" on public.dead_letter_jobs for select using (auth.uid() = user_id);
create policy "phase14 metrics authenticated" on public.platform_metrics for select using (auth.role() = 'authenticated');

-- Service-role workers bypass RLS for queue, rate-limit, health and metrics writes.

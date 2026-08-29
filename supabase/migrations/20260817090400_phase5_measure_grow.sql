-- BusiGo Phase 5 — Measure & Grow
create table if not exists business_kpi_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  kpi_id uuid references business_kpis(id) on delete cascade not null,
  value numeric not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  source text not null default 'manual',
  metadata jsonb not null default '{}',
  created_at timestamptz default now()
);

create table if not exists business_outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  outcome_type text not null check (outcome_type in ('hours_saved','cost_saved','revenue_influenced','leads_recovered','tickets_resolved','invoices_collected','conversion_improved','retention_improved','other')),
  title text not null,
  value numeric not null default 0,
  unit text,
  source text not null default 'manual',
  evidence jsonb not null default '{}',
  occurred_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Compatibility: business_outcomes is created by the Business OS migration.
-- Add Phase 5 fields when that table already exists so migrations remain additive/idempotent.
alter table if exists business_outcomes add column if not exists title text;
alter table if exists business_outcomes add column if not exists source text not null default 'manual';
alter table if exists business_outcomes add column if not exists occurred_at timestamptz default now();
alter table if exists business_outcomes add column if not exists created_at timestamptz default now();

create table if not exists growth_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  title text not null,
  category text not null check (category in ('acquisition','conversion','retention','pricing','operations','finance','marketing','sales','customer_experience','other')),
  description text not null,
  expected_impact numeric default 0,
  effort text not null default 'medium' check (effort in ('low','medium','high')),
  confidence numeric default 0,
  status text not null default 'recommended' check (status in ('recommended','planned','running','completed','dismissed')),
  evidence jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists growth_experiments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  recommendation_id uuid references growth_recommendations(id) on delete set null,
  name text not null,
  hypothesis text not null,
  metric text not null,
  baseline numeric,
  target numeric,
  status text not null default 'draft' check (status in ('draft','running','paused','completed','cancelled')),
  result jsonb not null default '{}',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists business_forecasts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  metric text not null,
  horizon text not null,
  forecast_value numeric not null,
  lower_bound numeric,
  upper_bound numeric,
  confidence numeric default 0,
  assumptions jsonb not null default '{}',
  created_at timestamptz default now()
);

create table if not exists business_benchmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  metric text not null,
  business_value numeric not null,
  benchmark_value numeric,
  percentile numeric,
  cohort text,
  source text not null default 'internal',
  created_at timestamptz default now()
);

create index if not exists kpi_measurements_user_period_idx on business_kpi_measurements(user_id, period_end desc);
create index if not exists outcomes_user_date_idx on business_outcomes(user_id, occurred_at desc);
create index if not exists growth_recommendations_user_status_idx on growth_recommendations(user_id, status, created_at desc);
create index if not exists experiments_user_status_idx on growth_experiments(user_id, status, created_at desc);
create index if not exists forecasts_user_metric_idx on business_forecasts(user_id, metric, created_at desc);
create index if not exists benchmarks_user_metric_idx on business_benchmarks(user_id, metric, created_at desc);

alter table business_kpi_measurements enable row level security;
alter table business_outcomes enable row level security;
alter table growth_recommendations enable row level security;
alter table growth_experiments enable row level security;
alter table business_forecasts enable row level security;
alter table business_benchmarks enable row level security;

create policy "own kpi measurements" on business_kpi_measurements for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own business outcomes" on business_outcomes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own growth recommendations" on growth_recommendations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own growth experiments" on growth_experiments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own business forecasts" on business_forecasts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own business benchmarks" on business_benchmarks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

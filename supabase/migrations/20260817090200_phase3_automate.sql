-- BusiGo Phase 3 — Automation Architect / Simulation / Observability
create table if not exists automation_blueprints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  workflow_id uuid references workflows(id) on delete cascade,
  request text not null,
  plan jsonb not null default '{}',
  validation jsonb not null default '{}',
  status text not null default 'draft' check (status in ('draft','tested','published','rejected')),
  created_at timestamptz default now()
);

create table if not exists automation_simulations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  workflow_id uuid references workflows(id) on delete cascade,
  definition jsonb not null default '[]',
  trigger_payload jsonb not null default '{}',
  result jsonb not null default '{}',
  created_at timestamptz default now()
);

create table if not exists automation_incidents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  workflow_id uuid references workflows(id) on delete cascade,
  run_id uuid references workflow_runs(id) on delete set null,
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  error_code text,
  message text not null,
  resolved boolean not null default false,
  created_at timestamptz default now(),
  resolved_at timestamptz
);

alter table automation_blueprints enable row level security;
alter table automation_simulations enable row level security;
alter table automation_incidents enable row level security;

create policy "own automation blueprints" on automation_blueprints for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own automation simulations" on automation_simulations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own automation incidents" on automation_incidents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

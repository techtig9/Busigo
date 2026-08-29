-- BusiGo Phase 6 — Autonomous Operations & Safety
create table if not exists autonomy_policies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  name text not null,
  enabled boolean not null default false,
  max_risk text not null default 'low' check (max_risk in ('low','medium','high')),
  requires_approval boolean not null default true,
  allowed_action_types text[] not null default '{}',
  blocked_action_types text[] not null default '{}',
  schedule text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, name)
);

create table if not exists autonomous_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  policy_id uuid references autonomy_policies(id) on delete set null,
  agent_id uuid references ai_agents(id) on delete set null,
  title text not null,
  rationale text not null,
  proposed_action jsonb not null default '{}',
  risk_level text not null default 'low' check (risk_level in ('low','medium','high','critical')),
  status text not null default 'recommended' check (status in ('recommended','approved','executing','completed','rejected','blocked','failed')),
  confidence numeric default 0,
  requires_human_approval boolean not null default true,
  created_at timestamptz default now(),
  decided_at timestamptz
);

create table if not exists autonomy_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  policy_id uuid references autonomy_policies(id) on delete set null,
  trigger_source text not null,
  status text not null default 'planned' check (status in ('planned','running','completed','blocked','failed','cancelled')),
  started_at timestamptz,
  completed_at timestamptz,
  steps_total integer not null default 0,
  steps_completed integer not null default 0,
  summary jsonb not null default '{}',
  created_at timestamptz default now()
);

-- Compatibility: automation_incidents already exists from Phase 3.
-- Extend it instead of redefining it so all phases can be applied in order.
alter table if exists automation_incidents add column if not exists run_id uuid references autonomy_runs(id) on delete set null;
alter table if exists automation_incidents add column if not exists title text;
alter table if exists automation_incidents add column if not exists description text;
alter table if exists automation_incidents add column if not exists status text not null default 'open';
alter table if exists automation_incidents add column if not exists remediation jsonb not null default '{}';
alter table if exists automation_incidents add column if not exists resolved_at timestamptz;



create table if not exists action_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  decision_id uuid references autonomous_decisions(id) on delete cascade,
  action_type text not null,
  expected_result jsonb not null default '{}',
  observed_result jsonb not null default '{}',
  verified boolean not null default false,
  verification_method text not null default 'manual',
  created_at timestamptz default now()
);

create table if not exists business_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  alert_type text not null,
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  title text not null,
  message text not null,
  source text not null default 'system',
  read boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists executive_briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  period text not null check (period in ('daily','weekly')),
  headline text not null,
  summary text not null,
  decisions jsonb not null default '[]',
  risks jsonb not null default '[]',
  opportunities jsonb not null default '[]',
  metrics jsonb not null default '{}',
  created_at timestamptz default now()
);

create index if not exists autonomy_policies_user_idx on autonomy_policies(user_id, enabled);
create index if not exists autonomous_decisions_user_status_idx on autonomous_decisions(user_id, status, created_at desc);
create index if not exists autonomy_runs_user_idx on autonomy_runs(user_id, created_at desc);
create index if not exists incidents_user_status_idx on automation_incidents(user_id, status, created_at desc);
create index if not exists verifications_user_idx on action_verifications(user_id, created_at desc);
create index if not exists alerts_user_idx on business_alerts(user_id, read, created_at desc);
create index if not exists briefings_user_idx on executive_briefings(user_id, period, created_at desc);

alter table autonomy_policies enable row level security;
alter table autonomous_decisions enable row level security;
alter table autonomy_runs enable row level security;
alter table automation_incidents enable row level security;
alter table action_verifications enable row level security;
alter table business_alerts enable row level security;
alter table executive_briefings enable row level security;

create policy "own autonomy policies" on autonomy_policies for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own autonomous decisions" on autonomous_decisions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own autonomy runs" on autonomy_runs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own autonomous automation incidents" on automation_incidents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own action verifications" on action_verifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own business alerts" on business_alerts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own executive briefings" on executive_briefings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

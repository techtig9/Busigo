-- BusiGo AI Business Operating System -----------------------------------
create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references users(id) not null,
  name text not null,
  industry text not null,
  business_model text,
  website text,
  description text,
  target_customer text,
  country text,
  team_size int,
  monthly_revenue numeric,
  currency text not null default 'USD',
  business_hours jsonb not null default '{}',
  brand_guidelines jsonb not null default '{}',
  rules jsonb not null default '[]',
  memory jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists business_discovery_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  question_key text not null,
  answer text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, question_key)
);

create table if not exists business_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  title text not null,
  description text,
  metric text,
  target_value numeric,
  current_value numeric,
  deadline date,
  status text not null default 'active' check (status in ('active','paused','completed')),
  created_at timestamptz default now()
);

create table if not exists business_processes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  name text not null,
  department text,
  description text,
  steps jsonb not null default '[]',
  owner_role text,
  automation_score int not null default 0 check (automation_score between 0 and 100),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists business_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  name text not null,
  condition jsonb not null default '{}',
  action jsonb not null default '{}',
  risk_level text not null default 'medium' check (risk_level in ('low','medium','high','critical')),
  enabled boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists business_kpis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  name text not null,
  key text not null,
  value numeric,
  unit text,
  target numeric,
  source text,
  recorded_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists ai_agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  name text not null,
  agent_type text not null,
  description text,
  status text not null default 'draft' check (status in ('draft','active','paused','error')),
  autonomy_level text not null default 'approval_required' check (autonomy_level in ('draft_only','approval_required','low_risk_auto','autonomous')),
  permissions jsonb not null default '[]',
  memory_scope jsonb not null default '{}',
  instructions text,
  model_policy jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, agent_type)
);

create table if not exists automation_opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  process_id uuid references business_processes(id) on delete set null,
  title text not null,
  description text,
  source text not null default 'ai',
  impact text not null default 'medium' check (impact in ('low','medium','high','critical')),
  effort text not null default 'medium' check (effort in ('low','medium','high')),
  priority_score int not null default 50 check (priority_score between 0 and 100),
  estimated_hours_saved numeric,
  estimated_annual_value numeric,
  recommended_agent text,
  status text not null default 'identified' check (status in ('identified','approved','building','active','dismissed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists ai_approvals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  agent_id uuid references ai_agents(id) on delete set null,
  workflow_id uuid references workflows(id) on delete set null,
  title text not null,
  reason text,
  risk_level text not null default 'medium' check (risk_level in ('low','medium','high','critical')),
  action_type text,
  payload jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  decided_by uuid references users(id),
  created_at timestamptz default now(),
  decided_at timestamptz
);

create table if not exists ai_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  agent_id uuid references ai_agents(id) on delete set null,
  workflow_run_id uuid references workflow_runs(id) on delete set null,
  action_type text not null,
  intent text,
  input jsonb,
  output jsonb,
  risk_level text not null default 'low' check (risk_level in ('low','medium','high','critical')),
  approval_id uuid references ai_approvals(id) on delete set null,
  status text not null default 'planned' check (status in ('planned','executing','success','failed','blocked')),
  cost numeric,
  duration_ms int,
  created_at timestamptz default now()
);

create table if not exists business_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  event_type text not null,
  source text,
  entity_type text,
  entity_id text,
  payload jsonb not null default '{}',
  created_at timestamptz default now()
);

create table if not exists agent_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  agent_id uuid references ai_agents(id) on delete cascade,
  memory_type text not null check (memory_type in ('semantic','episodic','procedural','preference')),
  key text not null,
  value jsonb not null,
  source text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists business_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  name text not null,
  source text,
  mime_type text,
  storage_path text,
  extracted_text text,
  metadata jsonb not null default '{}',
  indexed boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists agent_evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  agent_id uuid references ai_agents(id) on delete cascade,
  scenario text not null,
  expected jsonb,
  actual jsonb,
  score numeric,
  passed boolean,
  created_at timestamptz default now()
);

create table if not exists business_outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  opportunity_id uuid references automation_opportunities(id) on delete set null,
  workflow_id uuid references workflows(id) on delete set null,
  outcome_type text not null,
  value numeric,
  unit text,
  evidence jsonb not null default '{}',
  verified boolean not null default false,
  recorded_at timestamptz default now()
);

alter table businesses enable row level security;
alter table business_discovery_answers enable row level security;
alter table business_goals enable row level security;
alter table business_processes enable row level security;
alter table business_rules enable row level security;
alter table business_kpis enable row level security;
alter table ai_agents enable row level security;
alter table automation_opportunities enable row level security;
alter table ai_approvals enable row level security;
alter table ai_actions enable row level security;
alter table business_events enable row level security;
alter table agent_memory enable row level security;
alter table business_documents enable row level security;
alter table agent_evaluations enable row level security;
alter table business_outcomes enable row level security;

-- README documents running schema.sql first, then every file in migrations/ in
-- order. schema.sql already creates these same tables/policies (this section
-- was folded back into schema.sql after this migration was originally written),
-- so re-running the create policy statements here without a guard fails with
-- "policy already exists" and aborts the rest of this migration file — which in
-- turn means business_team_members/business_catalog_items/business_customer_segments
-- below never get created. Drop-then-create makes this idempotent regardless of
-- whether schema.sql already ran.
drop policy if exists "own businesses" on businesses;
create policy "own businesses" on businesses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own discovery answers" on business_discovery_answers;
create policy "own discovery answers" on business_discovery_answers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own goals" on business_goals;
create policy "own goals" on business_goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own processes" on business_processes;
create policy "own processes" on business_processes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own rules" on business_rules;
create policy "own rules" on business_rules for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own kpis" on business_kpis;
create policy "own kpis" on business_kpis for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own agents" on ai_agents;
create policy "own agents" on ai_agents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own opportunities" on automation_opportunities;
create policy "own opportunities" on automation_opportunities for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own approvals" on ai_approvals;
create policy "own approvals" on ai_approvals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own actions" on ai_actions;
create policy "own actions" on ai_actions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own events" on business_events;
create policy "own events" on business_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own agent memory" on agent_memory;
create policy "own agent memory" on agent_memory for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own documents" on business_documents;
create policy "own documents" on business_documents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own evaluations" on agent_evaluations;
create policy "own evaluations" on agent_evaluations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own outcomes" on business_outcomes;
create policy "own outcomes" on business_outcomes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- Phase 1: richer Business Discovery ------------------------------------
alter table businesses add column if not exists legal_name text;
alter table businesses add column if not exists business_type text;
alter table businesses add column if not exists locations jsonb not null default '[]';
alter table businesses add column if not exists markets jsonb not null default '[]';
alter table businesses add column if not exists languages jsonb not null default '[]';
alter table businesses add column if not exists products jsonb not null default '[]';
alter table businesses add column if not exists services jsonb not null default '[]';
alter table businesses add column if not exists customer_segments jsonb not null default '[]';
alter table businesses add column if not exists acquisition_channels jsonb not null default '[]';
alter table businesses add column if not exists sales_channels jsonb not null default '[]';
alter table businesses add column if not exists departments jsonb not null default '[]';
alter table businesses add column if not exists team_roles jsonb not null default '[]';
alter table businesses add column if not exists brand_voice text;
alter table businesses add column if not exists financial_snapshot jsonb not null default '{}';

create table if not exists business_team_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  name text not null,
  role text,
  department text,
  responsibilities text,
  employment_type text default 'employee',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists business_catalog_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  item_type text not null check (item_type in ('product','service')),
  name text not null,
  description text,
  price numeric,
  currency text default 'USD',
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists business_customer_segments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  name text not null,
  description text,
  ideal_profile text,
  created_at timestamptz default now()
);

alter table business_team_members enable row level security;
alter table business_catalog_items enable row level security;
alter table business_customer_segments enable row level security;
create policy "own team members" on business_team_members for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own catalog items" on business_catalog_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own customer segments" on business_customer_segments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

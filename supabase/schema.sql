-- busigo database schema — apply as-is in Supabase (SQL editor or migration) before running the app.

create table users (
  id uuid primary key references auth.users(id),
  name text,
  email text unique not null,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz default now()
);

create table templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  use_case text not null,
  definition jsonb not null, -- seed step-list definition a new workflow can start from
  thumbnail text
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  plan text not null default 'free' check (plan in ('free','starter','growth','pro','enterprise')),
  status text not null default 'active',
  provider text default 'paddle',
  paddle_subscription_id text,
  paddle_customer_id text,
  credits_remaining int not null default 1000,
  renews_at timestamptz
);

create table workflows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  name text not null,
  description text,
  trigger_type text not null check (trigger_type in ('webhook','schedule','form')),
  trigger_config jsonb not null default '{}', -- e.g. {"cron": "0 9 * * *"} for a schedule trigger
  trigger_token text unique default gen_random_uuid(), -- builds the public /api/hook/[token] URL
  definition jsonb not null default '[]', -- ordered array of step objects: [{key, type, config}]
  status text not null default 'draft' check (status in ('draft','published')),
  next_run_at timestamptz, -- for schedule-triggered workflows
  created_at timestamptz default now()
);

create table workflow_versions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid references workflows(id) not null,
  definition jsonb not null,
  created_at timestamptz default now()
);

create table forms (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid references workflows(id) not null,
  slug text unique not null,
  fields jsonb not null default '[]', -- [{key, label, type: text/number/email/textarea/select, required}]
  created_at timestamptz default now()
);

create table workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid references workflows(id) not null,
  trigger_source text not null check (trigger_source in ('webhook','schedule','form','manual_test')),
  status text not null default 'running' check (status in ('running','waiting','success','failed','stopped_by_filter')),
  trigger_payload jsonb,
  resume_at timestamptz, -- set while status = 'waiting' on a Delay step
  started_at timestamptz default now(),
  ended_at timestamptz
);

create table workflow_run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references workflow_runs(id) not null,
  step_key text not null,
  type text not null check (type in ('http_request','send_email','delay','filter','transform_data','ai_action','webhook_response')),
  input jsonb,
  output jsonb,
  status text not null check (status in ('success','failed','skipped')),
  duration_ms int,
  created_at timestamptz default now()
);

create table connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  service text not null check (service in ('slack','google_sheets','gmail','google_calendar','airtable','hubspot','trello','notion')),
  status text not null default 'queued' check (status in ('queued','connected')),
  created_at timestamptz default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  paddle_transaction_id text,
  amount numeric,
  status text,
  created_at timestamptz default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz default now()
);

-- Row Level Security ------------------------------------------------------
alter table users enable row level security;
alter table subscriptions enable row level security;
alter table workflows enable row level security;
alter table workflow_versions enable row level security;
alter table forms enable row level security;
alter table workflow_runs enable row level security;
alter table workflow_run_steps enable row level security;
alter table connections enable row level security;
alter table payments enable row level security;
alter table templates enable row level security;
alter table notifications enable row level security;

create policy "users read own row" on users for select using (auth.uid() = id);
create policy "users update own row" on users for update using (auth.uid() = id);

create policy "own subscription" on subscriptions for select using (auth.uid() = user_id);

create policy "own workflows crud" on workflows for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own workflow versions" on workflow_versions for all using (
  exists (select 1 from workflows w where w.id = workflow_id and w.user_id = auth.uid())
);

create policy "own forms" on forms for all using (
  exists (select 1 from workflows w where w.id = workflow_id and w.user_id = auth.uid())
);

create policy "own runs" on workflow_runs for select using (
  exists (select 1 from workflows w where w.id = workflow_id and w.user_id = auth.uid())
);

create policy "own run steps" on workflow_run_steps for select using (
  exists (
    select 1 from workflow_runs r join workflows w on w.id = r.workflow_id
    where r.id = run_id and w.user_id = auth.uid()
  )
);

create policy "own connections" on connections for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own payments" on payments for select using (auth.uid() = user_id);

create policy "own notifications" on notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "templates readable by all authenticated" on templates for select using (auth.role() = 'authenticated');

-- Note: server-side code that must bypass RLS (webhook execution, cron tick, admin panel,
-- Paddle webhook handler) uses the Supabase service-role client (lib/supabase/server.ts),
-- which is never exposed to the browser.

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

create policy "own businesses" on businesses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own discovery answers" on business_discovery_answers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own goals" on business_goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own processes" on business_processes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rules" on business_rules for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own kpis" on business_kpis for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own agents" on ai_agents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own opportunities" on automation_opportunities for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own approvals" on ai_approvals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own actions" on ai_actions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own events" on business_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own agent memory" on agent_memory for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own documents" on business_documents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own evaluations" on agent_evaluations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own outcomes" on business_outcomes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

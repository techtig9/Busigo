-- BusiGo Phase 4 — AI Workforce: tasks, permissions, action history and handoffs
create table if not exists agent_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  agent_id uuid references ai_agents(id) on delete cascade not null,
  title text not null,
  description text,
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  status text not null default 'queued' check (status in ('queued','running','waiting_approval','completed','failed','cancelled','handed_off')),
  input jsonb not null default '{}',
  output jsonb not null default '{}',
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists agent_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  agent_id uuid references ai_agents(id) on delete cascade not null,
  capability text not null,
  resource text not null,
  allowed boolean not null default false,
  requires_approval boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, agent_id, capability, resource)
);

create table if not exists agent_handoffs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  agent_id uuid references ai_agents(id) on delete set null,
  task_id uuid references agent_tasks(id) on delete set null,
  reason text not null,
  context jsonb not null default '{}',
  status text not null default 'open' check (status in ('open','accepted','resolved','cancelled')),
  resolved_by uuid references users(id),
  created_at timestamptz default now(),
  resolved_at timestamptz
);

create index if not exists agent_tasks_user_status_idx on agent_tasks(user_id, status, created_at desc);
create index if not exists agent_permissions_agent_idx on agent_permissions(agent_id);
create index if not exists agent_handoffs_user_status_idx on agent_handoffs(user_id, status, created_at desc);

alter table agent_tasks enable row level security;
alter table agent_permissions enable row level security;
alter table agent_handoffs enable row level security;

create policy "own agent tasks" on agent_tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own agent permissions" on agent_permissions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own agent handoffs" on agent_handoffs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

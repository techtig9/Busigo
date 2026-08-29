-- Phase 18 — Workspace / organization multi-tenancy foundation (Master Spec section 2)
-- Generated migration: adds workspace core tables + workspace_id across every existing
-- tenant-scoped table, backfills it from a per-user personal workspace, and replaces
-- user_id-only RLS with workspace-membership RLS. Idempotent: safe to re-run.

-- ===================================================================
-- 1. Core workspace tables
-- ===================================================================

do $$ begin
  create type workspace_role as enum ('owner','admin','manager','member','viewer','billing_admin','security_admin');
exception when duplicate_object then null; end $$;

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  owner_id uuid references users(id) not null,
  is_personal boolean not null default false,
  plan text not null default 'free' check (plan in ('free','starter','growth','pro','enterprise')),
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  user_id uuid references users(id) not null,
  role workspace_role not null default 'member',
  invited_by uuid references users(id),
  joined_at timestamptz not null default now(),
  unique(workspace_id, user_id)
);
create index if not exists workspace_members_user_idx on workspace_members(user_id);

create table if not exists workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  email text not null,
  role workspace_role not null default 'member',
  token uuid unique not null default gen_random_uuid(),
  invited_by uuid references users(id) not null,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz
);
create unique index if not exists workspace_invitations_pending_unique on workspace_invitations(workspace_id, lower(email)) where status = 'pending';

create table if not exists workspace_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  key text not null,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  unique(workspace_id, key)
);

create table if not exists workspace_api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  name text not null,
  key_prefix text not null,
  key_hash text not null,
  scopes text[] not null default '{}',
  created_by uuid references users(id) not null,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists workspace_api_keys_workspace_idx on workspace_api_keys(workspace_id) where revoked_at is null;

create table if not exists workspace_audit_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  actor_id uuid references users(id),
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists workspace_audit_log_workspace_idx on workspace_audit_log(workspace_id, created_at desc);

create table if not exists workspace_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  direction text not null check (direction in ('inbound','outbound')),
  event_id uuid not null default gen_random_uuid(),
  url text,
  status text not null default 'pending' check (status in ('pending','delivered','failed')),
  attempt int not null default 1,
  response_code int,
  signature text,
  created_at timestamptz not null default now()
);
create index if not exists workspace_webhook_deliveries_workspace_idx on workspace_webhook_deliveries(workspace_id, created_at desc);
create unique index if not exists workspace_webhook_deliveries_event_unique on workspace_webhook_deliveries(workspace_id, event_id, direction);

-- ===================================================================
-- 2. Helper functions used by every workspace-scoped RLS policy
-- ===================================================================

create or replace function is_workspace_member(p_workspace_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = p_workspace_id and user_id = p_user_id
  );
$$;

create or replace function workspace_role_rank(r workspace_role) returns int
language sql immutable as $$
  select case r
    when 'viewer' then 0
    when 'member' then 1
    when 'billing_admin' then 2
    when 'security_admin' then 2
    when 'manager' then 3
    when 'admin' then 4
    when 'owner' then 5
  end;
$$;

create or replace function workspace_role_at_least(p_workspace_id uuid, p_min_role workspace_role, p_user_id uuid default auth.uid())
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = p_workspace_id and user_id = p_user_id
      and workspace_role_rank(role) >= workspace_role_rank(p_min_role)
  );
$$;

-- ===================================================================
-- 3. RLS on the new workspace tables themselves
-- ===================================================================

alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table workspace_invitations enable row level security;
alter table workspace_settings enable row level security;
alter table workspace_api_keys enable row level security;
alter table workspace_audit_log enable row level security;
alter table workspace_webhook_deliveries enable row level security;

drop policy if exists "workspace members can read their workspace" on workspaces;
create policy "workspace members can read their workspace" on workspaces for select using (is_workspace_member(id));
drop policy if exists "admins can update their workspace" on workspaces;
create policy "admins can update their workspace" on workspaces for update using (workspace_role_at_least(id, 'admin')) with check (workspace_role_at_least(id, 'admin'));
drop policy if exists "any authenticated user can create a workspace" on workspaces;
create policy "any authenticated user can create a workspace" on workspaces for insert with check (auth.uid() = owner_id);

drop policy if exists "members can read workspace membership" on workspace_members;
create policy "members can read workspace membership" on workspace_members for select using (is_workspace_member(workspace_id));
drop policy if exists "admins can manage membership" on workspace_members;
create policy "admins can manage membership" on workspace_members for all using (workspace_role_at_least(workspace_id, 'admin')) with check (workspace_role_at_least(workspace_id, 'admin'));

drop policy if exists "admins can manage invitations" on workspace_invitations;
create policy "admins can manage invitations" on workspace_invitations for all using (workspace_role_at_least(workspace_id, 'admin')) with check (workspace_role_at_least(workspace_id, 'admin'));

drop policy if exists "members can read settings" on workspace_settings;
create policy "members can read settings" on workspace_settings for select using (is_workspace_member(workspace_id));
drop policy if exists "admins can write settings" on workspace_settings;
create policy "admins can write settings" on workspace_settings for all using (workspace_role_at_least(workspace_id, 'admin')) with check (workspace_role_at_least(workspace_id, 'admin'));

drop policy if exists "security admins can manage api keys" on workspace_api_keys;
create policy "security admins can manage api keys" on workspace_api_keys for all using (workspace_role_at_least(workspace_id, 'security_admin')) with check (workspace_role_at_least(workspace_id, 'security_admin'));

drop policy if exists "members can read audit log" on workspace_audit_log;
create policy "members can read audit log" on workspace_audit_log for select using (is_workspace_member(workspace_id));
-- audit log rows are written by server-only helpers via the service-role client; no user insert policy.

drop policy if exists "admins can read webhook deliveries" on workspace_webhook_deliveries;
create policy "admins can read webhook deliveries" on workspace_webhook_deliveries for select using (workspace_role_at_least(workspace_id, 'admin'));

-- ===================================================================
-- 4. Personal workspace for every existing user (one-time backfill)
-- ===================================================================

insert into workspaces (name, slug, owner_id, is_personal)
select
  coalesce(nullif(u.name, ''), split_part(u.email, '@', 1)) || '''s Workspace',
  'ws-' || replace(u.id::text, '-', ''),
  u.id,
  true
from users u
where not exists (
  select 1 from workspaces w where w.owner_id = u.id and w.is_personal = true
);

insert into workspace_members (workspace_id, user_id, role)
select w.id, w.owner_id, 'owner'
from workspaces w
where w.is_personal = true
  and not exists (
    select 1 from workspace_members m where m.workspace_id = w.id and m.user_id = w.owner_id
  );

-- ===================================================================
-- 5. Add workspace_id to every tenant-scoped table + backfill + RLS
-- ===================================================================

alter table businesses add column if not exists workspace_id uuid references workspaces(id);
update businesses t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table businesses alter column workspace_id set not null;
create index if not exists businesses_workspace_idx on businesses(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'businesses' loop
    execute format('drop policy if exists %I on businesses', pol.policyname);
  end loop;
end $$;
create policy "businesses_ws_select" on businesses for select using (is_workspace_member(workspace_id));
create policy "businesses_ws_insert" on businesses for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "businesses_ws_update" on businesses for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "businesses_ws_delete" on businesses for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table business_discovery_answers add column if not exists workspace_id uuid references workspaces(id);
update business_discovery_answers t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table business_discovery_answers alter column workspace_id set not null;
create index if not exists business_discovery_answers_workspace_idx on business_discovery_answers(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'business_discovery_answers' loop
    execute format('drop policy if exists %I on business_discovery_answers', pol.policyname);
  end loop;
end $$;
create policy "business_discovery_answers_ws_select" on business_discovery_answers for select using (is_workspace_member(workspace_id));
create policy "business_discovery_answers_ws_insert" on business_discovery_answers for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_discovery_answers_ws_update" on business_discovery_answers for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_discovery_answers_ws_delete" on business_discovery_answers for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table business_goals add column if not exists workspace_id uuid references workspaces(id);
update business_goals t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table business_goals alter column workspace_id set not null;
create index if not exists business_goals_workspace_idx on business_goals(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'business_goals' loop
    execute format('drop policy if exists %I on business_goals', pol.policyname);
  end loop;
end $$;
create policy "business_goals_ws_select" on business_goals for select using (is_workspace_member(workspace_id));
create policy "business_goals_ws_insert" on business_goals for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_goals_ws_update" on business_goals for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_goals_ws_delete" on business_goals for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table business_processes add column if not exists workspace_id uuid references workspaces(id);
update business_processes t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table business_processes alter column workspace_id set not null;
create index if not exists business_processes_workspace_idx on business_processes(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'business_processes' loop
    execute format('drop policy if exists %I on business_processes', pol.policyname);
  end loop;
end $$;
create policy "business_processes_ws_select" on business_processes for select using (is_workspace_member(workspace_id));
create policy "business_processes_ws_insert" on business_processes for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_processes_ws_update" on business_processes for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_processes_ws_delete" on business_processes for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table business_rules add column if not exists workspace_id uuid references workspaces(id);
update business_rules t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table business_rules alter column workspace_id set not null;
create index if not exists business_rules_workspace_idx on business_rules(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'business_rules' loop
    execute format('drop policy if exists %I on business_rules', pol.policyname);
  end loop;
end $$;
create policy "business_rules_ws_select" on business_rules for select using (is_workspace_member(workspace_id));
create policy "business_rules_ws_insert" on business_rules for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_rules_ws_update" on business_rules for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_rules_ws_delete" on business_rules for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table business_kpis add column if not exists workspace_id uuid references workspaces(id);
update business_kpis t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table business_kpis alter column workspace_id set not null;
create index if not exists business_kpis_workspace_idx on business_kpis(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'business_kpis' loop
    execute format('drop policy if exists %I on business_kpis', pol.policyname);
  end loop;
end $$;
create policy "business_kpis_ws_select" on business_kpis for select using (is_workspace_member(workspace_id));
create policy "business_kpis_ws_insert" on business_kpis for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_kpis_ws_update" on business_kpis for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_kpis_ws_delete" on business_kpis for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table ai_agents add column if not exists workspace_id uuid references workspaces(id);
update ai_agents t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table ai_agents alter column workspace_id set not null;
create index if not exists ai_agents_workspace_idx on ai_agents(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'ai_agents' loop
    execute format('drop policy if exists %I on ai_agents', pol.policyname);
  end loop;
end $$;
create policy "ai_agents_ws_select" on ai_agents for select using (is_workspace_member(workspace_id));
create policy "ai_agents_ws_insert" on ai_agents for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "ai_agents_ws_update" on ai_agents for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "ai_agents_ws_delete" on ai_agents for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table automation_opportunities add column if not exists workspace_id uuid references workspaces(id);
update automation_opportunities t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table automation_opportunities alter column workspace_id set not null;
create index if not exists automation_opportunities_workspace_idx on automation_opportunities(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'automation_opportunities' loop
    execute format('drop policy if exists %I on automation_opportunities', pol.policyname);
  end loop;
end $$;
create policy "automation_opportunities_ws_select" on automation_opportunities for select using (is_workspace_member(workspace_id));
create policy "automation_opportunities_ws_insert" on automation_opportunities for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "automation_opportunities_ws_update" on automation_opportunities for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "automation_opportunities_ws_delete" on automation_opportunities for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table ai_approvals add column if not exists workspace_id uuid references workspaces(id);
update ai_approvals t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table ai_approvals alter column workspace_id set not null;
create index if not exists ai_approvals_workspace_idx on ai_approvals(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'ai_approvals' loop
    execute format('drop policy if exists %I on ai_approvals', pol.policyname);
  end loop;
end $$;
create policy "ai_approvals_ws_select" on ai_approvals for select using (is_workspace_member(workspace_id));
create policy "ai_approvals_ws_insert" on ai_approvals for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "ai_approvals_ws_update" on ai_approvals for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "ai_approvals_ws_delete" on ai_approvals for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table ai_actions add column if not exists workspace_id uuid references workspaces(id);
update ai_actions t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table ai_actions alter column workspace_id set not null;
create index if not exists ai_actions_workspace_idx on ai_actions(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'ai_actions' loop
    execute format('drop policy if exists %I on ai_actions', pol.policyname);
  end loop;
end $$;
create policy "ai_actions_ws_select" on ai_actions for select using (is_workspace_member(workspace_id));
create policy "ai_actions_ws_insert" on ai_actions for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "ai_actions_ws_update" on ai_actions for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "ai_actions_ws_delete" on ai_actions for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table business_events add column if not exists workspace_id uuid references workspaces(id);
update business_events t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table business_events alter column workspace_id set not null;
create index if not exists business_events_workspace_idx on business_events(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'business_events' loop
    execute format('drop policy if exists %I on business_events', pol.policyname);
  end loop;
end $$;
create policy "business_events_ws_select" on business_events for select using (is_workspace_member(workspace_id));
create policy "business_events_ws_insert" on business_events for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_events_ws_update" on business_events for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_events_ws_delete" on business_events for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table agent_memory add column if not exists workspace_id uuid references workspaces(id);
update agent_memory t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table agent_memory alter column workspace_id set not null;
create index if not exists agent_memory_workspace_idx on agent_memory(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'agent_memory' loop
    execute format('drop policy if exists %I on agent_memory', pol.policyname);
  end loop;
end $$;
create policy "agent_memory_ws_select" on agent_memory for select using (is_workspace_member(workspace_id));
create policy "agent_memory_ws_insert" on agent_memory for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "agent_memory_ws_update" on agent_memory for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "agent_memory_ws_delete" on agent_memory for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table business_documents add column if not exists workspace_id uuid references workspaces(id);
update business_documents t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table business_documents alter column workspace_id set not null;
create index if not exists business_documents_workspace_idx on business_documents(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'business_documents' loop
    execute format('drop policy if exists %I on business_documents', pol.policyname);
  end loop;
end $$;
create policy "business_documents_ws_select" on business_documents for select using (is_workspace_member(workspace_id));
create policy "business_documents_ws_insert" on business_documents for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_documents_ws_update" on business_documents for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_documents_ws_delete" on business_documents for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table agent_evaluations add column if not exists workspace_id uuid references workspaces(id);
update agent_evaluations t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table agent_evaluations alter column workspace_id set not null;
create index if not exists agent_evaluations_workspace_idx on agent_evaluations(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'agent_evaluations' loop
    execute format('drop policy if exists %I on agent_evaluations', pol.policyname);
  end loop;
end $$;
create policy "agent_evaluations_ws_select" on agent_evaluations for select using (is_workspace_member(workspace_id));
create policy "agent_evaluations_ws_insert" on agent_evaluations for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "agent_evaluations_ws_update" on agent_evaluations for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "agent_evaluations_ws_delete" on agent_evaluations for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table business_outcomes add column if not exists workspace_id uuid references workspaces(id);
update business_outcomes t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table business_outcomes alter column workspace_id set not null;
create index if not exists business_outcomes_workspace_idx on business_outcomes(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'business_outcomes' loop
    execute format('drop policy if exists %I on business_outcomes', pol.policyname);
  end loop;
end $$;
create policy "business_outcomes_ws_select" on business_outcomes for select using (is_workspace_member(workspace_id));
create policy "business_outcomes_ws_insert" on business_outcomes for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_outcomes_ws_update" on business_outcomes for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_outcomes_ws_delete" on business_outcomes for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table business_team_members add column if not exists workspace_id uuid references workspaces(id);
update business_team_members t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table business_team_members alter column workspace_id set not null;
create index if not exists business_team_members_workspace_idx on business_team_members(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'business_team_members' loop
    execute format('drop policy if exists %I on business_team_members', pol.policyname);
  end loop;
end $$;
create policy "business_team_members_ws_select" on business_team_members for select using (is_workspace_member(workspace_id));
create policy "business_team_members_ws_insert" on business_team_members for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_team_members_ws_update" on business_team_members for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_team_members_ws_delete" on business_team_members for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table business_catalog_items add column if not exists workspace_id uuid references workspaces(id);
update business_catalog_items t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table business_catalog_items alter column workspace_id set not null;
create index if not exists business_catalog_items_workspace_idx on business_catalog_items(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'business_catalog_items' loop
    execute format('drop policy if exists %I on business_catalog_items', pol.policyname);
  end loop;
end $$;
create policy "business_catalog_items_ws_select" on business_catalog_items for select using (is_workspace_member(workspace_id));
create policy "business_catalog_items_ws_insert" on business_catalog_items for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_catalog_items_ws_update" on business_catalog_items for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_catalog_items_ws_delete" on business_catalog_items for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table business_customer_segments add column if not exists workspace_id uuid references workspaces(id);
update business_customer_segments t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table business_customer_segments alter column workspace_id set not null;
create index if not exists business_customer_segments_workspace_idx on business_customer_segments(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'business_customer_segments' loop
    execute format('drop policy if exists %I on business_customer_segments', pol.policyname);
  end loop;
end $$;
create policy "business_customer_segments_ws_select" on business_customer_segments for select using (is_workspace_member(workspace_id));
create policy "business_customer_segments_ws_insert" on business_customer_segments for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_customer_segments_ws_update" on business_customer_segments for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_customer_segments_ws_delete" on business_customer_segments for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table agent_orchestrations add column if not exists workspace_id uuid references workspaces(id);
update agent_orchestrations t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table agent_orchestrations alter column workspace_id set not null;
create index if not exists agent_orchestrations_workspace_idx on agent_orchestrations(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'agent_orchestrations' loop
    execute format('drop policy if exists %I on agent_orchestrations', pol.policyname);
  end loop;
end $$;
create policy "agent_orchestrations_ws_select" on agent_orchestrations for select using (is_workspace_member(workspace_id));
create policy "agent_orchestrations_ws_insert" on agent_orchestrations for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "agent_orchestrations_ws_update" on agent_orchestrations for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "agent_orchestrations_ws_delete" on agent_orchestrations for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table business_intelligence_snapshots add column if not exists workspace_id uuid references workspaces(id);
update business_intelligence_snapshots t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table business_intelligence_snapshots alter column workspace_id set not null;
create index if not exists business_intelligence_snapshots_workspace_idx on business_intelligence_snapshots(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'business_intelligence_snapshots' loop
    execute format('drop policy if exists %I on business_intelligence_snapshots', pol.policyname);
  end loop;
end $$;
create policy "business_intelligence_snapshots_ws_select" on business_intelligence_snapshots for select using (is_workspace_member(workspace_id));
create policy "business_intelligence_snapshots_ws_insert" on business_intelligence_snapshots for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_intelligence_snapshots_ws_update" on business_intelligence_snapshots for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_intelligence_snapshots_ws_delete" on business_intelligence_snapshots for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table business_anomalies add column if not exists workspace_id uuid references workspaces(id);
update business_anomalies t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table business_anomalies alter column workspace_id set not null;
create index if not exists business_anomalies_workspace_idx on business_anomalies(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'business_anomalies' loop
    execute format('drop policy if exists %I on business_anomalies', pol.policyname);
  end loop;
end $$;
create policy "business_anomalies_ws_select" on business_anomalies for select using (is_workspace_member(workspace_id));
create policy "business_anomalies_ws_insert" on business_anomalies for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_anomalies_ws_update" on business_anomalies for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_anomalies_ws_delete" on business_anomalies for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table business_entity_state add column if not exists workspace_id uuid references workspaces(id);
update business_entity_state t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table business_entity_state alter column workspace_id set not null;
create index if not exists business_entity_state_workspace_idx on business_entity_state(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'business_entity_state' loop
    execute format('drop policy if exists %I on business_entity_state', pol.policyname);
  end loop;
end $$;
create policy "business_entity_state_ws_select" on business_entity_state for select using (is_workspace_member(workspace_id));
create policy "business_entity_state_ws_insert" on business_entity_state for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_entity_state_ws_update" on business_entity_state for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_entity_state_ws_delete" on business_entity_state for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table business_alerts add column if not exists workspace_id uuid references workspaces(id);
update business_alerts t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table business_alerts alter column workspace_id set not null;
create index if not exists business_alerts_workspace_idx on business_alerts(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'business_alerts' loop
    execute format('drop policy if exists %I on business_alerts', pol.policyname);
  end loop;
end $$;
create policy "business_alerts_ws_select" on business_alerts for select using (is_workspace_member(workspace_id));
create policy "business_alerts_ws_insert" on business_alerts for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_alerts_ws_update" on business_alerts for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_alerts_ws_delete" on business_alerts for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table growth_plans add column if not exists workspace_id uuid references workspaces(id);
update growth_plans t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table growth_plans alter column workspace_id set not null;
create index if not exists growth_plans_workspace_idx on growth_plans(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'growth_plans' loop
    execute format('drop policy if exists %I on growth_plans', pol.policyname);
  end loop;
end $$;
create policy "growth_plans_ws_select" on growth_plans for select using (is_workspace_member(workspace_id));
create policy "growth_plans_ws_insert" on growth_plans for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "growth_plans_ws_update" on growth_plans for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "growth_plans_ws_delete" on growth_plans for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table growth_audiences add column if not exists workspace_id uuid references workspaces(id);
update growth_audiences t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table growth_audiences alter column workspace_id set not null;
create index if not exists growth_audiences_workspace_idx on growth_audiences(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'growth_audiences' loop
    execute format('drop policy if exists %I on growth_audiences', pol.policyname);
  end loop;
end $$;
create policy "growth_audiences_ws_select" on growth_audiences for select using (is_workspace_member(workspace_id));
create policy "growth_audiences_ws_insert" on growth_audiences for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "growth_audiences_ws_update" on growth_audiences for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "growth_audiences_ws_delete" on growth_audiences for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table growth_campaigns add column if not exists workspace_id uuid references workspaces(id);
update growth_campaigns t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table growth_campaigns alter column workspace_id set not null;
create index if not exists growth_campaigns_workspace_idx on growth_campaigns(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'growth_campaigns' loop
    execute format('drop policy if exists %I on growth_campaigns', pol.policyname);
  end loop;
end $$;
create policy "growth_campaigns_ws_select" on growth_campaigns for select using (is_workspace_member(workspace_id));
create policy "growth_campaigns_ws_insert" on growth_campaigns for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "growth_campaigns_ws_update" on growth_campaigns for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "growth_campaigns_ws_delete" on growth_campaigns for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table growth_offers add column if not exists workspace_id uuid references workspaces(id);
update growth_offers t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table growth_offers alter column workspace_id set not null;
create index if not exists growth_offers_workspace_idx on growth_offers(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'growth_offers' loop
    execute format('drop policy if exists %I on growth_offers', pol.policyname);
  end loop;
end $$;
create policy "growth_offers_ws_select" on growth_offers for select using (is_workspace_member(workspace_id));
create policy "growth_offers_ws_insert" on growth_offers for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "growth_offers_ws_update" on growth_offers for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "growth_offers_ws_delete" on growth_offers for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table growth_playbooks add column if not exists workspace_id uuid references workspaces(id);
update growth_playbooks t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table growth_playbooks alter column workspace_id set not null;
create index if not exists growth_playbooks_workspace_idx on growth_playbooks(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'growth_playbooks' loop
    execute format('drop policy if exists %I on growth_playbooks', pol.policyname);
  end loop;
end $$;
create policy "growth_playbooks_ws_select" on growth_playbooks for select using (is_workspace_member(workspace_id));
create policy "growth_playbooks_ws_insert" on growth_playbooks for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "growth_playbooks_ws_update" on growth_playbooks for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "growth_playbooks_ws_delete" on growth_playbooks for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table growth_actions add column if not exists workspace_id uuid references workspaces(id);
update growth_actions t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table growth_actions alter column workspace_id set not null;
create index if not exists growth_actions_workspace_idx on growth_actions(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'growth_actions' loop
    execute format('drop policy if exists %I on growth_actions', pol.policyname);
  end loop;
end $$;
create policy "growth_actions_ws_select" on growth_actions for select using (is_workspace_member(workspace_id));
create policy "growth_actions_ws_insert" on growth_actions for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "growth_actions_ws_update" on growth_actions for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "growth_actions_ws_delete" on growth_actions for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table security_events add column if not exists workspace_id uuid references workspaces(id);
update security_events t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table security_events alter column workspace_id set not null;
create index if not exists security_events_workspace_idx on security_events(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'security_events' loop
    execute format('drop policy if exists %I on security_events', pol.policyname);
  end loop;
end $$;
create policy "security_events_ws_select" on security_events for select using (is_workspace_member(workspace_id));
create policy "security_events_ws_insert" on security_events for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "security_events_ws_update" on security_events for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "security_events_ws_delete" on security_events for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table audit_logs add column if not exists workspace_id uuid references workspaces(id);
update audit_logs t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table audit_logs alter column workspace_id set not null;
create index if not exists audit_logs_workspace_idx on audit_logs(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'audit_logs' loop
    execute format('drop policy if exists %I on audit_logs', pol.policyname);
  end loop;
end $$;
create policy "audit_logs_ws_select" on audit_logs for select using (is_workspace_member(workspace_id));
create policy "audit_logs_ws_insert" on audit_logs for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "audit_logs_ws_update" on audit_logs for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "audit_logs_ws_delete" on audit_logs for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table governance_policies add column if not exists workspace_id uuid references workspaces(id);
update governance_policies t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table governance_policies alter column workspace_id set not null;
create index if not exists governance_policies_workspace_idx on governance_policies(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'governance_policies' loop
    execute format('drop policy if exists %I on governance_policies', pol.policyname);
  end loop;
end $$;
create policy "governance_policies_ws_select" on governance_policies for select using (is_workspace_member(workspace_id));
create policy "governance_policies_ws_insert" on governance_policies for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "governance_policies_ws_update" on governance_policies for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "governance_policies_ws_delete" on governance_policies for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table data_requests add column if not exists workspace_id uuid references workspaces(id);
update data_requests t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table data_requests alter column workspace_id set not null;
create index if not exists data_requests_workspace_idx on data_requests(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'data_requests' loop
    execute format('drop policy if exists %I on data_requests', pol.policyname);
  end loop;
end $$;
create policy "data_requests_ws_select" on data_requests for select using (is_workspace_member(workspace_id));
create policy "data_requests_ws_insert" on data_requests for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "data_requests_ws_update" on data_requests for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "data_requests_ws_delete" on data_requests for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table access_reviews add column if not exists workspace_id uuid references workspaces(id);
update access_reviews t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table access_reviews alter column workspace_id set not null;
create index if not exists access_reviews_workspace_idx on access_reviews(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'access_reviews' loop
    execute format('drop policy if exists %I on access_reviews', pol.policyname);
  end loop;
end $$;
create policy "access_reviews_ws_select" on access_reviews for select using (is_workspace_member(workspace_id));
create policy "access_reviews_ws_insert" on access_reviews for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "access_reviews_ws_update" on access_reviews for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "access_reviews_ws_delete" on access_reviews for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table system_jobs add column if not exists workspace_id uuid references workspaces(id);
update system_jobs t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table system_jobs alter column workspace_id set not null;
create index if not exists system_jobs_workspace_idx on system_jobs(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'system_jobs' loop
    execute format('drop policy if exists %I on system_jobs', pol.policyname);
  end loop;
end $$;
create policy "system_jobs_ws_select" on system_jobs for select using (is_workspace_member(workspace_id));
create policy "system_jobs_ws_insert" on system_jobs for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "system_jobs_ws_update" on system_jobs for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "system_jobs_ws_delete" on system_jobs for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table idempotency_keys add column if not exists workspace_id uuid references workspaces(id);
update idempotency_keys t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table idempotency_keys alter column workspace_id set not null;
create index if not exists idempotency_keys_workspace_idx on idempotency_keys(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'idempotency_keys' loop
    execute format('drop policy if exists %I on idempotency_keys', pol.policyname);
  end loop;
end $$;
create policy "idempotency_keys_ws_select" on idempotency_keys for select using (is_workspace_member(workspace_id));
create policy "idempotency_keys_ws_insert" on idempotency_keys for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "idempotency_keys_ws_update" on idempotency_keys for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "idempotency_keys_ws_delete" on idempotency_keys for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table dead_letter_jobs add column if not exists workspace_id uuid references workspaces(id);
update dead_letter_jobs t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table dead_letter_jobs alter column workspace_id set not null;
create index if not exists dead_letter_jobs_workspace_idx on dead_letter_jobs(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'dead_letter_jobs' loop
    execute format('drop policy if exists %I on dead_letter_jobs', pol.policyname);
  end loop;
end $$;
create policy "dead_letter_jobs_ws_select" on dead_letter_jobs for select using (is_workspace_member(workspace_id));

alter table integration_accounts add column if not exists workspace_id uuid references workspaces(id);
update integration_accounts t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table integration_accounts alter column workspace_id set not null;
create index if not exists integration_accounts_workspace_idx on integration_accounts(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'integration_accounts' loop
    execute format('drop policy if exists %I on integration_accounts', pol.policyname);
  end loop;
end $$;
create policy "integration_accounts_ws_select" on integration_accounts for select using (is_workspace_member(workspace_id));
create policy "integration_accounts_ws_insert" on integration_accounts for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "integration_accounts_ws_update" on integration_accounts for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "integration_accounts_ws_delete" on integration_accounts for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table integration_sync_runs add column if not exists workspace_id uuid references workspaces(id);
update integration_sync_runs t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table integration_sync_runs alter column workspace_id set not null;
create index if not exists integration_sync_runs_workspace_idx on integration_sync_runs(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'integration_sync_runs' loop
    execute format('drop policy if exists %I on integration_sync_runs', pol.policyname);
  end loop;
end $$;
create policy "integration_sync_runs_ws_select" on integration_sync_runs for select using (is_workspace_member(workspace_id));
create policy "integration_sync_runs_ws_insert" on integration_sync_runs for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "integration_sync_runs_ws_update" on integration_sync_runs for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "integration_sync_runs_ws_delete" on integration_sync_runs for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table business_data_sources add column if not exists workspace_id uuid references workspaces(id);
update business_data_sources t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table business_data_sources alter column workspace_id set not null;
create index if not exists business_data_sources_workspace_idx on business_data_sources(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'business_data_sources' loop
    execute format('drop policy if exists %I on business_data_sources', pol.policyname);
  end loop;
end $$;
create policy "business_data_sources_ws_select" on business_data_sources for select using (is_workspace_member(workspace_id));
create policy "business_data_sources_ws_insert" on business_data_sources for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_data_sources_ws_update" on business_data_sources for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_data_sources_ws_delete" on business_data_sources for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table unified_business_records add column if not exists workspace_id uuid references workspaces(id);
update unified_business_records t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table unified_business_records alter column workspace_id set not null;
create index if not exists unified_business_records_workspace_idx on unified_business_records(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'unified_business_records' loop
    execute format('drop policy if exists %I on unified_business_records', pol.policyname);
  end loop;
end $$;
create policy "unified_business_records_ws_select" on unified_business_records for select using (is_workspace_member(workspace_id));
create policy "unified_business_records_ws_insert" on unified_business_records for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "unified_business_records_ws_update" on unified_business_records for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "unified_business_records_ws_delete" on unified_business_records for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table website_analyses add column if not exists workspace_id uuid references workspaces(id);
update website_analyses t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table website_analyses alter column workspace_id set not null;
create index if not exists website_analyses_workspace_idx on website_analyses(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'website_analyses' loop
    execute format('drop policy if exists %I on website_analyses', pol.policyname);
  end loop;
end $$;
create policy "website_analyses_ws_select" on website_analyses for select using (is_workspace_member(workspace_id));
create policy "website_analyses_ws_insert" on website_analyses for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "website_analyses_ws_update" on website_analyses for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "website_analyses_ws_delete" on website_analyses for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table automation_blueprints add column if not exists workspace_id uuid references workspaces(id);
update automation_blueprints t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table automation_blueprints alter column workspace_id set not null;
create index if not exists automation_blueprints_workspace_idx on automation_blueprints(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'automation_blueprints' loop
    execute format('drop policy if exists %I on automation_blueprints', pol.policyname);
  end loop;
end $$;
create policy "automation_blueprints_ws_select" on automation_blueprints for select using (is_workspace_member(workspace_id));
create policy "automation_blueprints_ws_insert" on automation_blueprints for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "automation_blueprints_ws_update" on automation_blueprints for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "automation_blueprints_ws_delete" on automation_blueprints for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table automation_simulations add column if not exists workspace_id uuid references workspaces(id);
update automation_simulations t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table automation_simulations alter column workspace_id set not null;
create index if not exists automation_simulations_workspace_idx on automation_simulations(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'automation_simulations' loop
    execute format('drop policy if exists %I on automation_simulations', pol.policyname);
  end loop;
end $$;
create policy "automation_simulations_ws_select" on automation_simulations for select using (is_workspace_member(workspace_id));
create policy "automation_simulations_ws_insert" on automation_simulations for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "automation_simulations_ws_update" on automation_simulations for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "automation_simulations_ws_delete" on automation_simulations for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table automation_incidents add column if not exists workspace_id uuid references workspaces(id);
update automation_incidents t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table automation_incidents alter column workspace_id set not null;
create index if not exists automation_incidents_workspace_idx on automation_incidents(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'automation_incidents' loop
    execute format('drop policy if exists %I on automation_incidents', pol.policyname);
  end loop;
end $$;
create policy "automation_incidents_ws_select" on automation_incidents for select using (is_workspace_member(workspace_id));
create policy "automation_incidents_ws_insert" on automation_incidents for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "automation_incidents_ws_update" on automation_incidents for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "automation_incidents_ws_delete" on automation_incidents for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table agent_tasks add column if not exists workspace_id uuid references workspaces(id);
update agent_tasks t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table agent_tasks alter column workspace_id set not null;
create index if not exists agent_tasks_workspace_idx on agent_tasks(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'agent_tasks' loop
    execute format('drop policy if exists %I on agent_tasks', pol.policyname);
  end loop;
end $$;
create policy "agent_tasks_ws_select" on agent_tasks for select using (is_workspace_member(workspace_id));
create policy "agent_tasks_ws_insert" on agent_tasks for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "agent_tasks_ws_update" on agent_tasks for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "agent_tasks_ws_delete" on agent_tasks for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table agent_permissions add column if not exists workspace_id uuid references workspaces(id);
update agent_permissions t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table agent_permissions alter column workspace_id set not null;
create index if not exists agent_permissions_workspace_idx on agent_permissions(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'agent_permissions' loop
    execute format('drop policy if exists %I on agent_permissions', pol.policyname);
  end loop;
end $$;
create policy "agent_permissions_ws_select" on agent_permissions for select using (is_workspace_member(workspace_id));
create policy "agent_permissions_ws_insert" on agent_permissions for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "agent_permissions_ws_update" on agent_permissions for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "agent_permissions_ws_delete" on agent_permissions for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table agent_handoffs add column if not exists workspace_id uuid references workspaces(id);
update agent_handoffs t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table agent_handoffs alter column workspace_id set not null;
create index if not exists agent_handoffs_workspace_idx on agent_handoffs(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'agent_handoffs' loop
    execute format('drop policy if exists %I on agent_handoffs', pol.policyname);
  end loop;
end $$;
create policy "agent_handoffs_ws_select" on agent_handoffs for select using (is_workspace_member(workspace_id));
create policy "agent_handoffs_ws_insert" on agent_handoffs for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "agent_handoffs_ws_update" on agent_handoffs for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "agent_handoffs_ws_delete" on agent_handoffs for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table business_kpi_measurements add column if not exists workspace_id uuid references workspaces(id);
update business_kpi_measurements t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table business_kpi_measurements alter column workspace_id set not null;
create index if not exists business_kpi_measurements_workspace_idx on business_kpi_measurements(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'business_kpi_measurements' loop
    execute format('drop policy if exists %I on business_kpi_measurements', pol.policyname);
  end loop;
end $$;
create policy "business_kpi_measurements_ws_select" on business_kpi_measurements for select using (is_workspace_member(workspace_id));
create policy "business_kpi_measurements_ws_insert" on business_kpi_measurements for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_kpi_measurements_ws_update" on business_kpi_measurements for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_kpi_measurements_ws_delete" on business_kpi_measurements for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table growth_recommendations add column if not exists workspace_id uuid references workspaces(id);
update growth_recommendations t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table growth_recommendations alter column workspace_id set not null;
create index if not exists growth_recommendations_workspace_idx on growth_recommendations(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'growth_recommendations' loop
    execute format('drop policy if exists %I on growth_recommendations', pol.policyname);
  end loop;
end $$;
create policy "growth_recommendations_ws_select" on growth_recommendations for select using (is_workspace_member(workspace_id));
create policy "growth_recommendations_ws_insert" on growth_recommendations for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "growth_recommendations_ws_update" on growth_recommendations for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "growth_recommendations_ws_delete" on growth_recommendations for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table growth_experiments add column if not exists workspace_id uuid references workspaces(id);
update growth_experiments t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table growth_experiments alter column workspace_id set not null;
create index if not exists growth_experiments_workspace_idx on growth_experiments(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'growth_experiments' loop
    execute format('drop policy if exists %I on growth_experiments', pol.policyname);
  end loop;
end $$;
create policy "growth_experiments_ws_select" on growth_experiments for select using (is_workspace_member(workspace_id));
create policy "growth_experiments_ws_insert" on growth_experiments for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "growth_experiments_ws_update" on growth_experiments for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "growth_experiments_ws_delete" on growth_experiments for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table business_forecasts add column if not exists workspace_id uuid references workspaces(id);
update business_forecasts t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table business_forecasts alter column workspace_id set not null;
create index if not exists business_forecasts_workspace_idx on business_forecasts(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'business_forecasts' loop
    execute format('drop policy if exists %I on business_forecasts', pol.policyname);
  end loop;
end $$;
create policy "business_forecasts_ws_select" on business_forecasts for select using (is_workspace_member(workspace_id));
create policy "business_forecasts_ws_insert" on business_forecasts for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_forecasts_ws_update" on business_forecasts for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_forecasts_ws_delete" on business_forecasts for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table business_benchmarks add column if not exists workspace_id uuid references workspaces(id);
update business_benchmarks t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table business_benchmarks alter column workspace_id set not null;
create index if not exists business_benchmarks_workspace_idx on business_benchmarks(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'business_benchmarks' loop
    execute format('drop policy if exists %I on business_benchmarks', pol.policyname);
  end loop;
end $$;
create policy "business_benchmarks_ws_select" on business_benchmarks for select using (is_workspace_member(workspace_id));
create policy "business_benchmarks_ws_insert" on business_benchmarks for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_benchmarks_ws_update" on business_benchmarks for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "business_benchmarks_ws_delete" on business_benchmarks for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table autonomy_policies add column if not exists workspace_id uuid references workspaces(id);
update autonomy_policies t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table autonomy_policies alter column workspace_id set not null;
create index if not exists autonomy_policies_workspace_idx on autonomy_policies(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'autonomy_policies' loop
    execute format('drop policy if exists %I on autonomy_policies', pol.policyname);
  end loop;
end $$;
create policy "autonomy_policies_ws_select" on autonomy_policies for select using (is_workspace_member(workspace_id));
create policy "autonomy_policies_ws_insert" on autonomy_policies for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "autonomy_policies_ws_update" on autonomy_policies for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "autonomy_policies_ws_delete" on autonomy_policies for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table autonomous_decisions add column if not exists workspace_id uuid references workspaces(id);
update autonomous_decisions t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table autonomous_decisions alter column workspace_id set not null;
create index if not exists autonomous_decisions_workspace_idx on autonomous_decisions(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'autonomous_decisions' loop
    execute format('drop policy if exists %I on autonomous_decisions', pol.policyname);
  end loop;
end $$;
create policy "autonomous_decisions_ws_select" on autonomous_decisions for select using (is_workspace_member(workspace_id));
create policy "autonomous_decisions_ws_insert" on autonomous_decisions for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "autonomous_decisions_ws_update" on autonomous_decisions for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "autonomous_decisions_ws_delete" on autonomous_decisions for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table autonomy_runs add column if not exists workspace_id uuid references workspaces(id);
update autonomy_runs t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table autonomy_runs alter column workspace_id set not null;
create index if not exists autonomy_runs_workspace_idx on autonomy_runs(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'autonomy_runs' loop
    execute format('drop policy if exists %I on autonomy_runs', pol.policyname);
  end loop;
end $$;
create policy "autonomy_runs_ws_select" on autonomy_runs for select using (is_workspace_member(workspace_id));
create policy "autonomy_runs_ws_insert" on autonomy_runs for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "autonomy_runs_ws_update" on autonomy_runs for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "autonomy_runs_ws_delete" on autonomy_runs for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table action_verifications add column if not exists workspace_id uuid references workspaces(id);
update action_verifications t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table action_verifications alter column workspace_id set not null;
create index if not exists action_verifications_workspace_idx on action_verifications(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'action_verifications' loop
    execute format('drop policy if exists %I on action_verifications', pol.policyname);
  end loop;
end $$;
create policy "action_verifications_ws_select" on action_verifications for select using (is_workspace_member(workspace_id));
create policy "action_verifications_ws_insert" on action_verifications for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "action_verifications_ws_update" on action_verifications for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "action_verifications_ws_delete" on action_verifications for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table executive_briefings add column if not exists workspace_id uuid references workspaces(id);
update executive_briefings t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table executive_briefings alter column workspace_id set not null;
create index if not exists executive_briefings_workspace_idx on executive_briefings(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'executive_briefings' loop
    execute format('drop policy if exists %I on executive_briefings', pol.policyname);
  end loop;
end $$;
create policy "executive_briefings_ws_select" on executive_briefings for select using (is_workspace_member(workspace_id));
create policy "executive_briefings_ws_insert" on executive_briefings for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "executive_briefings_ws_update" on executive_briefings for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "executive_briefings_ws_delete" on executive_briefings for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table ai_provider_events add column if not exists workspace_id uuid references workspaces(id);
update ai_provider_events t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table ai_provider_events alter column workspace_id set not null;
create index if not exists ai_provider_events_workspace_idx on ai_provider_events(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'ai_provider_events' loop
    execute format('drop policy if exists %I on ai_provider_events', pol.policyname);
  end loop;
end $$;
create policy "ai_provider_events_ws_select" on ai_provider_events for select using (is_workspace_member(workspace_id));
create policy "ai_provider_events_ws_insert" on ai_provider_events for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "ai_provider_events_ws_update" on ai_provider_events for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "ai_provider_events_ws_delete" on ai_provider_events for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table integration_execution_logs add column if not exists workspace_id uuid references workspaces(id);
update integration_execution_logs t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table integration_execution_logs alter column workspace_id set not null;
create index if not exists integration_execution_logs_workspace_idx on integration_execution_logs(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'integration_execution_logs' loop
    execute format('drop policy if exists %I on integration_execution_logs', pol.policyname);
  end loop;
end $$;
create policy "integration_execution_logs_ws_select" on integration_execution_logs for select using (is_workspace_member(workspace_id));
create policy "integration_execution_logs_ws_insert" on integration_execution_logs for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "integration_execution_logs_ws_update" on integration_execution_logs for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "integration_execution_logs_ws_delete" on integration_execution_logs for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table usage_counters add column if not exists workspace_id uuid references workspaces(id);
update usage_counters t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table usage_counters alter column workspace_id set not null;
create index if not exists usage_counters_workspace_idx on usage_counters(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'usage_counters' loop
    execute format('drop policy if exists %I on usage_counters', pol.policyname);
  end loop;
end $$;
create policy "usage_counters_ws_select" on usage_counters for select using (is_workspace_member(workspace_id));

alter table marketplace_installations add column if not exists workspace_id uuid references workspaces(id);
update marketplace_installations t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table marketplace_installations alter column workspace_id set not null;
create index if not exists marketplace_installations_workspace_idx on marketplace_installations(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'marketplace_installations' loop
    execute format('drop policy if exists %I on marketplace_installations', pol.policyname);
  end loop;
end $$;
create policy "marketplace_installations_ws_select" on marketplace_installations for select using (is_workspace_member(workspace_id));
create policy "marketplace_installations_ws_insert" on marketplace_installations for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "marketplace_installations_ws_update" on marketplace_installations for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "marketplace_installations_ws_delete" on marketplace_installations for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table marketplace_reviews add column if not exists workspace_id uuid references workspaces(id);
update marketplace_reviews t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table marketplace_reviews alter column workspace_id set not null;
create index if not exists marketplace_reviews_workspace_idx on marketplace_reviews(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'marketplace_reviews' loop
    execute format('drop policy if exists %I on marketplace_reviews', pol.policyname);
  end loop;
end $$;
create policy "marketplace_reviews_ws_select" on marketplace_reviews for select using (is_workspace_member(workspace_id));
create policy "marketplace_reviews_ws_insert" on marketplace_reviews for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "marketplace_reviews_ws_update" on marketplace_reviews for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "marketplace_reviews_ws_delete" on marketplace_reviews for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table billing_events add column if not exists workspace_id uuid references workspaces(id);
update billing_events t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
create index if not exists billing_events_workspace_idx on billing_events(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'billing_events' loop
    execute format('drop policy if exists %I on billing_events', pol.policyname);
  end loop;
end $$;
create policy "billing_events_ws_select" on billing_events for select using (is_workspace_member(workspace_id));

alter table connections add column if not exists workspace_id uuid references workspaces(id);
update connections t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table connections alter column workspace_id set not null;
create index if not exists connections_workspace_idx on connections(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'connections' loop
    execute format('drop policy if exists %I on connections', pol.policyname);
  end loop;
end $$;
create policy "connections_ws_select" on connections for select using (is_workspace_member(workspace_id));
create policy "connections_ws_insert" on connections for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "connections_ws_update" on connections for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "connections_ws_delete" on connections for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table payments add column if not exists workspace_id uuid references workspaces(id);
update payments t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table payments alter column workspace_id set not null;
create index if not exists payments_workspace_idx on payments(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'payments' loop
    execute format('drop policy if exists %I on payments', pol.policyname);
  end loop;
end $$;
create policy "payments_ws_select" on payments for select using (is_workspace_member(workspace_id));

alter table notifications add column if not exists workspace_id uuid references workspaces(id);
update notifications t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table notifications alter column workspace_id set not null;
create index if not exists notifications_workspace_idx on notifications(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'notifications' loop
    execute format('drop policy if exists %I on notifications', pol.policyname);
  end loop;
end $$;
create policy "notifications_ws_select" on notifications for select using (is_workspace_member(workspace_id));
create policy "notifications_ws_insert" on notifications for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "notifications_ws_update" on notifications for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "notifications_ws_delete" on notifications for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table subscriptions add column if not exists workspace_id uuid references workspaces(id);
update subscriptions t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table subscriptions alter column workspace_id set not null;
create index if not exists subscriptions_workspace_idx on subscriptions(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'subscriptions' loop
    execute format('drop policy if exists %I on subscriptions', pol.policyname);
  end loop;
end $$;
create policy "subscriptions_ws_select" on subscriptions for select using (is_workspace_member(workspace_id));

alter table workflows add column if not exists workspace_id uuid references workspaces(id);
update workflows t set workspace_id = w.id
from workspaces w
where w.owner_id = t.user_id and w.is_personal = true and t.workspace_id is null;
alter table workflows alter column workspace_id set not null;
create index if not exists workflows_workspace_idx on workflows(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'workflows' loop
    execute format('drop policy if exists %I on workflows', pol.policyname);
  end loop;
end $$;
create policy "workflows_ws_select" on workflows for select using (is_workspace_member(workspace_id));
create policy "workflows_ws_insert" on workflows for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "workflows_ws_update" on workflows for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "workflows_ws_delete" on workflows for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table workflow_versions add column if not exists workspace_id uuid references workspaces(id);
update workflow_versions t set workspace_id = p.workspace_id
from workflows p
where t.workflow_id = p.id and t.workspace_id is null;
alter table workflow_versions alter column workspace_id set not null;
create index if not exists workflow_versions_workspace_idx on workflow_versions(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'workflow_versions' loop
    execute format('drop policy if exists %I on workflow_versions', pol.policyname);
  end loop;
end $$;
create policy "workflow_versions_ws_select" on workflow_versions for select using (is_workspace_member(workspace_id));
create policy "workflow_versions_ws_insert" on workflow_versions for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "workflow_versions_ws_update" on workflow_versions for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "workflow_versions_ws_delete" on workflow_versions for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table forms add column if not exists workspace_id uuid references workspaces(id);
update forms t set workspace_id = p.workspace_id
from workflows p
where t.workflow_id = p.id and t.workspace_id is null;
alter table forms alter column workspace_id set not null;
create index if not exists forms_workspace_idx on forms(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'forms' loop
    execute format('drop policy if exists %I on forms', pol.policyname);
  end loop;
end $$;
create policy "forms_ws_select" on forms for select using (is_workspace_member(workspace_id));
create policy "forms_ws_insert" on forms for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "forms_ws_update" on forms for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "forms_ws_delete" on forms for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table workflow_runs add column if not exists workspace_id uuid references workspaces(id);
update workflow_runs t set workspace_id = p.workspace_id
from workflows p
where t.workflow_id = p.id and t.workspace_id is null;
alter table workflow_runs alter column workspace_id set not null;
create index if not exists workflow_runs_workspace_idx on workflow_runs(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'workflow_runs' loop
    execute format('drop policy if exists %I on workflow_runs', pol.policyname);
  end loop;
end $$;
create policy "workflow_runs_ws_select" on workflow_runs for select using (is_workspace_member(workspace_id));
create policy "workflow_runs_ws_insert" on workflow_runs for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "workflow_runs_ws_update" on workflow_runs for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "workflow_runs_ws_delete" on workflow_runs for delete using (workspace_role_at_least(workspace_id, 'member'));

alter table workflow_run_steps add column if not exists workspace_id uuid references workspaces(id);
update workflow_run_steps t set workspace_id = p.workspace_id
from workflow_runs p
where t.run_id = p.id and t.workspace_id is null;
alter table workflow_run_steps alter column workspace_id set not null;
create index if not exists workflow_run_steps_workspace_idx on workflow_run_steps(workspace_id);
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'workflow_run_steps' loop
    execute format('drop policy if exists %I on workflow_run_steps', pol.policyname);
  end loop;
end $$;
create policy "workflow_run_steps_ws_select" on workflow_run_steps for select using (is_workspace_member(workspace_id));
create policy "workflow_run_steps_ws_insert" on workflow_run_steps for insert with check (workspace_role_at_least(workspace_id, 'member'));
create policy "workflow_run_steps_ws_update" on workflow_run_steps for update using (workspace_role_at_least(workspace_id, 'member')) with check (workspace_role_at_least(workspace_id, 'member'));
create policy "workflow_run_steps_ws_delete" on workflow_run_steps for delete using (workspace_role_at_least(workspace_id, 'member'));

-- ===================================================================
-- 6. Convenience views satisfying the spec's workspace_usage / workspace_billing naming
-- ===================================================================
-- Implemented as views over the now-workspace-scoped usage_counters / subscriptions
-- tables rather than duplicate physical tables — avoids a second ledger that could
-- drift out of sync. Full billing-dashboard rework lands in Phase 3 of this build.

create or replace view workspace_usage as
select workspace_id, metric_key, period_start, period_end, sum(quantity) as total
from usage_counters
group by workspace_id, metric_key, period_start, period_end;

create or replace view workspace_billing as
select workspace_id, plan, status, provider, paddle_subscription_id, paddle_customer_id,
       credits_remaining, renews_at
from subscriptions;

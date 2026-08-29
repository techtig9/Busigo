-- BusiGo Phase 12 — Advanced Growth Engine
create table if not exists public.growth_plans (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade not null,
 name text not null, objective text not null, status text not null default 'draft' check (status in ('draft','active','paused','completed')),
 target_metric text, target_value numeric, horizon_days integer, strategy jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists growth_plans_user_status_idx on public.growth_plans(user_id,status);

create table if not exists public.growth_audiences (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade not null,
 name text not null, description text, criteria jsonb not null default '{}'::jsonb, estimated_size integer,
 intent_score numeric, lifecycle_stage text, created_at timestamptz not null default now()
);
create index if not exists growth_audiences_user_idx on public.growth_audiences(user_id,created_at desc);

create table if not exists public.growth_campaigns (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade not null,
 plan_id uuid references public.growth_plans(id) on delete set null, audience_id uuid references public.growth_audiences(id) on delete set null,
 name text not null, channel text not null, objective text, status text not null default 'draft' check (status in ('draft','ready','running','paused','completed')),
 budget numeric, expected_revenue numeric, actual_revenue numeric, conversion_target numeric, assets jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists growth_campaigns_user_status_idx on public.growth_campaigns(user_id,status);

create table if not exists public.growth_offers (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade not null,
 name text not null, offer_type text not null, description text, price numeric, discount_pct numeric,
 target_audience text, status text not null default 'draft' check (status in ('draft','active','retired')),
 created_at timestamptz not null default now()
);
create index if not exists growth_offers_user_status_idx on public.growth_offers(user_id,status);

create table if not exists public.growth_playbooks (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade not null,
 name text not null, category text not null, trigger_condition text, steps jsonb not null default '[]'::jsonb,
 expected_outcome text, approval_required boolean not null default true, active boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists growth_playbooks_user_idx on public.growth_playbooks(user_id,active);

create table if not exists public.growth_actions (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade not null,
 plan_id uuid references public.growth_plans(id) on delete set null, campaign_id uuid references public.growth_campaigns(id) on delete set null,
 action_type text not null, title text not null, rationale text, status text not null default 'proposed' check (status in ('proposed','approved','running','completed','failed','cancelled')),
 risk text not null default 'medium' check (risk in ('low','medium','high','critical')), expected_impact numeric,
 actual_impact numeric, requires_approval boolean not null default true, executed_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists growth_actions_user_status_idx on public.growth_actions(user_id,status,created_at desc);

alter table public.growth_plans enable row level security;
alter table public.growth_audiences enable row level security;
alter table public.growth_campaigns enable row level security;
alter table public.growth_offers enable row level security;
alter table public.growth_playbooks enable row level security;
alter table public.growth_actions enable row level security;
create policy "own growth plans" on public.growth_plans for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own growth audiences" on public.growth_audiences for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own growth campaigns" on public.growth_campaigns for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own growth offers" on public.growth_offers for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own growth playbooks" on public.growth_playbooks for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own growth actions" on public.growth_actions for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

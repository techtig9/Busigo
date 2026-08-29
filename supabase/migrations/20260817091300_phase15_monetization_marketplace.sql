-- Phase 15: SaaS monetization, entitlements, usage metering and app marketplace.
create table if not exists public.usage_counters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  metric_key text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  quantity bigint not null default 0,
  updated_at timestamptz not null default now(),
  unique(user_id, metric_key, period_start)
);
create index if not exists usage_counters_user_idx on public.usage_counters(user_id, period_end desc);

create table if not exists public.plan_entitlements (
  id uuid primary key default gen_random_uuid(),
  plan text not null,
  feature_key text not null,
  limit_value bigint,
  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  unique(plan, feature_key)
);

create table if not exists public.marketplace_apps (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  category text not null,
  icon text,
  publisher text not null,
  status text not null default 'published' check (status in ('draft','published','suspended')),
  pricing_model text not null default 'free' check (pricing_model in ('free','paid','usage','contact')),
  price_monthly numeric,
  required_plan text,
  capabilities jsonb not null default '[]'::jsonb,
  permissions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_installations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_id uuid not null references public.marketplace_apps(id) on delete cascade,
  status text not null default 'installed' check (status in ('pending','installed','paused','revoked')),
  configuration jsonb not null default '{}'::jsonb,
  installed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, app_id)
);

create table if not exists public.marketplace_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_id uuid not null references public.marketplace_apps(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  review text,
  created_at timestamptz not null default now(),
  unique(user_id, app_id)
);

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  status text not null default 'received' check (status in ('received','processed','ignored','failed')),
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(provider, provider_event_id)
);

alter table public.usage_counters enable row level security;
alter table public.plan_entitlements enable row level security;
alter table public.marketplace_apps enable row level security;
alter table public.marketplace_installations enable row level security;
alter table public.marketplace_reviews enable row level security;
alter table public.billing_events enable row level security;

create policy "phase15 usage owner" on public.usage_counters for select using (auth.uid() = user_id);
create policy "phase15 usage service write" on public.usage_counters for all using (false) with check (false);
create policy "phase15 entitlements authenticated read" on public.plan_entitlements for select using (auth.role() = 'authenticated');
create policy "phase15 apps public read" on public.marketplace_apps for select using (status = 'published');
create policy "phase15 installations owner" on public.marketplace_installations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "phase15 reviews public read" on public.marketplace_reviews for select using (auth.role() = 'authenticated');
create policy "phase15 reviews owner write" on public.marketplace_reviews for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "phase15 billing owner read" on public.billing_events for select using (auth.uid() = user_id);

insert into public.plan_entitlements(plan, feature_key, limit_value, enabled)
values
('free','team_seats',1,true),('starter','team_seats',3,true),('growth','team_seats',10,true),('pro','team_seats',25,true),('enterprise','team_seats',null,true),
('free','ai_agents',1,true),('starter','ai_agents',3,true),('growth','ai_agents',10,true),('pro','ai_agents',25,true),('enterprise','ai_agents',null,true),
('free','marketplace_installs',2,true),('starter','marketplace_installs',5,true),('growth','marketplace_installs',15,true),('pro','marketplace_installs',50,true),('enterprise','marketplace_installs',null,true)
on conflict(plan, feature_key) do nothing;

insert into public.marketplace_apps(slug,name,description,category,publisher,pricing_model,required_plan,capabilities,permissions)
values
('gmail','Gmail','Send and manage business email through approved BusiGo workflows.','Communication','BusiGo','free','starter','["send_email"]','["email.send"]'),
('google-calendar','Google Calendar','Create and manage calendar events for business operations.','Productivity','BusiGo','free','starter','["create_event"]','["calendar.write"]'),
('slack','Slack','Send operational alerts and team messages to Slack.','Communication','BusiGo','free','growth','["send_message"]','["slack.write"]'),
('hubspot','HubSpot','Create and update CRM contacts from BusiGo agents and workflows.','CRM','BusiGo','free','growth','["create_contact"]','["crm.contacts.write"]'),
('notion','Notion','Create operational pages and knowledge records.','Knowledge','BusiGo','free','growth','["create_page"]','["notion.write"]'),
('airtable','Airtable','Create structured records in operational bases.','Data','BusiGo','free','growth','["create_record"]','["airtable.write"]')
on conflict(slug) do nothing;

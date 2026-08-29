-- BusiGo Phase 2: Connect + Unified Business Data
create table if not exists integration_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  provider text not null,
  display_name text not null,
  status text not null default 'disconnected' check (status in ('disconnected','requested','connected','syncing','error','paused')),
  auth_type text not null default 'oauth' check (auth_type in ('oauth','api_key','service_account','webhook','manual')),
  permissions jsonb not null default '[]',
  scopes jsonb not null default '[]',
  capabilities jsonb not null default '[]',
  metadata jsonb not null default '{}',
  last_sync_at timestamptz,
  next_sync_at timestamptz,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, provider)
);

create table if not exists integration_sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  integration_id uuid references integration_accounts(id) on delete cascade not null,
  status text not null default 'queued' check (status in ('queued','running','success','partial','failed')),
  records_seen int not null default 0,
  records_created int not null default 0,
  records_updated int not null default 0,
  records_failed int not null default 0,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists business_data_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  source_type text not null check (source_type in ('website','document','integration','manual')),
  name text not null,
  url text,
  integration_id uuid references integration_accounts(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','processing','ready','error','paused')),
  content_hash text,
  metadata jsonb not null default '{}',
  last_processed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists unified_business_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  source_id uuid references business_data_sources(id) on delete cascade,
  entity_type text not null,
  external_id text,
  name text,
  data jsonb not null default '{}',
  searchable_text text,
  first_seen_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  unique(user_id, entity_type, external_id)
);

create table if not exists website_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  source_id uuid references business_data_sources(id) on delete cascade not null,
  url text not null,
  status text not null default 'queued' check (status in ('queued','processing','ready','error')),
  pages_discovered int not null default 0,
  pages_processed int not null default 0,
  extracted jsonb not null default '{}',
  findings jsonb not null default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists integration_accounts_user_idx on integration_accounts(user_id);
create index if not exists integration_sync_runs_user_idx on integration_sync_runs(user_id, created_at desc);
create index if not exists business_data_sources_user_idx on business_data_sources(user_id, created_at desc);
create index if not exists unified_business_records_user_entity_idx on unified_business_records(user_id, entity_type);
create index if not exists website_analyses_user_idx on website_analyses(user_id, created_at desc);

alter table integration_accounts enable row level security;
alter table integration_sync_runs enable row level security;
alter table business_data_sources enable row level security;
alter table unified_business_records enable row level security;
alter table website_analyses enable row level security;

do $$
declare t text;
begin
  foreach t in array array['integration_accounts','integration_sync_runs','business_data_sources','unified_business_records','website_analyses'] loop
    execute format('drop policy if exists %I_select on %I', t || '_user_select', t);
    execute format('drop policy if exists %I_insert on %I', t || '_user_insert', t);
    execute format('drop policy if exists %I_update on %I', t || '_user_update', t);
    execute format('drop policy if exists %I_delete on %I', t || '_user_delete', t);
    execute format('create policy %I_user_select on %I for select using (auth.uid() = user_id)', t || '_user_select', t);
    execute format('create policy %I_user_insert on %I for insert with check (auth.uid() = user_id)', t || '_user_insert', t);
    execute format('create policy %I_user_update on %I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t || '_user_update', t);
    execute format('create policy %I_user_delete on %I for delete using (auth.uid() = user_id)', t || '_user_delete', t);
  end loop;
end $$;

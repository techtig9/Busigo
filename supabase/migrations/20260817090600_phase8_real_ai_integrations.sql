-- Phase 8: real AI provider telemetry + webhook ingestion foundation.
create table if not exists public.ai_provider_events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null, model text, event_type text not null, input_summary text, output_summary text,
  status text not null default 'started', latency_ms integer, input_tokens integer, output_tokens integer,
  error_message text, created_at timestamptz not null default now()
);
create index if not exists ai_provider_events_user_created_idx on public.ai_provider_events(user_id, created_at desc);
alter table public.ai_provider_events enable row level security;
drop policy if exists ai_provider_events_owner on public.ai_provider_events;
create policy ai_provider_events_owner on public.ai_provider_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.integration_webhook_events (
  id uuid primary key default gen_random_uuid(), provider text not null, signature text not null,
  payload text not null, status text not null default 'received', processed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists integration_webhook_events_provider_created_idx on public.integration_webhook_events(provider, created_at desc);

-- Service-role webhook ingestion intentionally has no user RLS policy; service role bypasses RLS.
alter table public.integration_webhook_events enable row level security;

create table if not exists public.integration_execution_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null, operation text not null, request_id text, status text not null,
  input jsonb not null default '{}'::jsonb, output jsonb not null default '{}'::jsonb,
  error_message text, created_at timestamptz not null default now()
);
create index if not exists integration_execution_logs_user_created_idx on public.integration_execution_logs(user_id, created_at desc);
alter table public.integration_execution_logs enable row level security;
drop policy if exists integration_execution_logs_owner on public.integration_execution_logs;
create policy integration_execution_logs_owner on public.integration_execution_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

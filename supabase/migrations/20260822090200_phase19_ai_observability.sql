-- Phase 19 — AI gateway observability + circuit-breaker (Master Spec section 4).
-- Builds on the existing ai_provider_events table (phase8), which already has
-- workspace_id from phase18. Adds the remaining fields the spec calls for and a
-- global cooldown table used to skip a provider that's actively rate-limited
-- instead of hitting it on every request.

alter table public.ai_provider_events add column if not exists request_id uuid not null default gen_random_uuid();
alter table public.ai_provider_events add column if not exists failover_reason text;
alter table public.ai_provider_events add column if not exists error_class text
  check (error_class is null or error_class in ('quota_or_rate_limit', 'auth_error', 'invalid_response', 'network_error', 'other'));
alter table public.ai_provider_events add column if not exists credits_consumed numeric;
alter table public.ai_provider_events add column if not exists cost_estimate_usd numeric;

-- user_id was NOT NULL from the original phase8 table (one caller, one user, always).
-- The gateway now logs every provider attempt itself (lib/ai/observability.ts), including
-- from call sites with no single acting user in scope (background retries, future workers) —
-- workspace_id (added in phase18, also NOT NULL) is the real tenant-scoping column going
-- forward, so user_id is relaxed to nullable rather than threading a user id through every
-- gateway call site just to satisfy a constraint that workspace_id already covers.
alter table public.ai_provider_events alter column user_id drop not null;

create index if not exists ai_provider_events_provider_time_idx on public.ai_provider_events(provider, created_at desc);

-- Provider credentials (GROQ_API_KEY etc.) are shared global env vars, not
-- per-workspace — so "is Groq currently rate-limited" is a platform-wide fact,
-- unlike everything else in this migration set. No workspace_id here by design.
create table if not exists public.ai_provider_cooldowns (
  provider text primary key,
  cooling_down_until timestamptz,
  last_error text,
  consecutive_failures int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.ai_provider_cooldowns enable row level security;
drop policy if exists "authenticated users can read provider cooldown state" on public.ai_provider_cooldowns;
create policy "authenticated users can read provider cooldown state" on public.ai_provider_cooldowns
  for select using (auth.role() = 'authenticated');
-- No insert/update/delete policy: written only by the service-role client from
-- lib/ai/observability.ts, mirroring the existing service_health_checks/
-- platform_metrics pattern (phase14) for platform-level, non-tenant data.

-- Phase 9: real OAuth connection vault metadata.
alter table public.connections add column if not exists encrypted_access_token text;
alter table public.connections add column if not exists encrypted_refresh_token text;
alter table public.connections add column if not exists token_expires_at timestamptz;
alter table public.connections add column if not exists provider_account_id text;
alter table public.connections add column if not exists updated_at timestamptz not null default now();
create unique index if not exists connections_user_service_unique on public.connections(user_id, service);
create index if not exists connections_token_expiry_idx on public.connections(token_expires_at);

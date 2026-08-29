create table if not exists public.agent_orchestrations (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 goal text not null, status text not null default 'planned' check(status in ('planned','running','waiting_approval','completed','failed','cancelled')),
 tasks jsonb not null default '[]'::jsonb, current_task_id text, run_count integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists agent_orchestrations_user_idx on public.agent_orchestrations(user_id, created_at desc);
alter table public.agent_orchestrations enable row level security;
drop policy if exists agent_orchestrations_owner on public.agent_orchestrations;
create policy agent_orchestrations_owner on public.agent_orchestrations for all using(auth.uid()=user_id) with check(auth.uid()=user_id);

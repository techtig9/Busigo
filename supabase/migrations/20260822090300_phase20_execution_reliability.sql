-- Phase 20 — Execution reliability (Master Spec section 8): dead-letter support for
-- workflow-run step failures, not just the (currently unused) system_jobs queue.
-- dead_letter_jobs.job_id was NOT NULL and FK'd only to system_jobs — but workflow run
-- retries (lib/engine/retry.ts) dead-letter a run/step, which never was a system_jobs row.

alter table public.dead_letter_jobs alter column job_id drop not null;
alter table public.dead_letter_jobs add column if not exists run_id uuid references public.workflow_runs(id) on delete cascade;
alter table public.dead_letter_jobs add column if not exists step_key text;
alter table public.dead_letter_jobs add column if not exists workflow_id uuid references public.workflows(id) on delete cascade;
-- user_id was NOT NULL from the original phase14 table (always a system_jobs-originated,
-- per-user dead-letter). A run/step dead-letter (lib/platform/reliability.ts writeDeadLetter,
-- called from executor.ts) can originate from a schedule trigger with no single acting user —
-- workspace_id (added in phase18, still NOT NULL) is the real scoping column for these.
alter table public.dead_letter_jobs alter column user_id drop not null;

-- payments.user_id is a billing-contact reference (who initiated the purchase), not the
-- tenant key (workspace_id, from phase18, is) — relaxed to nullable so a webhook payload
-- from Paddle that's missing custom_data.user_id for any reason doesn't reject an otherwise
-- valid payment record.
alter table public.payments alter column user_id drop not null;

do $$ begin
  alter table public.dead_letter_jobs add constraint dead_letter_jobs_origin_check
    check (job_id is not null or run_id is not null);
exception when duplicate_object then null; end $$;

create index if not exists dead_letter_jobs_run_idx on public.dead_letter_jobs(run_id) where run_id is not null;

-- dead_letter_jobs already has workspace_id (added in phase18) with a select-only RLS
-- policy (dead_letter_jobs was registered read-only in that migration's table registry) —
-- members can see what's dead-lettered; replay is a service-role-mediated action
-- (lib/actions/reliability.ts), not a direct client write, so no additional policy needed.

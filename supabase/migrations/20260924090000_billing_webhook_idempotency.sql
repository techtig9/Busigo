-- Webhook idempotency ledger.
--
-- Paddle retries a webhook until it gets a 2xx, and it can deliver the same event more than
-- once even after a success. Every handler in app/api/webhooks/paddle/route.ts was writing
-- unconditionally, so a retry of `transaction.completed` inserted a second payments row and,
-- for a credit top-up, granted the credits AGAIN. A customer who bought 40,000 credits once
-- could receive them several times, at our cost, purely because Paddle retried.
--
-- Recording the event id under a primary key makes replay a no-op: the insert conflicts, the
-- handler returns 200 without touching anything, and Paddle stops retrying.
--
-- Idempotent by construction (IF NOT EXISTS throughout) so re-running the migration chain is
-- safe.

create table if not exists public.billing_webhook_events (
  event_id      text primary key,
  event_type    text not null,
  received_at   timestamptz not null default now()
);

comment on table public.billing_webhook_events is
  'One row per processed billing webhook event. Presence of a row means the event was already applied; handlers must no-op on conflict.';

-- Retention: the table only needs to cover the provider's retry window (Paddle retries for
-- up to 3 days). This index makes the periodic prune cheap.
create index if not exists billing_webhook_events_received_at_idx
  on public.billing_webhook_events (received_at);

alter table public.billing_webhook_events enable row level security;

-- No policies, deliberately. This table is written and read ONLY by the webhook route using
-- the service-role key, which bypasses RLS. With RLS enabled and no policy, anon and
-- authenticated roles can neither read nor write it — which is correct: it is infrastructure
-- bookkeeping, it is not workspace-scoped, and nothing in the product surfaces it.

-- ---------------------------------------------------------------------------------------
-- Atomic credit top-up.
--
-- The webhook previously granted a top-up by reading credits_remaining into application
-- memory, adding to it, and writing the sum back. Two transactions completing close together
-- both read the same starting balance and the second write overwrote the first, so one
-- customer's purchase silently vanished. Doing the addition inside a single UPDATE makes the
-- database serialise it per row, and no read-modify-write window exists to lose.

create or replace function public.increment_subscription_credits(
  p_workspace_id uuid,
  p_amount integer
) returns void
language sql
security definer
set search_path = public
as $$
  update public.subscriptions
     set credits_remaining = credits_remaining + p_amount
   where workspace_id = p_workspace_id;
$$;

comment on function public.increment_subscription_credits(uuid, integer) is
  'Atomically adds credits to a workspace subscription. Called only by the billing webhook with the service-role key.';

-- SECURITY DEFINER means this runs as the function owner and bypasses RLS, so it must not be
-- callable by the public API roles -- otherwise any signed-in user could grant themselves
-- credits. Only the service-role key (which bypasses RLS anyway) needs it.
revoke execute on function public.increment_subscription_credits(uuid, integer) from public;
revoke execute on function public.increment_subscription_credits(uuid, integer) from anon;
revoke execute on function public.increment_subscription_credits(uuid, integer) from authenticated;

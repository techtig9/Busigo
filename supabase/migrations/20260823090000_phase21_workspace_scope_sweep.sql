-- Phase 21 — Workspace-scoping the remaining action files (business-os, workforce,
-- autonomous-ops, connect, marketplace). Several of these upsert on a user_id-based unique
-- constraint (one business profile per user, one agent per user+type, etc.) — converting
-- the app code to key off workspace_id instead requires the matching constraint to exist
-- first, or every upsert would fail with "no unique constraint matching the ON CONFLICT
-- specification". The old user_id-based constraints are left in place (harmless, and
-- dropping them isn't required for correctness) rather than removed.
--
-- Existing data needs no reconciliation here: every current workspace_id value was
-- backfilled 1:1 from a personal workspace (phase18), so today's data can't possibly
-- violate a new workspace_id-based uniqueness rule — the very first time two teammates in
-- the same real (non-personal) workspace both try to save a business profile, the second
-- one will correctly UPDATE the shared row instead of colliding, which is the whole point.

create unique index if not exists businesses_workspace_unique on businesses(workspace_id);
create unique index if not exists business_discovery_answers_workspace_unique on business_discovery_answers(workspace_id, question_key);
create unique index if not exists ai_agents_workspace_unique on ai_agents(workspace_id, agent_type);
create unique index if not exists integration_accounts_workspace_unique on integration_accounts(workspace_id, provider);
create unique index if not exists autonomy_policies_workspace_unique on autonomy_policies(workspace_id, name);
create unique index if not exists marketplace_installations_workspace_unique on marketplace_installations(workspace_id, app_id);

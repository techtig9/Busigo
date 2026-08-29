-- Phase 18b — MFA recovery codes (Master Spec section 7, Authentication).
-- Stored as salted-hash text[] on users, never plaintext. See lib/actions/mfa.ts.
alter table users add column if not exists mfa_recovery_codes text[] not null default '{}';

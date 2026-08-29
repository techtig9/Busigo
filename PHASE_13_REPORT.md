# BusiGo Phase 13 — Security, Compliance & Governance

## Added
- Security event ledger with severity and resolution state
- User-scoped audit trail
- Governance policies for agent/data/financial/autonomous actions
- Privacy/data request tracking for export, deletion and access review
- Access review storage
- Security & Governance dashboard
- Human approval defaults for governance policies
- Tenant/user RLS on all Phase 13 tables

## Safety boundary
Deletion is recorded as a request and is not performed implicitly. Real compliance programs still require deployment-specific legal, retention, DPA, subprocessors, encryption/key-management and incident-response controls.

## Validation
- 5 Phase 13 tables added
- 5 Phase 13 RLS policies added
- Dashboard route added
- Sidebar navigation added
- Server actions authenticate through Supabase session

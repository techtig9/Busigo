// Mirrors the `workspace_role` Postgres enum (supabase/migrations/20260822090000_phase18_workspace_foundation.sql)
// and its workspace_role_rank() function — keep both in sync if this changes.
export type WorkspaceRole = "owner" | "admin" | "manager" | "member" | "viewer" | "billing_admin" | "security_admin";

export const WORKSPACE_ROLES: WorkspaceRole[] = [
  "owner",
  "admin",
  "manager",
  "member",
  "viewer",
  "billing_admin",
  "security_admin",
];

const ROLE_RANK: Record<WorkspaceRole, number> = {
  viewer: 0,
  member: 1,
  billing_admin: 2,
  security_admin: 2,
  manager: 3,
  admin: 4,
  owner: 5,
};

export function roleAtLeast(role: WorkspaceRole, min: WorkspaceRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  member: "Member",
  viewer: "Viewer",
  billing_admin: "Billing Admin",
  security_admin: "Security Admin",
};

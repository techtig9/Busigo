"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { ROLE_LABELS, WORKSPACE_ROLES, type WorkspaceRole } from "@/lib/workspace/roles";
import {
  inviteMemberAction,
  revokeInvitationAction,
  changeMemberRoleAction,
  removeMemberAction,
} from "@/lib/actions/workspace";
import { createApiKeyAction, revokeApiKeyAction } from "@/lib/actions/api-keys";
import { enrollTotpAction, verifyTotpEnrollmentAction, unenrollFactorAction, generateRecoveryCodesAction } from "@/lib/actions/mfa";
import { revokeOtherSessionsAction, revokeAllSessionsAction } from "@/lib/actions/sessions";

export interface MemberRow {
  id: string;
  role: WorkspaceRole;
  joined_at: string;
  users: { id: string; name: string | null; email: string } | { id: string; name: string | null; email: string }[];
}
export interface InvitationRow {
  id: string;
  email: string;
  role: WorkspaceRole;
  status: string;
  created_at: string;
  expires_at: string;
}
export interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}
export interface MfaFactor {
  id: string;
  friendlyName: string | null;
  status: string;
  createdAt: string;
}

function personOf(m: MemberRow) {
  return Array.isArray(m.users) ? m.users[0] : m.users;
}

export function WorkspaceSettingsPanel({
  canManage,
  members,
  invitations,
  apiKeys,
  mfaFactors,
}: {
  canManage: boolean;
  members: MemberRow[];
  invitations: InvitationRow[];
  apiKeys: ApiKeyRow[];
  mfaFactors: MfaFactor[];
}) {
  return (
    <>
      <TeamCard canManage={canManage} members={members} invitations={invitations} />
      {canManage && <ApiKeysCard apiKeys={apiKeys} />}
      <MfaCard factors={mfaFactors} />
      <SessionsCard />
    </>
  );
}

function TeamCard({ canManage, members, invitations }: { canManage: boolean; members: MemberRow[]; invitations: InvitationRow[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <h2 className="font-bold text-ink">Team</h2>
      <div className="mt-3 space-y-2">
        {members.map((m) => {
          const person = personOf(m);
          return (
            <div key={m.id} className="flex items-center justify-between rounded border border-hairline px-3 py-2 text-sm">
              <div>
                <p className="text-ink">{person?.name || person?.email}</p>
                <p className="text-xs text-slate">{person?.email} · joined {formatDate(m.joined_at)}</p>
              </div>
              {canManage ? (
                <div className="flex items-center gap-2">
                  <select
                    defaultValue={m.role}
                    disabled={m.role === "owner" || pending}
                    onChange={(e) => startTransition(async () => {
                      const res = await changeMemberRoleAction(m.id, e.target.value as WorkspaceRole);
                      if (res.error) setError(res.error);
                    })}
                    className="rounded border border-hairline bg-surface px-2 py-1 text-xs text-ink"
                  >
                    {WORKSPACE_ROLES.filter((r) => r !== "owner").map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                    {m.role === "owner" && <option value="owner">Owner</option>}
                  </select>
                  {m.role !== "owner" && (
                    <button
                      disabled={pending}
                      onClick={() => startTransition(async () => {
                        const res = await removeMemberAction(m.id);
                        if (res.error) setError(res.error);
                      })}
                      className="text-xs text-danger hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ) : (
                <Badge tone="slate">{ROLE_LABELS[m.role]}</Badge>
              )}
            </div>
          );
        })}
      </div>

      {invitations.filter((i) => i.status === "pending").length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate">Pending invitations</p>
          <div className="mt-2 space-y-2">
            {invitations.filter((i) => i.status === "pending").map((inv) => (
              <div key={inv.id} className="flex items-center justify-between rounded border border-hairline px-3 py-2 text-sm">
                <span className="text-ink">{inv.email} <span className="text-xs text-slate">· {ROLE_LABELS[inv.role]} · expires {formatDate(inv.expires_at)}</span></span>
                {canManage && (
                  <button
                    onClick={() => startTransition(() => { revokeInvitationAction(inv.id); })}
                    className="text-xs text-danger hover:underline"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {canManage && (
        <form
          action={(fd) => startTransition(async () => {
            const res = await inviteMemberAction(fd);
            if (res.error) setError(res.error);
          })}
          className="mt-4 flex flex-wrap items-center gap-2 border-t border-hairline pt-4"
        >
          <input name="email" type="email" required placeholder="teammate@company.com" className="flex-1 rounded border border-hairline bg-surface px-2 py-1.5 text-sm outline-none focus:border-signal" />
          <select name="role" defaultValue="member" className="rounded border border-hairline bg-surface px-2 py-1.5 text-sm">
            {WORKSPACE_ROLES.filter((r) => r !== "owner").map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
          <Button variant="secondary" disabled={pending}>Invite</Button>
        </form>
      )}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </Card>
  );
}

function ApiKeysCard({ apiKeys }: { apiKeys: ApiKeyRow[] }) {
  const [pending, startTransition] = useTransition();
  const [revealed, setRevealed] = useState<string | null>(null);
  const [name, setName] = useState("");

  return (
    <Card>
      <h2 className="font-bold text-ink">API keys</h2>
      <p className="mt-1 text-xs text-slate">Security Admins only. A new key's full value is shown once — copy it now.</p>

      {revealed && (
        <div className="mt-3 rounded border border-signal bg-signal/5 p-3 text-sm">
          <p className="font-semibold text-ink">Copy this now — it won't be shown again:</p>
          <code className="mt-1 block break-all text-xs text-ink">{revealed}</code>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {apiKeys.map((k) => (
          <div key={k.id} className="flex items-center justify-between rounded border border-hairline px-3 py-2 text-sm">
            <div>
              <p className="text-ink">{k.name} <span className="text-xs text-slate">{k.key_prefix}…</span></p>
              <p className="text-xs text-slate">
                {k.revoked_at ? "Revoked" : k.last_used_at ? `Last used ${formatDate(k.last_used_at)}` : "Never used"} · created {formatDate(k.created_at)}
              </p>
            </div>
            {!k.revoked_at && (
              <button onClick={() => startTransition(() => { revokeApiKeyAction(k.id); })} className="text-xs text-danger hover:underline">Revoke</button>
            )}
          </div>
        ))}
      </div>

      <form
        action={(fd) => startTransition(async () => {
          const res = await createApiKeyAction(fd);
          if (res.plaintextKey) setRevealed(res.plaintextKey);
          setName("");
        })}
        className="mt-4 flex items-center gap-2 border-t border-hairline pt-4"
      >
        <input name="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Key name (e.g. Zapier integration)" className="flex-1 rounded border border-hairline bg-surface px-2 py-1.5 text-sm outline-none focus:border-signal" />
        <Button variant="secondary" disabled={pending}>Create key</Button>
      </form>
    </Card>
  );
}

function MfaCard({ factors }: { factors: MfaFactor[] }) {
  const [pending, startTransition] = useTransition();
  const [enrollment, setEnrollment] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <h2 className="font-bold text-ink">Two-factor authentication</h2>
      <div className="mt-3 space-y-2">
        {factors.map((f) => (
          <div key={f.id} className="flex items-center justify-between rounded border border-hairline px-3 py-2 text-sm">
            <span className="text-ink">{f.friendlyName || "Authenticator app"} <Badge tone={f.status === "verified" ? "success" : "neutral"}>{f.status}</Badge></span>
            <button onClick={() => startTransition(() => { unenrollFactorAction(f.id); })} className="text-xs text-danger hover:underline">Remove</button>
          </div>
        ))}
        {factors.length === 0 && <p className="text-sm text-slate">No authenticator app connected yet.</p>}
      </div>

      {!enrollment ? (
        <Button
          variant="secondary"
          className="mt-3"
          disabled={pending}
          onClick={() => startTransition(async () => {
            const res = await enrollTotpAction();
            if (res.error) setError(res.error);
            else if (res.factorId && res.qrCode && res.secret) setEnrollment({ factorId: res.factorId, qrCode: res.qrCode, secret: res.secret });
          })}
        >
          Add authenticator app
        </Button>
      ) : (
        <div className="mt-3 space-y-2 rounded border border-hairline p-3">
          <img src={enrollment.qrCode} alt="Scan with your authenticator app" className="h-40 w-40" />
          <p className="text-xs text-slate">Or enter manually: <code>{enrollment.secret}</code></p>
          <div className="flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" className="rounded border border-hairline bg-surface px-2 py-1.5 text-sm" />
            <Button
              disabled={pending}
              onClick={() => startTransition(async () => {
                const res = await verifyTotpEnrollmentAction(enrollment.factorId, code);
                if (res.error) setError(res.error);
                else { setEnrollment(null); setCode(""); }
              })}
            >
              Verify
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4 border-t border-hairline pt-4">
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => startTransition(async () => {
            const res = await generateRecoveryCodesAction();
            if (res.codes) setRecoveryCodes(res.codes);
          })}
        >
          Generate recovery codes
        </Button>
        {recoveryCodes && (
          <div className="mt-2 rounded border border-signal bg-signal/5 p-3 text-xs">
            <p className="mb-1 font-semibold text-ink">Save these somewhere safe — shown once:</p>
            <div className="grid grid-cols-2 gap-1 font-mono">
              {recoveryCodes.map((c) => <span key={c}>{c}</span>)}
            </div>
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </Card>
  );
}

function SessionsCard() {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  return (
    <Card>
      <h2 className="font-bold text-ink">Sessions</h2>
      <p className="mt-1 text-xs text-slate">If you suspect another device is signed in as you, sign out everywhere else.</p>
      <div className="mt-3 flex gap-2">
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => startTransition(async () => {
            await revokeOtherSessionsAction();
            setDone(true);
          })}
        >
          Sign out other sessions
        </Button>
        <Button variant="danger" disabled={pending} onClick={() => startTransition(() => { revokeAllSessionsAction(); })}>
          Sign out everywhere
        </Button>
      </div>
      {done && <p className="mt-2 text-xs text-slate">Other sessions have been signed out.</p>}
    </Card>
  );
}

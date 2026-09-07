"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Controls";

const CAPABILITIES: [string, string][] = [
  ["read", "business_data"],
  ["read", "documents"],
  ["read", "crm"],
  ["write", "crm"],
  ["send", "email"],
  ["create", "calendar_event"],
  ["create", "workflow"],
  ["publish", "marketing"],
  ["finance", "invoices"],
];

interface PermissionRow {
  capability: string;
  resource: string;
  allowed: boolean;
  requires_approval: boolean;
}

/**
 * Capability grid for one agent.
 *
 * The checkboxes were raw `<input type="checkbox">` with a wrapping `<label>` containing bare
 * text — visually fine, but no accessible grouping and no visible focus treatment. They now
 * use the design-system Checkbox, which carries its own label association and focus ring.
 *
 * `startOpen` exists because this renders in two places: inline on the card (collapsed behind
 * a toggle, to keep the card compact) and inside the agent drawer's Permissions tab, where a
 * toggle would be a pointless second click.
 */
export function AgentControls({
  agent,
  permissions,
  saveAction,
  startOpen = false,
}: {
  agent: { id: string };
  permissions: any[];
  saveAction: (formData: FormData) => void;
  startOpen?: boolean;
}) {
  const initial: PermissionRow[] = CAPABILITIES.map(([capability, resource]) => {
    const found = permissions.find((p) => p.capability === capability && p.resource === resource);
    return {
      capability,
      resource,
      allowed: found?.allowed ?? false,
      requires_approval: found?.requires_approval ?? true,
    };
  });

  const [rows, setRows] = useState(initial);
  const [open, setOpen] = useState(startOpen);

  const update = (i: number, key: "allowed" | "requires_approval", value: boolean) =>
    setRows((r) => r.map((x, j) => (j === i ? { ...x, [key]: value } : x)));

  return (
    <div className={startOpen ? "" : "mt-4"}>
      {!startOpen && (
        <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? "Hide permissions" : "Permissions & controls"}
        </Button>
      )}

      {open && (
        <form action={saveAction} className={startOpen ? "space-y-3" : "mt-4 space-y-3 rounded-lg border border-hairline bg-surface p-4"}>
          <input type="hidden" name="agent_id" value={agent.id} />
          <input type="hidden" name="permissions" value={JSON.stringify(rows)} />

          <div className="divide-y divide-hairline">
            {rows.map((row, i) => (
              <div
                key={`${row.capability}-${row.resource}`}
                className="flex flex-wrap items-center justify-between gap-3 py-2.5"
              >
                <span className="text-sm text-ink">
                  <strong className="font-semibold capitalize">{row.capability}</strong>{" "}
                  <span className="text-slate">{row.resource.replace(/_/g, " ")}</span>
                </span>
                <span className="flex items-center gap-4">
                  <Checkbox
                    checked={row.allowed}
                    onCheckedChange={(v) => update(i, "allowed", v)}
                    label={<span className="text-xs text-slate">Allowed</span>}
                  />
                  <Checkbox
                    checked={row.requires_approval}
                    onCheckedChange={(v) => update(i, "requires_approval", v)}
                    label={<span className="text-xs text-slate">Needs approval</span>}
                  />
                </span>
              </div>
            ))}
          </div>

          <Button type="submit" size="sm">
            Save permissions
          </Button>
        </form>
      )}
    </div>
  );
}

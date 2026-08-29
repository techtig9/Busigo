"use client";

import { useState } from "react";
import { Braces } from "lucide-react";

export interface AvailableRef {
  key: string; // e.g. "trigger" or "step1"
  label: string; // e.g. "Trigger data" or "1. HTTP Request"
}

/**
 * A small popover of prior-step / trigger references. Since a step's exact output shape
 * isn't known until it actually runs, this offers the reference root (e.g. {{step1}}) plus a
 * free-text suffix for a field path (e.g. {{step1.email}}) rather than pretending to know a
 * fixed schema.
 */
export function MergeFieldPicker({
  available,
  onInsert,
}: {
  available: AvailableRef[];
  onInsert: (token: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState<Record<string, string>>({});

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded border border-hairline px-2 py-1 text-xs text-slate hover:border-signal hover:text-signal"
        title="Insert a merge field"
      >
        <Braces size={13} /> Merge field
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded border border-hairline bg-panel p-3 shadow-md">
          {available.length === 0 ? (
            <p className="text-xs text-slate">No trigger or prior steps to reference yet.</p>
          ) : (
            <ul className="space-y-2">
              {available.map((ref) => (
                <li key={ref.key} className="flex items-center gap-1.5">
                  <span className="w-24 shrink-0 truncate font-mono text-xs text-ink">{ref.label}</span>
                  <input
                    className="w-20 rounded border border-hairline px-1.5 py-0.5 text-xs"
                    placeholder="field"
                    value={path[ref.key] || ""}
                    onChange={(e) => setPath((p) => ({ ...p, [ref.key]: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="rounded bg-signal/10 px-2 py-0.5 text-xs font-semibold text-signal hover:bg-signal/20"
                    onClick={() => {
                      const suffix = path[ref.key] ? `.${path[ref.key]}` : "";
                      onInsert(`{{${ref.key}${suffix}}}`);
                      setOpen(false);
                    }}
                  >
                    Insert
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

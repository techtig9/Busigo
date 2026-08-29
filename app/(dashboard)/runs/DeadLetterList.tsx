"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { replayDeadLetterAction } from "@/lib/actions/reliability";

export interface DeadLetterRow {
  id: string;
  workflow_id: string | null;
  run_id: string | null;
  step_key: string | null;
  reason: string;
  replayed_at: string | null;
  created_at: string;
  workflows: { name: string } | { name: string }[] | null;
}

function workflowName(row: DeadLetterRow): string {
  if (!row.workflows) return "Unknown workflow";
  return Array.isArray(row.workflows) ? row.workflows[0]?.name ?? "Unknown workflow" : row.workflows.name;
}

export function DeadLetterList({ entries, canReplay }: { entries: DeadLetterRow[]; canReplay: boolean }) {
  const [pending, startTransition] = useTransition();
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (entries.length === 0) return <p className="text-sm text-slate">Nothing dead-lettered — every retry that's run has eventually succeeded or is still in progress.</p>;

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-danger">{error}</p>}
      <ul className="divide-y divide-hairline">
        {entries.map((entry) => (
          <li key={entry.id} className="py-2.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-ink">
                  {workflowName(entry)} <span className="text-xs text-slate">— step "{entry.step_key}"</span>
                </p>
                <p className="mt-0.5 truncate text-xs text-slate">{entry.reason}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {entry.replayed_at ? (
                  <Badge tone="neutral">Replayed {formatDate(entry.replayed_at)}</Badge>
                ) : (
                  canReplay && (
                    <button
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          setReplayingId(entry.id);
                          const res = await replayDeadLetterAction(entry.id);
                          if (res.error) setError(res.error);
                          setReplayingId(null);
                        })
                      }
                      className="rounded border border-hairline px-2 py-1 text-xs text-ink transition-colors hover:border-signal hover:text-signal disabled:opacity-40"
                    >
                      {pending && replayingId === entry.id ? "Replaying…" : "Replay"}
                    </button>
                  )
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

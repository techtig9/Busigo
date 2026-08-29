"use client";

import { useTransition } from "react";
import { rollbackToVersionAction, saveVersionAction } from "@/lib/actions/workflows";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";

interface Version {
  id: string;
  created_at: string;
  definition: any[];
}

export function VersionHistory({ workflowId, versions }: { workflowId: string; versions: Version[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() => startTransition(() => saveVersionAction(workflowId))}
      >
        Save version
      </Button>
      {versions.length === 0 ? (
        <p className="text-sm text-slate">No saved versions yet.</p>
      ) : (
        <ul className="divide-y divide-hairline rounded border border-hairline">
          {versions.map((v) => (
            <li key={v.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="text-ink">
                {formatDate(v.created_at)} <span className="text-slate">— {v.definition.length} steps</span>
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => rollbackToVersionAction(workflowId, v.id))}
                className="text-xs font-semibold text-signal hover:underline disabled:opacity-50"
              >
                Roll back
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

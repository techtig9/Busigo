"use client";

import { useState, useTransition } from "react";
import { overrideSubscriptionAction } from "@/lib/actions/admin";
import type { Plan } from "@/types/database";

const PLANS: Plan[] = ["free", "starter", "growth", "pro", "enterprise"];
const STATUSES = ["active", "canceled", "past_due"];

export function SubscriptionOverrideRow({ workspaceId, currentPlan, currentStatus }: { workspaceId: string; currentPlan: Plan; currentStatus: string }) {
  const [plan, setPlan] = useState<Plan>(currentPlan);
  const [status, setStatus] = useState(currentStatus);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1.5">
      <select value={plan} onChange={(e) => setPlan(e.target.value as Plan)} className="rounded border border-hairline px-1.5 py-1 text-xs">
        {PLANS.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border border-hairline px-1.5 py-1 text-xs">
        {STATUSES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => overrideSubscriptionAction(workspaceId, plan, status))}
        className="rounded bg-signal/10 px-2 py-1 text-xs font-semibold text-signal hover:bg-signal/20 disabled:opacity-50"
      >
        {pending ? "..." : "Apply"}
      </button>
    </div>
  );
}

"use client";

import { useTransition } from "react";
import { joinConnectionQueueAction } from "@/lib/actions/connections";
import type { ConnectionService } from "@/types/database";

export function QueueButton({ service, disabled }: { service: ConnectionService; disabled?: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={disabled || pending}
      title={disabled ? "Requires the Pro plan" : undefined}
      onClick={() => startTransition(() => joinConnectionQueueAction(service))}
      className="rounded border border-hairline px-3 py-1 text-xs font-semibold text-ink hover:border-signal disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? "Joining..." : "Join waitlist"}
    </button>
  );
}

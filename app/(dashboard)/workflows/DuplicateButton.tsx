"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { duplicateWorkflowAction } from "@/lib/actions/workflows";

export function DuplicateButton({ workflowId }: { workflowId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const newId = await duplicateWorkflowAction(workflowId);
          router.push(`/workflows/${newId}`);
        })
      }
      className="text-xs font-semibold text-signal hover:underline disabled:opacity-50"
    >
      {pending ? "Duplicating..." : "Duplicate"}
    </button>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { acceptInvitationAction } from "@/lib/actions/workspace";

export function AcceptInviteButton({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="mt-4">
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await acceptInvitationAction(token);
            if (res.error) setError(res.error);
            else router.push("/dashboard");
          })
        }
      >
        Accept invitation
      </Button>
      {error && <p className="mt-2 text-sm text-danger-ink">{error}</p>}
    </div>
  );
}

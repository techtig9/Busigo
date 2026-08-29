"use client";

import { useState, useTransition } from "react";
import { requestPasswordResetAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  if (sent) {
    return (
      <p className="rounded border border-pulse/30 bg-pulse/10 px-3 py-2 text-sm text-ink">
        If an account exists for that email, a reset link is on its way.
      </p>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const result = await requestPasswordResetAction(formData);
          if (result?.error) setError(result.error);
          else setSent(true);
        });
      }}
    >
      {error && <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <div>
        <Label>Email</Label>
        <Input name="email" type="email" required autoComplete="email" />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Sending..." : "Send reset link"}
      </Button>
    </form>
  );
}

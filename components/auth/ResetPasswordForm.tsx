"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePasswordAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";

export function ResetPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const result = await updatePasswordAction(formData);
          if (result?.error) setError(result.error);
          else router.push("/login");
        });
      }}
    >
      {error && <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <div>
        <Label>New password</Label>
        <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Updating..." : "Update password"}
      </Button>
    </form>
  );
}

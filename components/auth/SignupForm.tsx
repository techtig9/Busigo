"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signUpAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import Link from "next/link";

export function SignupForm() {
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
          const result = await signUpAction(formData);
          if (result?.error) setError(result.error);
          else router.push("/login?verify=1");
        });
      }}
    >
      {error && <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger-ink">{error}</p>}
      <div>
        <Label htmlFor="signupform-name">Name</Label>
        <Input id="signupform-name" name="name" required autoComplete="name" />
      </div>
      <div>
        <Label htmlFor="signupform-email">Email</Label>
        <Input id="signupform-email" name="email" type="email" required autoComplete="email" />
      </div>
      <div>
        <Label htmlFor="signupform-password">Password</Label>
        <Input id="signupform-password" name="password" type="password" required minLength={8} autoComplete="new-password" />
        <p className="mt-1 text-xs text-slate">At least 8 characters.</p>
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating account..." : "Create account"}
      </Button>
      <p className="text-center text-sm text-slate">
        Already have an account?{" "}
        <Link href="/login" className="text-signal hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}

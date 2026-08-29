"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signInAction, signInWithGoogleAction } from "@/lib/actions/auth";
import { checkMfaChallengeNeededAction } from "@/lib/actions/mfa";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import Link from "next/link";

export function LoginForm({ justVerified }: { justVerified?: boolean }) {
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
          const result = await signInAction(formData);
          if (result?.error) {
            setError(result.error);
            return;
          }
          // A verified authenticator factor doesn't stop signInAction from issuing a session
          // (Supabase always does, at AAL1) — this check is what routes to the challenge
          // screen instead of straight to the dashboard. middleware.ts is the actual
          // enforcement boundary (it redirects here from any protected page too); this is
          // just getting the person to the right next step immediately after login.
          const mfa = await checkMfaChallengeNeededAction();
          router.push(mfa.needed ? "/mfa-challenge" : "/dashboard");
        });
      }}
    >
      {justVerified && (
        <p className="rounded border border-pulse/30 bg-pulse/10 px-3 py-2 text-sm text-ink">
          Check your inbox to verify your email, then log in below.
        </p>
      )}
      {error && <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <div>
        <Label>Email</Label>
        <Input name="email" type="email" required autoComplete="email" />
      </div>
      <div>
        <Label>Password</Label>
        <Input name="password" type="password" required autoComplete="current-password" />
      </div>
      <div className="flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-signal hover:underline">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Logging in..." : "Log In"}
      </Button>
      <form action={signInWithGoogleAction}>
        <Button type="submit" variant="secondary" className="w-full">
          Continue with Google
        </Button>
      </form>
      <p className="text-center text-sm text-slate">
        No account?{" "}
        <Link href="/signup" className="text-signal hover:underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { checkMfaChallengeNeededAction, verifyLoginChallengeAction, redeemRecoveryCodeAtLoginAction } from "@/lib/actions/mfa";
import { signOutAction } from "@/lib/actions/auth";

export function MfaChallengeForm() {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"totp" | "recovery">("totp");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    checkMfaChallengeNeededAction().then((res) => {
      if (!res.needed) {
        router.replace("/dashboard");
        return;
      }
      setFactorId(res.factorId ?? null);
    });
  }, [router]);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result =
        mode === "totp" && factorId
          ? await verifyLoginChallengeAction(factorId, code)
          : await redeemRecoveryCodeAtLoginAction(code);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/dashboard");
    });
  };

  return (
    <div className="space-y-4">
      {error && <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger-ink">{error}</p>}

      {mode === "totp" ? (
        <>
          <div>
            <Label htmlFor="mfachallengefo-authenticator-code">Authenticator code</Label>
            <Input id="mfachallengefo-authenticator-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder="123456"
            />
          </div>
          <Button onClick={submit} disabled={pending || !code || !factorId} className="w-full">
            {pending ? "Verifying..." : "Verify"}
          </Button>
          <button type="button" onClick={() => { setMode("recovery"); setCode(""); setError(null); }} className="w-full text-center text-sm text-signal hover:underline">
            Lost access to your authenticator?
          </button>
        </>
      ) : (
        <>
          <div>
            <Label htmlFor="mfachallengefo-recovery-code">Recovery code</Label>
            <Input id="mfachallengefo-recovery-code" value={code} onChange={(e) => setCode(e.target.value)} autoFocus placeholder="xxxxx-xxxxx" />
            <p className="mt-1 text-xs text-slate">
              Using a recovery code removes two-factor authentication from your account — you&apos;ll be prompted to set it
              up again from Settings.
            </p>
          </div>
          <Button onClick={submit} disabled={pending || !code} className="w-full">
            {pending ? "Verifying..." : "Use recovery code"}
          </Button>
          <button type="button" onClick={() => { setMode("totp"); setCode(""); setError(null); }} className="w-full text-center text-sm text-signal hover:underline">
            Back to authenticator code
          </button>
        </>
      )}

      <form action={signOutAction}>
        <button type="submit" className="w-full text-center text-xs text-slate hover:underline">
          Sign out
        </button>
      </form>
    </div>
  );
}

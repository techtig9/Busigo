import { MfaChallengeForm } from "@/components/auth/MfaChallengeForm";

export const metadata = { title: "Verify it's you" };

export default function MfaChallengePage() {
  return (
    <div className="mx-auto flex max-w-sm flex-col justify-center px-6 py-20">
      <h1 className="mb-1 text-2xl font-bold text-ink">Verify it's you</h1>
      <p className="mb-6 text-sm text-slate">Enter the 6-digit code from your authenticator app.</p>
      <MfaChallengeForm />
    </div>
  );
}

import { AlertTriangle } from "lucide-react";
import { LoginForm } from "@/components/auth/LoginForm";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const metadata = { title: "Log in" };

export default function LoginPage({ searchParams }: { searchParams: { verify?: string; unconfigured?: string } }) {
  // middleware sends every auth-gated route here with ?unconfigured=1 when this deployment
  // has no Supabase credentials. Saying so plainly beats letting someone type real
  // credentials into a form that cannot possibly work and get a bare network error.
  const unconfigured = searchParams.unconfigured === "1" || !isSupabaseConfigured();

  return (
    <div className="mx-auto flex max-w-sm flex-col justify-center px-6 py-20">
      <h1 className="mb-6 text-2xl font-bold text-ink">Log in</h1>

      {unconfigured && (
        <div
          role="status"
          className="mb-4 flex items-start gap-2.5 rounded-lg border border-warn/30 bg-warn-soft px-3.5 py-3"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warn-ink" aria-hidden />
          <div className="text-sm text-ink">
            <p className="font-semibold">This preview has no database connected.</p>
            <p className="mt-1 text-slate">
              The marketing pages and design system work, but signing in needs Supabase credentials
              (<code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>). Everything behind the login is
              intentionally unreachable until they are set.
            </p>
          </div>
        </div>
      )}

      <LoginForm justVerified={searchParams.verify === "1"} />
    </div>
  );
}

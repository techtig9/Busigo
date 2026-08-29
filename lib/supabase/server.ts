import { createServerClient } from "@supabase/ssr";
import { createClient as createRawClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Server-side Supabase client bound to the current request's cookies. Respects RLS
// as the logged-in user — use this in Server Components, Server Actions, and route handlers
// that act on behalf of the signed-in user.
//
// Uses the getAll/setAll cookie interface, which is what @supabase/ssr 0.5.x documents (the
// older per-cookie get/set/remove style from earlier versions is deprecated and can silently
// break multi-cookie session chunking).
export function createServerSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component render, which can't set cookies — safe to
            // ignore because middleware refreshes the session cookie on every request.
          }
        },
      },
    }
  );
}

// Service-role client — bypasses RLS entirely. Only ever import this in server-only code
// that must act outside a specific user's session: the webhook/cron execution engine, the
// Paddle webhook handler, and the admin panel. NEVER import this from a Client Component
// or expose SUPABASE_SERVICE_ROLE_KEY to the browser.
export function createServiceRoleSupabase() {
  return createRawClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

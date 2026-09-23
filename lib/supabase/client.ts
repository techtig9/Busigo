"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client. Uses the anon key + RLS — safe to use in Client Components.
//
// The two values are read as LITERAL `process.env.NEXT_PUBLIC_*` expressions, and must stay
// that way. Next.js inlines these into the client bundle by textual substitution at build
// time; there is no `process.env` object in a browser. Any indirection — a dynamic key like
// `process.env[name]`, or a shared helper that takes the name as an argument — is not
// substituted, evaluates to undefined at runtime, and silently breaks every browser-side
// Supabase call. This is why the server's `requireEnv` helper is deliberately not used here.
//
// The explicit check replaces a pair of non-null assertions, which claimed to the type checker
// that the values were present and, when they were not, handed `undefined` to the constructor
// to fail later inside the library with no mention of which variable was missing.
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured in the client bundle. NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY must be set at BUILD time, not only at runtime — " +
        "Next.js inlines them into the bundle, so adding them afterwards requires a redeploy. " +
        "See docs/vercel-deployment.md."
    );
  }

  return createBrowserClient(url, anonKey);
}

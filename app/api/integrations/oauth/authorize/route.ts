import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { buildAuthorizationUrl, createOAuthState, isOAuthProvider } from "@/lib/integrations/oauth";

export async function GET(request: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const provider = new URL(request.url).searchParams.get("provider") || "";
  if (!isOAuthProvider(provider)) return NextResponse.json({ error: "Unsupported OAuth provider" }, { status: 400 });
  try { return NextResponse.redirect(buildAuthorizationUrl(provider, createOAuthState(user.id, provider))); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "OAuth configuration error" }, { status: 503 }); }
}

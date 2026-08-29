import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { exchangeCode, verifyOAuthState } from "@/lib/integrations/oauth";
import { encryptSecret } from "@/lib/integrations/secret-vault";

export async function GET(request: Request) {
  const url = new URL(request.url); const code = url.searchParams.get("code"); const state = url.searchParams.get("state"); const error = url.searchParams.get("error");
  if (error) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/connect?oauth_error=${encodeURIComponent(error)}`);
  if (!code || !state) return NextResponse.json({ error: "Missing OAuth code/state" }, { status: 400 });
  const verified = verifyOAuthState(state); if (!verified) return NextResponse.json({ error: "Invalid or expired OAuth state" }, { status: 400 });
  const supabase = createServerSupabase(); const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== verified.userId) return NextResponse.json({ error: "OAuth session mismatch" }, { status: 403 });
  try {
    const token = await exchangeCode(verified.provider, code);
    const encryptedAccess = encryptSecret(token.access_token);
    const encryptedRefresh = token.refresh_token ? encryptSecret(token.refresh_token) : null;
    const { error: dbError } = await supabase.from("connections").upsert({ user_id: user.id, service: verified.provider, status: "connected", encrypted_access_token: encryptedAccess, encrypted_refresh_token: encryptedRefresh, token_expires_at: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null, provider_account_id: token.workspace_id || token.bot_id || null, updated_at: new Date().toISOString() }, { onConflict: "user_id,service" });
    if (dbError) throw dbError;
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/connect?connected=${verified.provider}`);
  } catch (e) { return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/connect?oauth_error=${encodeURIComponent(e instanceof Error ? e.message : "OAuth callback failed")}`); }
}

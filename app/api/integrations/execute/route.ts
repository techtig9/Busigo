import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/integrations/secret-vault";
import { executeReal } from "@/lib/integrations/real-adapters";
import type { IntegrationProvider } from "@/lib/integrations/types";

const risky = new Set(["send_email", "send_message", "create_event", "append_values", "create_contact", "create_page", "create_record"]);
export async function POST(request: Request) {
  const supabase = createServerSupabase(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await request.json(); const provider = String(body.provider) as IntegrationProvider; const operation = String(body.operation); const input = body.input && typeof body.input === "object" ? body.input : {};
  if (!provider || !operation) return NextResponse.json({ error: "provider and operation are required" }, { status: 400 });
  if (risky.has(operation) && body.approved !== true) return NextResponse.json({ error: "Human approval is required before external execution.", requires_approval: true }, { status: 409 });
  const { data: connection, error } = await supabase.from("connections").select("id,encrypted_access_token,status").eq("user_id", user.id).eq("service", provider).eq("status", "connected").maybeSingle();
  if (error || !connection?.encrypted_access_token) return NextResponse.json({ error: "No connected account for this provider." }, { status: 412 });
  const started = Date.now(); let result;
  try { result = await executeReal(provider, decryptSecret(connection.encrypted_access_token), operation, input); } catch (e) { result = { ok: false, provider, operation, error: e instanceof Error ? e.message : "Execution failed" }; }
  await supabase.from("integration_execution_logs").insert({ user_id: user.id, provider, operation, request_id: crypto.randomUUID(), status: result.ok ? "succeeded" : "failed", input, output: result.data ?? {}, error_message: result.error ?? null });
  return NextResponse.json({ ...result, duration_ms: Date.now() - started }, { status: result.ok ? 200 : 502 });
}

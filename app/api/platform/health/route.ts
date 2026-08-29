import { createServiceRoleSupabase } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const started = Date.now();
  const supabase = createServiceRoleSupabase();
  const { error } = await supabase.from("platform_metrics").select("id").limit(1);
  const latency = Date.now() - started;
  const status = error ? "degraded" : "healthy";
  await supabase.from("service_health_checks").insert({ service_name: "supabase", status, latency_ms: latency, details: error ? { message: error.message } : {} });
  return NextResponse.json({ status, latency_ms: latency, services: { database: status }, timestamp: new Date().toISOString() }, { status: status === "healthy" ? 200 : 503 });
}

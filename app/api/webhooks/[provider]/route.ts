import { NextResponse } from "next/server";
import { createServiceRoleSupabase } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: { provider: string } }) {
  const provider = params.provider;
  const signature = request.headers.get("x-busigo-signature");
  if (!signature) return NextResponse.json({ error: "Missing webhook signature" }, { status: 401 });
  const body = await request.text();
  const supabase = createServiceRoleSupabase();
  const { error } = await supabase.from("integration_webhook_events").insert({ provider, signature, payload: body.slice(0, 50000), status: "received" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ accepted: true });
}

import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getAIProviderStatus } from "@/lib/ai/provider";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return NextResponse.json({
    order: ["groq", "cerebras", "openrouter", "anthropic"],
    providers: getAIProviderStatus(),
  });
}

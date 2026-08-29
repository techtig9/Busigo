import { createHmac, timingSafeEqual } from "node:crypto";
import { createServiceRoleSupabase } from "@/lib/supabase/server";
import { PLAN_CREDITS } from "@/lib/plans";
import type { Plan } from "@/types/database";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Paddle Billing signs webhooks as `Paddle-Signature: ts=<unix>;h1=<hex hmac>`, where the HMAC
// is SHA-256 of `${ts}:${rawBody}` keyed with your notification webhook secret. Verifying this
// (rather than trusting the payload) is what stops someone from POSTing a fake
// "subscription upgraded" event straight at this endpoint.
function verifySignature(rawBody: string, header: string | null): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(";").map((p) => p.split("=") as [string, string]));
  const { ts, h1 } = parts;
  if (!ts || !h1) return false;

  const expected = createHmac("sha256", process.env.PADDLE_WEBHOOK_SECRET || "")
    .update(`${ts}:${rawBody}`)
    .digest("hex");

  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(h1, "hex");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

// Paddle price IDs -> internal plan names. Fill these in from your Paddle catalog once the
// Starter/Growth/Pro products are created there.
const PRICE_TO_PLAN: Record<string, Plan> = {
  // pri_starter_xxx: "starter",
  // pri_growth_xxx: "growth",
  // pri_pro_xxx: "pro",
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("paddle-signature");

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const supabase = createServiceRoleSupabase();
  const eventType = event.event_type as string;
  const data = event.data;

  try {
    switch (eventType) {
      case "subscription.created":
      case "subscription.updated": {
        const priceId = data.items?.[0]?.price?.id;
        const plan = PRICE_TO_PLAN[priceId] || "free";
        const workspaceId = data.custom_data?.workspace_id;
        if (!workspaceId) break;

        const status = data.status === "active" || data.status === "trialing" ? "active" : data.status;

        await supabase
          .from("subscriptions")
          .update({
            plan,
            status,
            paddle_subscription_id: data.id,
            paddle_customer_id: data.customer_id,
            credits_remaining: PLAN_CREDITS[plan],
            renews_at: data.next_billed_at,
          })
          .eq("workspace_id", workspaceId);
        break;
      }

      case "subscription.canceled": {
        await supabase
          .from("subscriptions")
          .update({ plan: "free", status: "canceled", credits_remaining: PLAN_CREDITS.free })
          .eq("paddle_subscription_id", data.id);
        break;
      }

      case "transaction.completed": {
        const workspaceId = data.custom_data?.workspace_id;
        const billingUserId = data.custom_data?.user_id; // billing contact — see payments.user_id note below
        const topupCredits = Number(data.custom_data?.topup_credits || 0);

        if (workspaceId) {
          // payments.user_id is NOT NULL and records who initiated the purchase (the billing
          // contact), same as subscriptions.user_id — workspace_id is the tenant-scoping column
          // both the RLS policy and this handler actually key off of.
          await supabase.from("payments").insert({
            user_id: billingUserId ?? null,
            workspace_id: workspaceId,
            paddle_transaction_id: data.id,
            amount: Number(data.details?.totals?.total || 0) / 100,
            status: "completed",
          });

          // A credit top-up is a one-time purchase, not a plan change — the client tags the
          // checkout with topup_credits in custom_data (see BuyCreditsButton) so this webhook
          // can tell it apart from a subscription-plan transaction and just add credits.
          if (topupCredits > 0) {
            const { data: sub } = await supabase
              .from("subscriptions")
              .select("id, credits_remaining")
              .eq("workspace_id", workspaceId)
              .single();
            if (sub) {
              await supabase
                .from("subscriptions")
                .update({ credits_remaining: sub.credits_remaining + topupCredits })
                .eq("id", sub.id);
            }
          }
        }
        break;
      }

      case "transaction.payment_failed": {
        const workspaceId = data.custom_data?.workspace_id;
        const billingUserId = data.custom_data?.user_id;
        if (workspaceId) {
          await supabase.from("payments").insert({
            user_id: billingUserId ?? null,
            workspace_id: workspaceId,
            paddle_transaction_id: data.id,
            amount: Number(data.details?.totals?.total || 0) / 100,
            status: "failed",
          });
        }
        break;
      }

      default:
        break; // ignore event types we don't act on
    }
  } catch (e: any) {
    console.error("Paddle webhook processing error", e);
    return NextResponse.json({ error: "Processing error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

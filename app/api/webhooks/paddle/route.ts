import { createHmac, timingSafeEqual } from "node:crypto";
import { createServiceRoleSupabase } from "@/lib/supabase/server";
import { PLAN_CREDITS } from "@/lib/plans";
import { priceToPlan } from "@/lib/billing/paddle-plans";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Paddle Billing signs webhooks as `Paddle-Signature: ts=<unix>;h1=<hex hmac>`, where the HMAC
// is SHA-256 of `${ts}:${rawBody}` keyed with your notification webhook secret. Verifying this
// (rather than trusting the payload) is what stops someone from POSTing a fake
// "subscription upgraded" event straight at this endpoint.
//
// The secret is checked for presence FIRST, and its absence rejects the request. Previously
// the key fell back to "" and verification proceeded: HMAC with an empty key is a perfectly
// computable value, so on any deployment where PADDLE_WEBHOOK_SECRET was unset, anyone who
// noticed could sign their own "subscription.updated" and grant themselves the Pro plan. An
// unconfigured verifier must refuse, not verify against a known key.
function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) return false;
  if (!header) return false;

  const parts = Object.fromEntries(header.split(";").map((p) => p.split("=") as [string, string]));
  const { ts, h1 } = parts;
  if (!ts || !h1) return false;

  const expected = createHmac("sha256", secret).update(`${ts}:${rawBody}`).digest("hex");

  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(h1, "hex");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("paddle-signature");

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const supabase = createServiceRoleSupabase();
  const eventType = event.event_type as string;
  const eventId = event.event_id as string | undefined;
  const data = event.data;

  // Idempotency gate. Paddle retries until it gets a 2xx and can redeliver even after one,
  // and every handler below writes unconditionally -- so without this, a retried
  // `transaction.completed` inserted a duplicate payment row and granted a credit top-up a
  // second time, at our expense. Claiming the event id under a primary key makes the replay
  // a no-op: the insert conflicts, we acknowledge, and Paddle stops retrying.
  //
  // Claimed BEFORE the work rather than after, because the failure we care about is
  // double-granting credits. If processing then fails we return 500 and Paddle retries into
  // the conflict, so the event is dropped rather than applied twice -- the safe direction for
  // money. The delivery is still recorded, so a dropped event is visible in the table rather
  // than lost silently.
  if (eventId) {
    const { error: claimError } = await supabase
      .from("billing_webhook_events")
      .insert({ event_id: eventId, event_type: eventType });
    if (claimError) {
      // 23505 = unique_violation: already processed. Anything else is a real database
      // problem, and returning 500 lets Paddle retry rather than silently dropping the event.
      if (claimError.code === "23505") {
        return NextResponse.json({ received: true, duplicate: true });
      }
      console.error("Paddle webhook idempotency claim failed", claimError);
      return NextResponse.json({ error: "Processing error" }, { status: 500 });
    }
  }

  try {
    switch (eventType) {
      case "subscription.created":
      case "subscription.updated": {
        const workspaceId = data.custom_data?.workspace_id;
        if (!workspaceId) break;

        const priceId = data.items?.[0]?.price?.id;
        const plan = priceToPlan(priceId);
        const status = data.status === "active" || data.status === "trialing" ? "active" : data.status;

        // Always safe to record: these describe the subscription itself, not entitlement.
        const update: Record<string, unknown> = {
          status,
          paddle_subscription_id: data.id,
          paddle_customer_id: data.customer_id,
          renews_at: data.next_billed_at,
        };

        if (plan === null) {
          // An unrecognised price means this deployment's environment does not describe the
          // product the customer just bought. That is a configuration gap on our side. The
          // old code wrote "free" here, taking paid access away from someone who had just
          // paid; leaving the plan untouched is the only safe response, and the log is what
          // tells an operator to add the missing NEXT_PUBLIC_PADDLE_PRICE_* variable.
          console.error(
            `Paddle webhook: price "${priceId}" is not mapped to a plan. Subscription ` +
              `status recorded, plan left unchanged. Set the matching ` +
              `NEXT_PUBLIC_PADDLE_PRICE_* variable so this price grants its plan.`
          );
        } else {
          update.plan = plan;

          // Credits are only reset when the plan actually changes. `subscription.updated`
          // fires for things that have nothing to do with entitlement -- a new payment
          // method, an address correction, a scheduled change being recorded -- and the old
          // code reset credits_remaining to the full allowance on every one of them. A
          // customer who had spent 90% of their month's credits got them all back by
          // updating their card. Renewals arrive as transaction events and are handled there.
          const { data: current } = await supabase
            .from("subscriptions")
            .select("plan")
            .eq("workspace_id", workspaceId)
            .maybeSingle();
          if (current?.plan !== plan) update.credits_remaining = PLAN_CREDITS[plan];
        }

        await supabase.from("subscriptions").update(update).eq("workspace_id", workspaceId);
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
            const { error } = await supabase.rpc("increment_subscription_credits", {
              p_workspace_id: workspaceId,
              p_amount: topupCredits,
            });
            // Read-modify-write in application code lost a grant whenever two transactions
            // landed together: both read the same balance and the second overwrote the first.
            // The RPC does it as a single UPDATE ... SET credits_remaining = credits_remaining
            // + n, which the database serialises per row.
            if (error) throw error;
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

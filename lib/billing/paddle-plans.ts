import type { Plan } from "@/types/database";

/**
 * Paddle price ID -> internal plan.
 *
 * This used to be a hardcoded object in the webhook route with every entry commented out,
 * waiting for someone to paste real price IDs in. Nobody did, and the lookup fell back to
 * `|| "free"` — so every `subscription.created` and `subscription.updated` recorded a paying
 * customer as free, with free-tier credits. The bug was invisible until the first real
 * payment.
 *
 * The price IDs already exist in the environment: the checkout buttons read
 * NEXT_PUBLIC_PADDLE_PRICE_{STARTER,GROWTH,PRO}[_YEARLY] to open the overlay. Deriving the
 * reverse map from those same variables means there is exactly one place to configure a
 * price, and the side that opens the checkout can never disagree with the side that grants
 * the plan.
 *
 * Read per call rather than at module scope so a value added to the environment takes effect
 * without a rebuild, and so importing this module never depends on env being present.
 */
export function priceToPlan(priceId: string | undefined | null): Plan | null {
  if (!priceId) return null;
  const map: Record<string, Plan> = {};
  const add = (id: string | undefined, plan: Plan) => {
    if (id) map[id] = plan;
  };
  add(process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER, "starter");
  add(process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER_YEARLY, "starter");
  add(process.env.NEXT_PUBLIC_PADDLE_PRICE_GROWTH, "growth");
  add(process.env.NEXT_PUBLIC_PADDLE_PRICE_GROWTH_YEARLY, "growth");
  add(process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO, "pro");
  add(process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_YEARLY, "pro");
  return map[priceId] ?? null;
}

/**
 * Whether a price ID is configured at all.
 *
 * `priceToPlan` returning null is deliberately NOT treated as "free". An unrecognised price
 * means this deployment's environment does not describe the product the customer just bought
 * — a configuration gap, not a downgrade — and the only safe response is to leave the plan
 * untouched and say so loudly. Writing "free" there takes paid access away from someone who
 * has just paid.
 */
export function isConfiguredPrice(priceId: string | undefined | null): boolean {
  return priceToPlan(priceId) !== null;
}

"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { PLAN_CREDITS, PLAN_PRICE_USD, ANNUAL_DISCOUNT_PCT, annualMonthlyPrice, planLabel } from "@/lib/pricing";
import { CheckoutButton } from "./CheckoutButton";
import type { Plan } from "@/types/database";

const UPGRADE_PLANS: { id: "starter" | "growth" | "pro" }[] = [
  { id: "starter" },
  { id: "growth" },
  { id: "pro" },
];

export function PlanCards({ currentPlan, userId, workspaceId }: { currentPlan: Plan; userId: string; workspaceId: string }) {
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");

  return (
    <div>
      <div className="mb-4 flex items-center justify-center gap-3">
        <span className={cycle === "monthly" ? "font-semibold text-ink" : "text-slate"}>Monthly</span>
        <button
          type="button"
          role="switch"
          aria-checked={cycle === "yearly"}
          onClick={() => setCycle(cycle === "monthly" ? "yearly" : "monthly")}
          className="relative h-6 w-11 rounded-full bg-hairline transition-colors data-[on=true]:bg-signal"
          data-on={cycle === "yearly"}
        >
          <span
            className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
            style={{ transform: cycle === "yearly" ? "translateX(22px)" : "translateX(2px)" }}
          />
        </button>
        <span className={cycle === "yearly" ? "font-semibold text-ink" : "text-slate"}>
          Annual <span className="text-signal">(save {ANNUAL_DISCOUNT_PCT}%)</span>
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {UPGRADE_PLANS.map((p) => {
          const monthlyPrice = PLAN_PRICE_USD[p.id];
          const yearlyMonthlyEquivalent = annualMonthlyPrice(p.id);
          const displayPrice = cycle === "yearly" ? yearlyMonthlyEquivalent : monthlyPrice;
          const yearlyTotal = yearlyMonthlyEquivalent != null ? Math.round(yearlyMonthlyEquivalent * 12 * 100) / 100 : null;

          return (
            <div
              key={p.id}
              className="rounded border border-hairline p-4 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-signal hover:shadow-md"
            >
              <p className="font-semibold text-ink">{planLabel(p.id)}</p>
              <p className="mt-1 text-2xl font-bold text-ink">
                ${displayPrice}
                <span className="text-sm font-normal text-slate">/mo</span>
              </p>
              {cycle === "yearly" && yearlyTotal != null && (
                <p className="text-xs text-slate">billed ${yearlyTotal}/yr</p>
              )}
              <p className="mt-1 text-xs text-slate">{PLAN_CREDITS[p.id].toLocaleString()} credits/mo</p>
              <div className="mt-3">
                {currentPlan === p.id ? (
                  <Badge tone="signal">Current plan</Badge>
                ) : (
                  <CheckoutButton
                    plan={p.id}
                    cycle={cycle}
                    userId={userId}
                    workspaceId={workspaceId}
                    label={`Upgrade to ${planLabel(p.id)}`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

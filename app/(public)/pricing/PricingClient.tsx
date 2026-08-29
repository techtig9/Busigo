"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PLAN_CREDITS,
  PLAN_PRICE_USD,
  PLAN_LIMITS,
  ANNUAL_DISCOUNT_PCT,
  LAUNCH_DISCOUNT_PCT,
  annualMonthlyPrice,
  planLabel,
} from "@/lib/pricing";
import type { Plan } from "@/types/database";

const DISPLAY_PLANS: Plan[] = ["free", "starter", "growth", "pro"];
const FEATURE_ROWS: { label: string; key: keyof (typeof PLAN_LIMITS)["free"] | "credits" }[] = [
  { label: "Monthly credits", key: "credits" },
  { label: "Workflows", key: "maxWorkflows" },
  { label: "Steps per workflow", key: "maxStepsPerWorkflow" },
  { label: "AI Action step", key: "aiActionStep" },
  { label: "Version history", key: "versionHistory" },
  { label: "App connections", key: "appConnections" },
  { label: "Priority generation", key: "priorityGeneration" },
  { label: "Run analytics", key: "runAnalytics" },
  { label: "Support", key: "support" },
];

function renderCell(plan: Plan, key: (typeof FEATURE_ROWS)[number]["key"]) {
  if (key === "credits") return PLAN_CREDITS[plan].toLocaleString();
  const v = PLAN_LIMITS[plan][key as keyof (typeof PLAN_LIMITS)["free"]];
  if (typeof v === "boolean") return v ? <Check size={16} className="mx-auto text-signal" /> : <X size={16} className="mx-auto text-hairline" />;
  if (v === Infinity) return "Unlimited";
  return String(v);
}

export function PricingClient() {
  const [annual, setAnnual] = useState(false);

  return (
    <div>
      <div className="mb-8 flex items-center justify-center gap-3">
        <span className={cn("text-sm", !annual ? "text-ink" : "text-slate")}>Monthly</span>
        <button
          onClick={() => setAnnual((v) => !v)}
          className={cn(
            "relative h-6 w-11 rounded-full transition-colors duration-200",
            annual ? "bg-signal" : "bg-hairline"
          )}
          aria-label="Toggle annual billing"
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
              annual ? "translate-x-[22px]" : "translate-x-0.5"
            )}
          />
        </button>
        <span className={cn("text-sm", annual ? "text-ink" : "text-slate")}>
          Annual <span className="text-pulse">(save {ANNUAL_DISCOUNT_PCT}%)</span>
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {DISPLAY_PLANS.map((plan, i) => {
          const price = annual ? annualMonthlyPrice(plan) : PLAN_PRICE_USD[plan];
          const launchPct = LAUNCH_DISCOUNT_PCT[plan];
          const featured = plan === "pro";
          return (
            <div
              key={plan}
              className={cn(
                "animate-slide-up rounded-lg border p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg",
                featured ? "border-signal bg-signal/5 shadow-md" : "border-hairline bg-panel"
              )}
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              {featured && (
                <span className="mb-2 inline-block rounded-full bg-signal px-2 py-0.5 text-xs font-semibold text-white">
                  Most popular
                </span>
              )}
              <p className="font-bold text-ink">{planLabel(plan)}</p>
              <p className="mt-2 text-3xl font-bold text-ink">
                ${price}
                <span className="text-sm font-normal text-slate">/mo</span>
              </p>
              {plan !== "free" && !annual && launchPct && (
                <p className="mt-0.5 text-xs text-pulse">{launchPct}% off your first month</p>
              )}
              {plan !== "free" && annual && <p className="mt-0.5 text-xs text-slate">billed annually</p>}
              <p className="mt-2 text-sm text-slate">{PLAN_CREDITS[plan].toLocaleString()} credits/mo</p>
              <Link
                href="/signup"
                className={cn(
                  "mt-4 block rounded px-3 py-2 text-center text-sm font-semibold transition-colors",
                  featured ? "bg-signal text-white hover:bg-signal-dark" : "border border-hairline text-ink hover:border-signal"
                )}
              >
                {plan === "free" ? "Start free" : "Choose " + planLabel(plan)}
              </Link>
            </div>
          );
        })}

        <div className="animate-slide-up rounded-lg border border-dashed border-hairline bg-surface p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg" style={{ animationDelay: "0.24s" }}>
          <p className="font-bold text-ink">Enterprise</p>
          <p className="mt-2 text-3xl font-bold text-ink">Custom</p>
          <p className="mt-2 text-sm text-slate">Unlimited workflows, SSO, dedicated support &amp; SLA</p>
          <Link
            href="mailto:techtig9@gmail.com?subject=busigo%20Enterprise"
            className="mt-4 block rounded border border-hairline px-3 py-2 text-center text-sm font-semibold text-ink transition-colors hover:border-signal"
          >
            Contact sales
          </Link>
        </div>
      </div>

      <div className="mt-14 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-hairline">
              <th className="py-3 text-left font-semibold text-slate">Feature</th>
              {DISPLAY_PLANS.map((p) => (
                <th key={p} className="py-3 text-center font-semibold text-ink">{planLabel(p)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEATURE_ROWS.map((row) => (
              <tr key={row.label} className="border-b border-hairline transition-colors hover:bg-surface/60">
                <td className="py-2.5 text-slate">{row.label}</td>
                {DISPLAY_PLANS.map((p) => (
                  <td key={p} className="py-2.5 text-center text-ink">{renderCell(p, row.key)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import type { Plan } from "@/types/database";

// ---------------------------------------------------------------------------------------
// PRICING STRATEGY (v2 — profitability pass)
// ---------------------------------------------------------------------------------------
// v1 (see the standalone pricing doc) targeted a conservative 60–65% gross margin band,
// holding the floor at 60% even under the worst case (annual billing + 100% credit use in
// the same month). This revision keeps that same worst-case floor for safety, but raises the
// target so the business captures more margin per customer rather than just protecting the
// downside:
//   - Modelled AI cost ceiling per credit: unchanged, $0.00040 (see busigo's cost-optimisation
//     strategy — routing, caching, incremental execution).
//   - New target: ~68% gross margin at regular monthly price, ~65% even at annual price
//     (10% off) with full credit consumption — both comfortably above the old 60% floor.
//   - Prices moved to standard SaaS anchor points ($19 / $39 / $79) instead of ($15/$25/$49).
//     Round, familiar price points convert better AND raise revenue per customer — a bigger
//     profit lever than shaving credits ever was.
//   - Free tier tightened (1,000 -> 500 credits) to push serious usage onto a paid plan sooner.
//   - Added an Enterprise tier: custom-priced (sales-assisted, not self-serve Paddle checkout),
//     typically the highest-margin segment because support cost doesn't scale linearly with a
//     large account's revenue. No fixed price — see PLAN_PRICE_USD note below.
// Math, per tier, at the numbers below (cost/credit = $0.0004):
//   Starter  $19 / 15,000 credits -> 68.4% @ regular, 64.9% @ annual
//   Growth   $39 / 31,000 credits -> 68.2% @ regular, 64.7% @ annual
//   Pro      $79 / 63,000 credits -> 68.1% @ regular, 64.6% @ annual
// If real invoiced AI cost ever runs meaningfully above $0.0004/credit, redo this math before
// trusting these numbers — they're an engineering budget, not a live invoice.
//
// This file is deliberately dependency-free (no Supabase, no Next.js) — every value and
// function here is pure data/math, so it can be unit-tested directly. See
// test/pricing.test.mjs. The Supabase-backed access-control logic that USES these numbers
// (canUseFeature, deductRunCredits) lives in lib/plans.ts, which re-exports everything below
// for backward compatibility.

export const CREDIT_COST_CEILING_USD = 0.0004;

export const PLAN_CREDITS: Record<Plan, number> = {
  free: 500,
  starter: 15000,
  growth: 31000,
  pro: 63000,
  enterprise: 250000, // starting point for sales conversations — negotiated per account
};

// Enterprise has no fixed price — it's quoted per account. UI code must special-case it
// rather than rendering PLAN_PRICE_USD.enterprise as a real dollar figure.
export const PLAN_PRICE_USD: Record<Plan, number | null> = {
  free: 0,
  starter: 19,
  growth: 39,
  pro: 79,
  enterprise: null,
};

export const ANNUAL_DISCOUNT_PCT = 10;

export function annualMonthlyPrice(plan: Plan): number | null {
  const price = PLAN_PRICE_USD[plan];
  if (price == null) return null;
  return Math.round(price * (1 - ANNUAL_DISCOUNT_PCT / 100) * 100) / 100;
}

// First-month launch discount — a deliberate, temporary margin dip treated as a
// customer-acquisition cost, not a sustained state. Not offered on Enterprise.
export const LAUNCH_DISCOUNT_PCT: Partial<Record<Plan, number>> = {
  starter: 15,
  growth: 18,
  pro: 20,
};

export function launchMonthlyPrice(plan: Plan): number | null {
  const price = PLAN_PRICE_USD[plan];
  const pct = LAUNCH_DISCOUNT_PCT[plan];
  if (price == null || pct == null) return null;
  return Math.round(price * (1 - pct / 100) * 100) / 100;
}

// Priced at roughly the same ~68% margin as the base plans — pure incremental revenue with
// no additional customer-acquisition cost, which makes top-ups one of the highest-margin
// line items available. 1 credit ≈ $0.00112.
export const CREDIT_TOPUPS = [
  { credits: 5000, priceUsd: 5.6 },
  { credits: 15000, priceUsd: 16.5 },
  { credits: 40000, priceUsd: 43.5 },
];

/** Gross margin for a top-up pack, given the modelled cost ceiling — used by tests/sanity checks. */
export function topupMarginPct(priceUsd: number, credits: number): number {
  const cogs = credits * CREDIT_COST_CEILING_USD;
  return Math.round(((priceUsd - cogs) / priceUsd) * 1000) / 10;
}

/** Gross margin at 100% credit usage for a given plan and price point — used by tests/sanity checks. */
export function planMarginPct(plan: Plan, atPrice: number | null): number | null {
  if (atPrice == null || atPrice === 0) return null;
  const cogs = PLAN_CREDITS[plan] * CREDIT_COST_CEILING_USD;
  return Math.round(((atPrice - cogs) / atPrice) * 1000) / 10;
}

export const PLAN_LIMITS: Record<Plan, {
  maxWorkflows: number;
  maxStepsPerWorkflow: number;
  aiActionStep: boolean;
  versionHistory: boolean;
  appConnections: boolean;
  priorityGeneration: boolean;
  runAnalytics: "basic" | "enhanced" | "advanced";
  support: string;
  sso: boolean;
}> = {
  free: { maxWorkflows: 2, maxStepsPerWorkflow: 3, aiActionStep: false, versionHistory: false, appConnections: false, priorityGeneration: false, runAnalytics: "basic", support: "Community", sso: false },
  starter: { maxWorkflows: 5, maxStepsPerWorkflow: 10, aiActionStep: true, versionHistory: true, appConnections: false, priorityGeneration: false, runAnalytics: "basic", support: "Email", sso: false },
  growth: { maxWorkflows: 15, maxStepsPerWorkflow: 25, aiActionStep: true, versionHistory: true, appConnections: false, priorityGeneration: false, runAnalytics: "enhanced", support: "Email", sso: false },
  pro: { maxWorkflows: Infinity, maxStepsPerWorkflow: Infinity, aiActionStep: true, versionHistory: true, appConnections: true, priorityGeneration: true, runAnalytics: "advanced", support: "Priority 24/7", sso: false },
  enterprise: { maxWorkflows: Infinity, maxStepsPerWorkflow: Infinity, aiActionStep: true, versionHistory: true, appConnections: true, priorityGeneration: true, runAnalytics: "advanced", support: "Dedicated + SLA", sso: true },
};

// Credits deducted per action. AI Action steps stack on top of the base run charge.
export const CREDIT_COSTS = {
  RUN_SUCCESS_OR_STOPPED: 5,
  RUN_FAILED: 0, // never charge for a run that didn't actually complete
  AI_ACTION_STEP: 10,
};

export function planLabel(plan: Plan): string {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

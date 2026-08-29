import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PLAN_CREDITS,
  PLAN_PRICE_USD,
  annualMonthlyPrice,
  launchMonthlyPrice,
  planMarginPct,
  topupMarginPct,
  CREDIT_TOPUPS,
  ANNUAL_DISCOUNT_PCT,
} from "../lib/pricing";
import type { Plan } from "../types/database";

test("annualMonthlyPrice applies exactly a 10% discount off the regular price", () => {
  assert.equal(ANNUAL_DISCOUNT_PCT, 10);
  assert.equal(annualMonthlyPrice("starter"), 17.1);
  assert.equal(annualMonthlyPrice("growth"), 35.1);
  assert.equal(annualMonthlyPrice("pro"), 71.1);
});

test("annualMonthlyPrice returns null for Enterprise (no fixed price to discount)", () => {
  assert.equal(annualMonthlyPrice("enterprise"), null);
});

test("launchMonthlyPrice matches the documented first-month discounts", () => {
  assert.equal(launchMonthlyPrice("starter"), 16.15);
  assert.equal(launchMonthlyPrice("growth"), 31.98);
  assert.equal(launchMonthlyPrice("pro"), 63.2);
});

test("every paid plan holds a 60% margin FLOOR even in the worst case (annual price, full usage)", () => {
  for (const plan of ["starter", "growth", "pro"] as Plan[]) {
    const worstCaseMargin = planMarginPct(plan, annualMonthlyPrice(plan))!;
    assert.ok(worstCaseMargin >= 60, `${plan}: worst-case margin is ${worstCaseMargin}%, below the 60% floor`);
  }
});

test("every paid plan sits close to the ~68% regular-price target, not wildly off it", () => {
  for (const plan of ["starter", "growth", "pro"] as Plan[]) {
    const regularMargin = planMarginPct(plan, PLAN_PRICE_USD[plan])!;
    assert.ok(regularMargin >= 65 && regularMargin <= 70, `${plan}: regular-price margin is ${regularMargin}%`);
  }
});

test("credit top-up packs sit in the same healthy margin band as the base plans (~60-70%)", () => {
  for (const pack of CREDIT_TOPUPS) {
    const margin = topupMarginPct(pack.priceUsd, pack.credits);
    assert.ok(margin >= 60 && margin <= 70, `${pack.credits} pack: margin is ${margin}%`);
  }
});

test("Free tier costs the business a small, bounded amount per user, not an open-ended one", () => {
  const COST_CEILING = 0.0004;
  const maxFreeCost = PLAN_CREDITS.free * COST_CEILING;
  assert.ok(maxFreeCost <= 1, `Free tier could cost up to $${maxFreeCost.toFixed(2)}/user/month`);
});

test("plan credits and prices strictly increase tier over tier", () => {
  const order: Plan[] = ["starter", "growth", "pro"];
  for (let i = 1; i < order.length; i++) {
    assert.ok(PLAN_CREDITS[order[i]] > PLAN_CREDITS[order[i - 1]]);
    assert.ok(PLAN_PRICE_USD[order[i]]! > PLAN_PRICE_USD[order[i - 1]]!);
  }
});

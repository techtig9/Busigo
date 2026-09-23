import { test } from "node:test";
import assert from "node:assert/strict";
import { priceToPlan, isConfiguredPrice } from "../lib/billing/paddle-plans";

const VARS = [
  "NEXT_PUBLIC_PADDLE_PRICE_STARTER",
  "NEXT_PUBLIC_PADDLE_PRICE_STARTER_YEARLY",
  "NEXT_PUBLIC_PADDLE_PRICE_GROWTH",
  "NEXT_PUBLIC_PADDLE_PRICE_GROWTH_YEARLY",
  "NEXT_PUBLIC_PADDLE_PRICE_PRO",
  "NEXT_PUBLIC_PADDLE_PRICE_PRO_YEARLY",
] as const;

function withEnv(values: Partial<Record<(typeof VARS)[number], string>>, fn: () => void) {
  const saved = Object.fromEntries(VARS.map((v) => [v, process.env[v]]));
  try {
    for (const v of VARS) delete process.env[v];
    for (const [k, val] of Object.entries(values)) process.env[k] = val;
    fn();
  } finally {
    for (const v of VARS) {
      if (saved[v] === undefined) delete process.env[v];
      else process.env[v] = saved[v];
    }
  }
}

test("maps each configured price id to its plan", () => {
  withEnv(
    {
      NEXT_PUBLIC_PADDLE_PRICE_STARTER: "pri_starter_m",
      NEXT_PUBLIC_PADDLE_PRICE_STARTER_YEARLY: "pri_starter_y",
      NEXT_PUBLIC_PADDLE_PRICE_GROWTH: "pri_growth_m",
      NEXT_PUBLIC_PADDLE_PRICE_PRO: "pri_pro_m",
    },
    () => {
      assert.equal(priceToPlan("pri_starter_m"), "starter");
      assert.equal(priceToPlan("pri_growth_m"), "growth");
      assert.equal(priceToPlan("pri_pro_m"), "pro");
    }
  );
});

test("a yearly price grants the same plan as its monthly counterpart", () => {
  withEnv(
    {
      NEXT_PUBLIC_PADDLE_PRICE_STARTER: "pri_starter_m",
      NEXT_PUBLIC_PADDLE_PRICE_STARTER_YEARLY: "pri_starter_y",
    },
    () => {
      assert.equal(priceToPlan("pri_starter_y"), priceToPlan("pri_starter_m"));
      assert.equal(priceToPlan("pri_starter_y"), "starter");
    }
  );
});

// This is the regression that matters. The old hardcoded map was empty and the lookup fell
// back to `|| "free"`, so a real payment downgraded the customer. Returning null instead is
// what lets the webhook leave a paying customer's plan alone.
test("an unknown price returns null and NEVER free", () => {
  withEnv({ NEXT_PUBLIC_PADDLE_PRICE_STARTER: "pri_starter_m" }, () => {
    assert.equal(priceToPlan("pri_something_else"), null);
    assert.notEqual(priceToPlan("pri_something_else"), "free");
  });
});

test("with nothing configured every price is unknown rather than free", () => {
  withEnv({}, () => {
    assert.equal(priceToPlan("pri_starter_m"), null);
    assert.equal(isConfiguredPrice("pri_starter_m"), false);
  });
});

test("missing and empty price ids are unknown, not a lookup for the empty string", () => {
  withEnv({ NEXT_PUBLIC_PADDLE_PRICE_STARTER: "pri_starter_m" }, () => {
    assert.equal(priceToPlan(undefined), null);
    assert.equal(priceToPlan(null), null);
    assert.equal(priceToPlan(""), null);
  });
});

test("an unset variable does not create an undefined key that swallows lookups", () => {
  // If the map were built without guarding on presence, `map[undefined]` would become a real
  // entry and an unmapped price could resolve through it.
  withEnv({ NEXT_PUBLIC_PADDLE_PRICE_GROWTH: "pri_growth_m" }, () => {
    assert.equal(priceToPlan("undefined"), null);
    assert.equal(priceToPlan("pri_growth_m"), "growth");
  });
});

test("isConfiguredPrice agrees with priceToPlan", () => {
  withEnv({ NEXT_PUBLIC_PADDLE_PRICE_PRO: "pri_pro_m" }, () => {
    assert.equal(isConfiguredPrice("pri_pro_m"), true);
    assert.equal(isConfiguredPrice("pri_nope"), false);
  });
});

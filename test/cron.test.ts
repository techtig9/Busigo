import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCron, nextRunAfter } from "../lib/engine/cron";

test("parseCron: rejects an expression that doesn't have exactly 5 fields", () => {
  assert.equal(parseCron("* * * *"), null);
  assert.equal(parseCron("* * * * * *"), null);
});

test("parseCron: '*' expands to the full valid range for that field", () => {
  const m = parseCron("* * * * *")!;
  assert.equal(m.minutes.size, 60);
  assert.equal(m.hours.size, 24);
  assert.equal(m.daysOfMonth.size, 31);
  assert.equal(m.months.size, 12);
  assert.equal(m.daysOfWeek.size, 7);
});

test("nextRunAfter: daily-at-09:00 finds tomorrow 09:00 UTC from a time already past it today", () => {
  const from = new Date("2026-07-30T10:00:00Z");
  const next = nextRunAfter("0 9 * * *", from)!;
  assert.equal(next.toISOString(), "2026-07-31T09:00:00.000Z");
});

test("nextRunAfter: daily-at-09:00 finds *today's* 09:00 UTC when asked from earlier the same day", () => {
  const from = new Date("2026-07-30T03:00:00Z");
  const next = nextRunAfter("0 9 * * *", from)!;
  assert.equal(next.toISOString(), "2026-07-30T09:00:00.000Z");
});

test("nextRunAfter: every-15-minutes step syntax", () => {
  const from = new Date("2026-07-30T10:02:00Z");
  const next = nextRunAfter("*/15 * * * *", from)!;
  assert.equal(next.toISOString(), "2026-07-30T10:15:00.000Z");
});

test("nextRunAfter: is strictly AFTER `from`, even if `from` itself matches exactly", () => {
  const from = new Date("2026-07-30T09:00:00Z");
  const next = nextRunAfter("0 9 * * *", from)!;
  assert.equal(next.toISOString(), "2026-07-31T09:00:00.000Z");
});

test("nextRunAfter: day-of-week field (Mondays only)", () => {
  const from = new Date("2026-07-30T00:00:00Z"); // a Thursday
  const next = nextRunAfter("0 9 * * 1", from)!;
  assert.equal(next.getUTCDay(), 1);
  assert.ok(next.getTime() > from.getTime());
});

test("nextRunAfter: an unparseable expression returns null instead of throwing", () => {
  assert.equal(nextRunAfter("not a cron expression", new Date()), null);
});

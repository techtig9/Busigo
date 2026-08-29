// A compact standard 5-field cron evaluator: minute hour day-of-month month day-of-week.
// Supports "*", "*/N", "a-b", "a-b/N", "a,b,c" and combinations thereof, per field.
// Good enough for the vast majority of real schedules without pulling in a dependency.

function parseField(field: string, min: number, max: number): Set<number> {
  const values = new Set<number>();
  for (const part of field.split(",")) {
    const stepMatch = part.match(/^(\*|\d+-\d+|\d+)(?:\/(\d+))?$/);
    if (!stepMatch) continue;
    const [, base, stepStr] = stepMatch;
    const step = stepStr ? parseInt(stepStr, 10) : 1;

    let rangeStart = min;
    let rangeEnd = max;
    if (base !== "*") {
      if (base.includes("-")) {
        const [a, b] = base.split("-").map(Number);
        rangeStart = a;
        rangeEnd = b;
      } else {
        rangeStart = rangeEnd = parseInt(base, 10);
      }
    }
    for (let v = rangeStart; v <= rangeEnd; v += step) values.add(v);
  }
  return values;
}

export interface CronMatcher {
  minutes: Set<number>;
  hours: Set<number>;
  daysOfMonth: Set<number>;
  months: Set<number>;
  daysOfWeek: Set<number>;
}

export function parseCron(expr: string): CronMatcher | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [minute, hour, dom, month, dow] = parts;
  try {
    return {
      minutes: parseField(minute, 0, 59),
      hours: parseField(hour, 0, 23),
      daysOfMonth: parseField(dom, 1, 31),
      months: parseField(month, 1, 12),
      daysOfWeek: parseField(dow, 0, 6),
    };
  } catch {
    return null;
  }
}

/** Finds the next UTC minute (strictly after `from`) matching the cron expression. */
export function nextRunAfter(expr: string, from: Date): Date | null {
  const matcher = parseCron(expr);
  if (!matcher) return null;

  const candidate = new Date(from.getTime());
  candidate.setUTCSeconds(0, 0);
  candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);

  const MAX_ITERATIONS = 60 * 24 * 366 * 2; // scan up to ~2 years of minutes
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const minute = candidate.getUTCMinutes();
    const hour = candidate.getUTCHours();
    const dom = candidate.getUTCDate();
    const month = candidate.getUTCMonth() + 1;
    const dow = candidate.getUTCDay();

    if (
      matcher.minutes.has(minute) &&
      matcher.hours.has(hour) &&
      matcher.daysOfMonth.has(dom) &&
      matcher.months.has(month) &&
      matcher.daysOfWeek.has(dow)
    ) {
      return candidate;
    }
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  }
  return null;
}

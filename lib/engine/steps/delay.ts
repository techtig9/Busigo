import type { StepHandler } from "../types";
import { resolveConfig } from "../merge-fields";

// Never a blocking sleep in a request handler — a Delay step sets the run to `waiting` with a
// resume_at timestamp, and the /api/cron/tick route (pinged once a minute) resumes it later.
// This step handler just computes resume_at; the executor is what actually pauses the run.

const UNIT_MS: Record<string, number> = {
  minutes: 60_000,
  hours: 60 * 60_000,
  days: 24 * 60 * 60_000,
};

export const delayStep: StepHandler = async ({ step, ctx }) => {
  const config = resolveConfig(step.config, ctx.data) as { amount: string | number; unit: string };
  const amount = Number(config.amount);
  const unitMs = UNIT_MS[config.unit] ?? UNIT_MS.minutes;

  if (!Number.isFinite(amount) || amount <= 0) {
    return { status: "failed", output: null, error: `Invalid delay amount: "${config.amount}"` };
  }

  const resumeAt = new Date(Date.now() + amount * unitMs).toISOString();
  return { status: "success", output: { waiting_until: resumeAt }, waitingUntil: resumeAt };
};

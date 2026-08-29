import type { StepHandler } from "../types";
import { resolveConfig } from "../merge-fields";

// Only valid on webhook-triggered workflows. The executor short-circuits the run after this
// step: it hands the resolved status code + body back to the /api/hook/[token] route so it
// can reply synchronously to whatever called the trigger URL.
export const webhookResponseStep: StepHandler = async ({ step, ctx }) => {
  const config = resolveConfig(step.config, ctx.data) as { statusCode?: string | number; body?: string };
  const statusCode = Number(config.statusCode) || 200;

  let parsedBody: any = config.body ?? "";
  try {
    parsedBody = config.body ? JSON.parse(config.body) : {};
  } catch {
    // Not JSON — send it back as a plain string, that's still a valid response body.
  }

  return { status: "success", output: { statusCode, body: parsedBody } };
};

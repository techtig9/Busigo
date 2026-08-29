import type { StepDefinition, StepStatus, StepType } from "@/types/database";

export interface RunContext {
  // Keyed by step key ("trigger" for the trigger payload, then each step's own key).
  // Each entry holds that step's resolved output, so later steps can reference
  // {{stepKey.field}} against real prior output — never against configuration.
  data: Record<string, any>;
}

// A step handler's semantic outcome. "stopped_by_filter" only ever comes from the Filter
// step and is a deliberate, successful evaluation — the executor persists it to
// workflow_run_steps as DB status "success" (the only value the schema allows) and instead
// carries "stopped_by_filter" up to the *run's* status. See executor.ts.
export type EngineStepStatus = StepStatus | "stopped_by_filter";

export interface StepExecutionResult {
  status: EngineStepStatus;
  output: any;
  error?: string;
  // Only set by the delay step — tells the executor to pause the run.
  waitingUntil?: string;
}

export interface StepHandlerArgs {
  step: StepDefinition;
  ctx: RunContext;
  runId: string;
  workflowId: string;
  workspaceId: string;
  userId: string;
}

export type StepHandler = (args: StepHandlerArgs) => Promise<StepExecutionResult>;

export const STEP_TYPES: StepType[] = [
  "http_request",
  "send_email",
  "delay",
  "filter",
  "transform_data",
  "ai_action",
  "webhook_response",
];

export const STEP_LABELS: Record<StepType, string> = {
  http_request: "HTTP Request",
  send_email: "Send Email",
  delay: "Delay",
  filter: "Filter",
  transform_data: "Transform Data",
  ai_action: "AI Action",
  webhook_response: "Webhook Response",
};

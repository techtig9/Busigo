// Hand-written types mirroring supabase/schema.sql.
// If you generate real types later with `supabase gen types typescript`, this file can be replaced.

export type Plan = "free" | "starter" | "growth" | "pro" | "enterprise";
export type WorkflowStatus = "draft" | "published";
export type TriggerType = "webhook" | "schedule" | "form";
export type RunStatus = "running" | "waiting" | "success" | "failed" | "stopped_by_filter";
export type TriggerSource = "webhook" | "schedule" | "form" | "manual_test";
export type StepType =
  | "http_request"
  | "send_email"
  | "delay"
  | "filter"
  | "transform_data"
  | "ai_action"
  | "webhook_response";
export type StepStatus = "success" | "failed" | "skipped"; // matches the DB check constraint exactly
export type ConnectionService =
  | "slack"
  | "google_sheets"
  | "gmail"
  | "google_calendar"
  | "airtable"
  | "hubspot"
  | "trello"
  | "notion";

export interface StepDefinition {
  key: string;
  type: StepType;
  config: Record<string, any>;
}

export interface DbUser {
  id: string;
  name: string | null;
  email: string;
  role: "user" | "admin";
  created_at: string;
}

export interface DbSubscription {
  id: string;
  user_id: string;
  plan: Plan;
  status: string;
  provider: string | null;
  paddle_subscription_id: string | null;
  paddle_customer_id: string | null;
  credits_remaining: number;
  renews_at: string | null;
}

export interface DbWorkflow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  trigger_type: TriggerType;
  trigger_config: Record<string, any>;
  trigger_token: string;
  definition: StepDefinition[];
  status: WorkflowStatus;
  next_run_at: string | null;
  created_at: string;
}

export interface DbWorkflowVersion {
  id: string;
  workflow_id: string;
  definition: StepDefinition[];
  created_at: string;
}

export interface DbForm {
  id: string;
  workflow_id: string;
  slug: string;
  fields: FormField[];
  created_at: string;
}

export interface FormField {
  key: string;
  label: string;
  type: "text" | "number" | "email" | "textarea" | "select";
  required: boolean;
  options?: string[];
}

export interface DbWorkflowRun {
  id: string;
  workflow_id: string;
  trigger_source: TriggerSource;
  status: RunStatus;
  trigger_payload: Record<string, any> | null;
  resume_at: string | null;
  started_at: string;
  ended_at: string | null;
}

export interface DbWorkflowRunStep {
  id: string;
  run_id: string;
  step_key: string;
  type: StepType;
  input: Record<string, any> | null;
  output: Record<string, any> | null;
  status: StepStatus;
  duration_ms: number | null;
  created_at: string;
}

export interface DbConnection {
  id: string;
  user_id: string;
  service: ConnectionService;
  status: "queued" | "connected";
  created_at: string;
}

export interface DbPayment {
  id: string;
  user_id: string;
  paddle_transaction_id: string | null;
  amount: number | null;
  status: string | null;
  created_at: string;
}

export interface DbTemplate {
  id: string;
  name: string;
  use_case: string;
  definition: StepDefinition[];
  thumbnail: string | null;
}

export type AgentStatus = "draft" | "active" | "paused" | "error";
export type AutonomyLevel = "draft_only" | "approval_required" | "low_risk_auto" | "autonomous";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";
export type RiskLevel = "low" | "medium" | "high" | "critical";

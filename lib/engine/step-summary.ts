import type { StepDefinition } from "@/types/database";

export function summarizeStep(step: StepDefinition): string {
  const c = step.config || {};
  switch (step.type) {
    case "http_request":
      return `${c.method || "GET"} ${c.url || "(no URL set)"}`;
    case "send_email":
      return `To: ${c.to || "(not set)"} — ${c.subject || "(no subject)"}`;
    case "delay":
      return `Wait ${c.amount || "?"} ${c.unit || "minutes"}`;
    case "filter":
      return `${c.field || "(field)"} ${c.operator || "equals"} ${c.value ?? ""}`;
    case "transform_data":
      return `${c.operation || "(operation)"}`;
    case "ai_action":
      return `${c.mode || "summarize"} — ${(c.instruction || c.input || "").slice(0, 60)}`;
    case "webhook_response":
      return `Respond ${c.statusCode || 200}`;
    default:
      return "";
  }
}

import "server-only";
import { createServiceRoleSupabase } from "@/lib/supabase/server";

export async function logWebhookDelivery(params: {
  workspaceId: string;
  direction: "inbound" | "outbound";
  eventId?: string;
  url?: string;
  status: "pending" | "delivered" | "failed";
  attempt?: number;
  responseCode?: number;
  signature?: string;
}) {
  const admin = createServiceRoleSupabase();
  const { error } = await admin.from("workspace_webhook_deliveries").insert({
    workspace_id: params.workspaceId,
    direction: params.direction,
    event_id: params.eventId,
    url: params.url,
    status: params.status,
    attempt: params.attempt ?? 1,
    response_code: params.responseCode,
    signature: params.signature,
  });
  if (error) console.error("logWebhookDelivery failed:", error.message);
}

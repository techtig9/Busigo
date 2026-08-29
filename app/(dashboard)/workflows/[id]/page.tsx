import { createServerSupabase } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { notFound } from "next/navigation";
import { WorkflowBuilder } from "./WorkflowBuilder";
import { PLAN_LIMITS } from "@/lib/plans";
import type { Plan } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function WorkflowBuilderPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { workspace } = await getWorkspaceContext();

  const [{ data: workflow }, { data: versions }, { data: form }, { data: sub }, { data: profile }] = await Promise.all([
    supabase.from("workflows").select("*").eq("id", params.id).eq("workspace_id", workspace.id).single(),
    supabase
      .from("workflow_versions")
      .select("id, created_at, definition")
      .eq("workflow_id", params.id)
      .order("created_at", { ascending: false }),
    supabase.from("forms").select("slug, fields").eq("workflow_id", params.id).single(),
    supabase.from("subscriptions").select("plan").eq("workspace_id", workspace.id).single(),
    supabase.from("users").select("role").eq("id", user.id).single(),
  ]);

  if (!workflow) notFound();

  const plan = (sub?.plan as Plan) || "free";
  const aiActionAllowed = profile?.role === "admin" || PLAN_LIMITS[plan].aiActionStep;

  return (
    <WorkflowBuilder
      workflow={workflow as any}
      versions={versions || []}
      form={form as any}
      aiActionAllowed={aiActionAllowed}
    />
  );
}

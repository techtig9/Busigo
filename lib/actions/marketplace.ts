"use server";
import { requireWorkspace } from "@/lib/workspace/authorize";
import { revalidatePath } from "next/cache";

export async function installMarketplaceApp(formData: FormData) {
  const { supabase, workspace, userId } = await requireWorkspace("member");
  const appId = String(formData.get("appId") || "");
  if (!appId) throw new Error("App is required");
  const { data: app } = await supabase.from("marketplace_apps").select("id").eq("id", appId).eq("status", "published").single();
  if (!app) throw new Error("Marketplace app not found");
  const { error } = await supabase.from("marketplace_installations").upsert({ user_id: userId, workspace_id: workspace.id, app_id: app.id, status: "installed" }, { onConflict: "workspace_id,app_id" });
  if (error) throw new Error(error.message);
  revalidatePath("/marketplace");
}

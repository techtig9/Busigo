import { createServerSupabase } from "@/lib/supabase/server";
import { NewWorkflowForm } from "./NewWorkflowForm";

export default async function NewWorkflowPage() {
  const supabase = createServerSupabase();
  const { data: templates } = await supabase.from("templates").select("id, name, use_case");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-ink">New workflow</h1>
      <NewWorkflowForm templates={templates || []} />
    </div>
  );
}

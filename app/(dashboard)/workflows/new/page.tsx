import { createServerSupabase } from "@/lib/supabase/server";
import { NewWorkflowForm } from "./NewWorkflowForm";
import { PageHeader } from "@/components/layout/PageHeader";

export default async function NewWorkflowPage() {
  const supabase = createServerSupabase();
  const { data: templates } = await supabase.from("templates").select("id, name, use_case");

  return (
    <div className="">
      <PageHeader title="New workflow" description="Pick a trigger, then build the steps it runs." />
      <NewWorkflowForm templates={templates || []} />
    </div>
  );
}

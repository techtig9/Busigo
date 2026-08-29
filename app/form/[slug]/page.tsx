import { createServiceRoleSupabase } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PublicFormClient } from "./PublicFormClient";
import { APP_NAME } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PublicFormPage({ params }: { params: { slug: string } }) {
  const supabase = createServiceRoleSupabase();
  const { data: form } = await supabase
    .from("forms")
    .select("slug, fields, workflows!inner(status, trigger_type)")
    .eq("slug", params.slug)
    .single();

  const workflow = (form as any)?.workflows;
  if (!form || !workflow || workflow.status !== "published" || workflow.trigger_type !== "form") {
    notFound();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate">{APP_NAME}</p>
      <h1 className="mb-6 text-xl font-bold text-ink">Submit</h1>
      <PublicFormClient slug={form.slug} fields={form.fields} />
    </div>
  );
}

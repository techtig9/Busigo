import { createServerSupabase } from "@/lib/supabase/server";
import { getBusinessContext } from "@/lib/business-os";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { saveBusinessProfileAction, saveDiscoveryAnswerAction } from "@/lib/actions/business-os";
import { BusinessPhaseBar } from "@/components/dashboard/BusinessPhaseBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AnalyzeBusinessButton } from "@/components/business-os/AnalyzeBusinessButton";
import { Input, Textarea } from "@/components/ui/Input";
import { PageHeader } from "@/components/layout/PageHeader";

const QUESTIONS = [
  ["business_story", "What does your business do, who do you serve, and why do customers choose you?"],
  ["lead_flow", "How does a new lead arrive and what happens from first contact to sale?"],
  ["customer_delivery", "What happens after a customer buys? Describe delivery/onboarding step by step."],
  ["support", "How do customers ask for help, refunds or changes, and who handles them?"],
  ["marketing", "How do you currently attract customers? Which channels, campaigns and content do you use?"],
  ["finance", "How are payments, invoices, expenses, refunds and financial reporting handled?"],
  ["operations", "What repetitive operational work happens every day or week?"],
  ["reporting", "Which reports do you prepare every day, week or month, and who receives them?"],
  ["bottlenecks", "What work wastes the most time, creates errors, causes delays or depends on one person?"],
  ["rules", "What decisions must always require human approval, and what actions can AI safely handle?"],
  ["success", "What are your most important goals for the next 3, 6 and 12 months?"],
];

function ListField({ name, label, value, placeholder }: { name: string; label: string; value?: unknown; placeholder: string }) {
  return <label className="block">
    <span className="text-xs font-semibold text-slate">{label}</span>
    <Input name={name} defaultValue={Array.isArray(value) ? value.join(", ") : String(value || "")} placeholder={placeholder}  />
    <span className="mt-1 block text-[11px] text-slate">Separate multiple items with commas.</span>
  </label>;
}

export default async function BusinessBrainPage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { workspace } = await getWorkspaceContext();
  const { business, goals, processes } = await getBusinessContext(workspace.id);
  const { data: answers } = await supabase.from("business_discovery_answers").select("question_key, answer").eq("workspace_id", workspace.id);
  const answerMap = new Map((answers || []).map((a: any) => [a.question_key, a.answer]));
  const snapshot = (business?.financial_snapshot || {}) as Record<string, string | null>;

  return <div className="space-y-6">
    <PageHeader title="Business Brain" description="Phase 1 — teach BusiGo your business before asking it to automate anything." />
    <BusinessPhaseBar current={1} />

    <Card>
      <div className="mb-5"><h2 className="text-lg font-bold text-ink">Business identity</h2><p className="text-sm text-slate">Give BusiGo enough context to understand your company, market and operating model.</p></div>
      <form action={saveBusinessProfileAction} className="grid gap-4 sm:grid-cols-2">
        <Input name="name" defaultValue={business?.name || ""} placeholder="Business name *"  required />
        <Input name="legal_name" defaultValue={business?.legal_name || ""} placeholder="Legal name (optional)"  />
        <Input name="industry" defaultValue={business?.industry || ""} placeholder="Industry *"  required />
        <Input name="business_type" defaultValue={business?.business_type || ""} placeholder="Business type (agency, ecommerce, SaaS…)"  />
        <Input name="business_model" defaultValue={business?.business_model || ""} placeholder="Business model (subscription, services, retail…)"  />
        <Input name="website" defaultValue={business?.website || ""} placeholder="Website"  />
        <Input name="target_customer" defaultValue={business?.target_customer || ""} placeholder="Primary target customer"  />
        <Input name="country" defaultValue={business?.country || ""} placeholder="Country / primary market"  />
        <Input name="team_size" type="number" min="0" defaultValue={business?.team_size || ""} placeholder="Team size"  />
        <Input name="monthly_revenue" type="number" min="0" defaultValue={business?.monthly_revenue || ""} placeholder="Monthly revenue (optional)"  />
        <Input name="currency" defaultValue={business?.currency || "USD"} placeholder="Currency"  />
        <Textarea name="description" defaultValue={business?.description || ""} placeholder="Describe the business in your own words…"  />
        <ListField name="locations" label="Locations" value={business?.locations} placeholder="Islamabad, Lahore, Remote" />
        <ListField name="markets" label="Markets / countries served" value={business?.markets} placeholder="Pakistan, UAE, UK" />
        <ListField name="languages" label="Languages" value={business?.languages} placeholder="English, Urdu" />
        <ListField name="departments" label="Departments" value={business?.departments} placeholder="Sales, Marketing, Operations, Finance" />
        <ListField name="team_roles" label="Team roles" value={business?.team_roles} placeholder="CEO, Sales Rep, Accountant" />
        <ListField name="products" label="Products" value={business?.products} placeholder="Product A, Product B" />
        <ListField name="services" label="Services" value={business?.services} placeholder="Consulting, Implementation" />
        <ListField name="customer_segments" label="Customer segments" value={business?.customer_segments} placeholder="SMBs, Enterprise" />
        <ListField name="acquisition_channels" label="Customer acquisition channels" value={business?.acquisition_channels} placeholder="Google, Instagram, Referrals" />
        <ListField name="sales_channels" label="Sales channels" value={business?.sales_channels} placeholder="Website, Phone, Sales Team" />
        <label className="block sm:col-span-2"><span className="text-xs font-semibold text-slate">Brand voice</span><Input name="brand_voice" defaultValue={business?.brand_voice || ""} placeholder="Professional, friendly, concise…"  /></label>

        <div className="sm:col-span-2 rounded border border-hairline bg-surface p-4">
          <h3 className="font-semibold text-ink">Financial snapshot <span className="text-xs font-normal text-slate">(optional)</span></h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input name="annual_revenue" defaultValue={snapshot.annual_revenue || ""} placeholder="Annual revenue"  />
            <Input name="gross_margin" defaultValue={snapshot.gross_margin || ""} placeholder="Gross margin %"  />
            <Input name="monthly_marketing_spend" defaultValue={snapshot.monthly_marketing_spend || ""} placeholder="Monthly marketing spend"  />
            <Input name="monthly_software_spend" defaultValue={snapshot.monthly_software_spend || ""} placeholder="Monthly software spend"  />
            <Input name="average_order_value" defaultValue={snapshot.average_order_value || ""} placeholder="Average order value"  />
            <Input name="customer_acquisition_cost" defaultValue={snapshot.customer_acquisition_cost || ""} placeholder="Customer acquisition cost"  />
            <Input name="customer_lifetime_value" defaultValue={snapshot.customer_lifetime_value || ""} placeholder="Customer lifetime value"  />
          </div>
        </div>
        <div className="sm:col-span-2"><Button type="submit">Save business brain</Button></div>
      </form>
    </Card>

    <div className="grid gap-4 sm:grid-cols-4">
      <Card><p className="text-xs uppercase tracking-wide text-slate">Goals</p><p className="mt-1 text-2xl font-bold text-ink">{goals.length}</p></Card>
      <Card><p className="text-xs uppercase tracking-wide text-slate">Processes</p><p className="mt-1 text-2xl font-bold text-ink">{processes.length}</p></Card>
      <Card><p className="text-xs uppercase tracking-wide text-slate">Interview</p><p className="mt-1 text-2xl font-bold text-ink">{answers?.length || 0}/{QUESTIONS.length}</p></Card>
      <Card><p className="text-xs uppercase tracking-wide text-slate">Discovery status</p><p className="mt-1 text-2xl font-bold text-ink">{business ? "Started" : "Not started"}</p></Card>
    </div>

    <Card>
      <div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-bold text-ink">AI business interview</h2><p className="text-sm text-slate">Answer naturally. These answers become the source material for process mapping, automation and agent recommendations.</p></div><div className="flex items-center gap-3"><Badge tone="signal">{answers?.length || 0}/{QUESTIONS.length}</Badge><AnalyzeBusinessButton /></div></div>
      <div className="mt-5 space-y-4">
        {QUESTIONS.map(([key, question], index) => <form key={key} action={saveDiscoveryAnswerAction} className="rounded border border-hairline p-4">
          <input type="hidden" name="key" value={key} />
          <div className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-bold text-slate">{index + 1}</span><p className="text-sm font-semibold text-ink">{question}</p></div>
          <Textarea name="answer" defaultValue={answerMap.get(key) || ""} placeholder="Tell BusiGo how this works today…"  />
          <Button type="submit" variant="secondary" className="mt-3">Save answer</Button>
        </form>)}
      </div>
    </Card>
  </div>;
}

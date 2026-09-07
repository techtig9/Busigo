import { Brain } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { getBusinessContext } from "@/lib/business-os";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { saveBusinessProfileAction, saveDiscoveryAnswerAction } from "@/lib/actions/business-os";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Label } from "@/components/ui/Input";
import { Progress } from "@/components/ui/Controls";
import { EmptyState } from "@/components/ui/States";
import { Metric, MetricStrip } from "@/components/patterns/Metric";
import { SectionTabs } from "@/components/patterns/SectionTabs";
import { AiCallout } from "@/components/patterns/Signals";
import { AnalyzeBusinessButton } from "@/components/business-os/AnalyzeBusinessButton";

export const dynamic = "force-dynamic";

const QUESTIONS: [string, string][] = [
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

function ListField({
  name,
  label,
  value,
  placeholder,
}: {
  name: string;
  label: string;
  value?: unknown;
  placeholder: string;
}) {
  const id = `bb-${name}`;
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        defaultValue={Array.isArray(value) ? value.join(", ") : String(value || "")}
        placeholder={placeholder}
      />
      <p className="mt-1 text-[11px] text-muted">Separate multiple items with commas.</p>
    </div>
  );
}

function TextField({
  name,
  label,
  defaultValue,
  placeholder,
  required,
  type,
}: {
  name: string;
  label: string;
  defaultValue?: any;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  const id = `bb-${name}`;
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={type}
        min={type === "number" ? 0 : undefined}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

export default async function BusinessBrainPage() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { workspace } = await getWorkspaceContext();
  const { business, goals, processes } = await getBusinessContext(workspace.id);
  const { data: answers } = await supabase
    .from("business_discovery_answers")
    .select("question_key, answer")
    .eq("workspace_id", workspace.id);

  const answerMap = new Map((answers || []).map((a: any) => [a.question_key, a.answer]));
  const snapshot = (business?.financial_snapshot || {}) as Record<string, string | null>;
  const answered = answers?.length || 0;

  // Completeness score (spec §14). Weighted toward the things downstream features actually
  // read: identity, then the interview, then goals and mapped processes.
  const identityFields = [business?.name, business?.industry, business?.description, business?.target_customer, business?.website];
  const identityDone = identityFields.filter(Boolean).length;
  const completeness = Math.round(
    (identityDone / identityFields.length) * 40 +
      (answered / QUESTIONS.length) * 40 +
      Math.min(1, goals.length / 3) * 10 +
      Math.min(1, processes.length / 3) * 10
  );

  const identity = (
    <Card>
      <CardTitle>Business identity</CardTitle>
      <CardDescription>
        Enough context for BusiGo to understand your company, market and operating model. Everything else — opportunity
        ranking, agent recommendations, insights — reasons from this.
      </CardDescription>
      <form action={saveBusinessProfileAction} className="mt-4 grid gap-4 sm:grid-cols-2">
        <TextField name="name" label="Business name" defaultValue={business?.name} required />
        <TextField name="legal_name" label="Legal name" defaultValue={business?.legal_name} placeholder="Optional" />
        <TextField name="industry" label="Industry" defaultValue={business?.industry} required />
        <TextField name="business_type" label="Business type" defaultValue={business?.business_type} placeholder="Agency, ecommerce, SaaS…" />
        <TextField name="business_model" label="Business model" defaultValue={business?.business_model} placeholder="Subscription, services, retail…" />
        <TextField name="website" label="Website" defaultValue={business?.website} placeholder="https://" />
        <TextField name="target_customer" label="Primary target customer" defaultValue={business?.target_customer} />
        <TextField name="country" label="Country / primary market" defaultValue={business?.country} />
        <TextField name="team_size" label="Team size" type="number" defaultValue={business?.team_size} />
        <TextField name="monthly_revenue" label="Monthly revenue" type="number" defaultValue={business?.monthly_revenue} placeholder="Optional" />
        <TextField name="currency" label="Currency" defaultValue={business?.currency || "USD"} />
        <TextField name="brand_voice" label="Brand voice" defaultValue={business?.brand_voice} placeholder="Professional, friendly, concise…" />

        <div className="sm:col-span-2">
          <Label htmlFor="bb-description">Describe the business in your own words</Label>
          <Textarea id="bb-description" name="description" defaultValue={business?.description || ""} />
        </div>

        <ListField name="locations" label="Locations" value={business?.locations} placeholder="Islamabad, Lahore, Remote" />
        <ListField name="markets" label="Markets served" value={business?.markets} placeholder="Pakistan, UAE, UK" />
        <ListField name="languages" label="Languages" value={business?.languages} placeholder="English, Urdu" />
        <ListField name="departments" label="Departments" value={business?.departments} placeholder="Sales, Marketing, Operations" />
        <ListField name="team_roles" label="Team roles" value={business?.team_roles} placeholder="CEO, Sales Rep, Accountant" />
        <ListField name="products" label="Products" value={business?.products} placeholder="Product A, Product B" />
        <ListField name="services" label="Services" value={business?.services} placeholder="Consulting, Implementation" />
        <ListField name="customer_segments" label="Customer segments" value={business?.customer_segments} placeholder="SMBs, Enterprise" />
        <ListField name="acquisition_channels" label="Acquisition channels" value={business?.acquisition_channels} placeholder="Google, Instagram, Referrals" />
        <ListField name="sales_channels" label="Sales channels" value={business?.sales_channels} placeholder="Website, Phone, Sales Team" />

        {/* The financial snapshot posts in the same form so one Save covers the whole profile. */}
        <fieldset className="rounded-lg border border-hairline bg-surface p-4 sm:col-span-2">
          <legend className="px-1 text-sm font-semibold text-ink">
            Financial snapshot <span className="font-normal text-muted">(optional)</span>
          </legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <TextField name="annual_revenue" label="Annual revenue" defaultValue={snapshot.annual_revenue} />
            <TextField name="gross_margin" label="Gross margin %" defaultValue={snapshot.gross_margin} />
            <TextField name="monthly_marketing_spend" label="Marketing spend / mo" defaultValue={snapshot.monthly_marketing_spend} />
            <TextField name="monthly_software_spend" label="Software spend / mo" defaultValue={snapshot.monthly_software_spend} />
            <TextField name="average_order_value" label="Average order value" defaultValue={snapshot.average_order_value} />
            <TextField name="customer_acquisition_cost" label="Acquisition cost" defaultValue={snapshot.customer_acquisition_cost} />
            <TextField name="customer_lifetime_value" label="Lifetime value" defaultValue={snapshot.customer_lifetime_value} />
          </div>
        </fieldset>

        <div className="sm:col-span-2">
          <Button type="submit">Save business brain</Button>
        </div>
      </form>
    </Card>
  );

  const interview = (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>AI business interview</CardTitle>
            <CardDescription>
              Answer naturally. These answers are the source material for process mapping, opportunity ranking and agent
              recommendations.
            </CardDescription>
          </div>
          <AnalyzeBusinessButton />
        </div>
        <div className="mt-4">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted">
              {answered} of {QUESTIONS.length} answered
            </span>
            <span className="tabular font-semibold text-slate">{Math.round((answered / QUESTIONS.length) * 100)}%</span>
          </div>
          <Progress value={answered} max={QUESTIONS.length} label="Interview progress" className="mt-1" />
        </div>
      </Card>

      {QUESTIONS.map(([key, question], index) => {
        const existing = answerMap.get(key);
        return (
          <Card key={key} density="compact">
            <form action={saveDiscoveryAnswerAction}>
              <input type="hidden" name="key" value={key} />
              <div className="flex gap-3">
                <span
                  className={`tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    existing ? "bg-success-soft text-success-ink" : "bg-surface text-slate"
                  }`}
                  aria-hidden
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <Label htmlFor={`interview-${key}`}>{question}</Label>
                  <Textarea
                    id={`interview-${key}`}
                    name="answer"
                    defaultValue={existing || ""}
                    placeholder="Tell BusiGo how this works today…"
                  />
                  <Button type="submit" size="sm" variant="secondary" className="mt-2">
                    Save answer
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        );
      })}
    </div>
  );

  const goalsAndProcesses = (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardTitle>Goals</CardTitle>
        <CardDescription>What the business is trying to achieve.</CardDescription>
        {goals.length === 0 ? (
          <EmptyState
            icon={Brain}
            title="No goals recorded"
            body="Answer the interview question about your 3, 6 and 12 month goals — BusiGo records them here."
            className="py-8"
          />
        ) : (
          <ul className="mt-3 divide-y divide-hairline">
            {goals.map((g: any) => (
              <li key={g.id} className="py-2.5">
                <p className="text-sm font-medium text-ink">{g.title || g.name}</p>
                {g.description && <p className="text-xs text-slate">{g.description}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <CardTitle>Processes</CardTitle>
        <CardDescription>How work actually flows today — the raw material for automation.</CardDescription>
        {processes.length === 0 ? (
          <EmptyState
            icon={Brain}
            title="No processes mapped"
            body="Describe your lead flow, delivery and support in the interview, then run Analyze to have BusiGo map them."
            className="py-8"
          />
        ) : (
          <ul className="mt-3 divide-y divide-hairline">
            {processes.map((p: any) => (
              <li key={p.id} className="py-2.5">
                <p className="text-sm font-medium text-ink">{p.name || p.title}</p>
                {p.description && <p className="text-xs text-slate">{p.description}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Business Brain"
        description="Teach BusiGo how your business works before asking it to automate anything."
        actions={<AnalyzeBusinessButton />}
      />

      <MetricStrip className="mb-4 lg:grid-cols-4">
        <Metric
          label="Completeness"
          value={completeness}
          suffix="/100"
          footer={<Progress value={completeness} label="Business Brain completeness" tone={completeness < 40 ? "warn" : "signal"} />}
        />
        <Metric label="Interview" value={`${answered}/${QUESTIONS.length}`} hint="questions answered" />
        <Metric label="Goals" value={goals.length} />
        <Metric label="Processes" value={processes.length} />
      </MetricStrip>

      {completeness < 60 && (
        <AiCallout className="mb-4">
          <span className="font-semibold">
            {business ? "Keep going — this is what everything else reasons from." : "Start here."}
          </span>{" "}
          Opportunity ranking, agent recommendations and insights are all only as good as what BusiGo knows about your
          business.
        </AiCallout>
      )}

      <SectionTabs
        sections={[
          { value: "identity", label: "Identity", content: identity },
          { value: "interview", label: "Interview", count: answered, content: interview },
          { value: "goals", label: "Goals & processes", count: goals.length + processes.length, content: goalsAndProcesses },
        ]}
      />
    </>
  );
}

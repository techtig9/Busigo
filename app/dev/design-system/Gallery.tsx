"use client";

import { useState } from "react";
import { Button, IconButton } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Input, Textarea, Select, Label } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { Modal, Drawer } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Menu, MenuItem, MenuLabel, MenuSeparator, Popover, Tooltip, TooltipProvider } from "@/components/ui/Menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Checkbox, Switch, RadioGroup, Separator, Avatar, Progress } from "@/components/ui/Controls";
import { Skeleton, EmptyState, ErrorState } from "@/components/ui/States";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useToast } from "@/components/ui/Toast";
import { Metric, MetricStrip } from "@/components/patterns/Metric";
import { TrendChart, BarList } from "@/components/patterns/TrendChart";
import { SignalPulse, EvidenceChip, ConfidenceBadge, ImpactEffort, AiCallout } from "@/components/patterns/Signals";
import { Settings, Trash2, Plus, MoreHorizontal, Workflow } from "lucide-react";

const TREND = [
  { label: "1 Mar", value: 92, detail: "23/25 runs" },
  { label: "2 Mar", value: 88, detail: "22/25 runs" },
  { label: "3 Mar", value: 100, detail: "31/31 runs" },
  { label: "4 Mar", value: 76, detail: "19/25 runs" },
  { label: "5 Mar", value: 84, detail: "21/25 runs" },
  { label: "6 Mar", value: 96, detail: "24/25 runs" },
  { label: "7 Mar", value: 100, detail: "28/28 runs" },
  { label: "8 Mar", value: 94, detail: "30/32 runs" },
];

const TOKENS = [
  ["canvas", "bg-canvas"],
  ["panel", "bg-panel"],
  ["surface", "bg-surface"],
  ["surface-3", "bg-surface-3"],
  ["signal / primary", "bg-signal"],
  ["signal-dark", "bg-signal-dark"],
  ["signal-soft", "bg-signal-soft"],
  ["pulse (live)", "bg-pulse"],
  ["accent-blue", "bg-accent-blue"],
  ["accent-teal", "bg-accent-teal"],
  ["success", "bg-success"],
  ["warn", "bg-warn"],
  ["danger", "bg-danger"],
  ["info", "bg-info"],
  ["hairline", "bg-hairline"],
  ["hairline-strong", "bg-hairline-strong"],
  ["ink", "bg-ink"],
  ["slate", "bg-slate"],
  ["muted", "bg-muted"],
];

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="scroll-mt-6">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      {note && <p className="mt-1 max-w-2xl text-sm text-slate">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Gallery() {
  const [modal, setModal] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [checked, setChecked] = useState(true);
  const [switched, setSwitched] = useState(true);
  const [radio, setRadio] = useState("guarded");
  const toast = useToast();

  return (
    <TooltipProvider delayDuration={200}>
      <div className="mx-auto max-w-5xl space-y-12 p-6 pb-24">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-hairline pb-6">
          <div>
            <h1 className="text-2xl font-bold text-ink">BusiGo Design System</h1>
            <p className="mt-1 text-sm text-slate">
              Every primitive in every state. Toggle the theme to check both palettes; tab through to check focus
              order and visible focus rings.
            </p>
          </div>
          <ThemeToggle />
        </header>

        <Section title="Colour tokens" note="All CSS-variable backed — these flip with the theme, not with component code.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            {TOKENS.map(([name, cls]) => (
              <div key={name}>
                <div className={`h-12 rounded-lg border border-hairline ${cls}`} />
                <p className="mt-1.5 font-mono text-[11px] text-slate">{name}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Typography" note="Inter for UI, IBM Plex Mono for code and identifiers. Metrics use tabular numerals.">
          <div className="space-y-2">
            <p className="text-5xl font-bold tracking-tight text-ink">Display 48</p>
            <p className="text-3xl font-bold tracking-tight text-ink">Heading 1 — 30</p>
            <p className="text-2xl font-bold text-ink">Heading 2 — 24</p>
            <p className="text-lg font-semibold text-ink">Heading 3 — 18</p>
            <p className="text-sm text-ink">Body 14 — the quick brown fox jumps over the lazy dog.</p>
            <p className="text-xs text-slate">Caption 12 — secondary metadata.</p>
            <p className="tabular text-2xl font-bold text-ink">1,234,567.89 · 0000 · 1111</p>
            <p className="font-mono text-xs text-slate">run_01J8ZQ4K2M · {"{ \"status\": \"success\" }"}</p>
          </div>
        </Section>

        <Section title="Buttons" note="Loading keeps the original width so a row never reflows mid-submit.">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="subtle">Subtle</Button>
              <Button variant="danger">Danger</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
              <Button disabled>Disabled</Button>
              <Button loading>Publishing workflow</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Tooltip content="Settings">
                <IconButton label="Settings"><Settings size={16} /></IconButton>
              </Tooltip>
              <Tooltip content="Add step">
                <IconButton label="Add step" variant="secondary"><Plus size={16} /></IconButton>
              </Tooltip>
              <Tooltip content="Delete">
                <IconButton label="Delete" variant="danger"><Trash2 size={16} /></IconButton>
              </Tooltip>
            </div>
          </div>
        </Section>

        <Section title="Badges & status" note="Status carries an icon as well as a hue — colour is never the only signal (WCAG 2.2 AA).">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge tone="signal">signal</Badge>
              <Badge tone="pulse">pulse</Badge>
              <Badge tone="success">success</Badge>
              <Badge tone="warn">warn</Badge>
              <Badge tone="danger">danger</Badge>
              <Badge tone="info">info</Badge>
              <Badge tone="slate">neutral</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status="success" />
              <StatusBadge status="running" />
              <StatusBadge status="failed" />
              <StatusBadge status="waiting" />
              <StatusBadge status="stopped_by_filter" />
              <StatusBadge status="draft" />
            </div>
          </div>
        </Section>

        <Section title="Signal Pulse" note="The one signature motion — used only while real work is executing. Under prefers-reduced-motion the travel freezes but the cyan track remains, so the meaning survives.">
          <div className="space-y-3">
            <div className="signal-pulse h-1 w-full rounded-full" />
            <div className="flex items-center gap-3">
              <div className="signal-pulse-node flex h-10 w-10 items-center justify-center rounded-lg border border-pulse bg-panel text-pulse-ink">
                <Workflow size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">AI Qualify</p>
                <p className="text-xs text-slate">Executing…</p>
              </div>
            </div>
          </div>
        </Section>

        <Section
          title="Metrics & charts"
          note="Single-series, single-hue by design: the validator scored the success-green / danger-red pair at ΔE 5.1 under deuteranopia — below the 6.0 floor — so an adjacent success/failed stack was rejected. Violet was validated against both real surfaces."
        >
          <MetricStrip className="mb-4">
            <Metric label="Workflows" value={12} hint="8 published" />
            <Metric label="Automation success" value={94} suffix="%" delta={3} deltaLabel="vs last week" />
            <Metric label="Failures" value={4} delta={-12} goodDirection="down" deltaLabel="vs last week" />
            <Metric label="Open approvals" value={3} hint="needs review" />
            <Metric label="Credits" value="18,402" suffix="/ 25,000" />
          </MetricStrip>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardTitle>Automation health</CardTitle>
              <CardDescription>Daily success rate — hover for detail, or expand the table.</CardDescription>
              <div className="mt-3">
                <TrendChart data={TREND} unit="%" yMax={100} title="Daily automation success rate" />
              </div>
            </Card>
            <Card>
              <CardTitle>Runs by workflow</CardTitle>
              <div className="mt-3">
                <BarList
                  items={[
                    { label: "Lead qualification", value: 128 },
                    { label: "Invoice follow-up", value: 94 },
                    { label: "Weekly digest", value: 41 },
                    { label: "Churn watch", value: 12 },
                  ]}
                />
              </div>
            </Card>
          </div>
        </Section>

        <Section title="Contextual AI & provenance" note="Every AI claim can point at what it came from — the 'glass box' half of the identity.">
          <div className="space-y-4">
            <AiCallout action={<Button size="sm" variant="secondary">Review</Button>}>
              <span className="font-semibold">2 quick wins available.</span> High impact with low build effort — these
              are the ones to do first.
            </AiCallout>
            <div className="flex flex-wrap items-center gap-2">
              <EvidenceChip label="Business Brain" href="#" />
              <EvidenceChip label="14 runs, last 7 days" />
              <EvidenceChip label="Agent: Revenue Analyst" href="#" />
              <ConfidenceBadge value={0.82} />
              <ConfidenceBadge value={0.61} />
              <ConfidenceBadge value={0.34} />
            </div>
            <div className="max-w-sm">
              <ImpactEffort impact="high" effort="low" />
            </div>
            <div className="max-w-sm space-y-2">
              <p className="text-xs font-medium text-slate">Signal Pulse — active vs idle</p>
              <SignalPulse active label="Workflow executing" />
              <SignalPulse active={false} />
            </div>
          </div>
        </Section>

        <Section title="Cards" note="Cards group meaningful information; they are not decoration. Flat by default — opt into elevation.">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card density="compact">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate">Compact · 12px</p>
              <p className="tabular mt-1 text-2xl font-bold text-ink">1,284</p>
            </Card>
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Default · 16px</CardTitle>
                  <CardDescription>With header and footer slots</CardDescription>
                </div>
                <Badge tone="success">Live</Badge>
              </CardHeader>
              <p className="text-sm text-slate">Body content sits here.</p>
              <CardFooter>
                <span className="text-xs text-muted">Updated 2m ago</span>
                <Button size="sm" variant="ghost">View</Button>
              </CardFooter>
            </Card>
            <Card density="hero" elevation="raised" interactive>
              <CardTitle>Hero · 20px, raised</CardTitle>
              <CardDescription>Interactive — hover me</CardDescription>
            </Card>
          </div>
        </Section>

        <Section title="Form controls">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Workspace name" hint="Visible to everyone you invite." required>
              {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} defaultValue="Acme Operations" />}
            </Field>
            <Field label="Webhook URL" error="Must be a valid https:// URL.">
              {({ id, describedBy, invalid }) => (
                <Input id={id} aria-describedby={describedBy} invalid={invalid} defaultValue="notaurl" />
              )}
            </Field>
            <div>
              <Label htmlFor="ds-select">Trigger type</Label>
              <Select id="ds-select" defaultValue="webhook">
                <option value="webhook">Webhook</option>
                <option value="schedule">Schedule</option>
                <option value="form">Form</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="ds-disabled">Disabled</Label>
              <Input id="ds-disabled" disabled defaultValue="Not editable" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="ds-ta">Instruction</Label>
              <Textarea id="ds-ta" placeholder="Describe what this step should do…" />
            </div>
          </div>

          <Separator className="my-6" />

          <div className="grid gap-6 sm:grid-cols-3">
            <div className="space-y-3">
              <Checkbox checked={checked} onCheckedChange={setChecked} label="Notify on failure" hint="Emails the workflow owner." />
              <Checkbox checked={false} onCheckedChange={() => {}} label="Disabled option" disabled />
              <Checkbox checked={false} indeterminate onCheckedChange={() => {}} label="Indeterminate" />
            </div>
            <div className="space-y-3">
              <Switch checked={switched} onCheckedChange={setSwitched} label="Autonomous mode" hint="Requires approval policy." />
              <Switch checked={false} onCheckedChange={() => {}} label="Disabled" disabled />
            </div>
            <RadioGroup
              value={radio}
              onValueChange={setRadio}
              options={[
                { value: "guarded", label: "Guarded", hint: "Approval required" },
                { value: "assisted", label: "Assisted" },
                { value: "autonomous", label: "Autonomous" },
              ]}
            />
          </div>
        </Section>

        <Section title="Avatars & progress">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Avatar name="Saad Ali" size="xs" />
              <Avatar name="Saad Ali" size="sm" />
              <Avatar name="Nina Ortega" size="md" />
              <Avatar name="Priya Raman" size="lg" />
            </div>
            <div className="w-56 space-y-2">
              <Progress value={72} label="Credits used" />
              <Progress value={94} tone="warn" label="Approaching limit" />
              <Progress value={100} tone="danger" label="Limit reached" />
              <Progress value={38} tone="success" label="Onboarding" />
            </div>
          </div>
        </Section>

        <Section title="Overlays" note="Radix-backed: focus trap, focus restore, Escape to dismiss, inert background.">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setModal(true)}>Open modal</Button>
            <Button variant="secondary" onClick={() => setDrawer(true)}>Open drawer</Button>
            <Button variant="secondary" onClick={() => setConfirm(true)}>Confirm dialog</Button>
            <Menu
              trigger={<Button variant="secondary"><MoreHorizontal size={15} /> Menu</Button>}
            >
              <MenuLabel>Workflow</MenuLabel>
              <MenuItem onSelect={() => toast.push("Duplicated workflow")}>Duplicate</MenuItem>
              <MenuItem onSelect={() => toast.push("Exported run history")}>Export runs</MenuItem>
              <MenuSeparator />
              <MenuItem destructive onSelect={() => toast.push("Deleted", "error")}>Delete</MenuItem>
            </Menu>
            <Popover trigger={<Button variant="secondary">Popover</Button>}>
              <p className="text-sm font-semibold text-ink">Evidence</p>
              <p className="mt-1 text-xs text-slate">
                Derived from 14 runs over the last 7 days, plus the Business Brain revenue goal.
              </p>
            </Popover>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => toast.push("Workflow published")}>Toast · success</Button>
            <Button size="sm" variant="ghost" onClick={() => toast.push("Could not reach provider", "error")}>Toast · error</Button>
            <Button size="sm" variant="ghost" onClick={() => toast.push("Credits running low", "warning")}>Toast · warning</Button>
            <Button size="sm" variant="ghost" onClick={() => toast.push("Sync started", "info")}>Toast · info</Button>
          </div>
        </Section>

        <Section title="Tabs">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="tasks" count={12}>Tasks</TabsTrigger>
              <TabsTrigger value="tools">Tools</TabsTrigger>
              <TabsTrigger value="perms">Permissions</TabsTrigger>
              <TabsTrigger value="off" disabled>Disabled</TabsTrigger>
            </TabsList>
            <TabsContent value="overview"><p className="text-sm text-slate">Overview panel.</p></TabsContent>
            <TabsContent value="tasks"><p className="text-sm text-slate">Tasks panel.</p></TabsContent>
            <TabsContent value="tools"><p className="text-sm text-slate">Tools panel.</p></TabsContent>
            <TabsContent value="perms"><p className="text-sm text-slate">Permissions panel.</p></TabsContent>
          </Tabs>
        </Section>

        <Section title="Loading, empty & error states" note="Every route needs all three (spec §17). Skeletons match the layout they replace.">
          <div className="space-y-4">
            <Card>
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-24" />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            </Card>
            <Card>
              <EmptyState
                icon={Workflow}
                title="No workflows yet"
                body="Workflows turn a trigger into a sequence of steps. Create one manually, or describe what you want and let BusiGo draft it."
                action={{ label: "New workflow", href: "#" }}
                aiAction={{ label: "Create with AI", href: "#" }}
              />
            </Card>
            <Card>
              <ErrorState
                body="We couldn't load your runs. This is usually temporary."
                detail={"TypeError: fetch failed\n  at loadRuns (runs.ts:42)"}
                requestId="req_01J8ZQ4K2MDX"
                retryHref="#"
              />
            </Card>
          </div>
        </Section>

        <Modal
          open={modal}
          onOpenChange={setModal}
          title="Publish workflow"
          description="This makes the workflow live and starts accepting triggers."
          footer={
            <>
              <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
              <Button onClick={() => { setModal(false); toast.push("Workflow published"); }}>Publish</Button>
            </>
          }
        >
          <p className="text-sm text-slate">
            Once published, the webhook URL accepts requests immediately. You can unpublish at any time.
          </p>
        </Modal>

        <Drawer
          open={drawer}
          onOpenChange={setDrawer}
          title="Run detail"
          description="run_01J8ZQ4K2MDX · 2.41s"
          footer={<Button variant="secondary" onClick={() => setDrawer(false)}>Close</Button>}
        >
          <p className="text-sm text-slate">
            A drawer on desktop, a bottom sheet below the sm breakpoint. Resize the window to see it switch.
          </p>
        </Drawer>

        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          destructive
          title="Delete workflow?"
          body="This removes the workflow and its run history. This cannot be undone."
          confirmLabel="Delete workflow"
          onConfirm={async () => { toast.push("Workflow deleted", "error"); }}
        />
      </div>
    </TooltipProvider>
  );
}

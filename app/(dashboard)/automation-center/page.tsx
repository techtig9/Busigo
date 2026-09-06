import Link from "next/link";
import { BusinessPhaseBar } from "@/components/dashboard/BusinessPhaseBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AutomationArchitect } from "@/components/automation/AutomationArchitect";
import { Sparkles, ShieldCheck, Activity, Workflow } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

const items = [
  [Sparkles, "Describe what should happen", "Tell BusiGo the business outcome in plain English. The existing workflow builder becomes the execution layer."],
  [Workflow, "Build and test", "Generate a workflow, inspect every step, test it in a safe path, and version the definition before publishing."],
  [ShieldCheck, "Set the approval boundary", "Keep financial, legal, customer-impacting and destructive actions behind human approval."],
  [Activity, "Measure the outcome", "Track executions, failures, time saved, revenue influenced and other verified business outcomes."],
] as const;

export default function AutomationCenterPage() { return <div className="space-y-6"><PageHeader title="Automation Center" description="Phase 3 — the execution layer of BusiGo&apos;s AI Business Operating System." /><BusinessPhaseBar current={3}/><div className="grid gap-4 md:grid-cols-2">{items.map(([Icon,title,body]) => <Card key={title}><Icon size={20} className="text-signal"/><h2 className="mt-3 font-bold text-ink">{title}</h2><p className="mt-2 text-sm text-slate">{body}</p></Card>)}</div><AutomationArchitect /><Card className="border-signal/30 bg-signal/5"><h2 className="font-bold text-ink">Build an automation</h2><p className="mt-2 max-w-2xl text-sm text-slate">Start with a plain-language goal, then use BusiGo&apos;s existing workflow builder to make the execution traceable and testable.</p><Button href="/workflows/new" className="mt-4">Open workflow builder</Button><Link href="/opportunities" className="ml-4 text-sm font-semibold text-signal hover:underline">Review opportunities →</Link></Card></div>; }

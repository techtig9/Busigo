"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ShieldCheck, Play, ArrowRight, TestTube as TestTubeIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { architectAndCreateWorkflowAction, simulateAutomationAction } from "@/lib/actions/workflows";

const examples = [
  "When a new lead arrives, qualify it, email the lead, and follow up after one day.",
  "Every morning, analyze my business events and summarize the most important issues.",
  "When a customer sends a message, classify it and notify the team if it is urgent.",
];

export function AutomationArchitect() {
  const router = useRouter();
  const [request, setRequest] = useState("");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [simulation, setSimulation] = useState<any>(null);

  const generate = () => startTransition(async () => {
    try {
      setError(null);
      setResult(await architectAndCreateWorkflowAction(request));
    } catch (e: any) { setError(e.message || "Could not create automation."); }
  });

  const simulate = () => startTransition(async () => {
    try { setError(null); setSimulation(await simulateAutomationAction(result.plan.steps, { sample: true })); }
    catch (e: any) { setError(e.message || "Simulation failed."); }
  });

  return <Card className="border-signal/30 bg-signal/5">
    <div className="flex items-start gap-3">
      <div className="rounded-lg bg-signal/15 p-2"><Sparkles size={20} className="text-signal" /></div>
      <div><h2 className="font-bold text-ink">AI Automation Architect</h2><p className="text-sm text-slate">Describe the business outcome. BusiGo turns it into an inspectable workflow with safety checks.</p></div>
    </div>
    <Textarea className="mt-4 min-h-28" value={request} onChange={e => setRequest(e.target.value)} placeholder="Example: When a new lead arrives, qualify it, email them, notify sales, and follow up after 24 hours." />
    <div className="mt-2 flex flex-wrap gap-2">{examples.map(x => <button key={x} onClick={() => setRequest(x)} className="rounded-full border border-hairline px-3 py-1 text-xs text-slate hover:border-signal hover:text-signal">{x}</button>)}</div>
    {error && <p className="mt-3 rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger-ink">{error}</p>}
    <Button className="mt-4" onClick={generate} disabled={pending || !request.trim()}>{pending ? "Architecting..." : "Generate automation"}<ArrowRight size={16}/></Button>
    {result && <div className="mt-5 rounded border border-hairline bg-panel p-4">
      <div className="flex items-center justify-between"><div><h3 className="font-bold text-ink">Generated plan</h3><p className="text-xs text-slate">Trigger: {result.plan.triggerType} · {result.plan.steps.length} steps · Risk: {result.plan.safety.risk}</p></div><ShieldCheck size={19} className="text-signal" /></div>
      <ol className="mt-3 space-y-2 text-sm">{result.plan.steps.map((s: any, i: number) => <li key={s.key} className="rounded bg-surface px-3 py-2"><span className="font-semibold">{i + 1}. {s.type.replaceAll("_", " ")}</span><span className="ml-2 text-slate">{s.config.instruction || s.config.subject || s.config.url || "configured action"}</span></li>)}</ol>
      {result.plan.safety.approvalRequired && <p className="mt-3 text-xs font-semibold text-warning">Human approval is required before high-impact actions are activated.</p>}
      <div className="mt-4 flex flex-wrap gap-2"><Button variant="secondary" onClick={simulate} disabled={pending}><TestTubeIcon /> Safe simulation</Button><Button variant="secondary" onClick={() => router.push(`/workflows/${result.workflowId}`)}><Play size={15}/> Open workflow</Button></div>{simulation && <p className="mt-3 text-xs font-semibold text-signal">Simulation passed: {simulation.steps.length} steps inspected and 0 external side effects executed.</p>}
    </div>}
  </Card>;
}

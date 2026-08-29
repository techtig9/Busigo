"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { LiveStatus } from "./StepCard";
import type { StepDefinition } from "@/types/database";

interface StepUpdate {
  stepKey: string;
  type: string;
  status: LiveStatus;
  output: any;
  error?: string;
  waitingUntil?: string;
}

interface Props {
  workflowId: string;
  steps: StepDefinition[];
  onLiveUpdate: (statuses: Record<string, { status: LiveStatus; output?: any }>) => void;
}

export function TestRunPanel({ workflowId, steps, onLiveUpdate }: Props) {
  const [payload, setPayload] = useState('{\n  "example": "value"\n}');
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<StepUpdate[]>([]);
  const [finalStatus, setFinalStatus] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const run = async () => {
    let parsedPayload: any;
    try {
      parsedPayload = JSON.parse(payload);
    } catch {
      setParseError("Payload must be valid JSON.");
      return;
    }
    setParseError(null);
    setRunning(true);
    setLog([]);
    setFinalStatus(null);

    const liveStatuses: Record<string, { status: LiveStatus; output?: any }> = {};
    steps.forEach((s) => (liveStatuses[s.key] = { status: "idle" }));
    onLiveUpdate({ ...liveStatuses });

    try {
      const res = await fetch(`/api/workflows/${workflowId}/test-run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: parsedPayload }),
      });

      if (!res.body) throw new Error("No response stream.");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const evt of events) {
          const line = evt.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const json = JSON.parse(line.slice(6));

          if (json.type === "step") {
            const update: StepUpdate = json;
            setLog((prev) => [...prev, update]);
            liveStatuses[update.stepKey] = { status: update.status, output: update.output ?? update.error };
            onLiveUpdate({ ...liveStatuses });
          } else if (json.type === "done") {
            setFinalStatus(json.finalStatus);
          }
        }
      }
    } catch (e: any) {
      setFinalStatus(`error: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <Textarea rows={5} value={payload} onChange={(e) => setPayload(e.target.value)} className="font-mono text-xs" />
        {parseError && <p className="mt-1 text-xs text-danger">{parseError}</p>}
      </div>
      <Button onClick={run} disabled={running || steps.length === 0} variant="secondary">
        {running ? "Running..." : "Run test"}
      </Button>

      {log.length > 0 && (
        <div className="mt-3 space-y-1 rounded bg-surface p-3 font-mono text-xs">
          {log.map((entry, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-slate">{entry.stepKey}</span>
              <span
                className={
                  entry.status === "failed"
                    ? "text-danger"
                    : entry.status === "stopped_by_filter" || entry.status === "waiting"
                    ? "text-warn"
                    : "text-signal"
                }
              >
                [{entry.status}]
              </span>
              {entry.waitingUntil && <span className="text-slate">waiting until {new Date(entry.waitingUntil).toLocaleTimeString()}</span>}
              {entry.error && <span className="text-danger">{entry.error}</span>}
            </div>
          ))}
          {finalStatus && <p className="mt-2 border-t border-hairline pt-2 text-ink">Run finished: {finalStatus}</p>}
        </div>
      )}
    </div>
  );
}

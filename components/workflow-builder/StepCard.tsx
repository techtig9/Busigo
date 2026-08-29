"use client";

import { useState } from "react";
import type { StepDefinition } from "@/types/database";
import { STEP_LABELS } from "@/lib/engine/types";
import { StepConfigForm } from "./StepConfigForm";
import { summarizeStep } from "@/lib/engine/step-summary";
import type { AvailableRef } from "./MergeFieldPicker";
import { ChevronDown, ChevronUp, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type LiveStatus = "idle" | "running" | "success" | "failed" | "stopped_by_filter" | "waiting";

interface Props {
  step: StepDefinition;
  index: number;
  total: number;
  availableRefs: AvailableRef[];
  liveStatus?: LiveStatus;
  liveOutput?: any;
  onChangeConfig: (config: Record<string, any>) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}

const NODE_CLASS: Record<LiveStatus, string> = {
  idle: "step-node",
  running: "step-node step-node--running",
  success: "step-node step-node--done",
  stopped_by_filter: "step-node step-node--stopped",
  failed: "step-node step-node--failed",
  waiting: "step-node step-node--stopped",
};

export function StepCard({ step, index, total, availableRefs, liveStatus = "idle", liveOutput, onChangeConfig, onMove, onDelete }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={NODE_CLASS[liveStatus]} />
        {index < total - 1 && <div className="step-connector" />}
      </div>
      <div className="flex-1 pb-4">
        <div className="rounded border border-hairline bg-panel">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <div>
              <p className="text-sm font-semibold text-ink">
                {index + 1}. {STEP_LABELS[step.type]}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate">{summarizeStep(step)}</p>
            </div>
            <div className="flex items-center gap-1">
              {liveStatus !== "idle" && <LiveBadge status={liveStatus} />}
              {open ? <ChevronUp size={16} className="text-slate" /> : <ChevronDown size={16} className="text-slate" />}
            </div>
          </button>
          {open && (
            <div className="border-t border-hairline p-4">
              <StepConfigForm step={step} availableRefs={availableRefs} onChange={onChangeConfig} />
              {liveOutput !== undefined && (
                <div className="mt-3 rounded bg-surface p-2 font-mono text-xs text-ink">
                  <p className="mb-1 text-slate">Last output:</p>
                  <pre className="whitespace-pre-wrap break-all">{typeof liveOutput === "string" ? liveOutput : JSON.stringify(liveOutput, null, 2)}</pre>
                </div>
              )}
              <div className="mt-4 flex items-center justify-between border-t border-hairline pt-3">
                <div className="flex gap-2">
                  <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className="rounded p-1.5 text-slate hover:bg-surface disabled:opacity-30">
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} className="rounded p-1.5 text-slate hover:bg-surface disabled:opacity-30">
                    <ArrowDown size={14} />
                  </button>
                </div>
                <button type="button" onClick={onDelete} className="flex items-center gap-1 rounded p-1.5 text-xs text-danger hover:bg-danger/10">
                  <Trash2 size={14} /> Remove step
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LiveBadge({ status }: { status: LiveStatus }) {
  const label: Record<LiveStatus, string> = {
    idle: "",
    running: "running",
    success: "success",
    failed: "failed",
    stopped_by_filter: "stopped by filter",
    waiting: "waiting",
  };
  const tone: Record<LiveStatus, string> = {
    idle: "",
    running: "bg-pulse/10 text-pulse",
    success: "bg-signal/10 text-signal",
    failed: "bg-danger/10 text-danger",
    stopped_by_filter: "bg-warn/10 text-warn",
    waiting: "bg-warn/10 text-warn",
  };
  return <span className={cn("rounded px-2 py-0.5 text-xs font-semibold", tone[status])}>{label[status]}</span>;
}

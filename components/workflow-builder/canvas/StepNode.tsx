"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { STEP_LABELS } from "@/lib/engine/types";
import { summarizeStep } from "@/lib/engine/step-summary";
import { cn } from "@/lib/utils";
import type { StepNodeData } from "@/lib/engine/canvas-convert";
import { GitBranch, Globe, Mail, Clock, Wand2, Webhook, ShuffleIcon } from "lucide-react";
import type { StepType } from "@/types/database";

const ICONS: Record<StepType, typeof Globe> = {
  http_request: Globe,
  send_email: Mail,
  delay: Clock,
  filter: GitBranch,
  transform_data: ShuffleIcon,
  ai_action: Wand2,
  webhook_response: Webhook,
};

// Every color here is an existing design token (see tailwind.config.ts) — filter gets `warn`
// since it's the one decision point in the graph; everything else stays a neutral `signal`
// accent so the branch point is the thing that visually stands out, not seven different hues.
const ACCENT: Record<StepType, string> = {
  http_request: "border-l-signal",
  send_email: "border-l-signal",
  delay: "border-l-slate",
  filter: "border-l-warn",
  transform_data: "border-l-signal",
  ai_action: "border-l-signal",
  webhook_response: "border-l-pulse",
};

export function StepNode({ data, selected }: NodeProps & { data: StepNodeData }) {
  const Icon = ICONS[data.stepType];
  const isFilter = data.stepType === "filter";

  return (
    <div
      className={cn(
        "w-56 rounded border-l-4 bg-panel shadow-sm transition-shadow",
        ACCENT[data.stepType],
        selected ? "ring-2 ring-signal shadow-md" : "border border-hairline"
      )}
    >
      <Handle type="target" position={Position.Top} className="!h-2.5 !w-2.5 !border-hairline !bg-panel" />

      <div className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <Icon size={13} className="text-slate" />
          <p className="text-xs font-semibold text-ink">{STEP_LABELS[data.stepType]}</p>
        </div>
        <p className="mt-0.5 truncate text-[11px] text-slate">
          {summarizeStep({ key: "", type: data.stepType, config: data.config }) || "Not configured yet"}
        </p>
      </div>

      {isFilter ? (
        <>
          <Handle type="source" position={Position.Bottom} id="true" style={{ left: "30%" }} className="!h-2.5 !w-2.5 !border-signal !bg-panel" />
          <Handle type="source" position={Position.Bottom} id="false" style={{ left: "70%" }} className="!h-2.5 !w-2.5 !border-danger !bg-panel" />
          <div className="flex justify-between px-3 pb-1 text-[10px] font-semibold">
            <span className="text-signal">true</span>
            <span className="text-danger-ink">false</span>
          </div>
        </>
      ) : (
        <Handle type="source" position={Position.Bottom} className="!h-2.5 !w-2.5 !border-hairline !bg-panel" />
      )}
    </div>
  );
}

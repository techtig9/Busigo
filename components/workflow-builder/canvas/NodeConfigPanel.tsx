"use client";

import { StepConfigForm } from "../StepConfigForm";
import type { AvailableRef } from "../MergeFieldPicker";
import { STEP_LABELS } from "@/lib/engine/types";
import type { StepDefinition } from "@/types/database";
import { X, Trash2 } from "lucide-react";

export function NodeConfigPanel({
  step,
  availableRefs,
  onChange,
  onDelete,
  onClose,
}: {
  step: StepDefinition;
  availableRefs: AvailableRef[];
  onChange: (config: Record<string, any>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l border-hairline bg-panel">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
        <p className="text-sm font-bold text-ink">{STEP_LABELS[step.type]}</p>
        <button onClick={onClose} className="rounded p-1 text-slate hover:bg-surface" aria-label="Close">
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <StepConfigForm step={step} availableRefs={availableRefs} onChange={onChange} />
      </div>
      <div className="border-t border-hairline p-3">
        <button
          onClick={onDelete}
          className="flex w-full items-center justify-center gap-1.5 rounded border border-hairline py-2 text-xs font-semibold text-danger-ink transition-colors hover:bg-danger/10"
        >
          <Trash2 size={13} /> Remove step
        </button>
      </div>
    </div>
  );
}

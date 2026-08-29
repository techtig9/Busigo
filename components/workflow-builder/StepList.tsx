"use client";

import { useState } from "react";
import type { StepDefinition, StepType } from "@/types/database";
import { STEP_LABELS, STEP_TYPES } from "@/lib/engine/types";
import { StepCard, type LiveStatus } from "./StepCard";
import type { AvailableRef } from "./MergeFieldPicker";
import { Plus } from "lucide-react";

interface Props {
  steps: StepDefinition[];
  onChange: (steps: StepDefinition[]) => void;
  triggerType: string;
  liveStatuses?: Record<string, { status: LiveStatus; output?: any }>;
  aiActionAllowed: boolean;
}

let keyCounter = 0;
function nextKey(existing: StepDefinition[]) {
  keyCounter += 1;
  let candidate = `step${existing.length + keyCounter}`;
  while (existing.some((s) => s.key === candidate)) {
    keyCounter += 1;
    candidate = `step${existing.length + keyCounter}`;
  }
  return candidate;
}

const DEFAULT_CONFIG: Record<StepType, Record<string, any>> = {
  http_request: { method: "GET", url: "" },
  send_email: { to: "", subject: "", body: "" },
  delay: { amount: 5, unit: "minutes" },
  filter: { field: "trigger.", operator: "equals", value: "" },
  transform_data: { operation: "extract_field", path: "" },
  ai_action: { mode: "summarize", instruction: "", input: "" },
  webhook_response: { statusCode: 200, body: "{}" },
};

export function StepList({ steps, onChange, triggerType, liveStatuses, aiActionAllowed }: Props) {
  const [showPalette, setShowPalette] = useState(false);

  const availableRefsFor = (index: number): AvailableRef[] => {
    const refs: AvailableRef[] = [{ key: "trigger", label: "Trigger data" }];
    for (let i = 0; i < index; i++) {
      refs.push({ key: steps[i].key, label: `${i + 1}. ${STEP_LABELS[steps[i].type]}` });
    }
    return refs;
  };

  const addStep = (type: StepType) => {
    const step: StepDefinition = { key: nextKey(steps), type, config: { ...DEFAULT_CONFIG[type] } };
    onChange([...steps, step]);
    setShowPalette(false);
  };

  const updateStepConfig = (index: number, config: Record<string, any>) => {
    const next = [...steps];
    next[index] = { ...next[index], config };
    onChange(next);
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const deleteStep = (index: number) => {
    onChange(steps.filter((_, i) => i !== index));
  };

  return (
    <div>
      {steps.length === 0 && (
        <p className="mb-4 rounded border border-dashed border-hairline p-6 text-center text-sm text-slate">
          No steps yet. Add your first step below.
        </p>
      )}
      {steps.map((step, i) => (
        <StepCard
          key={step.key}
          step={step}
          index={i}
          total={steps.length}
          availableRefs={availableRefsFor(i)}
          liveStatus={liveStatuses?.[step.key]?.status ?? "idle"}
          liveOutput={liveStatuses?.[step.key]?.output}
          onChangeConfig={(config) => updateStepConfig(i, config)}
          onMove={(dir) => moveStep(i, dir)}
          onDelete={() => deleteStep(i)}
        />
      ))}

      <div className="relative ml-[27px]">
        <button
          type="button"
          onClick={() => setShowPalette((v) => !v)}
          className="flex items-center gap-1.5 rounded border border-dashed border-hairline px-3 py-2 text-sm text-signal hover:border-signal"
        >
          <Plus size={15} /> Add step
        </button>
        {showPalette && (
          <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded border border-hairline bg-panel py-1 shadow-md">
            {STEP_TYPES.filter((t) => (triggerType === "webhook" ? true : t !== "webhook_response")).map((type) => {
              const disabled = type === "ai_action" && !aiActionAllowed;
              return (
                <button
                  key={type}
                  type="button"
                  disabled={disabled}
                  onClick={() => addStep(type)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                  title={disabled ? "Requires the Starter plan or higher" : undefined}
                >
                  {STEP_LABELS[type]}
                  {disabled && <span className="text-xs text-slate">Upgrade</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

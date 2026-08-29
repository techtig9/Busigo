"use client";

import type { StepDefinition, StepType } from "@/types/database";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { MergeFieldPicker, type AvailableRef } from "./MergeFieldPicker";

interface Props {
  step: StepDefinition;
  availableRefs: AvailableRef[];
  onChange: (config: Record<string, any>) => void;
}

// A text input/textarea paired with a merge-field inserter that appends at the field's end.
function MergeableField({
  label,
  value,
  onChange,
  availableRefs,
  multiline,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  availableRefs: AvailableRef[];
  multiline?: boolean;
  placeholder?: string;
}) {
  const Field = multiline ? Textarea : Input;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <Label>{label}</Label>
        <MergeFieldPicker available={availableRefs} onInsert={(token) => onChange(`${value || ""}${token}`)} />
      </div>
      <Field
        value={value || ""}
        placeholder={placeholder}
        rows={multiline ? 3 : undefined}
        onChange={(e: any) => onChange(e.target.value)}
      />
    </div>
  );
}

export function StepConfigForm({ step, availableRefs, onChange }: Props) {
  const cfg = step.config || {};
  const set = (patch: Record<string, any>) => onChange({ ...cfg, ...patch });

  switch (step.type as StepType) {
    case "http_request":
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Method</Label>
              <Select value={cfg.method || "GET"} onChange={(e) => set({ method: e.target.value })}>
                {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            </div>
            <div className="col-span-2">
              <MergeableField label="URL" value={cfg.url} onChange={(v) => set({ url: v })} availableRefs={availableRefs} placeholder="https://api.example.com/endpoint" />
            </div>
          </div>
          <MergeableField label="Body (JSON, optional)" value={cfg.body} onChange={(v) => set({ body: v })} availableRefs={availableRefs} multiline placeholder='{"key": "{{trigger.field}}"}' />
          <p className="text-xs text-slate">
            Requests to private/internal IP ranges are blocked automatically. Timeout: 8s. Response cap: 100KB.
          </p>
        </div>
      );

    case "send_email":
      return (
        <div className="space-y-3">
          <MergeableField label="To" value={cfg.to} onChange={(v) => set({ to: v })} availableRefs={availableRefs} placeholder="{{trigger.email}}" />
          <MergeableField label="Subject" value={cfg.subject} onChange={(v) => set({ subject: v })} availableRefs={availableRefs} />
          <MergeableField label="Body" value={cfg.body} onChange={(v) => set({ body: v })} availableRefs={availableRefs} multiline />
        </div>
      );

    case "delay":
      return (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Amount</Label>
            <Input type="number" min={1} value={cfg.amount || ""} onChange={(e) => set({ amount: e.target.value })} />
          </div>
          <div>
            <Label>Unit</Label>
            <Select value={cfg.unit || "minutes"} onChange={(e) => set({ unit: e.target.value })}>
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </Select>
          </div>
        </div>
      );

    case "filter":
      return (
        <div className="space-y-3">
          <MergeableField label="Field to check (path, e.g. trigger.amount)" value={cfg.field} onChange={(v) => set({ field: v })} availableRefs={availableRefs} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Operator</Label>
              <Select value={cfg.operator || "equals"} onChange={(e) => set({ operator: e.target.value })}>
                <option value="equals">Equals</option>
                <option value="contains">Contains</option>
                <option value="greater_than">Greater than</option>
                <option value="less_than">Less than</option>
                <option value="exists">Exists</option>
              </Select>
            </div>
            {cfg.operator !== "exists" && (
              <div>
                <Label>Value</Label>
                <Input value={cfg.value || ""} onChange={(e) => set({ value: e.target.value })} />
              </div>
            )}
          </div>
          <p className="text-xs text-slate">If this doesn't pass, the run ends as "stopped by filter" — not a failure.</p>
        </div>
      );

    case "transform_data":
      return (
        <div className="space-y-3">
          <div>
            <Label>Operation</Label>
            <Select value={cfg.operation || "extract_field"} onChange={(e) => set({ operation: e.target.value })}>
              <option value="extract_field">Extract field</option>
              <option value="json_parse">JSON parse</option>
              <option value="json_stringify">JSON stringify</option>
              <option value="uppercase">Uppercase</option>
              <option value="lowercase">Lowercase</option>
              <option value="trim">Trim</option>
            </Select>
          </div>
          {(cfg.operation === "extract_field" || cfg.operation === "json_stringify") && (
            <MergeableField label="Path (e.g. trigger.data.id)" value={cfg.path} onChange={(v) => set({ path: v })} availableRefs={availableRefs} />
          )}
          {(cfg.operation === "json_parse" || cfg.operation === "uppercase" || cfg.operation === "lowercase" || cfg.operation === "trim") && (
            <MergeableField label="Text" value={cfg.text} onChange={(v) => set({ text: v })} availableRefs={availableRefs} multiline />
          )}
        </div>
      );

    case "ai_action":
      return (
        <div className="space-y-3">
          <div>
            <Label>Mode</Label>
            <Select value={cfg.mode || "summarize"} onChange={(e) => set({ mode: e.target.value })}>
              <option value="summarize">Summarize</option>
              <option value="classify">Classify</option>
              <option value="extract">Extract structured fields</option>
              <option value="generate">Generate text</option>
            </Select>
          </div>
          {cfg.mode === "classify" && (
            <div>
              <Label>Categories (comma-separated)</Label>
              <Input
                value={(cfg.categories || []).join(", ")}
                onChange={(e) => set({ categories: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })}
              />
            </div>
          )}
          {cfg.mode !== "classify" && (
            <MergeableField label="Instruction" value={cfg.instruction} onChange={(v) => set({ instruction: v })} availableRefs={availableRefs} multiline />
          )}
          <MergeableField label="Input data" value={cfg.input} onChange={(v) => set({ input: v })} availableRefs={availableRefs} multiline placeholder="{{trigger.message}}" />
          <p className="text-xs text-slate">
            This data is sent to Claude wrapped as untrusted input — it's never treated as instructions, even if it tries to look like one.
          </p>
        </div>
      );

    case "webhook_response":
      return (
        <div className="space-y-3">
          <div>
            <Label>Status code</Label>
            <Input type="number" value={cfg.statusCode || "200"} onChange={(e) => set({ statusCode: e.target.value })} />
          </div>
          <MergeableField label="Response body (JSON)" value={cfg.body} onChange={(v) => set({ body: v })} availableRefs={availableRefs} multiline placeholder='{"ok": true}' />
          <p className="text-xs text-slate">Only valid on webhook-triggered workflows. Ends the run after responding.</p>
        </div>
      );

    default:
      return <p className="text-sm text-danger">Unknown step type.</p>;
  }
}

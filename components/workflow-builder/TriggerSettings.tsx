"use client";

import { useState, useTransition } from "react";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { regenerateWebhookTokenAction, saveFormFieldsAction } from "@/lib/actions/workflows";
import type { FormField } from "@/types/database";
import { Copy, Plus, Trash2 } from "lucide-react";

export function WebhookTrigger({ workflowId, token }: { workflowId: string; token: string }) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${siteUrl}/api/hook/${token}`;

  return (
    <div className="space-y-2">
      <Label>Webhook URL</Label>
      <div className="flex gap-2">
        <Input readOnly value={url} className="font-mono text-xs" />
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          <Copy size={14} /> {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <Button
        type="button"
        variant="ghost"
        disabled={pending}
        onClick={() => {
          if (confirm("Regenerating will make the current URL stop working immediately. Continue?")) {
            startTransition(() => regenerateWebhookTokenAction(workflowId));
          }
        }}
      >
        Regenerate URL
      </Button>
    </div>
  );
}

export function ScheduleTrigger({ cron, onChange }: { cron: string; onChange: (cron: string) => void }) {
  return (
    <div>
      <Label>Cron expression</Label>
      <Input value={cron} onChange={(e) => onChange(e.target.value)} placeholder="0 9 * * *" className="font-mono text-xs" />
      <p className="mt-1 text-xs text-slate">Checked once a minute by /api/cron/tick. Example: "0 9 * * *" runs daily at 09:00 UTC.</p>
    </div>
  );
}

export function FormTrigger({ workflowId, initialSlug, initialFields }: { workflowId: string; initialSlug: string; initialFields: FormField[] }) {
  const [slug, setSlug] = useState(initialSlug);
  const [fields, setFields] = useState<FormField[]>(initialFields.length ? initialFields : []);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";

  const addField = () => setFields((f) => [...f, { key: `field${f.length + 1}`, label: "", type: "text", required: false }]);
  const updateField = (i: number, patch: Partial<FormField>) =>
    setFields((f) => f.map((field, idx) => (idx === i ? { ...field, ...patch } : field)));
  const removeField = (i: number) => setFields((f) => f.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      <div>
        <Label>Form URL slug</Label>
        <Input value={slug} onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9-]/g, "-"))} placeholder="contact-us" />
        {slug && <p className="mt-1 text-xs text-slate font-mono">{siteUrl}/form/{slug}</p>}
      </div>
      <div className="space-y-2">
        {fields.map((field, i) => (
          <div key={i} className="flex items-center gap-2 rounded border border-hairline p-2">
            <Input placeholder="key" value={field.key} onChange={(e) => updateField(i, { key: e.target.value })} className="w-28" />
            <Input placeholder="Label" value={field.label} onChange={(e) => updateField(i, { label: e.target.value })} className="flex-1" />
            <select
              className="rounded border border-hairline px-2 py-2 text-sm"
              value={field.type}
              onChange={(e) => updateField(i, { type: e.target.value as FormField["type"] })}
            >
              {["text", "number", "email", "textarea", "select"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-xs text-slate">
              <input type="checkbox" checked={field.required} onChange={(e) => updateField(i, { required: e.target.checked })} />
              required
            </label>
            <button type="button" onClick={() => removeField(i)} className="text-danger">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <Button type="button" variant="ghost" onClick={addField}>
          <Plus size={14} /> Add field
        </Button>
      </div>
      <Button
        type="button"
        disabled={pending || !slug}
        onClick={() =>
          startTransition(async () => {
            await saveFormFieldsAction(workflowId, slug, fields);
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
          })
        }
      >
        {pending ? "Saving..." : saved ? "Saved" : "Save form"}
      </Button>
    </div>
  );
}

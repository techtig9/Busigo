"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createWorkflowAction } from "@/lib/actions/workflows";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

interface Template {
  id: string;
  name: string;
  use_case: string;
}

const TRIGGERS = [
  { value: "webhook", label: "Webhook", desc: "Triggered by an inbound HTTP call to a unique URL." },
  { value: "schedule", label: "Schedule", desc: "Triggered on a cron schedule you define." },
  { value: "form", label: "Form", desc: "Triggered by a submission on a public form page." },
];

export function NewWorkflowForm({ templates }: { templates: Template[] }) {
  const [triggerType, setTriggerType] = useState("webhook");
  const [templateId, setTemplateId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        formData.set("trigger_type", triggerType);
        formData.set("template_id", templateId);
        setError(null);
        startTransition(async () => {
          try {
            const newId = await createWorkflowAction(formData);
            router.push(`/workflows/${newId}`);
          } catch (err: any) {
            setError(err.message);
          }
        });
      }}
    >
      {error && <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      <div>
        <Label>Name</Label>
        <Input name="name" required placeholder="e.g. New customer welcome email" />
      </div>
      <div>
        <Label>Description (optional)</Label>
        <Textarea name="description" rows={2} />
      </div>

      <div>
        <Label>Trigger</Label>
        <div className="grid grid-cols-3 gap-3">
          {TRIGGERS.map((t) => (
            <button
              type="button"
              key={t.value}
              onClick={() => setTriggerType(t.value)}
              className={cn(
                "rounded border p-3 text-left text-sm",
                triggerType === t.value ? "border-signal bg-signal/5" : "border-hairline hover:border-signal/50"
              )}
            >
              <p className="font-semibold text-ink">{t.label}</p>
              <p className="mt-1 text-xs text-slate">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {templates.length > 0 && (
        <div>
          <Label>Start from a template (optional)</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setTemplateId("")}
              className={cn(
                "rounded border p-3 text-left text-sm",
                templateId === "" ? "border-signal bg-signal/5" : "border-hairline hover:border-signal/50"
              )}
            >
              <p className="font-semibold text-ink">Blank</p>
              <p className="mt-1 text-xs text-slate">Start with an empty step list.</p>
            </button>
            {templates.map((t) => (
              <button
                type="button"
                key={t.id}
                onClick={() => setTemplateId(t.id)}
                className={cn(
                  "rounded border p-3 text-left text-sm",
                  templateId === t.id ? "border-signal bg-signal/5" : "border-hairline hover:border-signal/50"
                )}
              >
                <p className="font-semibold text-ink">{t.name}</p>
                <p className="mt-1 text-xs text-slate">{t.use_case}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Creating..." : "Create workflow"}
      </Button>
    </form>
  );
}

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
      {error && <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger-ink">{error}</p>}

      <div>
        <Label htmlFor="newworkflowfor-name">Name</Label>
        <Input id="newworkflowfor-name" name="name" required placeholder="e.g. New customer welcome email" />
      </div>
      <div>
        <Label htmlFor="newworkflowfor-description-optional">Description (optional)</Label>
        <Textarea id="newworkflowfor-description-optional" name="description" rows={2} />
      </div>

      <div>
        <p id="trigger-group-label" className="mb-1.5 block text-xs font-semibold text-slate">
          Trigger
        </p>
        <div role="radiogroup" aria-labelledby="trigger-group-label" className="grid grid-cols-3 gap-3">
          {TRIGGERS.map((t) => (
            <button
              type="button"
              key={t.value}
              role="radio"
              aria-checked={triggerType === t.value}
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
          <p id="template-group-label" className="mb-1.5 block text-xs font-semibold text-slate">
            Start from a template (optional)
          </p>
          <div role="radiogroup" aria-labelledby="template-group-label" className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              role="radio"
              aria-checked={templateId === ""}
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
                role="radio"
                aria-checked={templateId === t.id}
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

"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import type { FormField } from "@/types/database";
import { Field } from "@/components/ui/Field";
import { Input, Textarea, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

/**
 * The one screen in BusiGo that a customer's OWN visitors see.
 *
 * It was built entirely outside the design system — raw `<input>`, `<select>`, `<textarea>`
 * and `<button>` with ad-hoc class strings — so it drifted from every other form in the
 * product and did not follow the theme. Worse, its `<label>`s carried no `htmlFor` and the
 * controls carried no `id`, so the label was decoration: clicking it did nothing, and a
 * screen reader announced each control unlabelled. On the public form, that is the customer's
 * form that is inaccessible, not ours.
 *
 * Every control now goes through `Field`, which owns the id and wires label, hint and error
 * together via `aria-describedby` and `aria-invalid`.
 */
export function PublicFormClient({ slug, fields }: { slug: string; fields: FormField[] }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const setValue = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }));

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch(`/api/form/${slug}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Submission failed (${res.status}).`);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed. Please try again.");
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <p
        role="status"
        className="flex items-start gap-2.5 rounded-lg border border-success/30 bg-success-soft px-4 py-3 text-sm text-ink"
      >
        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success-ink" aria-hidden="true" />
        Thanks — your submission was received.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <p
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger-soft px-3.5 py-3 text-sm text-ink"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger-ink" aria-hidden="true" />
          {error}
        </p>
      )}

      {fields.map((field) => (
        <Field key={field.key} label={field.label || field.key} required={field.required}>
          {({ id, describedBy }) =>
            field.type === "textarea" ? (
              <Textarea
                id={id}
                aria-describedby={describedBy}
                name={field.key}
                required={field.required}
                rows={4}
                value={values[field.key] ?? ""}
                onChange={(e) => setValue(field.key, e.target.value)}
              />
            ) : field.type === "select" ? (
              <Select
                id={id}
                aria-describedby={describedBy}
                name={field.key}
                required={field.required}
                value={values[field.key] ?? ""}
                onChange={(e) => setValue(field.key, e.target.value)}
              >
                <option value="">Select…</option>
                {(field.options || []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                id={id}
                aria-describedby={describedBy}
                name={field.key}
                type={field.type}
                required={field.required}
                value={values[field.key] ?? ""}
                onChange={(e) => setValue(field.key, e.target.value)}
              />
            )
          }
        </Field>
      ))}

      <Button type="submit" loading={status === "submitting"} disabled={status === "submitting"}>
        Submit
      </Button>
    </form>
  );
}

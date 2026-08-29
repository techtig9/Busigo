"use client";

import { useState, type FormEvent } from "react";
import type { FormField } from "@/types/database";

export function PublicFormClient({ slug, fields }: { slug: string; fields: FormField[] }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

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
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Submission failed.");
      setStatus("done");
    } catch (e: any) {
      setError(e.message);
      setStatus("error");
    }
  };

  if (status === "done") {
    return <p className="rounded border border-pulse/30 bg-pulse/10 px-4 py-3 text-sm text-ink">Thanks — your submission was received.</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      {fields.map((field) => (
        <div key={field.key}>
          <label className="mb-1 block text-xs font-semibold text-slate">
            {field.label || field.key} {field.required && <span className="text-danger">*</span>}
          </label>
          {field.type === "textarea" ? (
            <textarea
              required={field.required}
              rows={4}
              className="w-full rounded border border-hairline px-3 py-2 text-sm"
              onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
            />
          ) : field.type === "select" ? (
            <select
              required={field.required}
              className="w-full rounded border border-hairline px-3 py-2 text-sm"
              onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
            >
              <option value="">Select...</option>
              {(field.options || []).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : (
            <input
              type={field.type}
              required={field.required}
              className="w-full rounded border border-hairline px-3 py-2 text-sm"
              onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
            />
          )}
        </div>
      ))}
      <button
        type="submit"
        disabled={status === "submitting"}
        className="rounded bg-signal px-4 py-2 text-sm font-semibold text-white hover:bg-signal-dark disabled:opacity-50"
      >
        {status === "submitting" ? "Submitting..." : "Submit"}
      </button>
    </form>
  );
}

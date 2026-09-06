"use client";

import { useId } from "react";
import type { ReactNode } from "react";

/**
 * Wires label, hint and error text to a control by id.
 *
 * The association is programmatic, not merely visual: `aria-describedby` points at whichever
 * of hint/error exists, and `aria-invalid` flips with the error. A screen reader user
 * therefore hears the validation message as part of the field, instead of encountering
 * orphaned red text somewhere after it (spec §19: accessible errors).
 *
 * Usage:
 *   <Field label="Workspace name" error={errors.name} required>
 *     {({ id, describedBy, invalid }) => (
 *       <Input id={id} aria-describedby={describedBy} invalid={invalid} name="name" />
 *     )}
 *   </Field>
 */
export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-slate">
          {label}
          {required && (
            <span className="ml-0.5 text-danger" aria-hidden>
              *
            </span>
          )}
        </label>
      )}
      {children({ id, describedBy, invalid: !!error })}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

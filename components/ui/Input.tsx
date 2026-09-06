import { cn } from "@/lib/utils";
import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from "react";

// No "use client" here on purpose: these are plain styled elements with no hooks, so they
// stay usable directly inside Server Components (many dashboard pages render <Input>/<Label>
// in server-rendered forms). The one piece that needs a hook — Field, which calls useId to
// wire label/hint/error together — lives in its own client module, Field.tsx.

// Spec §6: 40–44px height, clear label/helper text, visible focus ring, inline validation.
const FIELD_BASE =
  "w-full rounded border bg-panel px-3 text-sm text-ink placeholder:text-muted " +
  "transition-colors duration-hover ease-out " +
  "outline-none focus-visible:ring-2 focus-visible:ring-signal/40 focus-visible:border-signal " +
  "disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted";

export function fieldClasses(invalid?: boolean, extra?: string) {
  return cn(
    FIELD_BASE,
    invalid ? "border-danger focus-visible:ring-danger/40 focus-visible:border-danger" : "border-hairline",
    extra
  );
}

export function Input({
  className,
  invalid,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input aria-invalid={invalid || undefined} className={fieldClasses(invalid, cn("h-10", className))} {...props} />
  );
}

export function Textarea({
  className,
  invalid,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={fieldClasses(invalid, cn("min-h-24 py-2", className))}
      {...props}
    />
  );
}

export function Select({
  className,
  invalid,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select aria-invalid={invalid || undefined} className={fieldClasses(invalid, cn("h-10", className))} {...props}>
      {children}
    </select>
  );
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold text-slate">
      {children}
    </label>
  );
}

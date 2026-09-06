"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useId } from "react";
import type { ReactNode } from "react";

const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

export function Checkbox({
  checked,
  onCheckedChange,
  label,
  hint,
  disabled,
  indeterminate,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: ReactNode;
  hint?: string;
  disabled?: boolean;
  indeterminate?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-2.5">
      <CheckboxPrimitive.Root
        id={id}
        checked={indeterminate ? "indeterminate" : checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        disabled={disabled}
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-hairline-strong bg-panel",
          "transition-colors duration-micro",
          "data-[state=checked]:border-signal data-[state=checked]:bg-signal",
          "data-[state=indeterminate]:border-signal data-[state=indeterminate]:bg-signal",
          "disabled:cursor-not-allowed disabled:opacity-50",
          FOCUS
        )}
      >
        <CheckboxPrimitive.Indicator className="text-white">
          {indeterminate ? <Minus size={12} strokeWidth={3} /> : <Check size={12} strokeWidth={3} />}
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {label && (
        <label htmlFor={id} className={cn("text-sm text-ink", disabled && "opacity-50")}>
          {label}
          {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
        </label>
      )}
    </div>
  );
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: ReactNode;
  hint?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      {label && (
        <label htmlFor={id} className={cn("text-sm text-ink", disabled && "opacity-50")}>
          {label}
          {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
        </label>
      )}
      <SwitchPrimitive.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full border border-transparent bg-hairline-strong",
          "transition-colors duration-hover ease-out",
          "data-[state=checked]:bg-signal",
          "disabled:cursor-not-allowed disabled:opacity-50",
          FOCUS
        )}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            "block h-4 w-4 rounded-full bg-white shadow-xs",
            "transition-transform duration-hover ease-out",
            "translate-x-0.5 data-[state=checked]:translate-x-[1.125rem]"
          )}
        />
      </SwitchPrimitive.Root>
    </div>
  );
}

export function RadioGroup({
  value,
  onValueChange,
  options,
  disabled,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: ReactNode; hint?: string }[];
  disabled?: boolean;
}) {
  return (
    <RadioGroupPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      className="flex flex-col gap-2.5"
    >
      {options.map((o) => (
        <RadioOption key={o.value} {...o} disabled={disabled} />
      ))}
    </RadioGroupPrimitive.Root>
  );
}

function RadioOption({
  value,
  label,
  hint,
  disabled,
}: {
  value: string;
  label: ReactNode;
  hint?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-2.5">
      <RadioGroupPrimitive.Item
        id={id}
        value={value}
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-hairline-strong bg-panel",
          "transition-colors duration-micro",
          "data-[state=checked]:border-signal",
          "disabled:cursor-not-allowed disabled:opacity-50",
          FOCUS
        )}
      >
        <RadioGroupPrimitive.Indicator className="h-2 w-2 rounded-full bg-signal" />
      </RadioGroupPrimitive.Item>
      <label htmlFor={id} className={cn("text-sm text-ink", disabled && "opacity-50")}>
        {label}
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </label>
    </div>
  );
}

export function Separator({ className, vertical }: { className?: string; vertical?: boolean }) {
  return (
    <SeparatorPrimitive.Root
      decorative
      orientation={vertical ? "vertical" : "horizontal"}
      className={cn("bg-hairline", vertical ? "h-full w-px" : "h-px w-full", className)}
    />
  );
}

export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const dim = { xs: "h-6 w-6 text-[10px]", sm: "h-7 w-7 text-xs", md: "h-9 w-9 text-sm", lg: "h-12 w-12 text-base" }[
    size
  ];
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <AvatarPrimitive.Root
      className={cn("inline-flex shrink-0 select-none overflow-hidden rounded-full", dim, className)}
    >
      {src && <AvatarPrimitive.Image src={src} alt="" className="h-full w-full object-cover" />}
      <AvatarPrimitive.Fallback
        // The name is conveyed by surrounding text wherever this is used, so the initials
        // are decorative rather than a second announcement of the same name.
        aria-hidden
        className="flex h-full w-full items-center justify-center bg-signal-strong font-bold text-white"
      >
        {initials || "?"}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

export function Progress({
  value,
  max = 100,
  label,
  tone = "signal",
  className,
}: {
  value: number;
  max?: number;
  label?: string;
  tone?: "signal" | "success" | "warn" | "danger";
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const barTone = { signal: "bg-signal", success: "bg-success", warn: "bg-warn", danger: "bg-danger" }[tone];
  return (
    <ProgressPrimitive.Root
      value={value}
      max={max}
      aria-label={label}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface", className)}
    >
      <ProgressPrimitive.Indicator
        className={cn("h-full rounded-full transition-transform duration-major ease-out", barTone)}
        style={{ transform: `translateX(-${100 - pct}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-signal text-white border border-signal hover:bg-signal-dark hover:border-signal-dark shadow-xs",
  secondary: "bg-panel text-ink border border-hairline hover:border-hairline-strong hover:bg-surface",
  ghost: "bg-transparent text-ink border border-transparent hover:bg-surface",
  subtle: "bg-signal-soft text-signal border border-transparent hover:bg-signal/15",
  danger: "bg-danger text-white border border-danger hover:brightness-95",
};

// Heights follow spec §6 (inputs/controls 40–44px at default size).
const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-sm gap-2",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  href?: string;
  /** Shows a spinner and blocks interaction. The button keeps its original dimensions
   *  (spec §6: "loading state keeps original dimensions") — the label stays in the layout
   *  and is hidden from view, so the row never reflows mid-submit. */
  loading?: boolean;
  /** Render as the child element instead of a <button>, keeping all styling. */
  asChild?: boolean;
}

/**
 * forwardRef is REQUIRED, not decorative.
 *
 * Radix's `asChild` pattern (used by every Tooltip.Trigger, DropdownMenu.Trigger,
 * Dialog.Trigger and Dialog.Close in this codebase) clones its child and passes it a ref.
 * A plain function component silently drops that ref, and React warns
 * "Function components cannot be given refs" — with the practical consequence that the
 * trigger cannot be measured or focused, so tooltip/menu positioning and focus restoration
 * break. Every component intended to sit inside `asChild` must forward its ref.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, href, loading = false, asChild = false, children, disabled, ...props },
  ref
) {
  const classes = cn(
    "relative inline-flex items-center justify-center whitespace-nowrap rounded font-semibold",
    "transition-all duration-hover ease-out active:scale-[0.98]",
    "outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
    "disabled:pointer-events-none",
    // `loading` also sets `disabled` (to block double-submits), but a busy button must not
    // look like an unavailable one — dimming it to 50% reads as "you can't do this" rather
    // than "this is happening". Only a genuinely disabled button is dimmed.
    !loading && "disabled:opacity-50",
    SIZE_CLASSES[size],
    VARIANT_CLASSES[variant],
    className
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  if (asChild) {
    return (
      <Slot ref={ref} className={classes} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <button
      ref={ref}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 size={16} className="animate-spin" aria-hidden />
        </span>
      )}
      {/* invisible (not removed) so the button's width is unchanged while loading */}
      <span className={cn("inline-flex items-center gap-2", loading && "invisible")}>{children}</span>
    </button>
  );
});

/** Icon-only control. `label` is required — it becomes the accessible name (spec §6:
 *  "icon-only controls require tooltip and accessible label"). Pair with <Tooltip> for the
 *  visual affordance. Forwards its ref for the same `asChild` reason as Button above. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, "href" | "asChild"> & { label: string }
>(function IconButton({ label, variant = "ghost", size = "md", className, children, ...props }, ref) {
  const sizeClass = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-11 w-11" : "h-10 w-10";
  return (
    <button
      ref={ref}
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded",
        "transition-all duration-hover ease-out active:scale-[0.98]",
        "outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        "disabled:pointer-events-none disabled:opacity-50",
        sizeClass,
        VARIANT_CLASSES[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});

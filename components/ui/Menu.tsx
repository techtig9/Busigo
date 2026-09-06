"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/* Shared surface styling for every floating panel, so a menu, a popover and a tooltip all
   read as the same material. */
const SURFACE =
  "z-50 rounded-lg border border-hairline bg-panel p-1 shadow-md " +
  "data-[state=open]:animate-zoom-in data-[state=closed]:animate-zoom-out";

const ITEM =
  "flex cursor-pointer select-none items-center gap-2 rounded px-2.5 py-2 text-sm text-ink outline-none " +
  "transition-colors duration-micro " +
  "data-[highlighted]:bg-surface data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

/**
 * Dropdown menu.
 *
 * Replaces the hand-rolled `div` dropdowns used for the notification, profile and workspace
 * menus. Radix brings roving tabindex, typeahead, arrow-key navigation, Escape dismissal and
 * focus restoration — none of which those divs had.
 */
export function Menu({
  trigger,
  children,
  align = "end",
  className,
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align={align} sideOffset={6} className={cn(SURFACE, "min-w-[10rem]", className)}>
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function MenuItem({
  children,
  onSelect,
  disabled,
  destructive,
  className,
}: {
  children: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  className?: string;
}) {
  return (
    <DropdownMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(ITEM, destructive && "text-danger data-[highlighted]:bg-danger-soft", className)}
    >
      {children}
    </DropdownMenu.Item>
  );
}

export function MenuCheckboxItem({
  children,
  checked,
  onCheckedChange,
}: {
  children: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <DropdownMenu.CheckboxItem checked={checked} onCheckedChange={onCheckedChange} className={cn(ITEM, "pl-2")}>
      <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
        {checked && <Check size={14} className="text-signal" />}
      </span>
      {children}
    </DropdownMenu.CheckboxItem>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu.Label className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
      {children}
    </DropdownMenu.Label>
  );
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-hairline" />;
}

/** Free-form floating panel — for content that isn't a list of commands. */
export function Popover({
  trigger,
  children,
  align = "center",
  className,
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
}) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={align}
          sideOffset={6}
          className={cn(SURFACE, "w-72 p-3", className)}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** Mount once near the root of an interactive tree. */
export const TooltipProvider = TooltipPrimitive.Provider;

/**
 * Tooltip.
 *
 * A tooltip is a supplement, never the only source of a control's name — icon-only controls
 * still carry an `aria-label` via IconButton (spec §6). Screen readers get the label; sighted
 * mouse users get this.
 */
export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className={cn(
            "z-50 rounded border border-hairline bg-ink px-2 py-1 text-xs font-medium text-canvas shadow-md",
            "data-[state=delayed-open]:animate-fade-in"
          )}
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

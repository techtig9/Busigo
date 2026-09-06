"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Tabs.
 *
 * Radix gives arrow-key navigation between triggers, correct `role="tablist"` / `tab` /
 * `tabpanel` wiring, and roving tabindex so the group is a single tab stop. Several screens
 * in the spec are tab-driven (Business Brain §14, Agent detail §16, Settings §27,
 * Security §24, AI Studio §8), so this is a load-bearing primitive rather than a nicety.
 *
 * The list scrolls horizontally rather than wrapping — a tab row that reflows to two lines
 * on a narrow viewport shifts every panel below it (spec §18: no horizontal page overflow,
 * so the scroll is contained here rather than pushing the page wide).
 */
export const Tabs = TabsPrimitive.Root;

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <TabsPrimitive.List
      className={cn(
        "flex items-center gap-1 overflow-x-auto border-b border-hairline",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {children}
    </TabsPrimitive.List>
  );
}

export function TabsTrigger({
  value,
  children,
  count,
  disabled,
}: {
  value: string;
  children: ReactNode;
  count?: number;
  disabled?: boolean;
}) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      disabled={disabled}
      className={cn(
        "relative shrink-0 whitespace-nowrap px-3 py-2.5 text-sm font-medium text-slate",
        "transition-colors duration-hover ease-out hover:text-ink",
        "outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-1 focus-visible:ring-offset-canvas",
        "disabled:pointer-events-none disabled:opacity-50",
        "data-[state=active]:text-ink",
        // The active indicator sits on the list's own border line.
        "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-transparent",
        "data-[state=active]:after:bg-signal"
      )}
    >
      {children}
      {typeof count === "number" && (
        <span className="ml-1.5 rounded bg-surface px-1.5 py-0.5 text-[11px] font-semibold text-slate">{count}</span>
      )}
    </TabsPrimitive.Trigger>
  );
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <TabsPrimitive.Content
      value={value}
      className={cn("pt-5 outline-none focus-visible:ring-2 focus-visible:ring-signal", className)}
    >
      {children}
    </TabsPrimitive.Content>
  );
}

"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Accessible modal dialog.
 *
 * Radix supplies what hand-rolled `div` overlays in this codebase did not: role="dialog",
 * aria-modal, a focus trap, focus restoration to the trigger on close, Escape-to-dismiss,
 * and inert background content. That is the whole reason Radix was added (see
 * docs/design-decision.md §10) — these behaviours are properties of the component rather
 * than per-page discipline that decays.
 *
 * A title is REQUIRED: Radix warns without one, and a dialog with no accessible name is
 * unusable with a screen reader. Pass `hideTitle` to keep it visually hidden but announced.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  hideTitle = false,
  size = "md",
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  hideTitle?: boolean;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  footer?: ReactNode;
}) {
  const width = size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-2xl" : "max-w-md";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2",
            "rounded-xl border border-hairline bg-panel shadow-lg",
            "data-[state=open]:animate-zoom-in data-[state=closed]:animate-zoom-out",
            "max-h-[calc(100vh-4rem)] overflow-y-auto",
            width
          )}
        >
          <div className="flex items-start justify-between gap-4 p-5 pb-0">
            <div className={cn(hideTitle && "sr-only")}>
              <Dialog.Title className="text-base font-bold text-ink">{title}</Dialog.Title>
              {description && <Dialog.Description className="mt-1 text-sm text-slate">{description}</Dialog.Description>}
            </div>
            <Dialog.Close
              aria-label="Close dialog"
              className="shrink-0 rounded p-1 text-slate transition-colors duration-hover hover:bg-surface hover:text-ink"
            >
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className="p-5">{children}</div>
          {footer && (
            <div className="flex items-center justify-end gap-2 border-t border-hairline px-5 py-4">{footer}</div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Side drawer / bottom sheet.
 *
 * Responsive by design (spec §18): slides in from the right on desktop, and becomes a bottom
 * sheet below the `sm` breakpoint, where a right-hand drawer would leave no readable width.
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = "md",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: "sm" | "md" | "lg";
}) {
  const w = width === "sm" ? "sm:max-w-sm" : width === "lg" ? "sm:max-w-xl" : "sm:max-w-md";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
        <Dialog.Content
          className={cn(
            "fixed z-50 flex flex-col border-hairline bg-panel shadow-lg",
            // mobile: bottom sheet
            "inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl border-t",
            "data-[state=open]:animate-slide-in-bottom data-[state=closed]:animate-slide-out-bottom",
            // sm and up: right-hand drawer
            "sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-full sm:rounded-none sm:rounded-l-2xl sm:border-l sm:border-t-0",
            "sm:data-[state=open]:animate-slide-in-right sm:data-[state=closed]:animate-slide-out-right",
            w
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-hairline p-5">
            <div>
              <Dialog.Title className="text-base font-bold text-ink">{title}</Dialog.Title>
              {description && <Dialog.Description className="mt-1 text-sm text-slate">{description}</Dialog.Description>}
            </div>
            <Dialog.Close
              aria-label="Close panel"
              className="shrink-0 rounded p-1 text-slate transition-colors duration-hover hover:bg-surface hover:text-ink"
            >
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-5">{children}</div>
          {footer && (
            <div className="flex items-center justify-end gap-2 border-t border-hairline px-5 py-4">{footer}</div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

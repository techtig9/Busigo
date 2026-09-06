"use client";

import { useState, useTransition } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { AlertTriangle } from "lucide-react";

/**
 * Confirmation gate for destructive operations (spec §2 design system: "Destructive
 * operations require confirmation").
 *
 * Errors thrown by `onConfirm` are surfaced inside the dialog and the dialog stays open, so
 * a failed delete never looks like a successful one — the caller does not need its own
 * error plumbing for the common case.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      try {
        await onConfirm();
        onOpenChange(false);
      } catch (e: any) {
        setError(e?.message || "That didn't work. Please try again.");
      }
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null);
        onOpenChange(next);
      }}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? "danger" : "primary"} onClick={confirm} loading={pending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        {destructive && (
          <span className="mt-0.5 shrink-0 text-danger" aria-hidden>
            <AlertTriangle size={18} />
          </span>
        )}
        <p className="text-sm text-slate">{body}</p>
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </Modal>
  );
}

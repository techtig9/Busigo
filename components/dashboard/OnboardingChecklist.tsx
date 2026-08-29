"use client";

import { useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { CheckCircle2, Circle, X } from "lucide-react";
import Link from "next/link";
import { dismissOnboardingAction } from "@/lib/actions/onboarding";

export interface ChecklistItem {
  label: string;
  done: boolean;
  href: string;
}

export function OnboardingChecklist({ items }: { items: ChecklistItem[] }) {
  const [pending, startTransition] = useTransition();
  const doneCount = items.filter((i) => i.done).length;

  return (
    <Card className="animate-slide-up stagger-1 border-signal/30 bg-signal/5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold text-ink">Getting started</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate">
            {doneCount}/{items.length}
          </span>
          <button
            onClick={() => startTransition(() => dismissOnboardingAction())}
            disabled={pending}
            className="rounded p-1 text-slate transition-colors hover:bg-surface hover:text-ink"
            aria-label="Dismiss getting-started checklist"
            title="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.label}>
            <Link href={item.href} className="flex items-center gap-2 text-sm transition-colors hover:text-signal">
              {item.done ? <CheckCircle2 size={16} className="shrink-0 text-signal" /> : <Circle size={16} className="shrink-0 text-slate" />}
              <span className={item.done ? "text-slate line-through" : "text-ink"}>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

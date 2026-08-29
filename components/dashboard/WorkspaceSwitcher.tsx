"use client";

import { useRef, useState, useTransition } from "react";
import { ChevronsUpDown, Check, Plus, Loader2 } from "lucide-react";
import { switchWorkspaceAction, createWorkspaceAction } from "@/lib/actions/workspace";
import { ROLE_LABELS, type WorkspaceRole } from "@/lib/workspace/roles";
import { cn } from "@/lib/utils";

export interface WorkspaceOption {
  id: string;
  name: string;
  is_personal: boolean;
  role: WorkspaceRole;
}

export function WorkspaceSwitcher({ current, options }: { current: WorkspaceOption; options: WorkspaceOption[] }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [pending, startTransition] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);

  function selectWorkspace(id: string) {
    if (id === current.id) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      await switchWorkspaceAction(id);
      window.location.reload();
    });
  }

  function submitNewWorkspace() {
    if (!newName.trim()) return;
    const formData = new FormData();
    formData.set("name", newName.trim());
    startTransition(async () => {
      const result = await createWorkspaceAction(formData);
      if (result.success) window.location.reload();
    });
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded border border-hairline bg-surface px-2.5 py-1.5 text-sm text-ink transition-colors hover:bg-panel"
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : null}
        <span className="max-w-[10rem] truncate font-medium">{current.name}</span>
        <ChevronsUpDown size={14} className="text-slate" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded border border-hairline bg-panel py-1 shadow-md animate-fade-in">
          <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate">Workspaces</p>
          {options.map((ws) => (
            <button
              key={ws.id}
              onClick={() => selectWorkspace(ws.id)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-ink">{ws.name}</span>
                <span className="text-xs text-slate">{ROLE_LABELS[ws.role]}</span>
              </span>
              {ws.id === current.id && <Check size={14} className="shrink-0 text-signal" />}
            </button>
          ))}

          <div className="border-t border-hairline px-3 py-2">
            {creating ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitNewWorkspace()}
                  placeholder="Workspace name"
                  className="w-full rounded border border-hairline bg-surface px-2 py-1 text-sm outline-none focus:border-signal"
                />
                <button onClick={submitNewWorkspace} className="shrink-0 rounded bg-signal px-2 py-1 text-xs font-semibold text-white">
                  Add
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className={cn("flex items-center gap-1.5 text-sm text-signal hover:underline")}
              >
                <Plus size={14} /> New workspace
              </button>
            )}
          </div>
        </div>
      )}

      {open && <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />}
    </div>
  );
}

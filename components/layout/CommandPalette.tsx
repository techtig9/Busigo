"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import * as Dialog from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Search, Loader2, CornerDownLeft, Workflow as WorkflowIcon, Activity } from "lucide-react";
import { NAV_GROUPS, ADMIN_ITEM, EXTRA_NAV_ITEMS } from "@/lib/navigation";
import { searchAction, type SearchResult } from "@/lib/actions/search";
import { statusTone } from "@/components/ui/Badge";
import { cn, formatDate } from "@/lib/utils";

const EMPTY: SearchResult = { workflows: [], runs: [] };

/**
 * ⌘K / Ctrl+K command palette (spec §3, §11).
 *
 * Two result sources, deliberately combined:
 *  - Static destinations, filtered client-side by cmdk's own scoring against the label plus
 *    the `keywords` on each nav item (so "invoice" finds Billing, "oauth" finds Connections).
 *  - Live records — workflows and runs — fetched through the existing searchAction, which is
 *    workspace-scoped and RLS-backed. Nothing new is exposed here; this is the same data the
 *    top-bar search already returned, reachable by keyboard.
 *
 * cmdk's built-in filtering is disabled for the async half (`shouldFilter` stays on, but
 * server results are given a value that always matches) so the server's ranking is preserved
 * rather than being re-scored against a query it already answered.
 */
export function CommandPalette({ isAdmin }: { isAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult>(EMPTY);
  const [searching, setSearching] = useState(false);
  const router = useRouter();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);

  // Global shortcut. Uses metaKey OR ctrlKey so it works on macOS and Windows/Linux alike.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Debounced server search. A sequence number guards against out-of-order responses —
  // without it, a slow request for "ema" can land after a fast one for "email" and overwrite
  // the newer results with staler ones.
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults(EMPTY);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      const seq = ++requestSeq.current;
      try {
        const r = await searchAction(trimmed);
        if (seq === requestSeq.current) setResults(r);
      } catch {
        if (seq === requestSeq.current) setResults(EMPTY);
      } finally {
        if (seq === requestSeq.current) setSearching(false);
      }
    }, 220);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query]);

  // Reset on close so reopening never shows a stale query or stale results.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults(EMPTY);
      setSearching(false);
    }
  }, [open]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const groups = isAdmin
    ? [...NAV_GROUPS, { label: "Internal", items: [ADMIN_ITEM] }]
    : NAV_GROUPS;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-ink/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-[12vh] z-[70] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2",
            "overflow-hidden rounded-xl border border-hairline bg-panel shadow-lg",
            "data-[state=open]:animate-zoom-in data-[state=closed]:animate-zoom-out"
          )}
        >
          <VisuallyHidden>
            <Dialog.Title>Search and commands</Dialog.Title>
            <Dialog.Description>
              Search pages, workflows and runs. Use the arrow keys to move and Enter to open.
            </Dialog.Description>
          </VisuallyHidden>

          <Command
            loop
            // The label is what a screen reader announces for the listbox.
            label="Search and commands"
          >
            <div className="flex items-center gap-2.5 border-b border-hairline px-4">
              {searching ? (
                <Loader2 size={16} className="shrink-0 animate-spin text-slate" aria-hidden />
              ) : (
                <Search size={16} className="shrink-0 text-slate" aria-hidden />
              )}
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Search pages, workflows and runs…"
                className="h-12 w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
              />
              <kbd className="hidden shrink-0 rounded border border-hairline bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted sm:block">
                esc
              </kbd>
            </div>

            <Command.List className="max-h-[min(24rem,60vh)] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-8 text-center text-sm text-slate">
                {searching ? "Searching…" : `No results for "${query.trim()}".`}
              </Command.Empty>

              {results.workflows.length > 0 && (
                <Command.Group heading="Workflows" className="cmd-group">
                  {results.workflows.map((w) => (
                    <Command.Item
                      key={w.id}
                      value={`workflow-${w.id}-${query}`}
                      onSelect={() => go(`/workflows/${w.id}`)}
                      className="cmd-item group"
                    >
                      <WorkflowIcon size={15} className="shrink-0 text-slate" aria-hidden />
                      <span className="flex-1 truncate">{w.name}</span>
                      <span className="shrink-0 text-xs capitalize text-muted">{w.status}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {results.runs.length > 0 && (
                <Command.Group heading="Runs" className="cmd-group">
                  {results.runs.map((r) => (
                    <Command.Item
                      key={r.id}
                      value={`run-${r.id}-${query}`}
                      onSelect={() => go(`/runs/${r.workflow_id}/${r.id}`)}
                      className="cmd-item group"
                    >
                      <Activity size={15} className="shrink-0 text-slate" aria-hidden />
                      <span className="flex-1 truncate">{r.workflow_name}</span>
                      <span className="shrink-0 text-xs text-muted">{formatDate(r.started_at)}</span>
                      <span
                        className={cn(
                          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold",
                          statusTone(r.status) === "success" && "bg-success-soft text-success",
                          statusTone(r.status) === "danger" && "bg-danger-soft text-danger",
                          statusTone(r.status) === "pulse" && "bg-pulse/10 text-pulse",
                          statusTone(r.status) === "warn" && "bg-warn-soft text-warn",
                          statusTone(r.status) === "slate" && "bg-surface text-slate"
                        )}
                      >
                        {r.status}
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {groups.map((group) => (
                <Command.Group key={group.label} heading={group.label} className="cmd-group">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Command.Item
                        key={item.href}
                        value={`${item.label} ${item.keywords ?? ""}`}
                        onSelect={() => go(item.href)}
                        className="cmd-item group"
                      >
                        <Icon size={15} className="shrink-0 text-slate" aria-hidden />
                        <span className="flex-1 truncate">{item.label}</span>
                        <CornerDownLeft size={13} className="shrink-0 text-muted opacity-0 group-data-[selected=true]:opacity-100" aria-hidden />
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              ))}

              <Command.Group heading="Other" className="cmd-group">
                {EXTRA_NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Command.Item
                      key={item.href}
                      value={`${item.label} ${item.keywords ?? ""}`}
                      onSelect={() => go(item.href)}
                      className="cmd-item group"
                    >
                      <Icon size={15} className="shrink-0 text-slate" aria-hidden />
                      <span className="flex-1 truncate">{item.label}</span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Button that opens the palette — rendered in the top bar. */
export function CommandPaletteTrigger({ className }: { className?: string }) {
  // Dispatches the same shortcut the palette listens for, so there is exactly one code path
  // that opens it rather than a second, divergent one.
  const openPalette = () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
  };

  return (
    <button
      onClick={openPalette}
      className={cn(
        "flex h-9 items-center gap-2 rounded border border-hairline bg-surface px-2.5 text-sm text-slate",
        "transition-colors duration-hover hover:border-hairline-strong hover:text-ink",
        className
      )}
    >
      <Search size={15} aria-hidden />
      <span className="hidden lg:inline">Search or jump to…</span>
      <span className="lg:hidden">Search</span>
      <kbd className="ml-auto hidden shrink-0 rounded border border-hairline bg-panel px-1.5 py-0.5 font-mono text-[10px] text-muted lg:block">
        ⌘K
      </kbd>
    </button>
  );
}

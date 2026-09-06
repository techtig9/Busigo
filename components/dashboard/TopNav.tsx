"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Menu, Search, Bell, X, Workflow as WorkflowIcon, Activity, Loader2 } from "lucide-react";
import { signOutAction } from "@/lib/actions/auth";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/actions/notifications";
import { searchAction, type SearchResult } from "@/lib/actions/search";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { SidebarLinks } from "./Sidebar";
import { WorkspaceSwitcher, type WorkspaceOption } from "./WorkspaceSwitcher";
import { cn, formatDate } from "@/lib/utils";
import { Badge, statusTone } from "@/components/ui/Badge";
import Link from "next/link";

export interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

export function TopNav({
  userName,
  plan,
  isAdmin,
  notifications,
  currentWorkspace,
  workspaceOptions,
}: {
  userName: string;
  plan: string;
  isAdmin?: boolean;
  notifications: NotificationItem[];
  currentWorkspace?: WorkspaceOption;
  workspaceOptions?: WorkspaceOption[];
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [items, setItems] = useState(notifications);
  const [, startTransition] = useTransition();

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult>({ workflows: [], runs: [] });
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search: waits 250ms after the last keystroke before actually querying, so
  // typing a full word doesn't fire a request per character.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults({ workflows: [], runs: [] });
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const result = await searchAction(trimmed);
      setResults(result);
      setSearching(false);
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Close the results dropdown on an outside click, and on Escape.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSearchOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const hasQuery = query.trim().length >= 2;
  const hasResults = results.workflows.length > 0 || results.runs.length > 0;

  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b border-hairline bg-panel px-4">
        <div className="flex items-center gap-3">
          <button
            className="rounded p-1.5 text-slate hover:bg-surface md:hidden"
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu size={20} />
          </button>
          {currentWorkspace && workspaceOptions && (
            <WorkspaceSwitcher current={currentWorkspace} options={workspaceOptions} />
          )}
          <div ref={searchBoxRef} className="relative hidden sm:block">
            <div className="flex items-center gap-2 rounded border border-hairline bg-surface px-3 py-1.5 text-sm text-slate transition-colors focus-within:border-signal">
              {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Search workflows, runs..."
                className="w-56 bg-transparent outline-none placeholder:text-slate"
              />
              {query && (
                <button
                  onClick={() => {
                    setQuery("");
                    setResults({ workflows: [], runs: [] });
                  }}
                  aria-label="Clear search"
                  className="text-slate hover:text-ink"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {searchOpen && hasQuery && (
              <div className="absolute left-0 top-full z-20 mt-1 w-96 rounded border border-hairline bg-panel py-1 shadow-md animate-fade-in">
                {!searching && !hasResults && (
                  <p className="px-3 py-6 text-center text-sm text-slate">No results for &quot;{query.trim()}&quot;.</p>
                )}

                {results.workflows.length > 0 && (
                  <div>
                    <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate">Workflows</p>
                    {results.workflows.map((w) => (
                      <Link
                        key={w.id}
                        href={`/workflows/${w.id}`}
                        onClick={() => setSearchOpen(false)}
                        className="flex items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-surface"
                      >
                        <span className="flex items-center gap-2 text-ink">
                          <WorkflowIcon size={14} className="text-slate" />
                          {w.name}
                        </span>
                        <Badge tone={w.status === "published" ? "signal" : "slate"}>{w.status}</Badge>
                      </Link>
                    ))}
                  </div>
                )}

                {results.runs.length > 0 && (
                  <div>
                    <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate">Runs</p>
                    {results.runs.map((r) => (
                      <Link
                        key={r.id}
                        href={`/runs/${r.workflow_id}/${r.id}`}
                        onClick={() => setSearchOpen(false)}
                        className="flex items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-surface"
                      >
                        <span className="flex min-w-0 items-center gap-2 text-ink">
                          <Activity size={14} className="shrink-0 text-slate" />
                          <span className="truncate">{r.workflow_name}</span>
                          <span className="shrink-0 text-xs text-slate">{formatDate(r.started_at)}</span>
                        </span>
                        <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <div className="relative">
            <button
              className="relative rounded p-1.5 text-slate transition-colors hover:bg-surface"
              aria-label="Notifications"
              onClick={() => setNotifOpen((v) => !v)}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-full z-20 mt-1 w-80 rounded border border-hairline bg-panel py-1 shadow-md animate-fade-in">
                <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
                  <span className="text-sm font-semibold text-ink">Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      className="text-xs text-signal hover:underline"
                      onClick={() => {
                        setItems((prev) => prev.map((n) => ({ ...n, read: true })));
                        startTransition(() => markAllNotificationsReadAction());
                      }}
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {items.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-slate">You&apos;re all caught up.</p>
                  ) : (
                    items.map((n) => (
                      <Link
                        key={n.id}
                        href={n.link || "#"}
                        onClick={() => {
                          setItems((prev) => prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)));
                          startTransition(() => markNotificationReadAction(n.id));
                          setNotifOpen(false);
                        }}
                        className={cn("block border-b border-hairline px-3 py-2.5 text-sm transition-colors last:border-0 hover:bg-surface", !n.read && "bg-signal/5")}
                      >
                        <div className="flex items-start gap-2">
                          {!n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />}
                          <div className={n.read ? "pl-3.5" : ""}>
                            <p className="font-semibold text-ink">{n.title}</p>
                            {n.body && <p className="mt-0.5 text-xs text-slate">{n.body}</p>}
                            <p className="mt-0.5 text-[11px] text-slate">{formatDate(n.created_at)}</p>
                          </div>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded px-2 py-1 text-sm transition-colors hover:bg-surface"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-signal text-xs font-bold text-white">
                {userName.slice(0, 1).toUpperCase() || "?"}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block text-ink">{userName}</span>
                <span className="block text-xs capitalize text-slate">{plan} plan{isAdmin ? " · admin" : ""}</span>
              </span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded border border-hairline bg-panel py-1 shadow-sm animate-fade-in">
                <a href="/profile" className="block px-3 py-2 text-sm text-ink hover:bg-surface">Profile</a>
                <a href="/billing" className="block px-3 py-2 text-sm text-ink hover:bg-surface">Billing</a>
                <form action={signOutAction}>
                  <button type="submit" className="block w-full px-3 py-2 text-left text-sm text-danger hover:bg-surface">
                    Log out
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-30 flex md:hidden">
          <div className="w-64 animate-slide-up bg-panel shadow-lg">
            <div className="flex items-center justify-between border-b border-hairline px-3 py-3">
              <span className="text-sm font-semibold text-slate">Menu</span>
              <button onClick={() => setDrawerOpen(false)} aria-label="Close menu" className="p-1 text-slate">
                <X size={18} />
              </button>
            </div>
            <SidebarLinks onNavigate={() => setDrawerOpen(false)} />
          </div>
          <div className="flex-1 bg-black/30 transition-opacity" onClick={() => setDrawerOpen(false)} />
        </div>
      )}
    </>
  );
}

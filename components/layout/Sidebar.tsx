"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NAV_GROUPS, ADMIN_ITEM, isActiveRoute, type NavItem } from "@/lib/navigation";
import { Tooltip } from "@/components/ui/Menu";
import { cn, APP_NAME } from "@/lib/utils";

const COOKIE = "busigo-sidebar";

/**
 * Collapse state is persisted in a COOKIE rather than localStorage on purpose.
 *
 * localStorage is only readable on the client, so the server would always render the
 * expanded sidebar and the collapsed state would snap in after hydration — a visible layout
 * jolt on every navigation. A cookie is sent with the request, so the server layout renders
 * the correct width immediately and there is no flash and no hydration mismatch.
 */
function persist(collapsed: boolean) {
  try {
    document.cookie = `${COOKIE}=${collapsed ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    // Cookies blocked — the sidebar still toggles for this session, it just won't persist.
  }
}

function NavLink({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname() || "";
  const active = isActiveRoute(pathname, item.href);
  const Icon = item.icon;

  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 rounded px-2.5 py-2 text-sm font-medium",
        "transition-colors duration-hover ease-out",
        collapsed && "justify-center px-0",
        active ? "bg-signal-soft text-signal" : "text-slate hover:bg-surface hover:text-ink"
      )}
    >
      {/* Active indicator rail — a shape cue as well as a colour change. */}
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-signal transition-opacity duration-hover",
          active ? "opacity-100" : "opacity-0"
        )}
      />
      <Icon size={16} className="shrink-0" aria-hidden />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );

  // In icon-only mode the label is gone visually, so a tooltip carries it (spec §3).
  // The link text itself remains the accessible name for assistive tech either way.
  return collapsed ? <Tooltip content={item.label} side="right">{link}</Tooltip> : link;
}

export function SidebarNav({
  isAdmin,
  collapsed = false,
  onNavigate,
}: {
  isAdmin?: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-5 overflow-y-auto px-2 py-3">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          {collapsed ? (
            <div className="mx-2 mb-1.5 h-px bg-hairline" aria-hidden />
          ) : (
            <p className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{group.label}</p>
          )}
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}

      {isAdmin && (
        <div>
          {collapsed ? (
            <div className="mx-2 mb-1.5 h-px bg-hairline" aria-hidden />
          ) : (
            <p className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Internal</p>
          )}
          <NavLink item={ADMIN_ITEM} collapsed={collapsed} onNavigate={onNavigate} />
        </div>
      )}
    </nav>
  );
}

export function Sidebar({ isAdmin, initialCollapsed = false }: { isAdmin?: boolean; initialCollapsed?: boolean }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  const toggle = () => {
    // Deliberately not `setCollapsed(c => { persist(!c); return !c })`: React invokes state
    // updaters twice under StrictMode, so a side effect inside one runs twice per click.
    // Computing `next` first keeps the updater pure and the cookie written exactly once.
    const next = !collapsed;
    setCollapsed(next);
    persist(next);
  };

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-hairline bg-panel md:flex",
        "transition-[width] duration-drawer ease-out",
        collapsed ? "w-[3.75rem]" : "w-60"
      )}
    >
      <div className={cn("flex h-14 shrink-0 items-center border-b border-hairline px-3", collapsed && "justify-center px-0")}>
        <Link
          href="/dashboard"
          className={cn("flex items-center gap-2 font-bold text-ink", collapsed && "sr-only")}
        >
          {APP_NAME}
        </Link>
        {collapsed && (
          <Link href="/dashboard" aria-label={APP_NAME} className="text-base font-bold text-signal">
            B
          </Link>
        )}
      </div>

      <SidebarNav isAdmin={isAdmin} collapsed={collapsed} />

      <div className={cn("shrink-0 border-t border-hairline p-2", collapsed && "flex justify-center")}>
        <button
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className={cn(
            "flex items-center gap-2.5 rounded px-2.5 py-2 text-sm font-medium text-slate",
            "transition-colors duration-hover hover:bg-surface hover:text-ink",
            collapsed ? "justify-center px-0" : "w-full"
          )}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Workflow, Activity, CheckSquare, Bot } from "lucide-react";
import { isActiveRoute } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/**
 * Mobile bottom navigation (spec §18: "Mobile: bottom navigation/drawer").
 *
 * Five primary destinations only. Everything else lives in the drawer opened from the top
 * bar — a bottom bar that tries to hold 25 links is worse than one that holds the five
 * people actually use in a session. Touch targets are 56px tall, comfortably above the
 * 44px minimum the accessibility target requires.
 */
const PRIMARY = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/workflows", label: "Workflows", icon: Workflow },
  { href: "/runs", label: "Runs", icon: Activity },
  { href: "/approvals", label: "Approvals", icon: CheckSquare },
  { href: "/workforce", label: "Agents", icon: Bot },
];

export function MobileNav() {
  const pathname = usePathname() || "";

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-hairline bg-panel/95 backdrop-blur md:hidden"
      // Keeps the bar clear of the iOS home indicator.
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {PRIMARY.map((item) => {
        const active = isActiveRoute(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
              "transition-colors duration-hover",
              active ? "text-signal" : "text-slate"
            )}
          >
            <Icon size={19} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

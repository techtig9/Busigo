"use client";

import { usePathname } from "next/navigation";
import { TooltipProvider } from "@/components/ui/Menu";
import { Sidebar } from "./Sidebar";
import { Topbar, type NotificationItem } from "./Topbar";
import { MobileNav } from "./MobileNav";
import { CommandPalette } from "./CommandPalette";
import { Breadcrumbs, PAGE_CONTAINER } from "./PageHeader";
import type { WorkspaceOption } from "@/components/dashboard/WorkspaceSwitcher";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Routes that need the full viewport rather than the standard centred column.
 *
 * The workflow builder is a three-panel canvas; constraining it to a 72rem column is what
 * made the old canvas a 36rem-tall box inside a page. These opt out explicitly so no other
 * screen is tempted to invent its own width.
 */
const FULL_BLEED = ["/workflows/"];

function isFullBleed(pathname: string) {
  // "/workflows" (the list) stays in the standard column; "/workflows/<id>" does not.
  return FULL_BLEED.some((p) => pathname.startsWith(p)) && pathname !== "/workflows/new";
}

export function AppShell({
  children,
  isAdmin,
  initialSidebarCollapsed,
  userName,
  plan,
  notifications,
  currentWorkspace,
  workspaceOptions,
}: {
  children: ReactNode;
  isAdmin?: boolean;
  initialSidebarCollapsed?: boolean;
  userName: string;
  plan: string;
  notifications: NotificationItem[];
  currentWorkspace?: WorkspaceOption;
  workspaceOptions?: WorkspaceOption[];
}) {
  const pathname = usePathname() || "";
  const fullBleed = isFullBleed(pathname);

  return (
    <TooltipProvider delayDuration={250} skipDelayDuration={400}>
      <div className="flex min-h-screen bg-canvas">
        <Sidebar isAdmin={isAdmin} initialCollapsed={initialSidebarCollapsed} />

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            userName={userName}
            plan={plan}
            isAdmin={isAdmin}
            notifications={notifications}
            currentWorkspace={currentWorkspace}
            workspaceOptions={workspaceOptions}
          />

          {/*
            pb-20 on mobile clears the fixed bottom navigation so the last element on a page
            is never hidden behind it. min-w-0 on the column above is what actually prevents a
            wide child (a table, the canvas) from forcing the whole shell to scroll sideways.
          */}
          <main id="main" className={cn("flex-1 pb-20 md:pb-0", fullBleed ? "flex flex-col" : "p-4 sm:p-6")}>
            {fullBleed ? (
              children
            ) : (
              <div className={PAGE_CONTAINER}>
                <Breadcrumbs pathname={pathname} />
                {children}
              </div>
            )}
          </main>
        </div>

        <MobileNav />
        <CommandPalette isAdmin={isAdmin} />
      </div>
    </TooltipProvider>
  );
}

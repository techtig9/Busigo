"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Menu as MenuIcon, Bell, X, LogOut, User, CreditCard, LifeBuoy } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { signOutAction } from "@/lib/actions/auth";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/actions/notifications";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Menu, MenuItem, MenuLabel, MenuSeparator, Popover } from "@/components/ui/Menu";
import { Avatar } from "@/components/ui/Controls";
import { IconButton } from "@/components/ui/Button";
import { CommandPaletteTrigger } from "./CommandPalette";
import { SidebarNav } from "./Sidebar";
import { WorkspaceSwitcher, type WorkspaceOption } from "@/components/dashboard/WorkspaceSwitcher";
import { cn, formatDate, APP_NAME } from "@/lib/utils";

export interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

export function Topbar({
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
  const [items, setItems] = useState(notifications);
  const [, startTransition] = useTransition();

  const unreadCount = items.filter((n) => !n.read).length;

  const markAll = () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    startTransition(() => markAllNotificationsReadAction());
  };

  const markOne = (id: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
    startTransition(() => markNotificationReadAction(id));
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-hairline bg-panel/95 px-3 backdrop-blur sm:px-4">
      {/* Mobile: full navigation in a Radix dialog drawer (focus-trapped, Escape-dismissable —
          the previous hand-rolled div drawer was neither). */}
      <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Dialog.Trigger asChild>
          <IconButton label="Open navigation" size="sm" className="md:hidden">
            <MenuIcon size={18} />
          </IconButton>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out md:hidden" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-hairline bg-panel shadow-lg data-[state=open]:animate-slide-in-right data-[state=closed]:animate-slide-out-right md:hidden">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-hairline px-3">
              <Dialog.Title className="font-bold text-ink">{APP_NAME}</Dialog.Title>
              <Dialog.Close asChild>
                <IconButton label="Close navigation" size="sm">
                  <X size={18} />
                </IconButton>
              </Dialog.Close>
            </div>
            <SidebarNav isAdmin={isAdmin} onNavigate={() => setDrawerOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {currentWorkspace && workspaceOptions && (
        <WorkspaceSwitcher current={currentWorkspace} options={workspaceOptions} />
      )}

      <CommandPaletteTrigger className="ml-1 min-w-0 flex-1 sm:max-w-xs lg:max-w-sm" />

      <div className="ml-auto flex items-center gap-1.5">
        <ThemeToggle className="hidden sm:inline-flex" />

        <Popover
          align="end"
          className="w-80 p-0"
          trigger={
            <button
              aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
              className="relative flex h-9 w-9 items-center justify-center rounded text-slate transition-colors duration-hover hover:bg-surface hover:text-ink"
            >
              <Bell size={18} aria-hidden />
              {unreadCount > 0 && (
                <span
                  aria-hidden
                  className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white"
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          }
        >
          <div className="flex items-center justify-between border-b border-hairline px-3 py-2.5">
            <span className="text-sm font-semibold text-ink">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAll} className="rounded text-xs font-medium text-signal hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-slate">You&apos;re all caught up.</p>
            ) : (
              items.map((n) => (
                <Link
                  key={n.id}
                  href={n.link || "#"}
                  onClick={() => markOne(n.id)}
                  className={cn(
                    "block border-b border-hairline px-3 py-2.5 text-sm transition-colors duration-hover last:border-0 hover:bg-surface",
                    !n.read && "bg-signal-soft/50"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />}
                    <div className={n.read ? "pl-3.5" : ""}>
                      <p className="font-semibold text-ink">
                        {!n.read && <span className="sr-only">Unread: </span>}
                        {n.title}
                      </p>
                      {n.body && <p className="mt-0.5 text-xs text-slate">{n.body}</p>}
                      <p className="mt-0.5 text-[11px] text-muted">{formatDate(n.created_at)}</p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Popover>

        <Menu
          align="end"
          className="w-56"
          trigger={
            <button className="flex items-center gap-2 rounded px-1 py-1 transition-colors duration-hover hover:bg-surface">
              <Avatar name={userName} size="sm" />
              <span className="hidden text-left sm:block">
                <span className="block text-sm text-ink">{userName}</span>
                <span className="block text-xs capitalize text-slate">
                  {plan} plan{isAdmin ? " · admin" : ""}
                </span>
              </span>
            </button>
          }
        >
          <MenuLabel>{userName}</MenuLabel>
          <MenuItem onSelect={() => (window.location.href = "/profile")}>
            <User size={15} className="text-slate" aria-hidden /> Profile
          </MenuItem>
          <MenuItem onSelect={() => (window.location.href = "/billing")}>
            <CreditCard size={15} className="text-slate" aria-hidden /> Billing
          </MenuItem>
          <MenuItem onSelect={() => (window.location.href = "/support")}>
            <LifeBuoy size={15} className="text-slate" aria-hidden /> Help
          </MenuItem>
          <MenuSeparator />
          {/* The sign-out server action still runs through a real form submission — the menu
              item just submits it, so behaviour is unchanged from the previous top nav. */}
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full cursor-pointer items-center gap-2 rounded px-2.5 py-2 text-sm text-danger outline-none transition-colors duration-micro hover:bg-danger-soft"
            >
              <LogOut size={15} aria-hidden /> Log out
            </button>
          </form>
        </Menu>
      </div>
    </header>
  );
}

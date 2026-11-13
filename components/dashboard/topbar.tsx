"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Command,
  Crown,
  GraduationCap,
  LogOut,
  Menu,
  Search,
  Settings,
  Shield,
  UserCheck,
  UserCog,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarContent } from "@/components/dashboard/sidebar";
import { CommandPalette } from "@/components/dashboard/command-palette";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { navGroups } from "@/lib/constants/nav";
import { useAuth } from "@/lib/auth/auth-context";

type Workspace = { id: string; name: string; role: "owner" | "admin" | "member" };

export function Topbar() {
  const [open, setOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const { user, users, isSuperAdmin, switchUser } = useAuth();

  const currentArea = navGroups
    .flatMap((group) => group.items)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const currentGroup = navGroups.find((group) => group.items.some((item) => item.href === currentArea?.href));

  useEffect(() => {
    function handleOpenCommandPalette() {
      setCommandOpen(true);
    }
    window.addEventListener("crm:open-command-palette", handleOpenCommandPalette);
    return () => window.removeEventListener("crm:open-command-palette", handleOpenCommandPalette);
  }, []);

  useEffect(() => {
    if (!getSupabaseConfig()) return;
    let active = true;
    void fetch("/api/workspaces", { cache: "no-store" })
      .then(async (response) => {
        const payload: unknown = await response.json();
        if (typeof payload !== "object" || payload === null) {
          throw new Error("The workspace service returned an invalid response.");
        }
        if (!response.ok) {
          const message =
            "error" in payload && typeof payload.error === "string"
              ? payload.error
              : "Could not load organization workspaces.";
          throw new Error(message);
        }
        if (!("data" in payload) || !Array.isArray(payload.data) || !("active" in payload)) {
          throw new Error("Could not load organization workspaces.");
        }
        const workspacesData = payload.data.filter(
          (workspace): workspace is Workspace =>
            typeof workspace === "object" &&
            workspace !== null &&
            "id" in workspace &&
            typeof workspace.id === "string" &&
            "name" in workspace &&
            typeof workspace.name === "string" &&
            "role" in workspace &&
            ["owner", "admin", "member"].includes(String(workspace.role)),
        );
        const current = workspacesData.find(
          (workspace) =>
            typeof payload.active === "object" &&
            payload.active !== null &&
            "id" in payload.active &&
            payload.active.id === workspace.id,
        );
        if (!current) throw new Error("The active organization is not available.");
        if (active) {
          setWorkspaces(workspacesData);
          setActiveWorkspace(current);
        }
      })
      .catch((error: unknown) => {
        if (active)
          toast.error(
            error instanceof Error ? error.message : "Could not load organization workspaces.",
          );
      });
    return () => {
      active = false;
    };
  }, []);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = search.trim();
    router.push(term ? `/leads?search=${encodeURIComponent(term)}` : "/leads");
    setSearch("");
  }

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      if (getSupabaseConfig()) {
        const { error } = await createClient().auth.signOut();
        if (error) throw error;
      }
      toast.success("You have been signed out.");
      window.location.replace("/login");
    } catch (signOutError) {
      toast.error(signOutError instanceof Error ? signOutError.message : "Could not sign out. Please try again.");
      setSigningOut(false);
    }
  }

  async function switchWorkspace(organizationId: string) {
    const response = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId }),
    });
    const payload: unknown = await response.json();
    if (!response.ok) {
      const message =
        typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "Could not switch workspaces.";
      toast.error(message);
      return;
    }
    window.location.reload();
  }

  const roleLabel = isSuperAdmin ? "Super Admin" : "Admin";
  const initials = user?.fullName
    ? user.fullName
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "VV";

  return (
    <header className="z-20 flex h-[68px] shrink-0 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 shadow-[0_2px_10px_-9px_rgba(15,23,42,0.35)] md:gap-5 md:px-7">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] border-sidebar-border bg-white p-0 text-sidebar-foreground">
          <SheetTitle className="sr-only">Main navigation</SheetTitle>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="hidden min-w-[150px] sm:block">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          {currentGroup?.label ?? "Vidyavriddhi"} / Workspace
        </p>
        <p className="mt-0.5 text-[13px] font-semibold tracking-tight text-slate-800">
          {pathname === "/user-management"
            ? "User Management"
            : currentArea?.title ?? "Admissions CRM"}
        </p>
      </div>
      <span className="hidden h-8 w-px bg-slate-200 sm:block" />

      <form onSubmit={submitSearch} className="relative max-w-2xl flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search leads by name, phone or email..."
          aria-label="Search student leads"
          className="h-10 rounded-xl border-slate-200 bg-slate-50 pl-10 text-xs shadow-none transition-colors placeholder:text-slate-400 focus-visible:border-blue-300 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/15"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-border/70 bg-card px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground sm:inline-flex">
          ENTER
        </kbd>
      </form>

      <div className="ml-auto flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 rounded-xl border-slate-200 bg-white px-2.5 text-[10px] font-medium text-slate-600 shadow-none hover:border-blue-200 hover:bg-blue-50/60 hover:text-foreground sm:px-3"
          onClick={() => setCommandOpen(true)}
          aria-label="Open quick navigation"
        >
          <Command className="h-3.5 w-3.5 text-primary" />
          <span className="hidden sm:inline">Jump to</span>
          <kbd className="hidden rounded border bg-muted px-1 py-0.5 text-[9px] sm:inline-flex">⌘ K</kbd>
        </Button>

        {/* User Role Badge in Header */}
        <div className="hidden sm:flex">
          {isSuperAdmin ? (
            <Link
              href="/user-management"
              className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 px-3 py-1 text-[11px] font-semibold text-amber-800 shadow-2xs transition-all hover:border-amber-300 hover:shadow-xs"
              title="Super Admin: Manage users & module permissions"
            >
              <Crown className="h-3.5 w-3.5 text-amber-600" />
              <span>Super Admin</span>
            </Link>
          ) : (
            <span
              className="flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold text-sky-800 shadow-2xs"
              title={`Admin with ${user?.allowedModules.length ?? 0} assigned modules`}
            >
              <Shield className="h-3.5 w-3.5 text-sky-600" />
              <span>Admin ({user?.allowedModules.length ?? 0} tasks)</span>
            </span>
          )}
        </div>

        {/* Reminders Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label="Follow-up shortcuts">
              <Bell className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center justify-between">
                Counsellor reminders <Badge variant="secondary">Today</Badge>
              </DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href="/follow-ups">
                  <Bell className="mr-2 h-4 w-4" />
                  View today&apos;s follow-ups
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/applications">
                  <GraduationCap className="mr-2 h-4 w-4" />
                  Check admission pipeline
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Profile & Account Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2" aria-label="Open profile and account menu">
              <Avatar className="h-8 w-8 rounded-xl">
                <AvatarFallback
                  className={`rounded-xl text-xs font-bold ring-1 ${
                    isSuperAdmin
                      ? "bg-gradient-to-br from-amber-50 to-yellow-100 text-amber-800 ring-amber-200"
                      : "bg-gradient-to-br from-sky-50 to-blue-100 text-sky-800 ring-sky-200"
                  }`}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-40 truncate text-xs font-medium md:inline">
                {user?.fullName || user?.email || "Account"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <p className="truncate text-xs font-semibold">{user?.fullName || "CRM User"}</p>
                <p className="truncate text-[11px] font-normal text-muted-foreground">{user?.email}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      isSuperAdmin
                        ? "bg-amber-100 text-amber-800"
                        : "bg-sky-100 text-sky-800"
                    }`}
                  >
                    {isSuperAdmin ? <Crown className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                    {roleLabel}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {isSuperAdmin
                      ? "Full Access"
                      : `${user?.allowedModules.length ?? 0} modules assigned`}
                  </span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => void signOut()}
              disabled={signingOut}
              className="font-medium text-rose-600 focus:bg-rose-50 focus:text-rose-700"
            >
              {signingOut
                ? <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-rose-500 border-r-transparent" />
                : <LogOut className="mr-2 h-4 w-4" />}
              {signingOut ? "Signing out…" : "Log out"}
            </DropdownMenuItem>

            {/* Super Admin User Management */}
            {isSuperAdmin && (
              <DropdownMenuItem asChild>
                <Link href="/user-management" className="text-amber-900 focus:bg-amber-50">
                  <UserCog className="mr-2 h-4 w-4 text-amber-600" />
                  User & Role Management
                </Link>
              </DropdownMenuItem>
            )}

            {/* Quick Switcher for live testing of sidebar filtering */}
            {users.length > 1 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Switch User (Preview RBAC)
                  </DropdownMenuLabel>
                  {users.map((u) => {
                    const isCurrent = u.id === user?.id;
                    return (
                      <DropdownMenuItem
                        key={u.id}
                        disabled={isCurrent}
                        onClick={() => {
                          switchUser(u.id);
                          toast.info(`Switched view to ${u.fullName || u.email}`);
                        }}
                        className="text-xs"
                      >
                        <UserCheck
                          className={`mr-2 h-3.5 w-3.5 ${
                            isCurrent ? "text-teal-600" : "text-muted-foreground"
                          }`}
                        />
                        <span className="truncate">{u.fullName || u.email}</span>
                        <span className="ml-auto text-[9px] font-semibold text-muted-foreground">
                          {u.role === "super_admin" ? "SA" : "Admin"}
                        </span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuGroup>
              </>
            )}

            {workspaces.length > 1 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Switch organization
                  </DropdownMenuLabel>
                  {workspaces.map((workspace) => (
                    <DropdownMenuItem
                      key={workspace.id}
                      disabled={workspace.id === activeWorkspace?.id}
                      onClick={() => void switchWorkspace(workspace.id)}
                    >
                      {workspace.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/students">
                <UserRound className="mr-2 h-4 w-4" />
                Students
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="mr-2 h-4 w-4" />
                Workspace settings
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </header>
  );
}

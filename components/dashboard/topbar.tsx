"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Command, GraduationCap, LogOut, Menu, Search, Settings, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarContent } from "@/components/dashboard/sidebar";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { CommandPalette } from "@/components/dashboard/command-palette";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { navGroups } from "@/lib/constants/nav";

export function Topbar() {
  const [open, setOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const currentArea = navGroups
    .flatMap((group) => group.items)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  useEffect(() => {
    function handleOpenCommandPalette() {
      setCommandOpen(true);
    }
    window.addEventListener("crm:open-command-palette", handleOpenCommandPalette);
    return () => window.removeEventListener("crm:open-command-palette", handleOpenCommandPalette);
  }, []);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = search.trim();
    router.push(term ? `/leads?search=${encodeURIComponent(term)}` : "/leads");
    setSearch("");
  }

  async function signOut() {
    if (getSupabaseConfig()) {
      const { error } = await createClient().auth.signOut();
      if (error) {
        toast.error(error.message);
        return;
      }
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="z-20 flex h-[70px] shrink-0 items-center gap-3 border-b border-border/70 bg-card/85 px-4 backdrop-blur-xl md:gap-5 md:px-7">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="sr-only">Main navigation</SheetTitle>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="hidden min-w-[145px] sm:block">
        <p className="text-[9px] font-semibold uppercase tracking-[0.17em] text-muted-foreground/75">Workspace</p>
        <p className="mt-0.5 text-[13px] font-semibold tracking-tight">{currentArea?.title ?? "Admissions CRM"}</p>
      </div>
      <span className="hidden h-8 w-px bg-border sm:block" />
      <form onSubmit={submitSearch} className="relative max-w-xl flex-1">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search student leads..."
          aria-label="Search student leads"
          className="h-10 rounded-xl border-border/65 bg-muted/55 pl-10 text-xs shadow-none transition-colors placeholder:text-muted-foreground/75 focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-primary/15"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-border/70 bg-card px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground sm:inline-flex">ENTER</kbd>
      </form>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 rounded-xl border-border/70 bg-card/70 px-2.5 text-[10px] font-medium text-muted-foreground shadow-none hover:bg-primary/[0.04] hover:text-foreground sm:px-3"
          onClick={() => setCommandOpen(true)}
          aria-label="Open quick navigation"
        >
          <Command className="h-3.5 w-3.5 text-primary" />
          <span className="hidden sm:inline">Jump to</span>
          <kbd className="hidden rounded border bg-muted px-1 py-0.5 text-[9px] sm:inline-flex">⌘ K</kbd>
        </Button>
        <span className="mr-1 hidden items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1.5 text-[10px] font-medium text-muted-foreground xl:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Vidyavriddhi CRM
        </span>
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label="Follow-up shortcuts">
              <Bell className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="flex items-center justify-between">
              Counsellor reminders <Badge variant="secondary">Today</Badge>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link href="/follow-ups"><Bell className="mr-2 h-4 w-4" />View today&apos;s follow-ups</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/applications"><GraduationCap className="mr-2 h-4 w-4" />Check admission pipeline</Link></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">VV</AvatarFallback>
              </Avatar>
              <span className="hidden text-xs font-medium md:inline">Workspace</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>
              <p className="text-xs font-semibold">Vidyavriddhi workspace</p>
              <p className="mt-1 text-[11px] font-normal text-muted-foreground">{pathname.split("/").filter(Boolean).at(-1)?.replaceAll("-", " ") ?? "Admissions CRM"}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link href="/students"><UserRound className="mr-2 h-4 w-4" />Students</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/settings"><Settings className="mr-2 h-4 w-4" />Workspace settings</Link></DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void signOut()}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </header>
  );
}

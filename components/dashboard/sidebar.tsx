"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ArrowRight, ArrowUpRight, ChevronDown, Command, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { navGroups } from "@/lib/constants/nav";

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const currentPage = navGroups.flatMap((group) => group.items).find((item) =>
    pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  function openCommandPalette() {
    window.dispatchEvent(new Event("crm:open-command-palette"));
  }

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex h-[82px] shrink-0 items-center border-b border-sidebar-border px-4">
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
        <Link href="/dashboard" aria-label="Vidyavriddhi CRM home" className="flex w-full items-center justify-center rounded-xl bg-white px-2 py-1 transition-shadow hover:shadow-md">
          <Image
            src="/vidyavriddhi-logo.png"
            alt="Vidyavriddhi — a unit of JP Technologies"
            width={500}
            height={200}
            priority
            className="h-[70px] w-full object-contain"
          />
        </Link>
      </div>

      <nav aria-label="Main navigation" className="crm-sidebar-scroll relative flex-1 space-y-5 overflow-x-hidden overflow-y-auto px-3.5 py-5">
        <div aria-hidden="true" className="pointer-events-none absolute right-[-34px] top-16 h-40 w-40 rounded-full border border-slate-200/60" />
        <div className="relative mb-1 flex items-center justify-between rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white px-3 py-3 shadow-sm">
          <span className="min-w-0">
            <span className="block text-[8px] font-bold uppercase tracking-[0.2em] text-sidebar-foreground/40">Admissions desk</span>
            <span className="mt-1 block truncate text-[11px] font-semibold text-sidebar-foreground/90">{currentPage?.title ?? "Student journey"}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[8px] font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Workspace
          </span>
        </div>
        {navGroups.map((group) => {
          const groupHasCurrentPage = group.items.some((item) =>
            pathname === item.href || pathname.startsWith(`${item.href}/`),
          );
          const expanded = !collapsedGroups.includes(group.label) || groupHasCurrentPage;
          return (
          <section key={group.label} className="relative">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setCollapsedGroups((groups) => groups.includes(group.label)
                ? groups.filter((label) => label !== group.label)
                : [...groups, group.label])}
              className="group mb-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-slate-100/80"
            >
              <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/45 group-hover:text-sidebar-foreground/70">{group.label}</span>
              <span className="h-px flex-1 bg-sidebar-border/70" />
              <span className="min-w-4 text-right text-[8px] font-medium tabular-nums text-sidebar-foreground/30">{String(group.items.length).padStart(2, "0")}</span>
              <ChevronDown className={cn("h-3 w-3 text-sidebar-foreground/35 transition-transform duration-200", !expanded && "-rotate-90")} />
            </button>
            {expanded && (
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group relative flex items-center gap-3 overflow-hidden rounded-xl border px-3 py-[9px] text-[11px] font-medium transition-all duration-200",
                          active
                            ? "border-blue-100 bg-gradient-to-r from-blue-50 via-white to-orange-50/45 text-[#075fa3] shadow-[0_3px_12px_-8px_rgba(7,95,163,0.5)]"
                            : "border-transparent text-sidebar-foreground/75 hover:border-slate-200/80 hover:bg-slate-50 hover:text-foreground",
                        )}
                      >
                        {active && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-primary" />}
                        <span className={cn("flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-lg transition-all", active ? "bg-white text-[#075fa3] shadow-sm" : "text-sidebar-foreground/55 group-hover:bg-white group-hover:text-[#075fa3]")}>
                          <item.icon className="h-[14px] w-[14px]" />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                        {active
                          ? <span className="h-1.5 w-1.5 rounded-full bg-sidebar-primary shadow-[0_0_8px_var(--sidebar-primary)]" />
                          : <ArrowUpRight className="h-3 w-3 shrink-0 text-sidebar-foreground/0 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-sidebar-foreground/50" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border bg-slate-50/70 p-3">
        <button
          type="button"
          onClick={openCommandPalette}
          className="group mb-2.5 flex w-full items-center gap-2.5 rounded-xl border border-sidebar-border bg-white px-3 py-2.5 text-left shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50/50"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sidebar-primary/10 text-sidebar-primary"><Command className="h-3.5 w-3.5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-semibold text-sidebar-foreground/80">Quick navigation</span>
            <span className="mt-0.5 block text-[8px] text-sidebar-foreground/40">Jump anywhere in your CRM</span>
          </span>
          <ArrowRight className="h-3 w-3 text-sidebar-foreground/35 transition-transform group-hover:translate-x-0.5 group-hover:text-sidebar-primary" />
        </button>
        <Link href="/reports" onClick={onNavigate} className="group relative flex items-center gap-2 overflow-hidden rounded-xl border border-sidebar-border bg-white px-3 py-2 transition-colors hover:bg-slate-50">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-sidebar-primary" />
          <span className="min-w-0 flex-1 truncate text-[9px] font-medium text-sidebar-foreground/65">Admissions insights</span>
          <ArrowUpRight className="h-3 w-3 shrink-0 text-sidebar-foreground/35 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
        <div className="mt-2.5 flex items-center justify-between px-1 text-[8px] font-medium uppercase tracking-[0.14em] text-sidebar-foreground/30">
          <span>Vidyavriddhi</span>
          <span>Student CRM · {String(navGroups.reduce((sum, group) => sum + group.items.length, 0)).padStart(2, "0")} tools</span>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="crm-sidebar crm-sidebar-edge hidden w-[276px] shrink-0 border-r border-r-slate-200 text-sidebar-foreground shadow-[8px_0_24px_-24px_rgba(15,23,42,0.5)] lg:block">
      <SidebarContent />
    </aside>
  );
}
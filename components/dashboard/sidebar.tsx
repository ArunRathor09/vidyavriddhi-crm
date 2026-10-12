"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, GraduationCap, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { navGroups } from "@/lib/constants/nav";
import { Button } from "@/components/ui/button";

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[82px] items-center border-b border-sidebar-border px-5">
        <Link href="/dashboard" className="flex items-center gap-3 font-semibold text-sidebar-foreground">
          <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-[14px] bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_6px_20px_-8px_var(--sidebar-primary)]">
            <GraduationCap className="h-5 w-5" />
            <span className="absolute -bottom-3 -right-2 h-6 w-6 rounded-full border border-sidebar-primary-foreground/20" />
          </span>
          <span className="leading-tight">
            <span className="block text-[14px] font-bold tracking-[0.12em]">NEXORA</span>
            <span className="mt-1 block text-[9px] font-semibold tracking-[0.18em] text-sidebar-foreground/45">ADMISSIONS OS</span>
          </span>
        </Link>
      </div>

      <nav aria-label="Main navigation" className="flex-1 space-y-6 overflow-y-auto px-3 py-6">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-2.5 flex items-center gap-2 px-3 text-[9px] font-bold uppercase tracking-[0.2em] text-sidebar-foreground/40">
              {group.label}
              <span className="h-px flex-1 bg-sidebar-border" />
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-medium transition-all duration-200",
                        active
                          ? "bg-sidebar-accent text-sidebar-foreground shadow-[inset_0_0_0_1px_oklch(1_0_0_/_5%)] before:absolute before:bottom-2.5 before:left-0 before:top-2.5 before:w-[3px] before:rounded-r-full before:bg-sidebar-primary"
                          : "text-sidebar-foreground/60 hover:bg-sidebar-accent/65 hover:text-sidebar-foreground"
                      )}
                    >
                      <item.icon className={cn("h-[16px] w-[16px] transition-colors", active ? "text-sidebar-primary" : "text-sidebar-foreground/55 group-hover:text-sidebar-foreground")} />
                      {item.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="relative overflow-hidden rounded-2xl border border-sidebar-border bg-white/[0.035] p-3.5">
          <div className="pointer-events-none absolute -right-5 -top-8 h-20 w-20 rounded-full border border-sidebar-primary/20" />
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[11px] font-semibold text-sidebar-foreground">
              <Sparkles className="h-3.5 w-3.5 text-sidebar-primary" />
              Built for admissions
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 text-sidebar-foreground/40" />
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-sidebar-foreground/50">
            Every conversation, application and student milestone in one place.
          </p>
          <Button size="sm" asChild className="mt-3 h-8 w-full rounded-lg bg-sidebar-primary text-[11px] font-semibold text-sidebar-primary-foreground hover:bg-sidebar-primary/90">
            <Link href="/settings">Configure workspace</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-[260px] shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:block">
      <SidebarContent />
    </aside>
  );
}
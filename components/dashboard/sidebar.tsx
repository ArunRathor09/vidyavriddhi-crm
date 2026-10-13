"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ArrowDown, ArrowUpRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { navGroups } from "@/lib/constants/nav";

const primaryItems = navGroups
  .flatMap((group) => group.items)
  .filter((item) => item.href === "/leads" || item.href === "/students");

const itemDetails: Record<string, { index: string; detail: string }> = {
  "/leads": { index: "01", detail: "Enquiry pipeline" },
  "/students": { index: "02", detail: "Student directory" },
};

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[90px] items-center border-b border-sidebar-border px-4">
        <Link href="/dashboard" aria-label="Vidyavriddhi CRM home" className="flex w-full items-center justify-center rounded-xl bg-white px-2 py-1 shadow-sm">
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

      <nav aria-label="Student records navigation" className="relative flex-1 overflow-y-auto px-3 py-8">
        <div aria-hidden="true" className="pointer-events-none absolute right-[-34px] top-16 h-40 w-40 rounded-full border border-white/[0.035]" />
        <div aria-hidden="true" className="pointer-events-none absolute right-[-15px] top-[76px] h-[102px] w-[102px] rounded-full border border-white/[0.035]" />
        <div className="relative mb-4 px-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-sidebar-primary">Your workspace</p>
          <h2 className="mt-2 text-[18px] font-semibold leading-tight tracking-[-0.035em] text-sidebar-foreground">Student records<span className="text-sidebar-primary">.</span></h2>
          <p className="mt-1 text-[10px] leading-relaxed text-sidebar-foreground/45">Two focused views. One student journey.</p>
        </div>
        <ul className="relative space-y-2">
          {primaryItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const details = itemDetails[item.href];
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex min-h-[76px] items-center gap-3 overflow-hidden rounded-2xl border px-3.5 py-3 transition-all duration-200",
                    active
                      ? "border-white/[0.09] bg-white/[0.075] text-sidebar-foreground shadow-[0_12px_30px_-20px_rgb(0_0_0_/_80%)]"
                      : "border-transparent text-sidebar-foreground/65 hover:border-white/[0.07] hover:bg-white/[0.035] hover:text-sidebar-foreground",
                  )}
                >
                  {active && <span aria-hidden="true" className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-sidebar-primary shadow-[0_0_16px_var(--sidebar-primary)]" />}
                  <span className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all",
                    active
                      ? "border-sidebar-primary/25 bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_7px_20px_-12px_var(--sidebar-primary)]"
                      : "border-white/[0.08] bg-white/[0.035] text-sidebar-foreground/65 group-hover:border-white/[0.12]",
                  )}>
                    <item.icon className="h-[17px] w-[17px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold tracking-tight">{item.title}</span>
                      <span className={cn("text-[8px] font-bold tracking-[0.13em]", active ? "text-sidebar-primary" : "text-sidebar-foreground/30")}>{details.index}</span>
                    </span>
                    <span className="mt-1 block text-[9px] text-sidebar-foreground/40">{details.detail}</span>
                  </span>
                  <ArrowUpRight className={cn("h-3.5 w-3.5 shrink-0 transition-all", active ? "text-sidebar-primary" : "text-sidebar-foreground/0 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-sidebar-foreground/60")} />
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="relative mx-3 mt-8 flex items-center gap-2">
          <span className="h-px flex-1 bg-sidebar-border" />
          <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-sidebar-foreground/30">Journey</span>
          <span className="h-px flex-1 bg-sidebar-border" />
        </div>
        <div className="relative mx-3 mt-4 flex items-center gap-2.5 text-[9px] text-sidebar-foreground/45">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-sidebar-primary/10 text-sidebar-primary"><ArrowDown className="h-3 w-3" /></span>
          Enquiry <span className="h-px w-3 bg-sidebar-foreground/20" /> Student
        </div>
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="relative overflow-hidden rounded-2xl border border-sidebar-border bg-white/[0.035] p-3.5">
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-9 -right-8 h-24 w-24 rounded-full border border-sidebar-primary/10" />
          <div className="relative flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-sidebar-primary" />
            <span className="text-[10px] font-semibold text-sidebar-foreground/85">More clarity, less chasing.</span>
          </div>
          <p className="relative mt-2 text-[9px] leading-relaxed text-sidebar-foreground/40">
            Every learner deserves a well-guided next step.
          </p>
        </div>
        <div className="mt-3 flex items-center justify-between px-1 text-[8px] font-medium uppercase tracking-[0.14em] text-sidebar-foreground/30">
          <span>Vidyavriddhi</span>
          <span>Student CRM</span>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="crm-sidebar hidden w-[276px] shrink-0 border-r border-sidebar-border text-sidebar-foreground lg:block">
      <SidebarContent />
    </aside>
  );
}
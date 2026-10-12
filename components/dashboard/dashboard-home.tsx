"use client";

import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BellRing,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  FileText,
  GraduationCap,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCrmCollection } from "@/hooks/use-crm-collection";
import { downloadCsv } from "@/lib/csv";
import { formatINR } from "@/lib/format";

const stages = ["New", "Contacted", "Interested", "Documents", "Applied", "Offer letter", "Admitted", "Payment complete"];

function isToday(value: unknown) {
  if (typeof value !== "string" || !value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

function initials(name: unknown) {
  return String(name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function DashboardHome() {
  const leads = useCrmCollection("leads");
  const students = useCrmCollection("students");
  const followUps = useCrmCollection("follow-ups");
  const applications = useCrmCollection("applications");
  const payments = useCrmCollection("payments");
  const activities = useCrmCollection("activities");
  const modules = [leads, students, followUps, applications, payments, activities];
  const loading = modules.some((module) => module.mode === "loading");
  const errors = modules.map((module) => module.error).filter((message): message is string => Boolean(message));
  const isDemo = modules.some((module) => module.mode === "demo");
  const todayFollowUps = followUps.records.filter((record) => isToday(record.due_at) && record.status === "Open");
  const activeApplications = applications.records.filter((record) => !["Admitted", "Rejected"].includes(String(record.status)));
  const paidTotal = payments.records
    .filter((record) => record.status === "Paid")
    .reduce((sum, record) => sum + Number(record.amount ?? 0), 0);
  const leadCounts = stages.map((stage) => ({
    name: stage,
    count: leads.records.filter((record) => record.status === stage).length,
  }));
  const pipelineMax = Math.max(1, ...leadCounts.map((stage) => stage.count));
  const latestLeads = [...leads.records]
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
    .slice(0, 5);
  const latestActivity = [...activities.records]
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
    .slice(0, 4);
  const today = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

  function exportDashboard() {
    const headers = ["Student", "Phone", "Email", "Source", "Pipeline", "Priority"];
    const rows = leads.records.map((lead) => [
      lead.full_name, lead.phone, lead.email, lead.source, lead.status, lead.priority,
    ]);
    downloadCsv(`nexora-leads-${new Date().toISOString().slice(0, 10)}.csv`, [headers, ...rows]);
    toast.success("Lead report downloaded.");
  }

  return (
    <div className="mx-auto max-w-[1480px] space-y-6 md:space-y-7">
      <section className="relative isolate overflow-hidden rounded-[26px] bg-[#111d24] px-5 py-6 text-white shadow-[0_24px_60px_-34px_oklch(0.18_0.025_253_/_55%)] sm:px-8 sm:py-8 xl:px-10">
        <div aria-hidden="true" className="hero-grid pointer-events-none absolute inset-y-0 right-0 w-[62%] opacity-60" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-36 h-[390px] w-[390px] rounded-full border border-emerald-300/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-24 h-[270px] w-[270px] rounded-full border border-emerald-300/10" />
        <div aria-hidden="true" className="pointer-events-none absolute right-[12%] top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_310px] lg:items-center xl:grid-cols-[minmax(0,1fr)_350px]">
          <div className="max-w-3xl">
            <div className="mb-5 flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.09] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-200">
                <Sparkles className="h-3 w-3" />
                Admissions intelligence
              </span>
              {isDemo ? (
                <Badge variant="outline" className="h-6 border-amber-200/20 bg-amber-300/10 px-2.5 text-[9px] font-semibold tracking-[0.1em] text-amber-200">DEMO DATA</Badge>
              ) : !loading && errors.length === 0 ? (
                <Badge variant="outline" className="h-6 border-emerald-200/20 bg-emerald-300/10 px-2.5 text-[9px] font-semibold tracking-[0.1em] text-emerald-200">LIVE WORKSPACE</Badge>
              ) : null}
            </div>
            <h1 className="max-w-2xl text-[clamp(2.25rem,5vw,4rem)] font-semibold leading-[1.04] tracking-[-0.055em]">
              Every student&apos;s next chapter<span className="text-emerald-300">,</span> starts here.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300/75 sm:text-[15px]">
              Your global admissions desk, in focus. Move every enquiry forward with clarity, context and care.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              <Button asChild className="h-10 rounded-xl bg-emerald-300 px-4 text-xs font-bold text-[#10211e] shadow-[0_8px_22px_-12px_oklch(0.8_0.14_158_/_90%)] hover:bg-emerald-200">
                <Link href="/leads"><Plus className="mr-2 h-4 w-4" />Create new enquiry</Link>
              </Button>
              <Button variant="outline" onClick={exportDashboard} disabled={loading || leads.records.length === 0} className="h-10 rounded-xl border-white/15 bg-white/[0.04] px-4 text-xs font-medium text-white hover:bg-white/10 hover:text-white">
                <ArrowDownToLine className="mr-2 h-3.5 w-3.5" />Export snapshot
              </Button>
              <span className="ml-1 inline-flex items-center gap-2 text-[10px] text-slate-300/60"><CalendarDays className="h-3.5 w-3.5" />{today}</span>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-sm sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-300/55">Daily pulse</p>
                <p className="mt-1 text-sm font-semibold text-white">Your workspace at a glance</p>
              </div>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-300/10 text-emerald-200"><TrendingUp className="h-4 w-4" /></span>
            </div>
            <div className="space-y-1">
              <PulseRow label="Hot prospects" value={loading ? "—" : leads.records.filter((lead) => lead.priority === "Hot").length} detail="Need personal attention" />
              <PulseRow label="Follow-ups due" value={loading ? "—" : todayFollowUps.length} detail="Keep the conversation moving" />
              <PulseRow label="Applications moving" value={loading ? "—" : activeApplications.length} detail="Across your admissions pipeline" />
            </div>
            <Link href="/follow-ups" className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-[10px] font-semibold text-emerald-200 transition-colors hover:text-emerald-100">
              Open today&apos;s priorities <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {isDemo && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-sm dark:border-amber-900/60 dark:bg-amber-950/20 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-amber-900 dark:text-amber-200"><span className="font-semibold">You&apos;re viewing sample data.</span> New records are saved only in this browser until Supabase is connected.</p>
          <Button variant="link" asChild className="h-auto justify-start p-0 text-amber-800 dark:text-amber-200"><Link href="/settings">Set up Supabase <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
        </div>
      )}

      {errors.length > 0 && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Could not load all CRM data: {errors.join(" ")}
        </div>
      )}

      <section aria-label="Key metrics" className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total leads" value={loading ? "—" : leads.records.length} note={`${leads.records.filter((lead) => lead.priority === "Hot").length} hot-priority`} icon={Target} accent="green" />
        <MetricCard label="Active students" value={loading ? "—" : students.records.length} note="Profiles in your workspace" icon={GraduationCap} accent="blue" />
        <MetricCard label="Applications in progress" value={loading ? "—" : activeApplications.length} note="Across all admission stages" icon={FileText} accent="amber" />
        <MetricCard label="Fees collected" value={loading ? "—" : formatINR(paidTotal)} note={`${payments.records.filter((payment) => payment.status === "Paid").length} payments received`} icon={CircleDollarSign} accent="violet" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-base">Lead pipeline</CardTitle>
              <p className="mt-1.5 text-xs text-muted-foreground">Student enquiries by counselling stage</p>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-xs"><Link href="/leads">View leads<ChevronRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
          </CardHeader>
          <CardContent className="space-y-3.5">
            {leadCounts.map((stage, index) => (
              <div key={stage.name} className="grid grid-cols-[112px_1fr_28px] items-center gap-3">
                <span className={`truncate text-[11px] ${index >= 6 ? "font-semibold text-primary" : "text-muted-foreground"}`}>{stage.name}</span>
                <div className="h-[7px] overflow-hidden rounded-full bg-muted/90">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all" style={{ width: `${Math.max(stage.count ? 7 : 0, (stage.count / pipelineMax) * 100)}%`, opacity: 1 - index * 0.055 }} />
                </div>
                <span className="text-right text-[11px] font-semibold tabular-nums">{loading ? "—" : stage.count}</span>
              </div>
            ))}
            <div className="mt-3 flex items-center justify-between border-t pt-4 text-xs">
              <span className="text-muted-foreground">Overall conversion</span>
              <span className="font-semibold">{leads.records.length ? `${Math.round((leads.records.filter((lead) => ["Admitted", "Payment complete"].includes(String(lead.status))).length / leads.records.length) * 100)}%` : "—"}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-base">Today&apos;s follow-ups</CardTitle>
              <p className="mt-1.5 text-xs text-muted-foreground">Counsellor callbacks and reminders</p>
            </div>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"><BellRing className="h-4 w-4" /></span>
          </CardHeader>
          <CardContent className="space-y-1">
            {todayFollowUps.length ? todayFollowUps.slice(0, 4).map((followUp) => (
              <Link key={followUp.id} href="/follow-ups" className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-muted/70">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">{initials(followUp.contact_name)}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{String(followUp.title)}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{String(followUp.contact_name)} · {String(followUp.channel)}</p>
                </div>
                <span className="whitespace-nowrap text-[10px] text-muted-foreground">{new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(new Date(String(followUp.due_at)))}</span>
              </Link>
            )) : (
              <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/25 text-center">
                <p className="text-xs font-medium">You&apos;re all caught up</p>
                <p className="mt-1 text-[11px] text-muted-foreground">No open follow-ups due today.</p>
              </div>
            )}
            <Button variant="outline" size="sm" asChild className="mt-2 w-full">
              <Link href="/follow-ups"><Plus className="mr-1.5 h-3.5 w-3.5" />Schedule a follow-up</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden rounded-2xl border-border/80 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-base">Recent enquiries</CardTitle>
              <p className="mt-1.5 text-xs text-muted-foreground">Latest student leads entering the pipeline</p>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-xs"><Link href="/leads">View all<ChevronRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {latestLeads.length ? latestLeads.map((lead) => (
              <Link key={lead.id} href="/leads" className="group flex items-center gap-3 rounded-xl border border-transparent px-2.5 py-2.5 transition hover:border-border/70 hover:bg-muted/45">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-[10px] font-bold text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">{initials(lead.full_name)}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">{String(lead.full_name)}</p>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">{String(lead.preferred_destination ?? "Destination not set")} · {String(lead.source ?? "—")}</p>
                </div>
                <Badge variant="outline" className="hidden max-w-36 truncate text-[10px] sm:inline-flex">{String(lead.status)}</Badge>
                <span className="inline-flex w-12 items-center justify-end gap-1 text-right text-[9px] font-semibold uppercase tracking-wide text-rose-600">{lead.priority === "Hot" ? <><span className="h-1.5 w-1.5 rounded-full bg-rose-500" />Hot</> : <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 transition group-hover:opacity-100" />}</span>
              </Link>
            )) : <EmptyMessage loading={loading} label="No enquiries yet" link="/leads" />}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-base">Team activity</CardTitle>
              <p className="mt-1.5 text-xs text-muted-foreground">Recent student interactions</p>
            </div>
            <Button variant="ghost" size="icon-sm" asChild aria-label="View activities"><Link href="/activities"><ArrowRight className="h-4 w-4" /></Link></Button>
          </CardHeader>
          <CardContent>
            {latestActivity.length ? (
              <div className="relative space-y-4 before:absolute before:bottom-4 before:left-[15px] before:top-4 before:w-px before:bg-border">
                {latestActivity.map((activity) => (
                  <Link key={activity.id} href="/activities" className="relative flex gap-3">
                    <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-card text-primary"><TrendingUp className="h-3.5 w-3.5" /></span>
                    <div className="min-w-0 pt-0.5">
                      <p className="line-clamp-2 text-xs leading-relaxed">{String(activity.description)}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">{String(activity.student_name ?? "Team")} · {String(activity.activity_type)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : <EmptyMessage loading={loading} label="No team activity recorded" link="/activities" />}
          </CardContent>
        </Card>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-4 text-[10px] text-muted-foreground">
        <span>One workspace for every student journey.</span>
        <Link href="/reports" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">Explore admission insights<ArrowRight className="h-3 w-3" /></Link>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  note: string;
  icon: typeof Target;
  accent: "green" | "blue" | "amber" | "violet";
}) {
  const accents = {
    green: { icon: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300", bar: "bg-emerald-500" },
    blue: { icon: "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300", bar: "bg-sky-500" },
    amber: { icon: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300", bar: "bg-amber-500" },
    violet: { icon: "bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300", bar: "bg-violet-500" },
  };
  return (
    <Card className="relative rounded-2xl border-border/80 shadow-sm">
      <span className={`absolute inset-x-5 top-0 h-[2px] rounded-b-full ${accents[accent].bar}`} />
      <CardContent className="flex min-h-[118px] items-start justify-between p-4.5 sm:p-5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
          <p className="mt-2.5 truncate text-[28px] font-semibold leading-none tracking-[-0.045em] tabular-nums">{value}</p>
          <p className="mt-2 truncate text-[10px] text-muted-foreground">{note}</p>
        </div>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${accents[accent].icon}`}><Icon className="h-4 w-4" /></span>
      </CardContent>
    </Card>
  );
}

function PulseRow({ label, value, detail }: { label: string; value: number | string; detail: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-white/[0.04]">
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-slate-100">{label}</p>
        <p className="mt-0.5 truncate text-[9px] text-slate-300/50">{detail}</p>
      </div>
      <span className="text-xl font-semibold tracking-tight text-emerald-200 tabular-nums">{value}</span>
    </div>
  );
}

function EmptyMessage({ loading, label, link }: { loading: boolean; label: string; link: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center text-center">
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted"><GraduationCap className="h-5 w-5 text-muted-foreground" /></span>
      <p className="text-xs font-medium">{loading ? "Loading your workspace…" : label}</p>
      {!loading && <Button variant="link" size="sm" asChild className="mt-1"><Link href={link}>Add a record<ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>}
    </div>
  );
}

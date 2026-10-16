"use client";

import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BellRing,
  ChevronRight,
  CircleDollarSign,
  FileText,
  GraduationCap,
  Plus,
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
  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const dueFollowUps = followUps.records
    .filter((record) => {
      if (record.status !== "Open" || typeof record.due_at !== "string") return false;
      const dueAt = new Date(record.due_at).getTime();
      return Number.isFinite(dueAt) && dueAt <= endOfToday.getTime();
    })
    .sort((left, right) => new Date(String(left.due_at)).getTime() - new Date(String(right.due_at)).getTime());
  const overdueFollowUps = dueFollowUps.filter((record) => new Date(String(record.due_at)).getTime() < now.getTime());
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
  const hotLeads = leads.records.filter((lead) => lead.priority === "Hot").length;

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
      <header className="crm-page-heading flex flex-col justify-between gap-4 px-5 py-5 sm:flex-row sm:items-center sm:px-7 sm:py-6">
        <div className="relative z-10">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-primary"><span className="h-1.5 w-1.5 rounded-full bg-[#fe661d]" />Admissions workspace</span>
            {isDemo ? <Badge variant="outline" className="h-5 border-amber-300/70 bg-amber-50 px-2 text-[9px] text-amber-800">DEMO DATA</Badge> : !loading && errors.length === 0 ? <Badge variant="outline" className="h-5 border-emerald-300/70 bg-emerald-50 px-2 text-[9px] text-emerald-800">LIVE WORKSPACE</Badge> : null}
          </div>
          <h1 className="text-[26px] font-semibold tracking-[-0.04em] text-slate-900 sm:text-[32px]">Dashboard</h1>
          <p className="mt-1.5 text-xs text-slate-500">{today} <span className="mx-1.5 text-slate-300">/</span> A clear view of every student journey.</p>
        </div>
        <div className="relative z-10 flex flex-wrap gap-2">
          <Button variant="outline" className="h-10 border-slate-200 bg-white/90 px-4 shadow-sm hover:border-blue-200 hover:bg-blue-50/50" onClick={exportDashboard} disabled={loading || leads.records.length === 0}>
            <ArrowDownToLine className="mr-2 h-4 w-4" />Export leads
          </Button>
          <Button asChild className="h-10 rounded-xl bg-[#075fa3] px-4 shadow-[0_7px_16px_-10px_rgba(7,95,163,0.8)] hover:bg-[#064f88]"><Link href="/leads"><Plus className="mr-2 h-4 w-4" />New enquiry</Link></Button>
        </div>
      </header>

      {isDemo && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-amber-900"><span className="font-semibold">You&apos;re viewing sample data.</span> New records are saved only in this browser until Supabase is connected.</p>
          <Button variant="link" asChild className="h-auto justify-start p-0 text-amber-800"><Link href="/settings">Set up Supabase <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
        </div>
      )}

      {errors.length > 0 && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Could not load all CRM data: {errors.join(" ")}
        </div>
      )}

      <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard href="/leads" label="Total leads" value={loading ? "—" : leads.records.length} note={`${hotLeads} hot-priority`} icon={Target} accent="blue" />
        <MetricCard href="/students" label="Active students" value={loading ? "—" : students.records.length} note="Profiles in your workspace" icon={GraduationCap} accent="blue" />
        <MetricCard href="/applications" label="Applications in progress" value={loading ? "—" : activeApplications.length} note="Across all admission stages" icon={FileText} accent="orange" />
        <MetricCard href="/payments" label="Fees collected" value={loading ? "—" : formatINR(paidTotal)} note={`${payments.records.filter((payment) => payment.status === "Paid").length} payments received`} icon={CircleDollarSign} accent="violet" />
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
                  <div className="h-full rounded-full bg-gradient-to-r from-[#075fa3] to-[#4b9bd1] transition-all" style={{ width: `${Math.max(stage.count ? 7 : 0, (stage.count / pipelineMax) * 100)}%`, opacity: 1 - index * 0.055 }} />
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
              <CardTitle className="text-base">Priority follow-ups</CardTitle>
              <p className="mt-1.5 text-xs text-muted-foreground">Overdue and due today · oldest first</p>
            </div>
            {overdueFollowUps.length > 0 ? (
              <Badge variant="outline" className="border-rose-200 bg-rose-50 text-[10px] text-rose-700">{overdueFollowUps.length} overdue</Badge>
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700"><BellRing className="h-4 w-4" /></span>
            )}
          </CardHeader>
          <CardContent className="space-y-1">
            {dueFollowUps.length ? dueFollowUps.slice(0, 5).map((followUp) => {
              const dueAt = new Date(String(followUp.due_at));
              const overdue = dueAt.getTime() < now.getTime();
              return (
                <Link key={followUp.id} href="/follow-ups" className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-muted/70">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${overdue ? "bg-rose-100 text-rose-700" : "bg-primary/10 text-primary"}`}>{initials(followUp.contact_name)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{String(followUp.title)}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{String(followUp.contact_name)} · {String(followUp.channel)}</p>
                  </div>
                  <span className={`whitespace-nowrap text-[10px] font-medium ${overdue ? "text-rose-600" : "text-muted-foreground"}`}>{overdue ? "Overdue" : new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(dueAt)}</span>
                </Link>
              );
            }) : (
              <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/25 text-center">
                <p className="text-xs font-medium">You&apos;re all caught up</p>
                <p className="mt-1 text-[11px] text-muted-foreground">No overdue or due-today follow-ups.</p>
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
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-[10px] font-bold text-sky-700">{initials(lead.full_name)}</div>
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
  href,
}: {
  href: string;
  label: string;
  value: string | number;
  note: string;
  icon: typeof Target;
  accent: "blue" | "sky" | "orange" | "violet";
}) {
  const accents = {
    blue: { icon: "bg-blue-50 text-[#075fa3]", bar: "bg-[#075fa3]" },
    sky: { icon: "bg-sky-50 text-sky-700", bar: "bg-sky-500" },
    orange: { icon: "bg-orange-50 text-orange-700", bar: "bg-[#fe661d]" },
    violet: { icon: "bg-violet-50 text-violet-700", bar: "bg-violet-500" },
  };
  return (
    <Link href={href} className="group/metric block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
      <Card className="relative h-full rounded-2xl border-border/80 shadow-sm transition-transform group-hover/metric:-translate-y-0.5">
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
    </Link>
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

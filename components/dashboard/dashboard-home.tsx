"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Flame,
  FileText,
  GraduationCap,
  Plus,
  Target,
  TrendingUp,
  UserRoundPlus,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCrmCollection } from "@/hooks/use-crm-collection";
import { useCrmOverview } from "@/hooks/use-crm-overview";
import { downloadCsv } from "@/lib/csv";
import { formatINR } from "@/lib/format";

const stages = ["New", "Contacted", "Interested", "Documents", "Applied", "Offer letter", "Admitted", "Payment complete"];
const sourcePalette = ["#087b83", "#fe7048", "#438fba", "#61b8a8", "#66789a", "#d9a441"];

function initials(name: unknown) {
  return String(name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function DashboardHome() {
  const [trendWindow, setTrendWindow] = useState<3 | 6>(6);
  const leads = useCrmCollection("leads");
  const students = useCrmCollection("students");
  const followUps = useCrmCollection("follow-ups");
  const applications = useCrmCollection("applications");
  const payments = useCrmCollection("payments");
  const activities = useCrmCollection("activities");
  const overview = useCrmOverview();
  const modules = [leads, students, followUps, applications, payments, activities];
  const loading = modules.some((module) => module.mode === "loading") || overview.loading;
  const errors = [...new Set(
    [...modules.map((module) => module.error), overview.error]
      .filter((message): message is string => Boolean(message)),
  )];
  const isDemo = modules.some((module) => module.mode === "demo");
  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const pageDueFollowUps = followUps.records
    .filter((record) => {
      if (record.status !== "Open" || typeof record.due_at !== "string") return false;
      const dueAt = new Date(record.due_at).getTime();
      return Number.isFinite(dueAt) && dueAt <= endOfToday.getTime();
    })
    .sort((left, right) => new Date(String(left.due_at)).getTime() - new Date(String(right.due_at)).getTime());
  const dueFollowUps = overview.data?.upcoming_follow_ups ?? pageDueFollowUps;
  const overdueFollowUps = overview.data?.overdue_follow_ups
    ?? pageDueFollowUps.filter((record) => new Date(String(record.due_at)).getTime() < now.getTime()).length;
  const activeApplications = applications.records.filter((record) => !["Admitted", "Rejected"].includes(String(record.status)));
  const paidTotal = overview.data?.paid_total ?? payments.records
    .filter((record) => record.status === "Paid")
    .reduce((sum, record) => sum + Number(record.amount ?? 0), 0);
  const pageStageCounts = leads.records.reduce<Record<string, number>>((counts, lead) => {
    const stage = String(lead.status ?? "");
    counts[stage] = (counts[stage] ?? 0) + 1;
    return counts;
  }, {});
  const leadCounts = stages.map((stage) => ({
    name: stage,
    count: overview.data?.lead_stages[stage] ?? pageStageCounts[stage] ?? 0,
  }));
  const pipelineMax = Math.max(1, ...leadCounts.map((stage) => stage.count));
  const leadTotal = overview.data?.leads ?? leads.records.length;
  const convertedLeads = (overview.data?.lead_stages["Admitted"] ?? pageStageCounts["Admitted"] ?? 0)
    + (overview.data?.lead_stages["Payment complete"] ?? pageStageCounts["Payment complete"] ?? 0);
  const conversionRate = leadTotal > 0 ? Math.round((convertedLeads / leadTotal) * 100) : 0;
  const newLeadCount = overview.data?.lead_stages.New ?? pageStageCounts.New ?? 0;
  const dueActionCount = overview.data?.due_follow_ups ?? dueFollowUps.length;
  const pageSourceCounts = leads.records.reduce<Record<string, number>>((counts, lead) => {
    const source = String(lead.source || "Unspecified");
    counts[source] = (counts[source] ?? 0) + 1;
    return counts;
  }, {});
  const leadSources = Object.entries(overview.data?.lead_sources ?? pageSourceCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count);
  const sourceChartRows = leadSources.length > 6
    ? [...leadSources.slice(0, 5), { name: "Other", count: leadSources.slice(5).reduce((total, source) => total + source.count, 0) }]
    : leadSources;
  const trendMonths = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat("en-IN", { month: "short" }).format(date),
    };
  });
  const leadTrendRows = overview.data
    ? trendMonths.map((month) => ({ ...month, count: overview.data?.lead_trends[month.key] ?? 0 }))
    : leads.mode === "demo"
      ? trendMonths.map((month) => ({
        ...month,
        count: leads.records.filter((lead) => String(lead.created_at ?? "").slice(0, 7) === month.key).length,
      }))
      : [];
  const latestLeads = [...leads.records]
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
    .slice(0, 5);
  const latestActivity = [...activities.records]
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
    .slice(0, 4);
  const today = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  const hotLeads = overview.data?.hot_leads ?? leads.records.filter((lead) => lead.priority === "Hot").length;

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
      <header className="flex flex-col justify-between gap-4 border-b border-slate-200/80 pb-5 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-800">Admissions operations</span>
            {isDemo ? (
              <Badge variant="outline" className="h-5 border-amber-300 bg-amber-50 px-2 text-[9px] text-amber-800">DEMO DATA</Badge>
            ) : !loading && errors.length === 0 ? (
              <Badge variant="outline" className="h-5 border-emerald-200 bg-emerald-50 px-2 text-[9px] text-emerald-800"><CheckCircle2 className="mr-1 h-3 w-3" />LIVE</Badge>
            ) : null}
          </div>
          <h1 className="text-[30px] font-semibold tracking-[-0.045em] text-slate-900 sm:text-[34px]">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Admissions workload and team performance for {today}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-9 border-slate-200 bg-white px-3.5 hover:border-teal-200 hover:bg-teal-50/60" onClick={exportDashboard} disabled={loading || leads.records.length === 0}>
            <ArrowDownToLine className="mr-2 h-4 w-4" />Export leads
          </Button>
          <Button asChild className="h-9 rounded-lg bg-[#087b83] px-3.5 text-white hover:bg-[#08656c]">
            <Link href="/leads"><Plus className="mr-2 h-4 w-4" />New enquiry</Link>
          </Button>
        </div>
      </header>

      {isDemo && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-amber-900"><span className="font-semibold">You&apos;re viewing sample data.</span> New records are saved only in this browser until Supabase is connected.</p>
          <Button variant="link" asChild className="h-auto justify-start p-0 text-amber-800"><Link href="/settings">Set up Supabase <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
        </div>
      )}

      {errors.length > 0 && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white px-4 py-4 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">CRM database setup needs attention</p>
            <p className="mt-1 max-w-3xl text-amber-900/85">{errors.join(" ")}</p>
          </div>
          <Button asChild variant="outline" className="shrink-0 border-amber-300 bg-white text-amber-950 hover:bg-amber-100">
            <Link href="/settings">Open setup guide <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      )}

      <section aria-label="Work queue" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Work queue</h2>
            <p className="mt-0.5 text-xs text-slate-500">Start with the records that need a counsellor action.</p>
          </div>
          <Link href="/follow-ups" className="text-xs font-medium text-teal-800 hover:underline">Open follow-up schedule <ArrowRight className="ml-1 inline h-3 w-3" /></Link>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <QueueCard
            href="/leads?status=New"
            label="Uncontacted enquiries"
            value={loading ? "—" : newLeadCount.toLocaleString()}
            detail="New leads waiting for first contact"
            icon={UserRoundPlus}
            accent="teal"
          />
          <QueueCard
            href="/leads?facet_priority=Hot"
            label="High intent"
            value={loading ? "—" : hotLeads.toLocaleString()}
            detail="Hot-priority leads to move forward"
            icon={Flame}
            accent="coral"
          />
          <QueueCard
            href="/follow-ups?status=Open"
            label="Callbacks due"
            value={loading ? "—" : dueActionCount.toLocaleString()}
            detail={overdueFollowUps > 0 ? `${overdueFollowUps.toLocaleString()} overdue · due through today` : "Open follow-ups due through today"}
            icon={CalendarClock}
            accent="amber"
          />
        </div>
      </section>

      <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard href="/leads" label="Total leads" value={loading ? "—" : leadTotal.toLocaleString()} note={`${hotLeads.toLocaleString()} hot-priority`} icon={Target} accent="blue" />
        <MetricCard href="/students" label="Active students" value={loading ? "—" : (overview.data?.students ?? students.records.length).toLocaleString()} note="Profiles in your workspace" icon={GraduationCap} accent="blue" />
        <MetricCard href="/applications" label="Applications in progress" value={loading ? "—" : (overview.data?.active_applications ?? activeApplications.length).toLocaleString()} note="Across all admission stages" icon={FileText} accent="orange" />
        <MetricCard href="/payments" label="Fees collected" value={loading ? "—" : formatINR(paidTotal)} note={`${(overview.data?.paid_payments ?? payments.records.filter((payment) => payment.status === "Paid").length).toLocaleString()} payments received`} icon={CircleDollarSign} accent="violet" />
      </section>

      <section aria-label="Admissions analytics" className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.85fr)]">
        <Card className="min-w-0 overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
          <CardHeader className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-white via-sky-50/55 to-white sm:flex-row sm:items-center">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 text-teal-800"><TrendingUp className="h-4 w-4" /></span>
                Enquiry momentum
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">{overview.data ? "Workspace-wide monthly admissions interest" : "Monthly leads in this browser"}</p>
            </div>
            <div aria-label="Chart time range" className="inline-flex w-fit rounded-lg border border-slate-200 bg-white p-1">
              {([3, 6] as const).map((months) => (
                <Button
                  key={months}
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-pressed={trendWindow === months}
                  onClick={() => setTrendWindow(months)}
                  className={`h-7 rounded-md px-3 text-xs ${trendWindow === months ? "bg-[#087b83] text-white shadow-sm hover:bg-[#08656c] hover:text-white" : "text-slate-600"}`}
                >
                  {months} months
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-5 sm:p-5">
          {loading ? (
            <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">Loading enquiry trends…</div>
          ) : leadTrendRows.length === 0 ? (
            <div className="flex h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center">
              <BarChart3 className="mb-2 h-5 w-5 text-slate-400" />
              <p className="text-sm font-medium text-slate-700">Trend data is not available yet</p>
              <p className="mt-1 max-w-md text-xs text-slate-500">Connect the workspace database to see monthly enquiry totals and pipeline charts.</p>
            </div>
          ) : (
            <div className="h-[220px] min-w-0 w-full" role="img" aria-label={`Monthly enquiry trend for the last ${trendWindow} months`}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={leadTrendRows.slice(-trendWindow)} margin={{ top: 12, right: 12, bottom: 0, left: -18 }}>
                  <defs>
                    <linearGradient id="dashboardLeadTrendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#087b83" stopOpacity={0.24} />
                      <stop offset="100%" stopColor="#087b83" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e8edf3" strokeDasharray="4 5" vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} tickMargin={10} />
                  <YAxis allowDecimals={false} width={34} axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                  <Tooltip
                    cursor={{ stroke: "#94a3b8", strokeDasharray: "4 4" }}
                    contentStyle={{ border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 10px 30px -16px rgba(15,23,42,.4)", fontSize: 12 }}
                    formatter={(value) => [Number(value ?? 0).toLocaleString(), "Enquiries"]}
                  />
                  <Area type="monotone" dataKey="count" stroke="#087b83" strokeWidth={2.5} fill="url(#dashboardLeadTrendFill)" activeDot={{ r: 5, fill: "#fe7048", stroke: "#fff", strokeWidth: 2 }} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          {!loading && leadTrendRows.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] text-muted-foreground">
              <span>{overview.data ? "Workspace-wide totals" : "Counts from records loaded in this browser"}</span>
              <span className="font-medium text-slate-700">
                {leadTrendRows.slice(-trendWindow).reduce((sum, month) => sum + month.count, 0).toLocaleString()} enquiries in view
              </span>
            </div>
          )}
        </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-white to-orange-50/45">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-orange-700"><Target className="h-4 w-4" /></span>
              Lead channels
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{overview.data ? "Where workspace enquiries begin" : "Sources from records loaded"}</p>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            {loading ? (
              <div className="flex h-[190px] items-center justify-center text-sm text-muted-foreground">Preparing channel mix…</div>
            ) : sourceChartRows.length === 0 ? (
              <div className="flex h-[190px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center text-xs text-slate-500">Add enquiries to see channel performance.</div>
            ) : (
              <>
                <div className="relative mx-auto h-[190px] min-w-0 max-w-[250px]" role="img" aria-label="Lead distribution by source">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={sourceChartRows} dataKey="count" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={3} stroke="white" strokeWidth={3} isAnimationActive={false}>
                        {sourceChartRows.map((source, index) => (
                          <Cell key={source.name} fill={sourcePalette[index % sourcePalette.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 10px 30px -16px rgba(15,23,42,.4)", fontSize: 12 }}
                        formatter={(value) => [Number(value ?? 0).toLocaleString(), "Enquiries"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[26px] font-semibold leading-none tracking-tight text-slate-900">{loading ? "—" : leadTotal.toLocaleString()}</span>
                    <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">Total leads</span>
                  </div>
                </div>
                <div className="mt-2 space-y-2">
                  {sourceChartRows.slice(0, 4).map((source, index) => {
                    const share = leadTotal > 0 ? Math.round((source.count / leadTotal) * 100) : 0;
                    return (
                      <div key={source.name} className="flex items-center gap-2.5 text-xs">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: sourcePalette[index % sourcePalette.length] }} />
                        <span className="min-w-0 flex-1 truncate text-slate-600">{source.name}</span>
                        <span className="font-semibold tabular-nums text-slate-800">{source.count.toLocaleString()}</span>
                        <span className="w-9 text-right text-[10px] tabular-nums text-slate-400">{share}%</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 border-b border-slate-100 bg-gradient-to-r from-white to-teal-50/50 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 text-teal-800"><BarChart3 className="h-4 w-4" /></span>
                Lead pipeline
              </CardTitle>
              <p className="mt-1.5 text-xs text-muted-foreground">Student enquiries by counselling stage</p>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-xs"><Link href="/leads">View leads<ChevronRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
          </CardHeader>
          <CardContent className="space-y-4 pt-1">
            {leadCounts.map((stage, index) => (
              <div key={stage.name} className="grid grid-cols-[minmax(82px,112px)_1fr_40px] items-center gap-3">
                <span className={`truncate text-[11px] ${index >= 6 ? "font-semibold text-primary" : "text-slate-500"}`}>{stage.name}</span>
                <div
                  className="h-2 overflow-hidden rounded-full bg-slate-100"
                  role="progressbar"
                  aria-label={`${stage.name} leads`}
                  aria-valuemin={0}
                  aria-valuemax={pipelineMax}
                  aria-valuenow={stage.count}
                >
                  <div className={`h-full rounded-full transition-[width] duration-500 ${index >= 6 ? "bg-gradient-to-r from-emerald-500 to-teal-400" : "bg-gradient-to-r from-[#087b83] to-[#62beb1]"}`} style={{ width: `${stage.count ? Math.max(4, (stage.count / pipelineMax) * 100) : 0}%` }} />
                </div>
                <span className="text-right text-[11px] font-semibold tabular-nums text-slate-700">{loading ? "—" : stage.count.toLocaleString()}</span>
              </div>
            ))}
            <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/60 px-3.5 py-3 text-xs">
              <span className="text-emerald-900/75">Admission conversion</span>
              <span className="font-semibold tabular-nums text-emerald-800">{loading || leadTotal === 0 ? "—" : `${conversionRate}%`}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-base">Priority follow-ups</CardTitle>
              <p className="mt-1.5 text-xs text-muted-foreground">Overdue and due today · oldest first</p>
            </div>
            {overdueFollowUps > 0 ? (
              <Badge variant="outline" className="border-rose-200 bg-rose-50 text-[10px] text-rose-700">{overdueFollowUps.toLocaleString()} overdue</Badge>
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
    blue: { icon: "bg-teal-100 text-teal-800", bar: "bg-[#087b83]" },
    sky: { icon: "bg-sky-100 text-sky-800", bar: "bg-[#438fba]" },
    orange: { icon: "bg-orange-100 text-orange-800", bar: "bg-[#fe7048]" },
    violet: { icon: "bg-indigo-100 text-indigo-800", bar: "bg-[#66789a]" },
  };
  return (
    <Link href={href} className="group/metric block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
      <Card className={`crm-metric-card crm-metric-${accent} relative h-full rounded-2xl shadow-sm transition-transform group-hover/metric:-translate-y-0.5`}>
        <span className={`absolute inset-x-5 top-0 z-10 h-[2px] rounded-b-full ${accents[accent].bar}`} />
        <CardContent className="relative z-[1] flex min-h-[126px] items-start justify-between p-4.5 sm:p-5">
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

function QueueCard({
  href,
  label,
  value,
  detail,
  icon: Icon,
  accent,
}: {
  href: string;
  label: string;
  value: string;
  detail: string;
  icon: typeof Target;
  accent: "teal" | "coral" | "amber";
}) {
  const accents = {
    teal: "border-teal-200 bg-teal-50 text-teal-800",
    coral: "border-orange-200 bg-orange-50 text-orange-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
  };
  return (
    <Link
      href={href}
      className="group flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 transition-colors hover:border-teal-300 hover:bg-teal-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${accents[accent]}`}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-semibold text-slate-500">{label}</span>
        <span className="mt-0.5 block text-[23px] font-semibold leading-none tracking-tight tabular-nums text-slate-900">{value}</span>
        <span className="mt-1.5 block truncate text-[10px] text-slate-500">{detail}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-teal-700" />
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

"use client";

import { ArrowDownToLine, BarChart3, FileText, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCrmCollection } from "@/hooks/use-crm-collection";
import { downloadCsv } from "@/lib/csv";
import type { CrmRecord } from "@/lib/crm/config";
import { formatINR } from "@/lib/format";

export function ReportsWorkspace() {
  const leads = useCrmCollection("leads");
  const applications = useCrmCollection("applications");
  const payments = useCrmCollection("payments");
  const loading = [leads, applications, payments].some((collection) => collection.mode === "loading");
  const errors = [leads, applications, payments].map((collection) => collection.error).filter((message): message is string => Boolean(message));
  const sources = countBy(leads.records, "source");
  const counsellors = countBy(leads.records, "counselor_name");
  const stages = countBy(applications.records, "status");
  const paid = payments.records.filter((record) => record.status === "Paid");
  const outstanding = payments.records.filter((record) => ["Pending", "Overdue", "Partially paid"].includes(String(record.status)));
  const totalCollected = paid.reduce((total, record) => total + Number(record.amount ?? 0), 0);
  const totalOutstanding = outstanding.reduce((total, record) => total + Number(record.amount ?? 0), 0);

  function downloadReport() {
    const rows = [
      ["Report", "Metric", "Value"],
      ...sources.map((item) => ["Leads by source", item.label, item.count]),
      ...counsellors.map((item) => ["Counsellor workload", item.label, item.count]),
      ...stages.map((item) => ["Applications by stage", item.label, item.count]),
      ["Payments", "Collected", totalCollected],
      ["Payments", "Outstanding", totalOutstanding],
    ];
    downloadCsv(`nexora-admissions-report-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast.success("Admissions report downloaded.");
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-[0.17em] text-primary">INSIGHTS & ANALYTICS</span>
            {leads.mode === "demo" && <Badge variant="outline" className="text-[10px]">DEMO DATA</Badge>}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Reports</h1>
          <p className="mt-2 text-sm text-muted-foreground">Understand lead sources, admission progress, and fee collections.</p>
        </div>
        <Button onClick={downloadReport} disabled={loading}><ArrowDownToLine className="mr-2 h-4 w-4" />Export report</Button>
      </div>

      {errors.length > 0 && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">Could not load all report data: {errors.join(" ")}</div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Total enquiries" value={loading ? "—" : leads.records.length} detail="Captured student leads" icon={BarChart3} />
        <SummaryCard title="Application conversion" value={loading || leads.records.length === 0 ? "—" : `${Math.round((applications.records.length / leads.records.length) * 100)}%`} detail={`${applications.records.length} applications tracked`} icon={TrendingUp} />
        <SummaryCard title="Fees collected" value={loading ? "—" : formatINR(totalCollected)} detail={`${paid.length} completed payments`} icon={FileText} />
        <SummaryCard title="Outstanding fees" value={loading ? "—" : formatINR(totalOutstanding)} detail={`${outstanding.length} payments to follow up`} icon={FileText} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <DistributionCard title="Lead source mix" description="Enquiries grouped by their original source" rows={sources} total={leads.records.length} loading={loading} emptyLabel="No lead sources to report yet." />
        <DistributionCard title="Counsellor performance" description="Assigned lead workload by counsellor" rows={counsellors} total={leads.records.length} loading={loading} emptyLabel="Assign counsellors to leads to see this report." />
        <DistributionCard title="Admission funnel" description="Applications across the admission journey" rows={stages} total={applications.records.length} loading={loading} emptyLabel="Add applications to see your admission funnel." />
      </div>

      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Collections overview</CardTitle>
          <p className="text-xs text-muted-foreground">Fee ledger summary by payment status</p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {["Paid", "Pending", "Overdue"].map((status) => {
            const matching = payments.records.filter((payment) => payment.status === status);
            const amount = matching.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
            return (
              <div key={status} className="rounded-xl border bg-muted/20 p-4">
                <p className="text-xs font-medium text-muted-foreground">{status}</p>
                <p className="mt-2 text-xl font-semibold">{loading ? "—" : formatINR(amount)}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{matching.length} {matching.length === 1 ? "payment" : "payments"}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function countBy(records: CrmRecord[], key: string) {
  const totals = new Map<string, number>();
  for (const record of records) {
    const label = String(record[key] ?? "Unspecified");
    totals.set(label, (totals.get(label) ?? 0) + 1);
  }
  return [...totals.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count);
}

function SummaryCard({ title, value, detail, icon: Icon }: { title: string; value: string | number; detail: string; icon: typeof BarChart3 }) {
  return (
    <Card className="rounded-2xl border-border/80 shadow-sm">
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-[18px] w-[18px]" /></span>
      </CardContent>
    </Card>
  );
}

function DistributionCard({
  title,
  description,
  rows,
  total,
  loading,
  emptyLabel,
}: {
  title: string;
  description: string;
  rows: { label: string; count: number }[];
  total: number;
  loading: boolean;
  emptyLabel: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <Card className="rounded-2xl border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading report data…</p> : rows.length ? rows.map((row) => (
          <div key={row.label}>
            <div className="mb-1.5 flex justify-between gap-2 text-xs">
              <span className="truncate font-medium">{row.label}</span>
              <span className="shrink-0 text-muted-foreground">{row.count} <span className="ml-1">· {total ? Math.round((row.count / total) * 100) : 0}%</span></span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }} /></div>
          </div>
        )) : <p className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>}
      </CardContent>
    </Card>
  );
}

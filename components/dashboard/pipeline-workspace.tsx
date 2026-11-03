"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, LoaderCircle, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { crmModules, type CrmRecord } from "@/lib/crm/config";

type PipelineColumn = {
  stage: string;
  total: number;
  leads: CrmRecord[];
};

type PipelineState = {
  columns: PipelineColumn[];
  loading: boolean;
  error: string | null;
};

const stages = crmModules.leads.fields.find((field) => field.key === "status")?.options ?? [];

async function fetchPipelineColumns(): Promise<PipelineColumn[]> {
  const response = await fetch("/api/crm/pipeline", { cache: "no-store" });
  const payload: unknown = await response.json();
  if (typeof payload !== "object" || payload === null) throw new Error("The pipeline service returned an invalid response.");
  if (!response.ok || !("data" in payload) || !Array.isArray(payload.data)) {
    const message = "error" in payload && typeof payload.error === "string" ? payload.error : "Could not load the lead pipeline.";
    throw new Error(message);
  }
  const columns = payload.data.filter((column): column is PipelineColumn =>
    typeof column === "object"
    && column !== null
    && "stage" in column && typeof column.stage === "string"
    && "total" in column && typeof column.total === "number"
    && "leads" in column && Array.isArray(column.leads),
  );
  if (columns.length !== stages.length) throw new Error("The pipeline response is missing one or more lead stages.");
  return columns;
}

export function PipelineWorkspace() {
  const [state, setState] = useState<PipelineState>({ columns: [], loading: true, error: null });
  const [updatingLead, setUpdatingLead] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const columns = await fetchPipelineColumns();
      setState({ columns, loading: false, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load the lead pipeline.";
      setState((current) => ({ ...current, loading: false, error: message }));
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetchPipelineColumns().then((columns) => {
      if (active) setState({ columns, loading: false, error: null });
    }).catch((error: unknown) => {
      if (!active) return;
      const message = error instanceof Error ? error.message : "Could not load the lead pipeline.";
      setState((current) => ({ ...current, loading: false, error: message }));
    });
    return () => { active = false; };
  }, []);

  async function moveLead(lead: CrmRecord, status: string) {
    if (!stages.some((stage) => stage === status) || typeof lead.id !== "string" || lead.status === status) return;
    setUpdatingLead(lead.id);
    try {
      const response = await fetch("/api/crm/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id, record: { status } }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "Could not move this lead.";
        throw new Error(message);
      }
      toast.success(`${String(lead.full_name ?? "Lead")} moved to ${status}.`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not move this lead.");
    } finally {
      setUpdatingLead(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <header className="crm-page-heading flex flex-col justify-between gap-4 px-5 py-5 sm:flex-row sm:items-center sm:px-7 sm:py-6">
        <div className="relative z-10">
          <span className="inline-flex items-center gap-1.5 text-[9px] font-bold tracking-[0.17em] text-primary"><span className="h-1.5 w-1.5 rounded-full bg-[#fe661d]" />SALES OPERATIONS</span>
          <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.04em] text-slate-900 sm:text-[32px]">Lead pipeline</h1>
          <p className="mt-1.5 text-[13px] text-slate-500">Move enquiries through admission stages with live organization-wide totals.</p>
        </div>
        <Button asChild className="relative z-10 h-10 rounded-xl bg-[#075fa3] px-4 hover:bg-[#064f88]"><Link href="/leads">Manage leads<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
      </header>

      {state.error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <span>{state.error}</span>
          <Button size="sm" variant="outline" onClick={() => void load()}>Retry</Button>
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {state.columns.map((column) => (
          <section key={column.stage} aria-label={`${column.stage} leads`} className="w-[290px] shrink-0">
            <Card className="h-full overflow-hidden rounded-2xl border-border/80 shadow-sm">
              <CardHeader className="border-b bg-slate-50/80 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="truncate text-sm">{column.stage}</CardTitle>
                  <Badge variant="secondary" className="tabular-nums">{column.total.toLocaleString()}</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">Latest 8 of this stage</p>
              </CardHeader>
              <CardContent className="space-y-3 p-3">
                {state.loading && !column.leads.length ? (
                  <div className="py-8 text-center text-xs text-muted-foreground"><LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" />Loading</div>
                ) : column.leads.length ? column.leads.map((lead) => (
                  <article key={lead.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_3px_12px_-10px_rgba(15,23,42,0.45)]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-800">{String(lead.full_name ?? "Unnamed lead")}</p>
                        <p className="mt-1 truncate text-[10px] text-muted-foreground">{String(lead.phone ?? "")}</p>
                      </div>
                      <Badge variant="outline" className={lead.priority === "Hot" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-slate-50 text-slate-600"}>{String(lead.priority ?? "—")}</Badge>
                    </div>
                    {typeof lead.preferred_destination === "string" && lead.preferred_destination && <p className="mt-2 truncate text-[10px] text-slate-500">Destination · {lead.preferred_destination}</p>}
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1 truncate text-[10px] text-muted-foreground"><UserRound className="h-3 w-3 shrink-0" />{String(lead.counselor_name || "Unassigned")}</span>
                      <Select value={column.stage} onValueChange={(value) => value && void moveLead(lead, value)} disabled={updatingLead === lead.id}>
                        <SelectTrigger aria-label={`Move ${String(lead.full_name ?? "lead")} to a different stage`} className="h-7 w-[112px] text-[10px]">
                          {updatingLead === lead.id ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <SelectValue />}
                        </SelectTrigger>
                        <SelectContent>
                          {stages.map((stage) => <SelectItem key={stage} value={stage}>{stage}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </article>
                )) : (
                  <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">No leads in this stage.</div>
                )}
              </CardContent>
            </Card>
          </section>
        ))}
      </div>
    </div>
  );
}

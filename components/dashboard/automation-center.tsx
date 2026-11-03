"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { CheckCircle2, Circle, LoaderCircle, RefreshCw, Sparkles, TriangleAlert, Zap } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  allAutomationRuleIds,
  automationRules,
  planAutomations,
  type AutomationAction,
  type AutomationRuleId,
  type CrmSnapshot,
} from "@/lib/crm/automation";
import { applyDemoAutomationActions } from "@/lib/crm/automation-demo";
import type { CrmRecord } from "@/lib/crm/config";
import type { DataMode } from "@/hooks/use-crm-collection";

const STORAGE_KEY = "nexora-crm-automation-rules";
const AUTORUN_KEY = "nexora-crm-automation-autorun";
const LAST_RUN_KEY = "nexora-crm-automation-last-run";
const RULES_CHANGED_EVENT = "nexora-crm-automation-rules-changed";
const defaultEnabled = automationRules.filter((rule) => rule.defaultEnabled).map((rule) => rule.id);
const defaultSnapshot = JSON.stringify(defaultEnabled);

const dueFormatter = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });

type AutomationRunResult = {
  created: number;
  updated: number;
  skipped: number;
  failed?: number;
};

function isRuleId(value: unknown): value is AutomationRuleId {
  return typeof value === "string" && (allAutomationRuleIds as readonly string[]).includes(value);
}

function createStorageStore(key: string, fallback: string) {
  return {
    subscribe(callback: () => void) {
      const onStorage = (event: StorageEvent) => {
        if (event.key === key) callback();
      };
      window.addEventListener("storage", onStorage);
      window.addEventListener(RULES_CHANGED_EVENT, callback);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(RULES_CHANGED_EVENT, callback);
      };
    },
    getSnapshot() {
      try {
        return window.localStorage.getItem(key) ?? fallback;
      } catch {
        return fallback;
      }
    },
    getServerSnapshot() {
      return fallback;
    },
  };
}

const rulesStore = createStorageStore(STORAGE_KEY, defaultSnapshot);
const autoRunStore = createStorageStore(AUTORUN_KEY, "on");

function parseRulesSnapshot(snapshot: string): AutomationRuleId[] {
  try {
    const parsed: unknown = JSON.parse(snapshot);
    return Array.isArray(parsed) ? parsed.filter(isRuleId) : defaultEnabled;
  } catch {
    return defaultEnabled;
  }
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function runSummary(result: AutomationRunResult, label: string) {
  const parts: string[] = [];
  if (result.created > 0) parts.push(`${result.created} follow-up${result.created === 1 ? "" : "s"} created`);
  if (result.updated > 0) parts.push(`${result.updated} payment${result.updated === 1 ? "" : "s"} marked overdue`);
  if (result.skipped > 0) parts.push(`${result.skipped} skipped`);
  if (result.failed) parts.push(`${result.failed} failed`);
  return parts.length ? `${label}: ${parts.join(", ")}.` : `${label}: nothing needed changing.`;
}


function actionMeta(action: AutomationAction) {
  if (action.kind === "mark-overdue") {
    return `Payment · ₹${action.amount.toLocaleString("en-IN")} · due ${action.dueDate}`;
  }
  const due = new Date(action.followUp.dueAt);
  return `${action.followUp.channel} · ${action.followUp.priority} priority · due ${dueFormatter.format(due)}`;
}

function ruleLabel(ruleId: AutomationRuleId) {
  return automationRules.find((rule) => rule.id === ruleId)?.title ?? ruleId;
}

export function AutomationCenter({
  leads,
  followUps,
  payments,
  applications,
  documents,
  mode,
  onApplied,
}: {
  leads: CrmRecord[];
  followUps: CrmRecord[];
  payments: CrmRecord[];
  applications: CrmRecord[];
  documents: CrmRecord[];
  mode: DataMode;
  onApplied: () => void | Promise<void>;
}) {
  const rulesSnapshot = useSyncExternalStore(rulesStore.subscribe, rulesStore.getSnapshot, rulesStore.getServerSnapshot);
  const autoRunSnapshot = useSyncExternalStore(autoRunStore.subscribe, autoRunStore.getSnapshot, autoRunStore.getServerSnapshot);
  const enabled = useMemo(() => parseRulesSnapshot(rulesSnapshot), [rulesSnapshot]);
  const autoRun = autoRunSnapshot !== "off";
  const [now, setNow] = useState(() => new Date());
  const [applying, setApplying] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const snapshot = useMemo<CrmSnapshot>(
    () => ({ leads, followUps, payments, applications, documents }),
    [leads, followUps, payments, applications, documents],
  );
  const plan = useMemo(() => planAutomations(snapshot, enabled, now), [snapshot, enabled, now]);
  const highPriority = plan.filter((action) => action.severity === "high").length;

  function toggleRule(ruleId: AutomationRuleId) {
    const next = enabled.includes(ruleId)
      ? enabled.filter((id) => id !== ruleId)
      : [...enabled, ruleId];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(RULES_CHANGED_EVENT));
    setSummary(null);
  }

  function toggleAutoRun() {
    window.localStorage.setItem(AUTORUN_KEY, autoRun ? "off" : "on");
    window.dispatchEvent(new Event(RULES_CHANGED_EVENT));
    setSummary(null);
  }

  const applyPlan = useCallback(async (origin: "manual" | "auto" = "manual") => {
    if (applying || plan.length === 0) return;
    setApplying(true);
    setError(null);
    setSummary(null);
    // Mark the day before the request so a re-render can never start a duplicate run.
    window.localStorage.setItem(LAST_RUN_KEY, localDateKey(new Date()));

    try {
      let result: AutomationRunResult;
      if (mode === "demo") {
        result = applyDemoAutomationActions(plan);
      } else if (mode === "supabase") {
        const response = await fetch("/api/automation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actions: plan.map((action) => action.kind === "mark-overdue"
              ? { kind: "mark-overdue", paymentId: action.paymentId }
              : { kind: "create-follow-up", followUp: action.followUp }),
          }),
        });
        const payload = await response.json() as { results?: AutomationRunResult; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Could not run automations.");
        if (!payload.results) throw new Error("The automation endpoint returned an invalid response.");
        result = payload.results;
      } else {
        throw new Error("Wait for the workspace to finish loading before running automations.");
      }

      await onApplied();
      setNow(new Date());

      const message = runSummary(result, origin === "auto" ? "Auto-run complete" : "Run complete");
      setSummary(message);
      toast.success(origin === "auto" ? "Automations ran automatically." : "Automation run complete.");
    } catch (applyError) {
      const message = applyError instanceof Error ? applyError.message : "Could not run automations.";
      setError(message);
      toast.error(message);
    } finally {
      setApplying(false);
    }
  }, [applying, mode, onApplied, plan]);

  useEffect(() => {
    if (!autoRun || applying) return;
    if (mode !== "demo" && mode !== "supabase") return;
    if (plan.length === 0) return;
    if (window.localStorage.getItem(LAST_RUN_KEY) === localDateKey(new Date())) return;

    const timer = window.setTimeout(() => { void applyPlan("auto"); }, 700);
    return () => window.clearTimeout(timer);
  }, [applyPlan, applying, autoRun, mode, plan]);

  const preview = plan.slice(0, 5);

  return (
    <Card className="overflow-hidden rounded-2xl border-border/80 shadow-sm">
      <CardHeader className="flex flex-col gap-3 border-b bg-gradient-to-r from-slate-50/95 via-white to-blue-50/35 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#075fa3]/10 text-[#075fa3]">
            <Zap className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">Automation center</CardTitle>
              <Badge variant="outline" className="h-5 border-primary/20 bg-primary/5 px-2 text-[10px] font-semibold text-primary">
                {plan.length} pending
              </Badge>
              {highPriority > 0 && (
                <Badge variant="outline" className="h-5 border-rose-200 bg-rose-50 px-2 text-[10px] font-semibold text-rose-700">
                  {highPriority} urgent
                </Badge>
              )}
            </div>
            <p className="mt-1.5 max-w-2xl text-xs text-muted-foreground">
              Runs by itself once a day and whenever a lead, fee, or document is saved. You can still trigger an extra pass any time.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 self-start">
          <button
            type="button"
            aria-pressed={autoRun}
            onClick={toggleAutoRun}
            title="Apply the enabled rules automatically once a day when the dashboard opens"
            className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium transition ${
              autoRun
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${autoRun ? "bg-emerald-500" : "bg-slate-300"}`} />
            Auto-run {autoRun ? "on" : "off"}
          </button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={() => { setNow(new Date()); setSummary(null); }}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Automation rules">
          {automationRules.map((rule) => {
            const active = enabled.includes(rule.id);
            const count = plan.filter((action) => action.ruleId === rule.id).length;
            return (
              <button
                key={rule.id}
                type="button"
                aria-pressed={active}
                title={rule.description}
                onClick={() => toggleRule(rule.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                  active
                    ? "border-primary/25 bg-primary/5 text-primary"
                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                }`}
              >
                {active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                {rule.title}
                {count > 0 && (
                  <span className={`rounded-full px-1.5 text-[10px] font-semibold ${active ? "bg-primary/10" : "bg-slate-100"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {mode === "loading" ? (
          <div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed bg-muted/20 text-xs text-muted-foreground">
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            Reviewing your workspace…
          </div>
        ) : plan.length === 0 ? (
          <div className="flex min-h-24 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 text-center">
            <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <p className="text-xs font-medium">Everything is on track</p>
            <p className="mt-1 text-[11px] text-muted-foreground">No enabled rule has anything to action right now.</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {preview.map((action) => (
              <li key={action.key} className="flex items-start gap-2.5 rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2.5">
                <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${action.severity === "high" ? "bg-rose-500" : "bg-amber-500"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <p className="truncate text-xs font-medium">{action.title}</p>
                    <span className="text-[10px] text-muted-foreground">{ruleLabel(action.ruleId)}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{action.reason}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground/80">{actionMeta(action)}</p>
                </div>
              </li>
            ))}
            {plan.length > preview.length && (
              <li className="px-1 text-[11px] text-muted-foreground">
                +{plan.length - preview.length} more action{plan.length - preview.length === 1 ? "" : "s"} in this run.
              </li>
            )}
          </ul>
        )}

        {error && (
          <p role="alert" className="flex items-start gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}

        {summary && (
          <p aria-live="polite" className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-800">
            {summary}
          </p>
        )}

        <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            {mode === "demo"
              ? "Demo mode: tasks are saved in this browser only. Connect Supabase in Settings to automate live data."
              : autoRun
                ? "Auto-run is on. Event rules also fire immediately after a lead, fee, or document is saved."
                : "Auto-run is off. Only the manual Run button will apply these actions."}
          </p>
          <Button
            className="h-9 shrink-0 rounded-xl bg-[#075fa3] px-4 shadow-[0_7px_16px_-10px_rgba(7,95,163,0.8)] hover:bg-[#064f88]"
            onClick={() => void applyPlan()}
            disabled={applying || plan.length === 0 || mode === "loading" || mode === "error"}
          >
            {applying ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {applying ? "Running automations…" : plan.length > 0 ? `Run ${plan.length} automation${plan.length === 1 ? "" : "s"}` : "Nothing to run"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

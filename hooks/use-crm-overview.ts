"use client";

import { useEffect, useState } from "react";
import { z } from "zod";

export type CrmOverview = {
  leads: number;
  hot_leads: number;
  lead_stages: Record<string, number>;
  lead_sources: Record<string, number>;
  lead_trends: Record<string, number>;
  counsellors: Record<string, number>;
  students: number;
  applications: number;
  active_applications: number;
  application_stages: Record<string, number>;
  paid_payments: number;
  paid_total: number;
  outstanding_payments: number;
  outstanding_total: number;
  payment_totals: Record<string, { count: number; amount: number }>;
  due_follow_ups: number;
  overdue_follow_ups: number;
  upcoming_follow_ups: {
    id: string;
    title: string;
    contact_name: string;
    channel: string;
    due_at: string;
    priority: string;
  }[];
};

const overviewSchema = z.object({
  leads: z.number(),
  hot_leads: z.number(),
  lead_stages: z.record(z.string(), z.number()),
  lead_sources: z.record(z.string(), z.number()),
  lead_trends: z.record(z.string(), z.number()),
  counsellors: z.record(z.string(), z.number()),
  students: z.number(),
  applications: z.number(),
  active_applications: z.number(),
  application_stages: z.record(z.string(), z.number()),
  paid_payments: z.number(),
  paid_total: z.number(),
  outstanding_payments: z.number(),
  outstanding_total: z.number(),
  payment_totals: z.record(z.string(), z.object({ count: z.number(), amount: z.number() })),
  due_follow_ups: z.number(),
  overdue_follow_ups: z.number(),
  upcoming_follow_ups: z.array(z.object({
    id: z.string(),
    title: z.string(),
    contact_name: z.string(),
    channel: z.string(),
    due_at: z.string(),
    priority: z.string(),
  })),
});

type OverviewState = {
  data: CrmOverview | null;
  loading: boolean;
  error: string | null;
  demo: boolean;
};

export function useCrmOverview() {
  const [state, setState] = useState<OverviewState>({
    data: null,
    loading: true,
    error: null,
    demo: false,
  });

  useEffect(() => {
    let active = true;
    void fetch("/api/crm/overview", { cache: "no-store" })
      .then(async (response) => {
        const payload: unknown = await response.json();
        if (typeof payload !== "object" || payload === null) {
          throw new Error("The CRM server returned an invalid analytics response.");
        }
        if (response.status === 503 && "code" in payload && payload.code === "SUPABASE_NOT_CONFIGURED") {
          if (active) setState((current) => ({ ...current, loading: false, demo: true }));
          return;
        }
        if (!response.ok) {
          const message = "error" in payload && typeof payload.error === "string" ? payload.error : "Could not load CRM analytics.";
          throw new Error(message);
        }
        const parsed = z.object({ data: overviewSchema }).safeParse(payload);
        if (!parsed.success) {
          throw new Error("The CRM server returned invalid analytics data.");
        }
        if (active) setState({ data: parsed.data.data, loading: false, error: null, demo: false });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          data: null,
          loading: false,
          error: error instanceof Error ? error.message : "Could not load CRM analytics.",
          demo: false,
        });
      });
    return () => { active = false; };
  }, []);

  return state;
}

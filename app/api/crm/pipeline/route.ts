import { getActiveOrganization } from "@/lib/crm/server-organization";
import { crmModules } from "@/lib/crm/config";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured.", code: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: "Sign in to view the lead pipeline.", code: "UNAUTHENTICATED" }, { status: 401 });
  }
  const active = await getActiveOrganization(supabase, user.id);
  if ("error" in active) {
    return Response.json({ error: active.error, code: active.code }, { status: active.status });
  }

  const stageField = crmModules.leads.fields.find((field) => field.key === "status");
  const stages = stageField?.options ?? [];
  const results = await Promise.all(stages.map(async (stage) => {
    const { data, error } = await supabase
      .from("leads")
      .select("id, full_name, phone, preferred_destination, priority, counselor_name, status, created_at")
      .eq("organization_id", active.organization.organizationId)
      .eq("status", stage)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(8);
    return { stage, data, error };
  }));
  const failed = results.find((result) => result.error);
  if (failed?.error) {
    console.error("Failed to load a CRM lead pipeline stage.", failed.error);
    return Response.json({ error: "Could not load the lead pipeline." }, { status: 500 });
  }

  const { data: metrics, error: metricsError } = await supabase.rpc("get_crm_overview", {
    target_org: active.organization.organizationId,
  });
  if (metricsError) {
    console.error("Failed to load CRM pipeline totals.", metricsError);
    return Response.json({ error: "Could not load lead pipeline totals." }, { status: 500 });
  }

  const stageCounts = typeof metrics === "object" && metrics !== null && "lead_stages" in metrics
    ? metrics.lead_stages
    : {};
  const columns = results.map((result) => ({
    stage: result.stage,
    total: typeof stageCounts === "object" && stageCounts !== null && result.stage in stageCounts
      ? Number(stageCounts[result.stage])
      : 0,
    leads: result.data ?? [],
  }));
  return Response.json({ data: columns });
}

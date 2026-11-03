import { getActiveOrganization } from "@/lib/crm/server-organization";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured.", code: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: "Sign in to view CRM analytics.", code: "UNAUTHENTICATED" }, { status: 401 });
  }

  const active = await getActiveOrganization(supabase, user.id);
  if ("error" in active) {
    return Response.json({ error: active.error, code: active.code }, { status: active.status });
  }

  const { data, error } = await supabase.rpc("get_crm_overview", {
    target_org: active.organization.organizationId,
  });
  if (error) {
    console.error("Failed to calculate CRM overview metrics.", error);
    return Response.json({ error: "Could not calculate workspace analytics." }, { status: 500 });
  }
  return Response.json({ data });
}

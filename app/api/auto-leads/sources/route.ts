import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { getActiveOrganization } from "@/lib/crm/server-organization";
import { createClient } from "@/lib/supabase/server";

async function getAdminContext() {
  const supabase = await createClient();
  if (!supabase) {
    return { response: Response.json({ error: "Supabase is not configured.", code: "SUPABASE_NOT_CONFIGURED" }, { status: 503 }) };
  }

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { response: Response.json({ error: "Sign in to manage Auto Leads integrations.", code: "UNAUTHENTICATED" }, { status: 401 }) };
  }

  const active = await getActiveOrganization(supabase, user.id);
  if ("error" in active) {
    return { response: Response.json({ error: active.error, code: active.code }, { status: active.status }) };
  }
  if (active.organization.role !== "owner" && active.organization.role !== "admin") {
    return { response: Response.json({ error: "Only workspace owners and admins can manage Auto Leads integrations." }, { status: 403 }) };
  }

  return { supabase, user, organization: active.organization };
}

export async function GET() {
  const auth = await getAdminContext();
  if ("response" in auth) return auth.response;

  const { data, error } = await auth.supabase
    .from("auto_lead_sources")
    .select("id, name, created_at, last_received_at, leads_received, revoked_at")
    .eq("organization_id", auth.organization.organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Could not load Auto Leads sources.", { code: error.code, message: error.message });
    return Response.json({ error: "Could not load integrations. Apply the Auto Leads database migration and retry." }, { status: 503 });
  }

  return Response.json({ sources: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await getAdminContext();
  if ("response" in auth) return auth.response;

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const validation = z.object({ name: z.string().trim().min(1).max(120) }).strict().safeParse(input);
  if (!validation.success) {
    return Response.json({ error: "Integration name must be between 1 and 120 characters." }, { status: 400 });
  }

  const apiKey = `nxl_${randomBytes(32).toString("base64url")}`;
  const tokenHash = createHash("sha256").update(apiKey).digest();
  const { data, error } = await auth.supabase
    .from("auto_lead_sources")
    .insert({
      organization_id: auth.organization.organizationId,
      created_by: auth.user.id,
      name: validation.data.name,
      token_hash: `\\x${tokenHash.toString("hex")}`,
    })
    .select("id, name, created_at, last_received_at, leads_received, revoked_at")
    .single();

  if (error) {
    console.error("Could not create an Auto Leads source.", { code: error.code, message: error.message });
    return Response.json({ error: "Could not create this integration. Check the Auto Leads database migration." }, { status: 503 });
  }

  return Response.json({ source: data, apiKey }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await getAdminContext();
  if ("response" in auth) return auth.response;

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const validation = z.object({ id: z.string().uuid() }).strict().safeParse(input);
  if (!validation.success) return Response.json({ error: "A valid integration id is required." }, { status: 400 });

  const { data, error } = await auth.supabase
    .from("auto_lead_sources")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", validation.data.id)
    .eq("organization_id", auth.organization.organizationId)
    .is("revoked_at", null)
    .select("id");

  if (error) {
    console.error("Could not revoke an Auto Leads source.", { code: error.code, message: error.message });
    return Response.json({ error: "Could not revoke this integration." }, { status: 500 });
  }
  if (!data?.length) return Response.json({ error: "Integration not found or already revoked." }, { status: 404 });

  return Response.json({ success: true });
}

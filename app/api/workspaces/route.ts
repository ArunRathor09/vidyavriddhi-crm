import { cookies } from "next/headers";
import { z } from "zod";
import {
  getOrganizationSetupError,
  isOrganizationSchemaError,
  setActiveOrganizationCookie,
} from "@/lib/crm/server-organization";
import { createClient } from "@/lib/supabase/server";

async function getUserClient() {
  const supabase = await createClient();
  if (!supabase) {
    return { response: Response.json({ error: "Supabase is not configured.", code: "SUPABASE_NOT_CONFIGURED" }, { status: 503 }) };
  }

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { response: Response.json({ error: "Sign in to access your CRM workspaces.", code: "UNAUTHENTICATED" }, { status: 401 }) };
  }
  return { supabase, user };
}

export async function GET() {
  const auth = await getUserClient();
  if ("response" in auth) return auth.response;

  const { data: memberships, error } = await auth.supabase
    .from("organization_members")
    .select("organization_id, role, created_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Failed to list CRM workspaces.", error);
    const setupError = isOrganizationSchemaError(error)
      ? getOrganizationSetupError()
      : { error: "Could not load your CRM workspaces. Please retry or contact your administrator.", code: "WORKSPACE_LOOKUP_FAILED", status: 500 };
    return Response.json({ error: setupError.error, code: setupError.code }, { status: setupError.status });
  }
  if (!memberships?.length) {
    return Response.json({
      error: "No workspace is linked to this account. Ask an administrator to invite you, or verify the Supabase organization migration.",
      code: "ORGANIZATION_MEMBERSHIP_MISSING",
    }, { status: 403 });
  }

  const { data: organizations, error: organizationError } = await auth.supabase
    .from("organizations")
    .select("id, name")
    .in("id", memberships.map((membership) => membership.organization_id));
  if (organizationError) {
    console.error("Failed to load CRM workspace details.", organizationError);
    const setupError = isOrganizationSchemaError(organizationError)
      ? getOrganizationSetupError()
      : { error: "Could not load your CRM workspace details.", code: "WORKSPACE_LOOKUP_FAILED", status: 500 };
    return Response.json({ error: setupError.error, code: setupError.code }, { status: setupError.status });
  }

  const cookieStore = await cookies();
  const requestedId = cookieStore.get("crm-active-organization")?.value;
  const active = memberships.find((item) => item.organization_id === requestedId) ?? memberships[0];
  if (active.organization_id !== requestedId) {
    setActiveOrganizationCookie(cookieStore, active.organization_id);
  }
  const organizationById = new Map((organizations ?? []).map((organization) => [organization.id, organization]));
  const workspaces = memberships.flatMap((item) => {
    const organization = organizationById.get(item.organization_id);
    return organization && typeof organization.name === "string"
      ? [{ id: item.organization_id, name: organization.name, role: item.role }]
      : [];
  });
  const current = workspaces.find((workspace) => workspace.id === active.organization_id);
  if (!current) {
    return Response.json({
      error: "The active workspace record is missing. Ask an administrator to verify the Supabase organization migration.",
      code: "ORGANIZATION_RECORD_MISSING",
    }, { status: 403 });
  }
  return Response.json({ data: workspaces, active: current });
}

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const validation = z.object({ organizationId: z.string().uuid() }).safeParse(input);
  if (!validation.success) {
    return Response.json({ error: "A valid workspace id is required." }, { status: 400 });
  }

  const auth = await getUserClient();
  if ("response" in auth) return auth.response;
  const { data, error } = await auth.supabase
    .from("organization_members")
    .select("organization_id")
    .eq("organization_id", validation.data.organizationId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error) {
    console.error("Failed to verify CRM workspace membership.", error);
    return Response.json({ error: "Could not verify workspace access." }, { status: 500 });
  }
  if (!data) return Response.json({ error: "You are not a member of this workspace." }, { status: 403 });

  const cookieStore = await cookies();
  setActiveOrganizationCookie(cookieStore, data.organization_id);
  return Response.json({ success: true });
}

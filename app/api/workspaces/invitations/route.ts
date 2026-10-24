import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getActiveOrganization } from "@/lib/crm/server-organization";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

const invitationSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(["admin", "member"]).default("member"),
});

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const validation = invitationSchema.safeParse(input);
  if (!validation.success) {
    return Response.json({ error: "Enter a valid email address and workspace role." }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured.", code: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: "Sign in to invite a workspace member.", code: "UNAUTHENTICATED" }, { status: 401 });
  }
  const active = await getActiveOrganization(supabase, user.id);
  if ("error" in active) {
    return Response.json({ error: active.error, code: active.code }, { status: active.status });
  }
  if (active.organization.role !== "owner" && active.organization.role !== "admin") {
    return Response.json({ error: "Only workspace owners and admins can invite team members." }, { status: 403 });
  }

  const config = getSupabaseConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!config || !serviceRoleKey) {
    return Response.json({
      error: "Team invitations need SUPABASE_SERVICE_ROLE_KEY configured as a server-only environment variable.",
      code: "INVITATIONS_NOT_CONFIGURED",
    }, { status: 503 });
  }

  const admin = createSupabaseClient(config.url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: invitation, error: invitationError } = await admin
    .from("organization_invitations")
    .insert({
      organization_id: active.organization.organizationId,
      email: validation.data.email,
      role: validation.data.role,
      invited_by: user.id,
    })
    .select("id")
    .single();
  if (invitationError) {
    if (invitationError.code === "23505") {
      return Response.json({ error: "This email already has a pending invitation to this workspace." }, { status: 409 });
    }
    console.error("Failed to create CRM workspace invitation.", invitationError);
    return Response.json({ error: "Could not create the workspace invitation." }, { status: 500 });
  }

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(validation.data.email);
  if (inviteError) {
    const { error: cleanupError } = await admin
      .from("organization_invitations")
      .delete()
      .eq("id", invitation.id);
    if (cleanupError) {
      console.error("Could not remove an invitation after Supabase Auth rejected it.", cleanupError);
    }
    if (inviteError.code === "email_exists") {
      return Response.json({ error: "This email already has a Supabase account. Invite a new email address." }, { status: 409 });
    }
    console.error("Supabase Auth could not send the workspace invitation.", inviteError);
    return Response.json({ error: "Supabase Auth could not send the invitation email." }, { status: 502 });
  }

  return Response.json({ success: true, email: validation.data.email, role: validation.data.role }, { status: 201 });
}

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

const ACTIVE_ORGANIZATION_COOKIE = "crm-active-organization";
type AuthenticatedSupabaseClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;

export type OrganizationAccess = {
  organizationId: string;
  organizationName: string;
  role: "owner" | "admin" | "member";
};

type OrganizationResolutionError = {
  error: string;
  code: string;
  status: number;
};

export function isOrganizationSchemaError(error: { code?: string }) {
  return ["42P01", "42703", "42501", "PGRST200", "PGRST204", "PGRST205"].includes(error.code ?? "");
}

export function getOrganizationSetupError(): OrganizationResolutionError {
  return {
    error: "Workspace database setup is incomplete. In Supabase SQL Editor, run supabase/schema.sql, then supabase/migrations/20261023000000_multi_tenant_crm.sql, and refresh this page.",
    code: "ORGANIZATION_SCHEMA_NOT_READY",
    status: 503,
  };
}

export async function getActiveOrganization(
  supabase: AuthenticatedSupabaseClient,
  userId: string,
) {
  const cookieStore = await cookies();
  const requestedId = cookieStore.get(ACTIVE_ORGANIZATION_COOKIE)?.value;
  let membershipQuery = supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .limit(1);

  if (requestedId) membershipQuery = membershipQuery.eq("organization_id", requestedId);

  let { data: membership, error: membershipError } = await membershipQuery.maybeSingle();
  if (membershipError) {
    console.error("Failed to resolve the active CRM organization membership.", membershipError);
    if (isOrganizationSchemaError(membershipError)) return getOrganizationSetupError();
    return {
      error: "Could not verify your workspace access. Please retry or contact your administrator.",
      code: "ORGANIZATION_LOOKUP_FAILED",
      status: 500,
    } satisfies OrganizationResolutionError;
  }
  if (!membership && requestedId) {
    const fallback = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    membership = fallback.data;
    membershipError = fallback.error;
    if (membershipError) {
      console.error("Failed to recover the active CRM organization membership.", membershipError);
      if (isOrganizationSchemaError(membershipError)) return getOrganizationSetupError();
      return {
        error: "Could not verify your workspace access. Please retry or contact your administrator.",
        code: "ORGANIZATION_LOOKUP_FAILED",
        status: 500,
      } satisfies OrganizationResolutionError;
    }
    if (membership) setActiveOrganizationCookie(cookieStore, membership.organization_id);
  }
  if (!membership) {
    return {
      error: requestedId
        ? "Your selected workspace is no longer available to this account. Choose another workspace or ask an administrator for access."
        : "No workspace is linked to this account. Ask an administrator to invite you, or verify the Supabase organization migration.",
      code: "ORGANIZATION_MEMBERSHIP_MISSING",
      status: 403,
    } satisfies OrganizationResolutionError;
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", membership.organization_id)
    .maybeSingle();
  if (organizationError) {
    console.error("Failed to resolve the active CRM organization details.", organizationError);
    if (isOrganizationSchemaError(organizationError)) return getOrganizationSetupError();
    return {
      error: "Could not load your workspace details. Please retry or contact your administrator.",
      code: "ORGANIZATION_LOOKUP_FAILED",
      status: 500,
    } satisfies OrganizationResolutionError;
  }
  if (!organization || typeof organization.name !== "string") {
    return {
      error: "Your workspace record is missing. Ask an administrator to verify the Supabase organization migration.",
      code: "ORGANIZATION_RECORD_MISSING",
      status: 403,
    } satisfies OrganizationResolutionError;
  }

  return {
    organization: {
      organizationId: membership.organization_id,
      organizationName: organization.name,
      role: membership.role as OrganizationAccess["role"],
    },
  } as const;
}

export function setActiveOrganizationCookie(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  organizationId: string,
) {
  cookieStore.set(ACTIVE_ORGANIZATION_COOKIE, organizationId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

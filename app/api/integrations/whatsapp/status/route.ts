import { getActiveOrganization } from "@/lib/crm/server-organization";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured.", code: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  }
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return Response.json({ error: "Sign in to view integration readiness.", code: "UNAUTHENTICATED" }, { status: 401 });
  }
  const active = await getActiveOrganization(supabase, user.id);
  if ("error" in active) {
    return Response.json({ error: active.error, code: active.code }, { status: active.status });
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const graphVersion = process.env.WHATSAPP_GRAPH_API_VERSION?.trim();
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME?.trim();
  const templateLanguage = process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim();
  const configured = Boolean(
    accessToken
    && phoneNumberId && /^\d+$/.test(phoneNumberId)
    && graphVersion && /^v\d+\.\d+$/.test(graphVersion)
    && templateName && /^[a-zA-Z0-9_]+$/.test(templateName)
    && templateLanguage && /^[a-zA-Z0-9_-]+$/.test(templateLanguage)
    && getSupabaseServiceRoleKey(),
  );
  return Response.json({ data: { provider: "WhatsApp Cloud API", configured } });
}

function getSupabaseServiceRoleKey() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

import { z } from "zod";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getActiveOrganization } from "@/lib/crm/server-organization";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type WhatsAppMessageLogRow = {
  id: string;
  organization_id: string;
  lead_id: string;
  initiated_by: string;
  request_id: string;
  provider_message_id: string | null;
  status: "pending" | "accepted" | "failed";
  created_at: string;
};

type WhatsAppAuditDatabase = {
  public: {
    Tables: {
      whatsapp_message_logs: {
        Row: WhatsAppMessageLogRow;
        Insert: Omit<WhatsAppMessageLogRow, "id" | "created_at" | "provider_message_id"> & { provider_message_id?: string | null };
        Update: Partial<WhatsAppMessageLogRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

const sendSchema = z.object({
  leadId: z.string().uuid(),
  requestId: z.string().uuid(),
});

function getProviderErrorCode(payload: unknown) {
  if (
    typeof payload !== "object"
    || payload === null
    || !("error" in payload)
    || typeof payload.error !== "object"
    || payload.error === null
    || !("code" in payload.error)
  ) return undefined;
  return typeof payload.error.code === "string" || typeof payload.error.code === "number"
    ? payload.error.code
    : undefined;
}

async function finishLog(supabase: ReturnType<typeof createSupabaseClient<WhatsAppAuditDatabase>>, logId: string, values: {
  status: "accepted" | "failed";
  provider_message_id?: string;
}) {
  const { data, error } = await supabase
    .from("whatsapp_message_logs")
    .update(values)
    .eq("id", logId)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    console.error("Could not finalize the WhatsApp message audit record.", error);
    return false;
  }
  return true;
}

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const validation = sendSchema.safeParse(input);
  if (!validation.success) {
    return Response.json({ error: "A valid lead and request id are required." }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured.", code: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: "Sign in before sending a WhatsApp template.", code: "UNAUTHENTICATED" }, { status: 401 });
  }
  const active = await getActiveOrganization(supabase, user.id);
  if ("error" in active) {
    return Response.json({ error: active.error, code: active.code }, { status: active.status });
  }

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, full_name, phone, whatsapp_opt_in")
    .eq("id", validation.data.leadId)
    .eq("organization_id", active.organization.organizationId)
    .maybeSingle();
  if (leadError) {
    console.error("Could not verify WhatsApp recipient access.", leadError);
    return Response.json({ error: "Could not verify this lead before sending." }, { status: 500 });
  }
  if (!lead) return Response.json({ error: "Lead not found in the active organization." }, { status: 404 });
  if (lead.whatsapp_opt_in !== true) {
    return Response.json({ error: "This lead has no recorded WhatsApp opt-in. Record explicit consent before sending." }, { status: 403 });
  }
  if (typeof lead.phone !== "string" || !/^\+[1-9]\d{7,14}$/.test(lead.phone)) {
    return Response.json({ error: "Store this student's number in international format (for example, +919876543210) before sending." }, { status: 400 });
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const graphVersion = process.env.WHATSAPP_GRAPH_API_VERSION?.trim();
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME?.trim();
  const templateLanguage = process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim();
  const config = getSupabaseConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!accessToken || !phoneNumberId || !graphVersion || !templateName || !templateLanguage || !config || !serviceRoleKey) {
    return Response.json({
      error: "WhatsApp sending is not configured. Add the WhatsApp settings and server-only audit credentials.",
      code: "WHATSAPP_NOT_CONFIGURED",
    }, { status: 503 });
  }
  if (!/^\d+$/.test(phoneNumberId) || !/^v\d+\.\d+$/.test(graphVersion)
      || !/^[a-zA-Z0-9_]+$/.test(templateName) || !/^[a-zA-Z0-9_-]+$/.test(templateLanguage)) {
    console.error("WhatsApp Cloud API configuration contains an invalid identifier or version.");
    return Response.json({ error: "WhatsApp Cloud API configuration is invalid." }, { status: 503 });
  }

  const admin = createSupabaseClient<WhatsAppAuditDatabase>(config.url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: log, error: logError } = await admin
    .from("whatsapp_message_logs")
    .insert({
      organization_id: active.organization.organizationId,
      lead_id: lead.id,
      initiated_by: user.id,
      request_id: validation.data.requestId,
      status: "pending",
    })
    .select("id")
    .single();
  if (logError) {
    if (logError.code === "23505") {
      return Response.json({ error: "This send request was already processed. Check the WhatsApp conversation before retrying." }, { status: 409 });
    }
    console.error("Could not reserve the WhatsApp send audit record.", logError);
    return Response.json({ error: "Could not safely prepare this WhatsApp send." }, { status: 500 });
  }

  let providerResponse: Response;
  try {
    providerResponse = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: lead.phone.slice(1),
        type: "template",
        template: {
          name: templateName,
          language: { code: templateLanguage },
          components: [{
            type: "body",
            parameters: [{ type: "text", text: lead.full_name }],
          }],
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    const finalized = await finishLog(supabase, log.id, { status: "failed" });
    console.error("WhatsApp Cloud API request failed before a response was received.", error);
    return Response.json({
      error: finalized
        ? "The WhatsApp provider did not return a response. Check the provider conversation status before retrying."
        : "The WhatsApp provider did not return a response and the CRM could not update its audit record.",
    }, { status: 502 });
  }

  let providerPayload: unknown;
  try {
    providerPayload = await providerResponse.json();
  } catch (error) {
    const finalized = await finishLog(supabase, log.id, { status: "failed" });
    console.error("WhatsApp Cloud API returned a non-JSON response.", { status: providerResponse.status, error });
    return Response.json({
      error: finalized
        ? "WhatsApp returned an unreadable response. Check the provider conversation status before retrying."
        : "WhatsApp returned an unreadable response and the CRM could not update its audit record.",
    }, { status: 502 });
  }

  if (!providerResponse.ok) {
    const finalized = await finishLog(supabase, log.id, { status: "failed" });
    console.error("WhatsApp Cloud API rejected a template send.", {
      status: providerResponse.status,
      code: getProviderErrorCode(providerPayload),
    });
    return Response.json({
      error: finalized
        ? "WhatsApp did not accept this template. Verify the approved template, language, number, and provider configuration."
        : "WhatsApp rejected this template and the CRM could not update its audit record.",
    }, { status: 502 });
  }

  const providerMessageId = typeof providerPayload === "object"
    && providerPayload !== null
    && "messages" in providerPayload
    && Array.isArray(providerPayload.messages)
    && typeof providerPayload.messages[0] === "object"
    && providerPayload.messages[0] !== null
    && "id" in providerPayload.messages[0]
    && typeof providerPayload.messages[0].id === "string"
    ? providerPayload.messages[0].id
    : null;
  if (!providerMessageId) {
    const finalized = await finishLog(supabase, log.id, { status: "failed" });
    return Response.json({
      error: finalized
        ? "WhatsApp returned success without a message id. Check the provider conversation before retrying."
        : "WhatsApp returned success, but the CRM could not update its audit record.",
    }, { status: 502 });
  }

  const finalized = await finishLog(supabase, log.id, { status: "accepted", provider_message_id: providerMessageId });
  if (!finalized) {
    return Response.json({ error: "WhatsApp accepted the message, but the CRM could not save its audit record. Check the provider conversation before retrying." }, { status: 502 });
  }
  return Response.json({ success: true, status: "accepted", providerMessageId });
}

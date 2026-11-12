import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const leadSchema = z.object({
  full_name: z.string().trim().min(1).max(160),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/).transform((value) => value.replace(/[ ()-]/g, "")),
  email: z.union([z.string().trim().toLowerCase().email().max(254), z.literal("")]).optional(),
  source: z.enum(["Website", "Google", "Facebook", "Instagram", "Referral", "Walk-in", "Other"]).optional(),
  counselor_name: z.string().trim().max(160).optional(),
  status: z.enum(["New", "Contacted", "Interested", "Documents", "Applied", "Offer letter", "Admitted", "Payment complete"]).optional(),
  priority: z.enum(["Hot", "Warm", "Cold"]).optional(),
  whatsapp_opt_in: z.boolean().optional(),
  preferred_destination: z.string().trim().max(160).optional(),
  budget: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.coerce.number().nonnegative().max(9_999_999_999.99).optional(),
  ),
  next_follow_up_date: z.string().date().optional().or(z.literal("")),
}).strict();

const payloadSchema = z.union([
  z.object({ leads: z.array(leadSchema).min(1).max(100) }).strict(),
  leadSchema.transform((lead) => ({ leads: [lead] })),
]);

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const credential = /^Bearer (nxl_[A-Za-z0-9_-]{43})$/.exec(authorization)?.[1];
  if (!credential) {
    return Response.json({ error: "A valid Auto Leads bearer token is required." }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 1_000_000) {
    return Response.json({ error: "Request body must be smaller than 1 MB." }, { status: 413 });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) {
    return Response.json(
      { error: "Please check the lead fields. A request can contain up to 100 valid leads.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured.", code: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  }

  const { data, error } = await supabase.rpc("ingest_auto_leads", {
    p_api_key: credential,
    p_leads: parsed.data.leads,
  });
  if (error) {
    if (error.code === "28000") {
      return Response.json({ error: "The Auto Leads token is invalid or has been revoked." }, { status: 401 });
    }
    console.error("Auto Leads webhook could not ingest leads.", { code: error.code, message: error.message });
    if (["PGRST202", "42883", "42P01", "42703"].includes(error.code ?? "")) {
      return Response.json({ error: "Auto Leads database setup is incomplete. Apply the Auto Leads migration." }, { status: 503 });
    }
    return Response.json({ error: "Could not import leads. Check for duplicate email addresses or invalid lead data." }, { status: 400 });
  }

  return Response.json({ success: true, results: data }, { status: 200 });
}

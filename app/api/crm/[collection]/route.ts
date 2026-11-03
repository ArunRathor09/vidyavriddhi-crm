import { z } from "zod";
import { crmModules, isCrmCollection } from "@/lib/crm/config";
import { getActiveOrganization } from "@/lib/crm/server-organization";
import { createClient } from "@/lib/supabase/server";

const schemas = {
  leads: z.object({
    full_name: z.string().trim().min(1).max(160),
    phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/).transform((value) => value.replace(/[ ()-]/g, "")),
    email: z.union([z.string().trim().toLowerCase().email().max(254), z.literal("")]).optional(),
    source: z.enum(["Website", "Google", "Facebook", "Instagram", "Referral", "Walk-in", "Other"]),
    counselor_name: z.string().max(160).optional(),
    status: z.enum(["New", "Contacted", "Interested", "Documents", "Applied", "Offer letter", "Admitted", "Payment complete"]),
    priority: z.enum(["Hot", "Warm", "Cold"]),
    whatsapp_opt_in: z.boolean().optional(),
    preferred_destination: z.string().max(160).optional(),
    budget: z.coerce.number().nonnegative().optional(),
    next_follow_up_date: z.string().date().optional().or(z.literal("")),
  }).strict(),
  students: z.object({
    full_name: z.string().trim().min(1).max(160),
    phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/).transform((value) => value.replace(/[ ()-]/g, "")),
    email: z.union([z.string().trim().toLowerCase().email().max(254), z.literal("")]).optional(),
    parent_name: z.string().max(160).optional(),
    neet_score: z.coerce.number().min(0).max(720).optional(),
    rank: z.coerce.number().int().nonnegative().optional(),
    category: z.enum(["General", "OBC", "SC", "ST", "EWS", "Other"]).optional(),
    preferred_destination: z.string().max(160).optional(),
    budget: z.coerce.number().nonnegative().optional(),
    timeline: z.string().max(120).optional(),
    notes: z.string().max(4000).optional(),
  }).strict(),
  follow_ups: z.object({
    title: z.string().trim().min(1).max(240),
    contact_name: z.string().trim().min(1).max(160),
    channel: z.enum(["Call", "WhatsApp", "Email", "Meeting", "SMS"]),
    due_at: z.string().datetime({ offset: true }),
    priority: z.enum(["High", "Medium", "Low"]),
    status: z.enum(["Open", "Completed", "Snoozed"]),
    notes: z.string().max(4000).optional(),
  }).strict(),
  colleges: z.object({
    name: z.string().trim().min(1).max(240),
    country: z.string().trim().min(1).max(100),
    state: z.string().max(120).optional(),
    course: z.string().trim().min(1).max(120),
    annual_fee: z.coerce.number().nonnegative().optional(),
    hostel_fee: z.coerce.number().nonnegative().optional(),
    seats: z.coerce.number().int().nonnegative().optional(),
    cutoff: z.coerce.number().nonnegative().optional(),
    eligibility: z.string().max(4000).optional(),
  }).strict(),
  applications: z.object({
    student_name: z.string().trim().min(1).max(160),
    college_name: z.string().trim().min(1).max(240),
    course: z.string().trim().min(1).max(120),
    status: z.enum(["Registration", "Document verification", "University application", "Offer letter", "Visa", "Admitted", "Rejected"]),
    last_updated: z.string().date(),
    notes: z.string().max(4000).optional(),
  }).strict(),
  documents: z.object({
    student_name: z.string().trim().min(1).max(160),
    document_type: z.enum(["NEET scorecard", "10th marksheet", "12th marksheet", "Aadhaar", "Passport", "Photo", "Signature", "Other"]),
    file_name: z.string().trim().min(1).max(255),
    verification_status: z.enum(["Pending", "Verified", "Needs correction"]),
    file_path: z.string().max(512).optional().nullable(),
  }).strict(),
  payments: z.object({
    student_name: z.string().trim().min(1).max(160),
    fee_type: z.enum(["Registration fee", "Counselling fee", "Tuition instalment", "Visa fee", "Other"]),
    amount: z.coerce.number().positive(),
    status: z.enum(["Pending", "Paid", "Overdue", "Partially paid"]),
    due_date: z.string().date().optional().or(z.literal("")),
    receipt_number: z.string().max(120).optional(),
    notes: z.string().max(4000).optional(),
  }).strict(),
  activities: z.object({
    description: z.string().trim().min(1).max(4000),
    student_name: z.string().max(160).optional(),
    activity_type: z.enum(["Call", "WhatsApp", "Email", "Meeting", "Note", "Admission"]),
  }).strict(),
};

async function getAuthenticatedClient() {
  const supabase = await createClient();
  if (!supabase) {
    return {
      response: Response.json(
        { error: "Supabase is not configured.", code: "SUPABASE_NOT_CONFIGURED" },
        { status: 503 },
      ),
    };
  }

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return {
      response: Response.json(
        { error: "Sign in to access your CRM workspace.", code: "UNAUTHENTICATED" },
        { status: 401 },
      ),
    };
  }
  const active = await getActiveOrganization(supabase, user.id);
  if ("error" in active) {
    return {
      response: Response.json(
        { error: active.error, code: active.code },
        { status: active.status },
      ),
    };
  }
  return { supabase, user, organization: active.organization };
}

type RouteContext = { params: Promise<{ collection: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { collection } = await params;
  if (!isCrmCollection(collection)) {
    return Response.json({ error: "Unknown CRM collection." }, { status: 404 });
  }

  const auth = await getAuthenticatedClient();
  if ("response" in auth) return auth.response;

  const url = new URL(_request.url);
  const limit = Number(url.searchParams.get("limit") ?? 50);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return Response.json({ error: "Page size must be between 1 and 100." }, { status: 400 });
  }
  const cursorValue = url.searchParams.get("cursor");
  let cursor: { created_at: string; id: string } | undefined;
  if (cursorValue) {
    if (cursorValue.length > 512) {
      return Response.json({ error: "The page cursor is invalid. Refresh the list and try again." }, { status: 400 });
    }
    try {
      const parsed = z.object({
        created_at: z.string().datetime({ offset: true }),
        id: z.string().uuid(),
      }).safeParse(JSON.parse(Buffer.from(cursorValue, "base64url").toString("utf8")));
      if (!parsed.success) throw new Error("Invalid cursor.");
      cursor = parsed.data;
    } catch {
      return Response.json({ error: "The page cursor is invalid. Refresh the list and try again." }, { status: 400 });
    }
  }

  const moduleConfig = crmModules[collection];
  const status = url.searchParams.get("status");
  if (status) {
    const statusField = moduleConfig.fields.find((field) => field.key === "status" || field.key === "verification_status");
    if (!statusField?.options?.some((option) => option === status)) {
      return Response.json({ error: "The selected status is not valid for this collection." }, { status: 400 });
    }
  }

  let query = auth.supabase
    .from(collection.replaceAll("-", "_"))
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1)
    .eq("organization_id", auth.organization.organizationId);
  if (status) query = query.eq(moduleConfig.fields.some((field) => field.key === "status") ? "status" : "verification_status", status);

  const search = url.searchParams.get("q")?.trim();
  if (search && search.length > 120) {
    return Response.json({ error: "Search terms must be 120 characters or fewer." }, { status: 400 });
  }
  if (search) query = query.textSearch("search_document", search, { config: "simple", type: "websearch" });

  for (const facet of "facets" in moduleConfig ? moduleConfig.facets : []) {
    const value = url.searchParams.get(`facet_${facet.key}`);
    if (value) {
      if (value.length > 120) return Response.json({ error: `The ${facet.label.toLowerCase()} filter is too long.` }, { status: 400 });
      query = query.eq(facet.key, value);
    }
  }
  if (cursor) {
    query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
  }

  const { data, error } = await query;
  if (error) {
    console.error(`Failed to read CRM collection "${collection}".`, error);
    return Response.json({ error: "Could not load CRM records." }, { status: 500 });
  }

  const page = data ?? [];
  const hasMore = page.length > limit;
  const records = page.slice(0, limit).map((record) => {
    const publicRecord = { ...record };
    delete publicRecord.search_document;
    return publicRecord;
  });
  const last = records.at(-1);
  const nextCursor = hasMore && last && typeof last.created_at === "string" && typeof last.id === "string"
    ? Buffer.from(JSON.stringify({ created_at: last.created_at, id: last.id })).toString("base64url")
    : null;

  return Response.json({ data: records, hasMore, nextCursor, limit });
}

export async function POST(request: Request, { params }: RouteContext) {
  const { collection } = await params;
  if (!isCrmCollection(collection)) {
    return Response.json({ error: "Unknown CRM collection." }, { status: 404 });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const auth = await getAuthenticatedClient();
  if ("response" in auth) return auth.response;

  const schema = schemas[collection.replaceAll("-", "_") as keyof typeof schemas];
  const isBulk = typeof input === "object" && input !== null && "records" in input;
  let inputs: unknown[];
  if (isBulk) {
    const batch = z.object({ records: z.array(z.unknown()).min(1).max(100) }).safeParse(input);
    if (!batch.success) {
      return Response.json({ error: "Import batches must contain between 1 and 100 records." }, { status: 400 });
    }
    inputs = batch.data.records;
  } else {
    inputs = [input];
  }
  const parsedRecords = inputs.map((record) => schema.safeParse(record));
  const invalidIndex = parsedRecords.findIndex((result) => !result.success);
  if (invalidIndex >= 0) {
    const invalid = parsedRecords[invalidIndex];
    return Response.json({
      error: `Please check import row ${invalidIndex + 1}.`,
      details: invalid?.success === false ? invalid.error.flatten() : undefined,
      row: invalidIndex + 1,
    }, { status: 400 });
  }
  const recordsToInsert = parsedRecords.flatMap((result) => result.success ? [result.data] : []);
  const { data, error } = await auth.supabase
    .from(collection.replaceAll("-", "_"))
    .insert(recordsToInsert.map((record) => ({
      ...record,
      user_id: auth.user.id,
      organization_id: auth.organization.organizationId,
    })))
    .select();
  if (error) {
    if (error.code === "23505") {
      return Response.json({ error: "A record with this email address or phone number already exists.", code: "DUPLICATE_RECORD" }, { status: 409 });
    }
    console.error(`Failed to create a CRM record in "${collection}".`, error);
    return Response.json({ error: "Could not save the CRM record." }, { status: 500 });
  }

  return Response.json({ data: isBulk ? data : data?.[0] }, { status: 201 });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { collection } = await params;
  if (!isCrmCollection(collection)) {
    return Response.json({ error: "Unknown CRM collection." }, { status: 404 });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsedInput = z.object({ id: z.string().uuid(), record: z.unknown() }).safeParse(input);
  if (!parsedInput.success) {
    return Response.json({ error: "A valid record id and update are required." }, { status: 400 });
  }
  const validation = schemas[collection.replaceAll("-", "_") as keyof typeof schemas]
    .partial()
    .safeParse(parsedInput.data.record);
  if (!validation.success || Object.keys(validation.data ?? {}).length === 0) {
    return Response.json({ error: "Please check the submitted fields.", details: validation.success ? undefined : validation.error.flatten() }, { status: 400 });
  }

  const auth = await getAuthenticatedClient();
  if ("response" in auth) return auth.response;

  const { data, error } = await auth.supabase
    .from(collection.replaceAll("-", "_"))
    .update(validation.data)
    .eq("id", parsedInput.data.id)
    .eq("organization_id", auth.organization.organizationId)
    .select()
    .maybeSingle();
  if (error) {
    if (error.code === "23505") {
      return Response.json({ error: "A record with this email address or phone number already exists.", code: "DUPLICATE_RECORD" }, { status: 409 });
    }
    console.error(`Failed to update a CRM record in "${collection}".`, error);
    return Response.json({ error: "Could not update the CRM record." }, { status: 500 });
  }
  if (!data) return Response.json({ error: "Record not found." }, { status: 404 });

  return Response.json({ data });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { collection } = await params;
  if (!isCrmCollection(collection)) {
    return Response.json({ error: "Unknown CRM collection." }, { status: 404 });
  }
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !z.string().uuid().safeParse(id).success) {
    return Response.json({ error: "A valid record id is required." }, { status: 400 });
  }

  const auth = await getAuthenticatedClient();
  if ("response" in auth) return auth.response;
  if (auth.organization.role !== "owner" && auth.organization.role !== "admin") {
    return Response.json({ error: "Only workspace owners and admins can delete CRM records." }, { status: 403 });
  }

  const { error, count } = await auth.supabase
    .from(collection.replaceAll("-", "_"))
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("organization_id", auth.organization.organizationId);
  if (error) {
    console.error(`Failed to delete a CRM record from "${collection}".`, error);
    return Response.json({ error: "Could not delete the CRM record." }, { status: 500 });
  }
  if (count === 0) return Response.json({ error: "Record not found." }, { status: 404 });

  return Response.json({ success: true });
}

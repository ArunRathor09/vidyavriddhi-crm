import { z } from "zod";
import { isCrmCollection } from "@/lib/crm/config";
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
  return { supabase, user };
}

type RouteContext = { params: Promise<{ collection: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { collection } = await params;
  if (!isCrmCollection(collection)) {
    return Response.json({ error: "Unknown CRM collection." }, { status: 404 });
  }

  const auth = await getAuthenticatedClient();
  if ("response" in auth) return auth.response;

  const { data, error } = await auth.supabase
    .from(collection.replaceAll("-", "_"))
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error(`Failed to read CRM collection "${collection}".`, error);
    return Response.json({ error: "Could not load CRM records." }, { status: 500 });
  }

  return Response.json({ data });
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

  const validation = schemas[collection.replaceAll("-", "_") as keyof typeof schemas].safeParse(input);
  if (!validation.success) {
    return Response.json({ error: "Please check the submitted fields.", details: validation.error.flatten() }, { status: 400 });
  }

  const auth = await getAuthenticatedClient();
  if ("response" in auth) return auth.response;

  const { data, error } = await auth.supabase
    .from(collection.replaceAll("-", "_"))
    .insert({ ...validation.data, user_id: auth.user.id })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") {
      return Response.json({ error: "A record with this email address or phone number already exists.", code: "DUPLICATE_RECORD" }, { status: 409 });
    }
    console.error(`Failed to create a CRM record in "${collection}".`, error);
    return Response.json({ error: "Could not save the CRM record." }, { status: 500 });
  }

  return Response.json({ data }, { status: 201 });
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
    .eq("user_id", auth.user.id)
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

  const { error, count } = await auth.supabase
    .from(collection.replaceAll("-", "_"))
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("user_id", auth.user.id);
  if (error) {
    console.error(`Failed to delete a CRM record from "${collection}".`, error);
    return Response.json({ error: "Could not delete the CRM record." }, { status: 500 });
  }
  if (count === 0) return Response.json({ error: "Record not found." }, { status: 404 });

  return Response.json({ success: true });
}

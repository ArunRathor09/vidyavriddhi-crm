import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const followUpActionSchema = z.object({
  kind: z.literal("create-follow-up"),
  followUp: z.object({
    title: z.string().trim().min(1).max(240),
    contactName: z.string().trim().min(1).max(160),
    channel: z.enum(["Call", "WhatsApp", "Email", "Meeting", "SMS"]),
    dueAt: z.string().datetime({ offset: true }),
    priority: z.enum(["High", "Medium", "Low"]),
    notes: z.string().max(4000).optional(),
  }),
});

const paymentActionSchema = z.object({
  kind: z.literal("mark-overdue"),
  paymentId: z.string().uuid(),
});

const requestSchema = z.object({
  actions: z.array(z.discriminatedUnion("kind", [followUpActionSchema, paymentActionSchema])).min(1).max(50),
});

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
        { error: "Sign in to run workspace automations.", code: "UNAUTHENTICATED" },
        { status: 401 },
      ),
    };
  }
  return { supabase, user };
}

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const validation = requestSchema.safeParse(input);
  if (!validation.success) {
    return Response.json(
      { error: "Please check the automation actions.", details: validation.error.flatten() },
      { status: 400 },
    );
  }

  const auth = await getAuthenticatedClient();
  if ("response" in auth) return auth.response;

  const results = { created: 0, updated: 0, skipped: 0, failed: 0 };

  for (const action of validation.data.actions) {
    if (action.kind === "mark-overdue") {
      const { data, error } = await auth.supabase
        .from("payments")
        .update({ status: "Overdue" })
        .eq("id", action.paymentId)
        .eq("user_id", auth.user.id)
        .in("status", ["Pending", "Partially paid"])
        .select("id");

      if (error) {
        console.error("Automation could not mark a payment overdue.", error);
        results.failed += 1;
      } else if (!data || data.length === 0) {
        results.skipped += 1;
      } else {
        results.updated += 1;
      }
      continue;
    }

    const { data: existing, error: lookupError } = await auth.supabase
      .from("follow_ups")
      .select("id")
      .eq("user_id", auth.user.id)
      .eq("contact_name", action.followUp.contactName)
      .eq("title", action.followUp.title)
      .in("status", ["Open", "Snoozed"])
      .limit(1);

    if (lookupError) {
      console.error("Automation could not check for an existing follow-up.", lookupError);
      results.failed += 1;
      continue;
    }
    if (existing && existing.length > 0) {
      results.skipped += 1;
      continue;
    }

    const { error } = await auth.supabase
      .from("follow_ups")
      .insert({
        user_id: auth.user.id,
        title: action.followUp.title,
        contact_name: action.followUp.contactName,
        channel: action.followUp.channel,
        due_at: action.followUp.dueAt,
        priority: action.followUp.priority,
        status: "Open",
        notes: action.followUp.notes,
      });

    if (error) {
      console.error("Automation could not create a follow-up.", error);
      results.failed += 1;
    } else {
      results.created += 1;
    }
  }

  return Response.json({ results });
}

import type { SupabaseClient } from "@supabase/supabase-js";

type RecordAutomationInput = {
  supabase: SupabaseClient;
  userId: string;
  collection: string;
  record: Record<string, unknown>;
  previous?: Record<string, unknown> | null;
};

const terminalLeadStatuses = new Set(["Admitted", "Payment complete"]);
const outstandingPaymentStatuses = new Set(["Pending", "Partially paid", "Overdue"]);

function text(value: unknown) {
  return String(value ?? "").trim();
}

function parseDate(value: unknown, hour = 10) {
  const raw = text(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T${String(hour).padStart(2, "0")}:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function nextSlot(urgent: boolean) {
  const date = new Date();
  const endOfDay = new Date(date);
  endOfDay.setHours(17, 0, 0, 0);
  if (urgent && date.getTime() < endOfDay.getTime()) return endOfDay;
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  return date;
}

async function hasOpenFollowUp(input: RecordAutomationInput, contactName: string, title?: string) {
  let query = input.supabase
    .from("follow_ups")
    .select("id")
    .eq("user_id", input.userId)
    .eq("contact_name", contactName)
    .in("status", ["Open", "Snoozed"])
    .limit(1);

  if (title) query = query.eq("title", title);

  const { data, error } = await query;
  if (error) throw error;
  return Boolean(data && data.length > 0);
}

async function createFollowUp(
  input: RecordAutomationInput,
  followUp: {
    title: string;
    contactName: string;
    channel: string;
    dueAt: Date;
    priority: string;
    notes: string;
  },
) {
  const { error } = await input.supabase.from("follow_ups").insert({
    user_id: input.userId,
    title: followUp.title,
    contact_name: followUp.contactName,
    channel: followUp.channel,
    due_at: followUp.dueAt.toISOString(),
    priority: followUp.priority,
    status: "Open",
    notes: followUp.notes,
  });
  if (error) throw error;
}

async function completeFollowUp(input: RecordAutomationInput, title: string) {
  const { error } = await input.supabase
    .from("follow_ups")
    .update({ status: "Completed" })
    .eq("user_id", input.userId)
    .eq("title", title)
    .in("status", ["Open", "Snoozed"]);
  if (error) throw error;
}

async function automateLead(input: RecordAutomationInput) {
  const status = text(input.record.status);
  if (!status || terminalLeadStatuses.has(status)) return null;

  const isNew = !input.previous;
  const becameHot = Boolean(input.previous)
    && text(input.previous?.priority) !== "Hot"
    && text(input.record.priority) === "Hot";
  if (!isNew && !becameHot) return null;

  const name = text(input.record.full_name);
  if (!name || await hasOpenFollowUp(input, name)) return null;

  const hot = text(input.record.priority) === "Hot";
  const due = parseDate(input.record.next_follow_up_date) ?? nextSlot(hot);
  const title = hot ? `Call hot lead · ${name}` : `First contact · ${name}`;

  await createFollowUp(input, {
    title,
    contactName: name,
    channel: "Call",
    dueAt: due,
    priority: hot ? "High" : "Medium",
    notes: `Auto-created when the lead was ${isNew ? "captured" : "marked hot"}. Stage: ${status}.`,
  });

  return `Follow-up auto-created: ${title}`;
}

async function automatePayment(input: RecordAutomationInput) {
  const status = text(input.record.status);
  const previousStatus = text(input.previous?.status);
  const student = text(input.record.student_name);
  const feeType = text(input.record.fee_type) || "Fee";
  if (!student) return null;

  const title = `Payment reminder · ${student} · ${feeType}`;

  if (status === "Paid") {
    if (previousStatus !== "Paid") {
      await completeFollowUp(input, title);
      return `Fee reminder closed: ${title}`;
    }
    return null;
  }

  if (!outstandingPaymentStatuses.has(status)) return null;

  const due = parseDate(input.record.due_date);
  if (!due) return null;

  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 3);
  horizon.setHours(23, 59, 59, 999);
  if (due.getTime() > horizon.getTime()) return null;
  if (await hasOpenFollowUp(input, student, title)) return null;

  const overdue = due.getTime() < new Date().setHours(0, 0, 0, 0);
  await createFollowUp(input, {
    title,
    contactName: student,
    channel: "Call",
    dueAt: nextSlot(overdue),
    priority: overdue ? "High" : "Medium",
    notes: `Auto-created because the ${feeType.toLowerCase()} is due on ${text(input.record.due_date)}.`,
  });

  return `Fee reminder auto-created: ${title}`;
}

async function automateDocument(input: RecordAutomationInput) {
  const status = text(input.record.verification_status);
  const previousStatus = text(input.previous?.verification_status);
  const student = text(input.record.student_name);
  const documentType = text(input.record.document_type) || "Document";
  if (!student) return null;

  const title = `Verify document · ${student} · ${documentType}`;

  if (status === "Pending" && previousStatus !== "Pending") {
    if (await hasOpenFollowUp(input, student, title)) return null;
    await createFollowUp(input, {
      title,
      contactName: student,
      channel: "WhatsApp",
      dueAt: nextSlot(false),
      priority: "Medium",
      notes: `Auto-created because ${documentType} is pending verification.`,
    });
    return `Verification task auto-created: ${title}`;
  }

  if (previousStatus === "Pending" && status !== "Pending") {
    await completeFollowUp(input, title);
    return `Verification task closed: ${title}`;
  }

  return null;
}

async function automateFollowUp(input: RecordAutomationInput) {
  const status = text(input.record.status);
  const previousStatus = text(input.previous?.status);
  if (status !== "Completed" || previousStatus === "Completed") return null;

  const title = text(input.record.title);
  const contact = text(input.record.contact_name);
  if (!contact) return null;
  if (!title.startsWith("First contact ·") && !title.startsWith("Call hot lead ·")) return null;

  const { data, error } = await input.supabase
    .from("leads")
    .update({ status: "Contacted" })
    .eq("user_id", input.userId)
    .eq("full_name", contact)
    .eq("status", "New")
    .select("id");
  if (error) throw error;

  if (!data || data.length === 0) return null;
  return `Lead stage updated: ${contact} moved to Contacted`;
}

/**
 * Event-driven automation that runs right after a CRM record is created or updated.
 * Returns a short description of the automatic action, if any.
 * Failures are logged and never block the original save response.
 */
export async function runRecordAutomation(input: RecordAutomationInput): Promise<string | null> {
  try {
    if (input.collection === "leads") return await automateLead(input);
    if (input.collection === "payments") return await automatePayment(input);
    if (input.collection === "documents") return await automateDocument(input);
    if (input.collection === "follow-ups") return await automateFollowUp(input);
    return null;
  } catch (error) {
    console.error(`Record automation failed for "${input.collection}".`, error);
    return null;
  }
}

import type { CrmRecord } from "@/lib/crm/config";

export type AutomationRuleId =
  | "hot-lead-follow-up"
  | "new-lead-first-contact"
  | "overdue-payments"
  | "payment-reminder"
  | "document-verification"
  | "application-check-in";

export type AutomationSeverity = "high" | "medium";

export type AutomationRule = {
  id: AutomationRuleId;
  title: string;
  description: string;
  area: "Pipeline" | "Collections" | "Documents" | "Admissions";
  defaultEnabled: boolean;
};

export const automationRules: readonly AutomationRule[] = [
  {
    id: "hot-lead-follow-up",
    title: "Hot lead callback",
    description: "Creates a same-day call task when a hot lead has no open follow-up.",
    area: "Pipeline",
    defaultEnabled: true,
  },
  {
    id: "new-lead-first-contact",
    title: "24-hour first contact",
    description: "Creates a first-contact task for new enquiries that are still untouched after 24 hours.",
    area: "Pipeline",
    defaultEnabled: true,
  },
  {
    id: "overdue-payments",
    title: "Auto-flag overdue fees",
    description: "Moves pending fees past their due date to Overdue automatically.",
    area: "Collections",
    defaultEnabled: true,
  },
  {
    id: "payment-reminder",
    title: "Fee reminder task",
    description: "Creates a reminder for overdue fees and fees due within the next three days.",
    area: "Collections",
    defaultEnabled: true,
  },
  {
    id: "document-verification",
    title: "Pending document check",
    description: "Creates a verification task for documents left pending for more than two days.",
    area: "Documents",
    defaultEnabled: true,
  },
  {
    id: "application-check-in",
    title: "Stalled application check-in",
    description: "Creates a check-in task when an application has not moved for 14 days.",
    area: "Admissions",
    defaultEnabled: true,
  },
];

export const allAutomationRuleIds = automationRules.map((rule) => rule.id);

export type CrmSnapshot = {
  leads: CrmRecord[];
  followUps: CrmRecord[];
  payments: CrmRecord[];
  applications: CrmRecord[];
  documents: CrmRecord[];
};

type BaseAutomationAction = {
  key: string;
  ruleId: AutomationRuleId;
  title: string;
  reason: string;
  severity: AutomationSeverity;
};

export type FollowUpAutomationAction = BaseAutomationAction & {
  kind: "create-follow-up";
  followUp: {
    title: string;
    contactName: string;
    channel: "Call" | "WhatsApp" | "Email" | "Meeting" | "SMS";
    dueAt: string;
    priority: "High" | "Medium" | "Low";
    notes: string;
  };
};

export type PaymentStatusAutomationAction = BaseAutomationAction & {
  kind: "mark-overdue";
  paymentId: string;
  studentName: string;
  feeType: string;
  amount: number;
  dueDate: string;
};

export type AutomationAction = FollowUpAutomationAction | PaymentStatusAutomationAction;

const terminalLeadStatuses = new Set(["Admitted", "Payment complete"]);
const terminalApplicationStatuses = new Set(["Admitted", "Rejected"]);
const outstandingPaymentStatuses = new Set(["Pending", "Partially paid"]);

function toText(value: unknown) {
  return String(value ?? "").trim();
}

function toAmount(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function daysAgo(value: unknown, now: Date) {
  const parsed = new Date(toText(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return (startOfDay(now).getTime() - startOfDay(parsed).getTime()) / 86_400_000;
}

function nextDueSlot(now: Date, severity: AutomationSeverity) {
  const endOfDay = new Date(now);
  endOfDay.setHours(17, 0, 0, 0);
  if (severity === "high" && now.getTime() < endOfDay.getTime()) {
    return endOfDay.toISOString();
  }
  const tomorrow = addDays(now, 1);
  tomorrow.setHours(10, 0, 0, 0);
  return tomorrow.toISOString();
}

function isOpenFollowUp(record: CrmRecord) {
  return ["Open", "Snoozed"].includes(toText(record.status));
}

function hasOpenFollowUp(followUps: CrmRecord[], contactName: string, title?: string) {
  const contact = contactName.toLowerCase();
  return followUps.some((record) =>
    isOpenFollowUp(record)
    && toText(record.contact_name).toLowerCase() === contact
    && (!title || toText(record.title).toLowerCase() === title.toLowerCase())
  );
}

function hasOpenFollowUpForTitle(followUps: CrmRecord[], title: string) {
  const expected = title.toLowerCase();
  return followUps.some((record) => isOpenFollowUp(record) && toText(record.title).toLowerCase() === expected);
}

function nearDueDate(value: unknown, now: Date, days: number) {
  const due = toText(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return false;
  return due <= localDateKey(addDays(now, days));
}

function pastDueDate(value: unknown, now: Date) {
  const due = toText(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return false;
  return due < localDateKey(now);
}

/**
 * Builds a review-only plan of the actions the automation rules would take.
 * Nothing is written until the plan is applied (see app/api/automation/route.ts).
 */
export function planAutomations(
  snapshot: CrmSnapshot,
  enabledRuleIds: readonly AutomationRuleId[],
  now: Date = new Date(),
): AutomationAction[] {
  const enabled = new Set(enabledRuleIds);
  const actions: AutomationAction[] = [];
  const leadAlreadyPlanned = new Set<string>();

  if (enabled.has("hot-lead-follow-up") || enabled.has("new-lead-first-contact")) {
    for (const lead of snapshot.leads) {
      const name = toText(lead.full_name);
      const status = toText(lead.status);
      if (!name || terminalLeadStatuses.has(status)) continue;
      if (hasOpenFollowUp(snapshot.followUps, name)) continue;

      const isHot = toText(lead.priority) === "Hot";
      const hotDue = toText(lead.next_follow_up_date).slice(0, 10);
      const hotNeedsCall = isHot && (!hotDue || hotDue <= localDateKey(now));
      const ageInDays = daysAgo(lead.created_at, now);
      const newNeedsCall = status === "New" && ageInDays !== null && ageInDays >= 1;

      if (enabled.has("hot-lead-follow-up") && hotNeedsCall && !leadAlreadyPlanned.has(String(lead.id))) {
        leadAlreadyPlanned.add(String(lead.id));
        const title = `Call hot lead · ${name}`;
        actions.push({
          key: `hot-lead-follow-up:${String(lead.id)}`,
          ruleId: "hot-lead-follow-up",
          kind: "create-follow-up",
          title,
          reason: `${name} is a hot lead at stage "${status}" with no open follow-up.`,
          severity: "high",
          followUp: {
            title,
            contactName: name,
            channel: "Call",
            dueAt: nextDueSlot(now, "high"),
            priority: "High",
            notes: `Automation: hot lead callback. Stage: ${status}. Source: ${toText(lead.source) || "unknown"}.`,
          },
        });
      }

      if (enabled.has("new-lead-first-contact") && newNeedsCall && !leadAlreadyPlanned.has(String(lead.id))) {
        leadAlreadyPlanned.add(String(lead.id));
        const title = `First contact · ${name}`;
        actions.push({
          key: `new-lead-first-contact:${String(lead.id)}`,
          ruleId: "new-lead-first-contact",
          kind: "create-follow-up",
          title,
          reason: `${name} is still at stage "New" after ${Math.floor(ageInDays ?? 0)} day(s) without contact.`,
          severity: "medium",
          followUp: {
            title,
            contactName: name,
            channel: "Call",
            dueAt: nextDueSlot(now, "medium"),
            priority: "Medium",
            notes: `Automation: 24-hour first contact. Lead source: ${toText(lead.source) || "unknown"}.`,
          },
        });
      }
    }
  }

  if (enabled.has("overdue-payments")) {
    for (const payment of snapshot.payments) {
      const status = toText(payment.status);
      if (!outstandingPaymentStatuses.has(status) || !pastDueDate(payment.due_date, now)) continue;
      const student = toText(payment.student_name);
      actions.push({
        key: `overdue-payments:${String(payment.id)}`,
        ruleId: "overdue-payments",
        kind: "mark-overdue",
        title: `Mark ${student || "student"} fee overdue`,
        reason: `${toText(payment.fee_type) || "Fee"} of ₹${toAmount(payment.amount).toLocaleString("en-IN")} was due on ${toText(payment.due_date)}.`,
        severity: "high",
        paymentId: String(payment.id),
        studentName: student,
        feeType: toText(payment.fee_type),
        amount: toAmount(payment.amount),
        dueDate: toText(payment.due_date),
      });
    }
  }

  if (enabled.has("payment-reminder")) {
    for (const payment of snapshot.payments) {
      const status = toText(payment.status);
      if (!["Pending", "Partially paid", "Overdue"].includes(status)) continue;
      if (!nearDueDate(payment.due_date, now, 3)) continue;

      const student = toText(payment.student_name);
      const feeType = toText(payment.fee_type) || "Fee";
      const title = `Payment reminder · ${student} · ${feeType}`;
      if (!student || hasOpenFollowUpForTitle(snapshot.followUps, title)) continue;

      actions.push({
        key: `payment-reminder:${String(payment.id)}`,
        ruleId: "payment-reminder",
        kind: "create-follow-up",
        title,
        reason: `${student}'s ${feeType.toLowerCase()} of ₹${toAmount(payment.amount).toLocaleString("en-IN")} is due on ${toText(payment.due_date)}.`,
        severity: status === "Overdue" ? "high" : "medium",
        followUp: {
          title,
          contactName: student,
          channel: "Call",
          dueAt: nextDueSlot(now, status === "Overdue" ? "high" : "medium"),
          priority: status === "Overdue" ? "High" : "Medium",
          notes: `Automation: fee reminder. Amount: ₹${toAmount(payment.amount).toLocaleString("en-IN")}. Due: ${toText(payment.due_date)}. Status: ${status}.`,
        },
      });
    }
  }

  if (enabled.has("document-verification")) {
    for (const document of snapshot.documents) {
      if (toText(document.verification_status) !== "Pending") continue;
      const ageInDays = daysAgo(document.created_at, now);
      if (ageInDays === null || ageInDays < 2) continue;

      const student = toText(document.student_name);
      const documentType = toText(document.document_type) || "Document";
      const title = `Verify document · ${student} · ${documentType}`;
      if (!student || hasOpenFollowUpForTitle(snapshot.followUps, title)) continue;

      actions.push({
        key: `document-verification:${String(document.id)}`,
        ruleId: "document-verification",
        kind: "create-follow-up",
        title,
        reason: `${student}'s ${documentType.toLowerCase()} has been pending verification for ${Math.floor(ageInDays)} day(s).`,
        severity: "medium",
        followUp: {
          title,
          contactName: student,
          channel: "WhatsApp",
          dueAt: nextDueSlot(now, "medium"),
          priority: "Medium",
          notes: `Automation: document verification. File: ${toText(document.file_name) || "not uploaded"}.`,
        },
      });
    }
  }

  if (enabled.has("application-check-in")) {
    for (const application of snapshot.applications) {
      const status = toText(application.status);
      if (terminalApplicationStatuses.has(status)) continue;
      const ageInDays = daysAgo(application.last_updated, now);
      if (ageInDays === null || ageInDays < 14) continue;

      const student = toText(application.student_name);
      const title = `Application check-in · ${student}`;
      if (!student || hasOpenFollowUpForTitle(snapshot.followUps, title)) continue;

      actions.push({
        key: `application-check-in:${String(application.id)}`,
        ruleId: "application-check-in",
        kind: "create-follow-up",
        title,
        reason: `${student}'s application at "${status}" has not moved for ${Math.floor(ageInDays)} day(s).`,
        severity: "medium",
        followUp: {
          title,
          contactName: student,
          channel: "Call",
          dueAt: nextDueSlot(now, "medium"),
          priority: "Medium",
          notes: `Automation: stalled application. College: ${toText(application.college_name) || "unknown"}. Stage: ${status}.`,
        },
      });
    }
  }

  return actions.sort((left, right) => {
    if (left.severity !== right.severity) return left.severity === "high" ? -1 : 1;
    return left.title.localeCompare(right.title);
  });
}

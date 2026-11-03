import { getDemoRecords } from "@/lib/crm/demo-data";
import type { CrmRecord } from "@/lib/crm/config";
import type { AutomationAction } from "@/lib/crm/automation";

export type AutomationApplyResult = {
  created: number;
  updated: number;
  skipped: number;
};

function storageKey(collection: string) {
  return `nexora-crm-demo-${collection}`;
}

function readCollection(collection: "follow-ups" | "payments"): CrmRecord[] {
  const stored = window.localStorage.getItem(storageKey(collection));
  if (stored === null) {
    const initial = getDemoRecords(collection);
    window.localStorage.setItem(storageKey(collection), JSON.stringify(initial));
    return initial;
  }

  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed)) throw new Error(`Saved demo ${collection} data is invalid.`);
  return parsed as CrmRecord[];
}

/**
 * Applies the automation plan to the browser-only demo workspace.
 * Follow-ups and payments are written in one pass so a batch never overwrites itself.
 */
export function applyDemoAutomationActions(actions: AutomationAction[]): AutomationApplyResult {
  const result: AutomationApplyResult = { created: 0, updated: 0, skipped: 0 };
  if (actions.length === 0 || typeof window === "undefined") return result;

  const followUps = readCollection("follow-ups");
  const payments = readCollection("payments");
  const now = new Date().toISOString();

  for (const action of actions) {
    if (action.kind === "mark-overdue") {
      const index = payments.findIndex((payment) => payment.id === action.paymentId);
      if (index === -1) {
        result.skipped += 1;
        continue;
      }
      payments[index] = { ...payments[index], status: "Overdue", updated_at: now };
      result.updated += 1;
      continue;
    }

    const title = action.followUp.title.toLowerCase();
    const duplicate = followUps.some((followUp) =>
      ["Open", "Snoozed"].includes(String(followUp.status))
      && String(followUp.title ?? "").trim().toLowerCase() === title
    );
    if (duplicate) {
      result.skipped += 1;
      continue;
    }

    followUps.unshift({
      id: `demo-follow-up-${crypto.randomUUID()}`,
      title: action.followUp.title,
      contact_name: action.followUp.contactName,
      channel: action.followUp.channel,
      due_at: action.followUp.dueAt,
      priority: action.followUp.priority,
      status: "Open",
      notes: action.followUp.notes,
      created_at: now,
    });
    result.created += 1;
  }

  if (result.created > 0) {
    window.localStorage.setItem(storageKey("follow-ups"), JSON.stringify(followUps));
  }
  if (result.updated > 0) {
    window.localStorage.setItem(storageKey("payments"), JSON.stringify(payments));
  }

  return result;
}

/**
 * Role-based access control definitions for the CRM.
 *
 * Roles:
 *  - super_admin  → full access to every module, can manage admin users & assign module permissions
 *  - admin        → access only to explicitly assigned modules
 */

export type UserRole = "super_admin" | "admin";

/** Every sidebar-accessible section in the CRM. */
export const ALL_MODULES = [
  "dashboard",
  "leads",
  "pipeline",
  "students",
  "follow-ups",
  "colleges",
  "applications",
  "documents",
  "payments",
  "activities",
  "reports",
  "settings",
] as const;

export type ModuleKey = (typeof ALL_MODULES)[number];

export type ModuleInfo = {
  key: ModuleKey;
  label: string;
  description: string;
  category: string;
};

/** Human-readable labels and descriptions for each module. */
export const MODULE_CATALOG: Record<ModuleKey, ModuleInfo> = {
  dashboard: {
    key: "dashboard",
    label: "Dashboard",
    description: "Executive admissions KPIs, daily stats & metrics",
    category: "Workspace",
  },
  leads: {
    key: "leads",
    label: "Leads",
    description: "Capture enquiries & prioritise high-intent students",
    category: "Student CRM",
  },
  pipeline: {
    key: "pipeline",
    label: "Pipeline",
    description: "Visual Kanban stages from Enquiry to Enrolment",
    category: "Student CRM",
  },
  students: {
    key: "students",
    label: "Students",
    description: "Student 360° profiles, NEET scores & preferences",
    category: "Student CRM",
  },
  "follow-ups": {
    key: "follow-ups",
    label: "Follow-ups",
    description: "Counsellor reminders, calls & WhatsApp follow-ups",
    category: "Student CRM",
  },
  colleges: {
    key: "colleges",
    label: "Colleges",
    description: "Institutions, courses, seats, fees & eligibility",
    category: "Admissions",
  },
  applications: {
    key: "applications",
    label: "Applications",
    description: "Application tracking, offer letters & visa stages",
    category: "Admissions",
  },
  documents: {
    key: "documents",
    label: "Documents",
    description: "Student document checklists & verification",
    category: "Admissions",
  },
  payments: {
    key: "payments",
    label: "Payments",
    description: "Application fees, receipts & payment reconciliation",
    category: "Admissions",
  },
  activities: {
    key: "activities",
    label: "Activities",
    description: "Team activity logs, calls & counselling timeline",
    category: "Insights",
  },
  reports: {
    key: "reports",
    label: "Reports",
    description: "Conversion metrics, counselor output & intake insights",
    category: "Insights",
  },
  settings: {
    key: "settings",
    label: "Settings",
    description: "Workspace preferences & system configuration",
    category: "System",
  },
};

export const MODULE_LABELS: Record<ModuleKey, string> = Object.fromEntries(
  Object.entries(MODULE_CATALOG).map(([k, v]) => [k, v.label]),
) as Record<ModuleKey, string>;

/** Module groups that match the sidebar sections. */
export const MODULE_GROUPS: { label: string; modules: ModuleKey[] }[] = [
  { label: "Workspace", modules: ["dashboard"] },
  { label: "Student CRM", modules: ["leads", "pipeline", "students", "follow-ups"] },
  { label: "Admissions", modules: ["colleges", "applications", "documents", "payments"] },
  { label: "Insights", modules: ["activities", "reports"] },
  { label: "System", modules: ["settings"] },
];

export function isSuperAdmin(role?: string | null): boolean {
  return role === "super_admin";
}

export function isAdmin(role?: string | null): boolean {
  return role === "admin";
}

export function isValidRole(role: unknown): role is UserRole {
  return role === "super_admin" || role === "admin";
}

/**
 * Get the modules a user can access based on their role and assigned modules.
 * Super admin always gets all modules.
 * Admin gets only explicitly assigned modules (plus dashboard by default so they have a landing screen).
 */
export function getAccessibleModules(
  role: UserRole | null | undefined,
  assignedModules?: string[],
): ModuleKey[] {
  if (isSuperAdmin(role)) return [...ALL_MODULES];
  if (!assignedModules || assignedModules.length === 0) return ["dashboard"];

  const modules = new Set<ModuleKey>(["dashboard"]);
  for (const mod of assignedModules) {
    if (ALL_MODULES.includes(mod as ModuleKey)) {
      modules.add(mod as ModuleKey);
    }
  }
  return [...modules];
}

/** Maps a nav href (e.g. "/leads") to a module key. */
export function hrefToModuleKey(href: string): ModuleKey | null {
  const segment = href.replace(/^\//, "").split("/")[0];
  if (!segment) return null;
  if (ALL_MODULES.includes(segment as ModuleKey)) return segment as ModuleKey;
  return null;
}

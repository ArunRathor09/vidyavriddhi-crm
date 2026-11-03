import {
  LayoutDashboard,
  GraduationCap,
  FileText,
  CreditCard,
  BellRing,
  FileStack,
  Landmark,
  Target,
  TrendingUp,
  Workflow,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { ModuleKey } from "@/lib/auth/roles";

export type NavItem = { title: string; href: string; icon: LucideIcon; moduleKey: ModuleKey };
export type NavGroup = { label: string; items: NavItem[] };

export const navGroups: NavGroup[] = [
  {
    label: "Workspace",
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, moduleKey: "dashboard" }],
  },
  {
    label: "Student CRM",
    items: [
      { title: "Leads", href: "/leads", icon: Target, moduleKey: "leads" },
      { title: "Pipeline", href: "/pipeline", icon: Workflow, moduleKey: "pipeline" },
      { title: "Students", href: "/students", icon: GraduationCap, moduleKey: "students" },
      { title: "Follow-ups", href: "/follow-ups", icon: BellRing, moduleKey: "follow-ups" },
    ],
  },
  {
    label: "Admissions",
    items: [
      { title: "Colleges", href: "/colleges", icon: Landmark, moduleKey: "colleges" },
      { title: "Applications", href: "/applications", icon: FileText, moduleKey: "applications" },
      { title: "Documents", href: "/documents", icon: FileStack, moduleKey: "documents" },
      { title: "Payments", href: "/payments", icon: CreditCard, moduleKey: "payments" },
    ],
  },
  {
    label: "Insights",
    items: [
      { title: "Activities", href: "/activities", icon: BellRing, moduleKey: "activities" },
      { title: "Reports", href: "/reports", icon: TrendingUp, moduleKey: "reports" },
    ],
  },
  {
    label: "System",
    items: [{ title: "Settings", href: "/settings", icon: Settings, moduleKey: "settings" }],
  },
];
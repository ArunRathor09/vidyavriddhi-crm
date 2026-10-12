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
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { title: string; href: string; icon: LucideIcon };
export type NavGroup = { label: string; items: NavItem[] };

export const navGroups: NavGroup[] = [
  {
    label: "Workspace",
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Student CRM",
    items: [
      { title: "Leads", href: "/leads", icon: Target },
      { title: "Students", href: "/students", icon: GraduationCap },
      { title: "Follow-ups", href: "/follow-ups", icon: BellRing },
    ],
  },
  {
    label: "Admissions",
    items: [
      { title: "Colleges", href: "/colleges", icon: Landmark },
      { title: "Applications", href: "/applications", icon: FileText },
      { title: "Documents", href: "/documents", icon: FileStack },
      { title: "Payments", href: "/payments", icon: CreditCard },
    ],
  },
  {
    label: "Insights",
    items: [
      { title: "Activities", href: "/activities", icon: BellRing },
      { title: "Reports", href: "/reports", icon: TrendingUp },
    ],
  },
  {
    label: "System",
    items: [{ title: "Settings", href: "/settings", icon: Settings }],
  },
];
import type { Metadata } from "next";
import { UserManagementView } from "@/components/dashboard/user-management";

export const metadata: Metadata = {
  title: "User Management & Role Permissions",
  description: "Create admins and configure role-based access to CRM modules.",
};

export default function UserManagementPage() {
  return <UserManagementView />;
}

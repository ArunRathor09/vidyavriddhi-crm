"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { hrefToModuleKey, type ModuleKey } from "@/lib/auth/roles";
import { AccessDenied } from "@/components/dashboard/access-denied";
import { Loader2 } from "lucide-react";

export function DashboardRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, canAccess, isSuperAdmin } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
          <span className="text-xs font-medium">Verifying permissions...</span>
        </div>
      </div>
    );
  }

  // User management is strictly Super Admin only
  if (pathname === "/user-management" || pathname.startsWith("/user-management/")) {
    if (!isSuperAdmin) {
      return <AccessDenied />;
    }
    return <>{children}</>;
  }

  // Check module permissions for standard CRM routes
  const moduleKey = hrefToModuleKey(pathname);

  // If this route corresponds to a CRM module and user cannot access it
  if (moduleKey && moduleKey !== "dashboard" && !canAccess(moduleKey)) {
    return <AccessDenied moduleKey={moduleKey} />;
  }

  return <>{children}</>;
}

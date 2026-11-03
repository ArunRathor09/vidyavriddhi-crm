"use client";

import Link from "next/link";
import { ShieldAlert, Crown, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";
import { MODULE_CATALOG, type ModuleKey } from "@/lib/auth/roles";

export function AccessDenied({ moduleKey }: { moduleKey?: ModuleKey }) {
  const { user, isSuperAdmin } = useAuth();
  const moduleInfo = moduleKey ? MODULE_CATALOG[moduleKey] : null;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-200">
      <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 text-amber-600 shadow-sm">
        <ShieldAlert className="h-10 w-10" />
        <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow">
          !
        </span>
      </div>

      <div className="max-w-md space-y-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-800">
          Role-Based Access Control
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Access Restricted
        </h1>
        <p className="text-sm leading-relaxed text-slate-600">
          You do not have permission to view the{" "}
          <strong className="text-slate-900">{moduleInfo?.label ?? "requested"}</strong> module.
          Your admin account ({user?.email}) only has access to tasks and modules explicitly assigned to you.
        </p>

        {user && user.allowedModules.length > 0 && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-left text-xs">
            <p className="font-semibold text-slate-700">Your assigned modules:</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {user.allowedModules.map((m) => (
                <Link
                  key={m}
                  href={`/${m}`}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-2xs hover:border-teal-300 hover:text-teal-700"
                >
                  {MODULE_CATALOG[m]?.label ?? m}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button asChild variant="default" className="gap-2 rounded-xl">
            <Link href="/dashboard">
              <LayoutDashboard className="h-4 w-4" />
              Go to Dashboard
            </Link>
          </Button>
          {isSuperAdmin && (
            <Button asChild variant="outline" className="gap-2 rounded-xl border-amber-200 text-amber-800 hover:bg-amber-50">
              <Link href="/user-management">
                <Crown className="h-4 w-4" />
                Manage User Permissions
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

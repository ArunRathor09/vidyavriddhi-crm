import { notFound } from "next/navigation";
import { ModuleWorkspace } from "@/components/dashboard/module-workspace";
import { ReportsWorkspace } from "@/components/dashboard/reports-workspace";
import { SettingsWorkspace } from "@/components/dashboard/settings-workspace";
import { isCrmCollection } from "@/lib/crm/config";

export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ search?: string }>;
}) {
  const [{ section }, { search }] = await Promise.all([params, searchParams]);

  if (section === "reports") return <ReportsWorkspace />;
  if (section === "settings") return <SettingsWorkspace />;
  if (!isCrmCollection(section)) notFound();

  return <ModuleWorkspace key={`${section}:${search ?? ""}`} collection={section} initialSearch={search ?? ""} />;
}

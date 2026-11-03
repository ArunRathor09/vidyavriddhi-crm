import { notFound } from "next/navigation";
import { ModuleWorkspace } from "@/components/dashboard/module-workspace";
import { PipelineWorkspace } from "@/components/dashboard/pipeline-workspace";
import { ReportsWorkspace } from "@/components/dashboard/reports-workspace";
import { SettingsWorkspace } from "@/components/dashboard/settings-workspace";
import { isCrmCollection } from "@/lib/crm/config";

export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ search?: string; status?: string; facet_priority?: string; facet_source?: string }>;
}) {
  const [{ section }, { search, status, facet_priority, facet_source }] = await Promise.all([params, searchParams]);

  if (section === "reports") return <ReportsWorkspace />;
  if (section === "settings") return <SettingsWorkspace />;
  if (section === "pipeline") return <PipelineWorkspace />;
  if (!isCrmCollection(section)) notFound();

  const initialFacets = Object.fromEntries(
    Object.entries({ priority: facet_priority, source: facet_source })
      .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0),
  );
  return (
    <ModuleWorkspace
      key={`${section}:${search ?? ""}:${status ?? ""}:${facet_priority ?? ""}:${facet_source ?? ""}`}
      collection={section}
      initialSearch={search ?? ""}
      initialStatus={status}
      initialFacets={initialFacets}
    />
  );
}

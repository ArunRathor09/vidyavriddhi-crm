"use client";

import Link from "next/link";
import { ArrowRight, CircleAlert, FileCheck2, GraduationCap, LoaderCircle, RotateCw } from "lucide-react";
import type { DataMode } from "@/hooks/use-crm-collection";
import type { CrmRecord } from "@/lib/crm/config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const applicationStages = [
  "Registration",
  "Document verification",
  "University application",
  "Offer letter",
  "Visa",
  "Admitted",
];

function stageIndex(status: string) {
  if (status === "Rejected") return -1;
  return applicationStages.indexOf(status);
}

function updatedLabel(record: CrmRecord) {
  const value = record.last_updated ?? record.created_at;
  if (typeof value !== "string") return "Update date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Update date unavailable";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(date);
}

function stageClass(status: string) {
  if (status === "Admitted") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "Rejected") return "border-rose-200 bg-rose-50 text-rose-800";
  if (status === "Document verification" || status === "Visa") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  return "border-sky-200 bg-sky-50 text-sky-800";
}

export function RecentApplications({
  records,
  mode,
  error,
  reload,
}: {
  records: CrmRecord[];
  mode: DataMode;
  error: string | null;
  reload: () => Promise<void>;
}) {
  const recentApplications = [...records]
    .sort((left, right) => {
      const leftDate = String(left.last_updated ?? left.created_at ?? "");
      const rightDate = String(right.last_updated ?? right.created_at ?? "");
      return rightDate.localeCompare(leftDate);
    })
    .slice(0, 4);
  const reviewCount = records.filter((record) =>
    ["Document verification", "Visa"].includes(String(record.status)),
  ).length;

  return (
    <Card className="min-w-0 overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 border-b border-slate-100 bg-gradient-to-r from-white to-sky-50/50 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-800">
              <GraduationCap className="h-4 w-4" />
            </span>
            Application progress
          </CardTitle>
          <p className="mt-1.5 text-xs text-muted-foreground">Latest student admission journeys</p>
        </div>
        <Button variant="ghost" size="sm" asChild className="h-8 px-2 text-xs">
          <Link href="/applications">View all<ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-1 p-3 sm:p-4">
        {mode === "loading" ? (
          <div className="flex min-h-40 items-center justify-center gap-2 text-xs text-muted-foreground" role="status">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Loading applications…
          </div>
        ) : error ? (
          <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-rose-100 bg-rose-50/50 px-4 text-center">
            <CircleAlert className="mb-2 h-5 w-5 text-rose-600" />
            <p className="text-xs font-medium text-slate-800">Applications could not be loaded</p>
            <p className="mt-1 line-clamp-2 text-[11px] text-slate-600">{error}</p>
            <Button variant="outline" size="sm" className="mt-3 h-8" onClick={() => void reload()}>
              <RotateCw className="mr-1.5 h-3.5 w-3.5" />Try again
            </Button>
          </div>
        ) : recentApplications.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 text-center">
            <FileCheck2 className="mb-2 h-5 w-5 text-slate-400" />
            <p className="text-xs font-medium text-slate-800">No applications to track yet</p>
            <p className="mt-1 text-[11px] text-slate-500">Create an application to follow a student through admission.</p>
            <Button variant="outline" size="sm" asChild className="mt-3 h-8">
              <Link href="/applications">Open applications</Link>
            </Button>
          </div>
        ) : (
          <>
            {recentApplications.map((application) => {
              const status = String(application.status ?? "Registration");
              const currentStage = stageIndex(status);
              const needsReview = ["Document verification", "Visa"].includes(status);
              return (
                <Link
                  key={application.id}
                  href="/applications"
                  className="group block rounded-xl border border-transparent px-2.5 py-3 transition hover:border-slate-200 hover:bg-slate-50/80"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-900">{String(application.student_name ?? "Unnamed student")}</p>
                      <p className="mt-1 truncate text-[11px] text-slate-500">
                        {String(application.college_name ?? "College not assigned")}
                        {application.course ? ` · ${String(application.course)}` : ""}
                      </p>
                    </div>
                    <Badge variant="outline" className={`h-5 max-w-36 truncate px-2 text-[9px] ${stageClass(status)}`}>
                      {status}
                    </Badge>
                   </div>
                  <div className="mt-3 flex items-center gap-1" aria-label={`Application stage: ${status}`}>
                    {applicationStages.map((stage, index) => (
                      <span
                        key={stage}
                        className={`h-1 flex-1 rounded-full ${
                          currentStage >= 0 && index <= currentStage
                            ? "bg-[#087b83]"
                            : status === "Rejected" && index === 0
                              ? "bg-rose-300"
                              : "bg-slate-100"
                        }`}
                      />
                    ))}
                    <span className="sr-only">{status}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[10px]">
                    <span className={`inline-flex items-center gap-1 ${needsReview ? "font-medium text-amber-700" : "text-slate-500"}`}>
                      {needsReview ? <CircleAlert className="h-3 w-3" /> : null}
                      {needsReview ? "Review stage" : "Last updated"}
                    </span>
                    <span className="shrink-0 text-slate-500">{updatedLabel(application)}</span>
                  </div>
                </Link>
              );
            })}
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 px-2.5 pt-3 text-[10px]">
              <span className="text-slate-500">{mode === "demo" ? "Sample workspace" : "Latest loaded records"}</span>
              <span className="font-medium text-slate-700">
                {reviewCount > 0 ? `${reviewCount} in review stages` : "No review-stage applications"}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

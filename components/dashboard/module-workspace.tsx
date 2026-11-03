"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowUpRight,
  CircleAlert,
  Database,
  FileText,
  Filter,
  LoaderCircle,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { crmModules, type CrmCollection, type CrmField, type CrmRecord } from "@/lib/crm/config";
import { useCrmCollection } from "@/hooks/use-crm-collection";
import { downloadCsv, parseCsv } from "@/lib/csv";
import { createClient } from "@/lib/supabase/client";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const noFacets: readonly { key: string; label: string }[] = [];

function displayValue(value: unknown, type?: string) {
  if (value === null || value === undefined || value === "") return "—";
  if (type === "currency") {
    const amount = Number(value);
    if (Number.isFinite(amount)) return currency.format(amount);
  }
  if (type === "date" || type === "datetime") {
    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) return "—";
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      ...(type === "datetime" ? { timeStyle: "short" as const } : {}),
    }).format(parsed);
  }
  return String(value);
}

function initials(value: unknown) {
  return String(value ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function statusClass(value: unknown) {
  const status = String(value ?? "").toLowerCase();
  if (["paid", "completed", "verified", "admitted", "payment complete", "offer letter"].includes(status)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (["overdue", "needs correction", "rejected", "hot"].includes(status)) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (["new", "open", "pending", "registration", "document verification"].includes(status)) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function ModuleWorkspace({
  collection,
  initialSearch = "",
  initialStatus = "",
  initialFacets = {},
}: {
  collection: CrmCollection;
  initialSearch?: string;
  initialStatus?: string;
  initialFacets?: Record<string, string>;
}) {
  const moduleConfig = crmModules[collection];
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const statusField = moduleConfig.fields.find((field) => field.key === "status" || field.key === "verification_status");
  const statuses: string[] = statusField?.options ? [...statusField.options] : [];
  const [statusFilter, setStatusFilter] = useState(statuses.includes(initialStatus) ? initialStatus : "All records");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<{ filename: string; records: Record<string, unknown>[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [editing, setEditing] = useState<CrmRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedFacets, setSelectedFacets] = useState<Record<string, string>>(initialFacets);
  const router = useRouter();
  const facets = "facets" in moduleConfig ? moduleConfig.facets : noFacets;
  const queryFacets = useMemo(() => Object.fromEntries(
    Object.entries(selectedFacets).filter(([, value]) => !value.startsWith("All ")),
  ), [selectedFacets]);
  const queryStatus = statusFilter === "All records" ? undefined : statusFilter;
  const { records, mode, error, errorCode, reload, loadMore, hasMore, loadingMore, importRecords, save, remove } = useCrmCollection(collection, {
    search: debouncedSearch.trim(),
    status: queryStatus,
    facets: queryFacets,
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const filteredRecords = useMemo(() => records.filter((record) => {
    const matchesSearch = moduleConfig.searchKeys.some((key) =>
      String(record[key] ?? "").toLowerCase().includes(search.trim().toLowerCase()),
    );
    const recordStatus = String(record.status ?? record.verification_status ?? "");
    const matchesFacets = facets.every((facet) => {
      const selected = selectedFacets[facet.key];
      return !selected || selected === `All ${facet.label.toLowerCase()}` || String(record[facet.key] ?? "") === selected;
    });
    return matchesSearch && matchesFacets && (statusFilter === "All records" || recordStatus === statusFilter);
  }), [facets, moduleConfig.searchKeys, records, search, selectedFacets, statusFilter]);
  const visibleRecords = filteredRecords;
  const selectedVisibleRecords = visibleRecords.filter((record) => selectedIds.has(record.id));
  const allVisibleSelected = visibleRecords.length > 0 && selectedVisibleRecords.length === visibleRecords.length;

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(record: CrmRecord) {
    setEditing(record);
    setDialogOpen(true);
  }

  async function downloadDocument(record: CrmRecord) {
    const path = record.file_path;
    if (typeof path !== "string" || !path) {
      toast.info("This demo document has no uploaded file. Connect Supabase Storage to preview files.");
      return;
    }
    const previewWindow = window.open("about:blank", "_blank");
    if (!previewWindow) {
      toast.error("Allow pop-ups to preview this document.");
      return;
    }
    try {
      const { data, error: storageError } = await createClient()
        .storage
        .from("student-documents")
        .createSignedUrl(path, 60);
      if (storageError) throw storageError;
      previewWindow.opener = null;
      previewWindow.location.replace(data.signedUrl);
    } catch (downloadError) {
      previewWindow.close();
      toast.error(downloadError instanceof Error ? downloadError.message : "Could not open this document.");
    }
  }

  async function deleteRecord(record: CrmRecord) {
    if (!window.confirm(`Delete this ${moduleConfig.singular}? This cannot be undone.`)) return;
    const deleted = await remove(record.id);
    if (!deleted || collection !== "documents" || typeof record.file_path !== "string" || !record.file_path) return;

    const { error: storageError } = await createClient()
      .storage
      .from("student-documents")
      .remove([record.file_path]);
    if (storageError) {
      console.error("Document record was deleted but its stored file could not be removed.", storageError);
      toast.error("The record was deleted, but its file could not be removed from Supabase Storage.");
    }
  }

  async function sendWhatsAppTemplate(record: CrmRecord) {
    if (record.whatsapp_opt_in !== true) {
      toast.error("Record explicit student consent before sending a WhatsApp message.");
      return;
    }
    if (!window.confirm(`Send the configured WhatsApp template to ${String(record.full_name ?? "this lead")}?`)) return;

    try {
      const response = await fetch("/api/integrations/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: record.id, requestId: crypto.randomUUID() }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "WhatsApp could not accept this message.";
        throw new Error(message);
      }
      toast.success("WhatsApp template accepted by the provider.");
    } catch (sendError) {
      toast.error(sendError instanceof Error ? sendError.message : "WhatsApp could not accept this message.");
    }
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const values: Record<string, unknown> = {};
    for (const field of moduleConfig.fields) {
      if (field.type === "file") continue;
      if (field.type === "checkbox") {
        values[field.key] = formData.get(field.key) === "on";
        continue;
      }
      const value = String(formData.get(field.key) ?? "").trim();
      if (value === "") continue;
      if (field.type === "number") values[field.key] = Number(value);
      else if (field.type === "datetime-local") values[field.key] = new Date(value).toISOString();
      else values[field.key] = value;
    }

    let uploadedPath: string | undefined;
    if (collection === "documents") {
      const fileEntry = formData.get("document_file");
      if (fileEntry instanceof File && fileEntry.size > 0) {
        if (fileEntry.size > 10 * 1024 * 1024) {
          toast.error("Choose a document smaller than 10 MB.");
          setSubmitting(false);
          return;
        }
        if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(fileEntry.type)) {
          toast.error("Supported document formats are PDF, JPEG, PNG, and WebP.");
          setSubmitting(false);
          return;
        }
        if (mode === "supabase") {
          try {
            const client = createClient();
            const { data: { user }, error: userError } = await client.auth.getUser();
            if (userError || !user) throw userError ?? new Error("Sign in before uploading student documents.");
            const workspaceResponse = await fetch("/api/workspaces", { cache: "no-store" });
            const workspacePayload: unknown = await workspaceResponse.json();
            if (
              !workspaceResponse.ok
              || typeof workspacePayload !== "object"
              || workspacePayload === null
              || !("active" in workspacePayload)
              || typeof workspacePayload.active !== "object"
              || workspacePayload.active === null
              || !("id" in workspacePayload.active)
              || typeof workspacePayload.active.id !== "string"
            ) {
              throw new Error("Could not resolve the active organization for document upload.");
            }
            uploadedPath = `${workspacePayload.active.id}/${user.id}/${crypto.randomUUID()}-${fileEntry.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
            const { error: uploadError } = await client.storage
              .from("student-documents")
              .upload(uploadedPath, fileEntry, { contentType: fileEntry.type, upsert: false });
            if (uploadError) throw uploadError;
            values.file_name = fileEntry.name;
            values.file_path = uploadedPath;
          } catch (uploadError) {
            toast.error(uploadError instanceof Error ? uploadError.message : "Could not upload this document.");
            setSubmitting(false);
            return;
          }
        } else {
          values.file_name = fileEntry.name;
          values.file_path = null;
        }
      } else if (editing) {
        values.file_name = editing.file_name;
        values.file_path = editing.file_path;
      } else {
        toast.error("Choose a file to upload for this student.");
        setSubmitting(false);
        return;
      }
    }

    const saved = await save(values, editing?.id);
    if (!saved && uploadedPath) {
      const { error: cleanupError } = await createClient()
        .storage
        .from("student-documents")
        .remove([uploadedPath]);
      if (cleanupError) {
        console.error("Could not remove an orphaned student document after its record failed to save.", cleanupError);
        toast.error("The record failed to save and the uploaded file could not be removed. Check Supabase Storage.");
      }
    }
    if (saved) {
      setDialogOpen(false);
      setEditing(null);
      form.reset();
    }
    setSubmitting(false);
  }

  function exportCsv() {
    const headings = moduleConfig.columns.map((column) => column.label);
    const rows = filteredRecords.map((record) => moduleConfig.columns.map((column) => record[column.key] ?? ""));
    downloadCsv(`nexora-${collection}-${new Date().toISOString().slice(0, 10)}.csv`, [headings, ...rows]);
    toast.success("Currently loaded records exported to CSV.");
  }

  function downloadImportTemplate() {
    const fields: CrmField[] = moduleConfig.fields.filter((field) => field.type !== "file");
    downloadCsv(`${collection}-import-template.csv`, [fields.map((field) => field.key)]);
  }

  async function prepareImport(file: File) {
    setImportPreview(null);
    try {
      if (!["leads", "students"].includes(collection)) {
        throw new Error("CSV import is currently available for leads and students.");
      }
      if (file.size > 10 * 1024 * 1024) throw new Error("CSV files must be 10 MB or smaller.");
      const rows = parseCsv((await file.text()).replace(/^\uFEFF/, ""));
      const normalizeHeader = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      const fields: CrmField[] = moduleConfig.fields.filter((field) => field.type !== "file");
      const fieldByHeader = new Map<string, CrmField>();
      for (const field of fields) {
        fieldByHeader.set(normalizeHeader(field.key), field);
        fieldByHeader.set(normalizeHeader(field.label), field);
      }
      const headerFields = rows[0].map((header) => fieldByHeader.get(normalizeHeader(header)));
      const unknownHeaders = rows[0].filter((header, index) => !headerFields[index]);
      if (unknownHeaders.length) throw new Error(`Unknown CSV column${unknownHeaders.length === 1 ? "" : "s"}: ${unknownHeaders.join(", ")}. Use the template field names.`);
      const fieldKeys = new Set(headerFields.map((field) => field?.key));
      const missingRequired = fields.filter((field) => field.required && !fieldKeys.has(field.key)).map((field) => field.label);
      if (missingRequired.length) throw new Error(`Required column${missingRequired.length === 1 ? "" : "s"} missing: ${missingRequired.join(", ")}.`);

      const dataRows = rows.slice(1);
      if (dataRows.length > 10_000) throw new Error("A single CSV import is limited to 10,000 records. Split larger files into smaller uploads.");
      const records = dataRows.map((values, index) => {
        if (values.length !== headerFields.length) throw new Error(`CSV row ${index + 2} has a different number of values than the header.`);
        const record: Record<string, unknown> = {};
        headerFields.forEach((field, columnIndex) => {
          if (!field) return;
          const value = values[columnIndex].trim();
          if (!value) {
            if (field.required) throw new Error(`CSV row ${index + 2} is missing ${field.label.toLowerCase()}.`);
            return;
          }
          if (field.type === "checkbox") {
            const normalized = value.toLowerCase();
            if (!["true", "false", "yes", "no", "1", "0"].includes(normalized)) {
              throw new Error(`CSV row ${index + 2} has an invalid ${field.label.toLowerCase()} value.`);
            }
            record[field.key] = ["true", "yes", "1"].includes(normalized);
          } else if (field.type === "number") {
            const number = Number(value);
            if (!Number.isFinite(number)) throw new Error(`CSV row ${index + 2} has an invalid ${field.label.toLowerCase()}.`);
            record[field.key] = number;
          } else if (field.type === "select") {
            if (field.options && !field.options.includes(value)) throw new Error(`CSV row ${index + 2} has an invalid ${field.label.toLowerCase()} value: ${value}.`);
            record[field.key] = value;
          } else if (field.type === "email") {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error(`CSV row ${index + 2} has an invalid email address.`);
            record[field.key] = value.toLowerCase();
          } else {
            record[field.key] = value;
          }
        });
        return record;
      });
      if (!records.length) throw new Error("The CSV has a header but no data rows.");
      setImportPreview({ filename: file.name, records });
    } catch (importError) {
      toast.error(importError instanceof Error ? importError.message : "Could not read this CSV file.");
    }
  }

  async function runImport() {
    if (!importPreview) return;
    setImporting(true);
    try {
      const inserted = await importRecords(importPreview.records);
      toast.success(`${inserted.toLocaleString()} ${moduleConfig.title.toLowerCase()} imported.`);
      setImportPreview(null);
      setImportDialogOpen(false);
      setSelectedIds(new Set());
    } catch (importError) {
      toast.error(importError instanceof Error ? importError.message : "Could not import these records.");
    } finally {
      setImporting(false);
    }
  }

  function exportSelectedCsv() {
    const headings = moduleConfig.columns.map((column) => column.label);
    const rows = selectedVisibleRecords.map((record) => moduleConfig.columns.map((column) => record[column.key] ?? ""));
    downloadCsv(`nexora-${collection}-selected-${new Date().toISOString().slice(0, 10)}.csv`, [headings, ...rows]);
    toast.success(`${selectedVisibleRecords.length} selected ${moduleConfig.title.toLowerCase()} exported.`);
  }

  function toggleVisibleSelection() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visibleRecords.forEach((record) => next.delete(record.id));
      else visibleRecords.forEach((record) => next.add(record.id));
      return next;
    });
  }

  const openCount = records.filter((record) =>
    ["Open", "Pending", "Overdue", "Needs correction"].includes(String(record.status ?? record.verification_status)),
  ).length;
  const highlight = collection === "leads" ? records.filter((record) => record.priority === "Hot").length : openCount;

  async function updateLeadStage(record: CrmRecord, nextStatus: string | null) {
    if (collection !== "leads" || !nextStatus || nextStatus === record.status) return;
    await save({ status: nextStatus }, record.id);
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 md:space-y-7">
      <header className="crm-page-heading crm-module-hero flex flex-col justify-between gap-4 px-5 py-5 md:flex-row md:items-center md:px-7 md:py-6">
        <div className="relative z-10">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[9px] font-bold tracking-[0.17em] text-teal-100"><span className="h-1.5 w-1.5 rounded-full bg-[#fe7048]" />{moduleConfig.eyebrow}</span>
            {mode === "demo" && (
              <Badge variant="outline" className="h-5 border-amber-200/40 bg-amber-300/15 px-2 text-[10px] font-semibold text-amber-100">
                DEMO MODE
              </Badge>
            )}
            {mode === "supabase" && (
              <Badge variant="outline" className="h-5 border-emerald-200/35 bg-emerald-300/15 px-2 text-[10px] font-semibold text-emerald-100">
                SUPABASE LIVE
              </Badge>
            )}
          </div>
          <h1 className="text-[26px] font-semibold tracking-[-0.04em] text-white sm:text-[32px]">{moduleConfig.title}</h1>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-slate-300">{moduleConfig.description}</p>
        </div>
        <div className="relative z-10 flex flex-wrap gap-2">
          <Button variant="outline" className="h-10 border-slate-200 bg-white/90 px-4 shadow-sm hover:border-blue-200 hover:bg-blue-50/50" onClick={exportCsv} disabled={filteredRecords.length === 0}>
            <ArrowDownToLine className="mr-2 h-4 w-4" />
            Export loaded
          </Button>
          {["leads", "students"].includes(collection) && (
            <Button variant="outline" className="h-10 border-slate-200 bg-white/90 px-4 shadow-sm" onClick={() => setImportDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />Import CSV
            </Button>
          )}
          <Button className="h-10 rounded-xl bg-[#fe7048] px-4 text-white shadow-[0_7px_16px_-10px_rgba(254,112,72,0.8)] hover:bg-[#ed603a]" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add {moduleConfig.singular}
          </Button>
        </div>
      </header>

      {mode === "demo" && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-amber-900">
            <span className="font-semibold">Demo workspace.</span> Changes are saved in this browser only, not to a database.
          </p>
          <Button variant="link" className="h-auto justify-start p-0 text-amber-800" onClick={() => router.push("/settings")}>
            Connect Supabase <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {error && (errorCode === "ORGANIZATION_SCHEMA_NOT_READY" || errorCode === "ORGANIZATION_MEMBERSHIP_MISSING" ? (
        <section role="alert" className="relative isolate overflow-hidden rounded-2xl border border-sky-200 bg-gradient-to-br from-white via-sky-50/80 to-orange-50/70 shadow-sm">
          <div aria-hidden="true" className="absolute -right-14 -top-20 h-52 w-52 rounded-full bg-teal-200/35 blur-3xl" />
          <div className="relative grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-6">
            <div className="flex gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-teal-200 bg-white text-teal-800 shadow-sm">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-orange-200 bg-orange-50 text-[10px] font-semibold tracking-wide text-orange-800">SETUP REQUIRED</Badge>
                  <span className="text-[11px] font-medium text-slate-500">Workspace access</span>
                </div>
                <h2 className="text-base font-semibold tracking-tight text-slate-900">
                  {errorCode === "ORGANIZATION_SCHEMA_NOT_READY" ? "Finish connecting your Supabase workspace" : "No team workspace is linked to your account"}
                </h2>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">{error}</p>
                {errorCode === "ORGANIZATION_SCHEMA_NOT_READY" ? (
                  <ol className="mt-3 grid gap-1.5 text-xs text-slate-600 sm:grid-cols-2">
                    <li><span className="mr-2 font-semibold text-teal-800">01</span>Open your Supabase project&apos;s SQL Editor.</li>
                    <li><span className="mr-2 font-semibold text-teal-800">02</span>Run the base schema, then the organization migration.</li>
                  </ol>
                ) : (
                  <p className="mt-3 text-xs text-slate-600">Ask your workspace owner to invite this account, or have an administrator verify that the organization migration completed successfully.</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              {errorCode === "ORGANIZATION_SCHEMA_NOT_READY" && (
                <Button asChild variant="outline" className="border-sky-200 bg-white/80">
                  <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">
                    Supabase dashboard <ArrowUpRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              )}
              <Button onClick={() => void reload()} className="bg-[#087b83] hover:bg-[#08656c]">
                Retry connection
              </Button>
            </div>
          </div>
        </section>
      ) : (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-rose-800"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>
          <Button variant="outline" size="sm" onClick={() => void reload()}>Retry</Button>
        </div>
      ))}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="relative overflow-hidden rounded-2xl border-border/80">
          <span className="absolute inset-x-5 top-0 h-[2px] rounded-b-full bg-primary/75" />
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total {moduleConfig.title.toLowerCase()}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{mode === "loading" ? "—" : records.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">{hasMore ? "Rows loaded; more are available" : "Rows matching the current filters"}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden rounded-2xl border-border/80">
          <span className="absolute inset-x-5 top-0 h-[2px] rounded-b-full bg-[#fe7048]/80" />
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">{collection === "leads" ? "Hot-priority leads" : "Needs attention"}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{mode === "loading" ? "—" : highlight}</p>
              <p className="mt-1 text-xs text-muted-foreground">{collection === "leads" ? "Ready for counsellor outreach" : "Open, pending, or overdue"}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Filter className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="relative hidden overflow-hidden rounded-2xl border-border/80 xl:block">
          <span className="absolute inset-x-5 top-0 h-[2px] rounded-b-full bg-emerald-500/70" />
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Workspace security</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">Private</p>
              <p className="mt-1 text-xs text-muted-foreground">Student records stay access-controlled</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden rounded-2xl border-border/80">
        <div className="flex flex-col gap-4 border-b border-slate-200/80 bg-gradient-to-r from-slate-50/95 via-white to-teal-50/45 p-4 md:p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold">{moduleConfig.title} directory</h2>
                <Badge variant="secondary" className="h-5 px-2 text-[10px] tabular-nums">{filteredRecords.length}</Badge>
                <span className="text-xs text-muted-foreground">loaded in this view</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Search, refine and manage your {moduleConfig.title.toLowerCase()} in one place.</p>
            </div>
            <div className="flex min-h-8 items-center gap-2">
              {selectedVisibleRecords.length > 0 && (
                <>
                  <span aria-live="polite" className="text-[11px] text-muted-foreground">{selectedVisibleRecords.length} selected</span>
                  <Button variant="outline" size="sm" className="h-8" onClick={exportSelectedCsv}>
                    <ArrowDownToLine className="mr-1.5 h-3.5 w-3.5" />Export selected
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setSelectedIds(new Set())}>Clear</Button>
                </>
              )}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_repeat(4,auto)]">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={`Search ${moduleConfig.title.toLowerCase()}...`}
                aria-label={`Search ${moduleConfig.title.toLowerCase()}`}
                className="h-10 border-border/70 bg-background pl-9"
              />
            </div>
            {statuses.length > 0 && (
              <Select value={statusFilter} onValueChange={(value) => value && setStatusFilter(value)}>
                <SelectTrigger aria-label="Filter by status" className="h-10 w-full bg-background lg:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All records">All records</SelectItem>
                  {statuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {facets.map((facet) => {
              const options = Array.from(new Set(records.map((record) => String(record[facet.key] ?? "")).filter(Boolean)));
              if (options.length === 0) return null;
              const allOption = `All ${facet.label.toLowerCase()}`;
              return (
                <Select
                  key={facet.key}
                  value={selectedFacets[facet.key] ?? allOption}
                  onValueChange={(value) => setSelectedFacets((current) => ({ ...current, [facet.key]: value ?? allOption }))}
                >
                  <SelectTrigger aria-label={`Filter by ${facet.label.toLowerCase()}`} className="h-10 w-full bg-background lg:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={allOption}>{allOption}</SelectItem>
                    {options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                  </SelectContent>
                </Select>
              );
            })}
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/95 hover:bg-slate-50/95">
                <TableHead className="w-10 bg-muted/25">
                  <input
                    type="checkbox"
                    aria-label="Select all visible records"
                    checked={allVisibleSelected}
                    onChange={toggleVisibleSelection}
                    className="h-4 w-4 cursor-pointer accent-primary"
                  />
                </TableHead>
                {moduleConfig.columns.map((column) => (
                <TableHead key={column.key} className="sticky top-0 h-11 bg-slate-50/95 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  {column.label}
                </TableHead>
              ))}
              <TableHead className="w-24 bg-muted/25 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mode === "loading" ? (
              <TableRow><TableCell colSpan={moduleConfig.columns.length + 2} className="h-32 text-center text-sm text-muted-foreground"><LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" />Loading {moduleConfig.title.toLowerCase()}…</TableCell></TableRow>
            ) : visibleRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={moduleConfig.columns.length + 2} className="h-44">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted"><Search className="h-4 w-4 text-muted-foreground" /></div>
                    <p className="text-sm font-medium">{records.length ? "No matching records" : `No ${moduleConfig.title.toLowerCase()} yet`}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{records.length ? "Try another search or filter." : `Add your first ${moduleConfig.singular} to get started.`}</p>
                    {!records.length && <Button size="sm" className="mt-3" onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" />Add {moduleConfig.singular}</Button>}
                  </div>
                </TableCell>
              </TableRow>
            ) : visibleRecords.map((record) => (
              <TableRow key={record.id} className={`group even:bg-muted/[0.14] ${selectedIds.has(record.id) ? "bg-primary/[0.045]" : ""}`}>
                <TableCell className="w-10">
                  <input
                    type="checkbox"
                    aria-label={`Select ${moduleConfig.singular} ${String(record[moduleConfig.columns.find((column) => "primary" in column && column.primary)?.key ?? "id"] ?? "")}`}
                    checked={selectedIds.has(record.id)}
                    onChange={() => setSelectedIds((current) => {
                      const next = new Set(current);
                      if (next.has(record.id)) next.delete(record.id);
                      else next.add(record.id);
                      return next;
                    })}
                    className="h-4 w-4 cursor-pointer accent-primary"
                  />
                </TableCell>
                {moduleConfig.columns.map((column) => {
                  const value = record[column.key];
                  const columnType = "type" in column ? column.type : undefined;
                  return (
                    <TableCell key={column.key} className="py-3.5">
                      {"primary" in column && column.primary ? (
                        <div className="flex min-w-40 items-center gap-2.5">
                          <Avatar className="h-8 w-8 rounded-lg">
                            <AvatarFallback className="rounded-lg bg-primary/10 text-[10px] font-semibold text-primary">{initials(value)}</AvatarFallback>
                          </Avatar>
                          <span className="max-w-56 truncate text-[13px] font-medium">{displayValue(value, columnType)}</span>
                        </div>
                      ) : column.key === "whatsapp_opt_in" ? (
                        <Badge variant="outline" className={value === true ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}>{value === true ? "Opted in" : "No consent"}</Badge>
                      ) : collection === "leads" && column.key === "status" && statuses.length > 0 ? (
                        <Select value={String(value ?? "")} onValueChange={(nextStatus) => void updateLeadStage(record, nextStatus)}>
                          <SelectTrigger
                            aria-label={`Update ${String(record.full_name ?? "lead")} pipeline stage`}
                            className={`h-7 w-[142px] rounded-full px-2.5 text-[10px] font-semibold ${statusClass(value)}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : column.key === "status" || column.key === "verification_status" || column.key === "priority" ? (
                        <Badge variant="outline" className={`whitespace-nowrap px-2.5 py-1 text-[10px] font-semibold ${statusClass(value)}`}>{displayValue(value)}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">{displayValue(value, columnType)}</span>
                      )}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    {collection === "leads" && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Send WhatsApp template to ${String(record.full_name ?? "lead")}`}
                        title={record.whatsapp_opt_in === true ? "Send approved WhatsApp template" : "Student WhatsApp consent is required"}
                        disabled={record.whatsapp_opt_in !== true}
                        onClick={() => void sendWhatsAppTemplate(record)}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    )}
                    {collection === "documents" && (
                      <Button variant="ghost" size="icon-sm" aria-label="Preview document" onClick={() => void downloadDocument(record)}>
                        <ArrowDownToLine className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${moduleConfig.singular}`} onClick={() => openEdit(record)}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Delete ${moduleConfig.singular}`} className="text-muted-foreground hover:text-destructive" onClick={() => void deleteRecord(record)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {hasMore && (
          <div className="flex flex-col items-center gap-2 border-t px-4 py-4 sm:flex-row sm:justify-between">
            <p className="text-xs text-muted-foreground">Showing {records.length.toLocaleString()} rows. Results are loaded in indexed pages.</p>
            <Button variant="outline" size="sm" onClick={() => void loadMore()} disabled={loadingMore}>
              {loadingMore && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              Load more
            </Button>
          </div>
        )}
      </Card>

      <Dialog open={importDialogOpen} onOpenChange={(open) => {
        setImportDialogOpen(open);
        if (!open) setImportPreview(null);
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Upload className="h-5 w-5" /></div>
            <DialogTitle>Import {moduleConfig.title.toLowerCase()} from CSV</DialogTitle>
            <DialogDescription>Validated uploads are inserted in small batches. Imports support up to 10,000 rows per CSV.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 p-4">
              <div>
                <p className="text-sm font-medium">Use the CRM field names as CSV headers</p>
                <p className="mt-1 text-xs text-muted-foreground">CSV only. Save Excel workbooks as CSV before uploading.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={downloadImportTemplate}>
                <ArrowDownToLine className="mr-1.5 h-3.5 w-3.5" />Download template
              </Button>
            </div>
            <Input
              type="file"
              accept=".csv,text/csv"
              disabled={importing}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void prepareImport(file);
                event.currentTarget.value = "";
              }}
            />
            {importPreview && (
              <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-emerald-900">{importPreview.records.length.toLocaleString()} rows ready</p>
                  <Badge variant="outline" className="max-w-full truncate border-emerald-300 bg-white text-emerald-800">{importPreview.filename}</Badge>
                </div>
                <p className="text-xs text-emerald-800">First record preview: {Object.entries(importPreview.records[0] ?? {}).map(([key, value]) => `${key}: ${String(value)}`).join(" · ")}</p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" disabled={importing} onClick={() => setImportDialogOpen(false)}>Cancel</Button>
            <Button type="button" disabled={!importPreview || importing || mode === "loading"} onClick={() => void runImport()}>
              {importing && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              {importing ? "Importing…" : "Import records"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {collection === "documents" ? <Upload className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
            </div>
            <DialogTitle>{editing ? `Update ${moduleConfig.singular}` : `Add ${moduleConfig.singular}`}</DialogTitle>
            <DialogDescription>
            {editing ? "Update the record details below." : `Enter the details to add this ${moduleConfig.singular} to your workspace.`}
            </DialogDescription>
          </DialogHeader>
          <form key={editing?.id ?? "new-record"} onSubmit={(event) => void submitForm(event)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {moduleConfig.fields.map((field) => (
                <FormField key={field.key} field={field} value={editing?.[field.key]} wide={field.type === "textarea" || field.type === "file" || field.type === "checkbox"} />
              ))}
            </div>
            {collection === "documents" && mode === "demo" && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Demo mode saves document details only. Configure Supabase to securely upload and preview files.
              </p>
            )}
            <DialogFooter className="gap-2 sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting || mode === "loading" || mode === "error"}>
                {submitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                {collection === "documents" ? "Save document" : editing ? "Save changes" : `Add ${moduleConfig.singular}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FormField({ field, value, wide }: { field: CrmField; value?: unknown; wide?: boolean }) {
  const id = `record-${field.key}`;
  const inputClassName = "h-10";
  return (
    <div className={wide ? "space-y-2 sm:col-span-2" : "space-y-2"}>
      <Label htmlFor={id} className="text-xs font-medium">
        {field.label}{field.required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
      </Label>
      {field.type === "select" ? (
        <Select name={field.key} defaultValue={String(value ?? "") || undefined} required={field.required}>
          <SelectTrigger id={id} className={inputClassName}><SelectValue placeholder={`Select ${field.label.toLowerCase()}`} /></SelectTrigger>
          <SelectContent>
            {field.options?.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : field.type === "checkbox" ? (
        <label htmlFor={id} className="flex min-h-10 items-center gap-2 rounded-lg border border-input px-3 text-xs text-muted-foreground">
          <input id={id} name={field.key} type="checkbox" defaultChecked={value === true} className="h-4 w-4 accent-primary" />
          Record explicit student consent before enabling WhatsApp outreach.
        </label>
      ) : field.type === "textarea" ? (
        <textarea
          id={id}
          name={field.key}
          defaultValue={String(value ?? "")}
          required={field.required}
          placeholder={field.placeholder}
          rows={3}
          className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      ) : field.type === "file" ? (
        <Input
          id={id}
          name={field.key}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
          className="h-10 pt-2"
          required={field.required}
          aria-describedby={`${id}-help`}
        />
      ) : (
        <Input
          id={id}
          name={field.key}
          type={field.type}
          defaultValue={field.type === "datetime-local" && value ? new Date(String(value)).toISOString().slice(0, 16) : String(value ?? "")}
          required={field.required}
          placeholder={field.placeholder}
          min={field.type === "number" ? "0" : undefined}
          className={inputClassName}
        />
      )}
      {field.type === "file" && <p id={`${id}-help`} className="text-[11px] text-muted-foreground">{field.placeholder}</p>}
    </div>
  );
}

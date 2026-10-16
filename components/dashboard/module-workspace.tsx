"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowUpRight,
  FileText,
  Filter,
  LoaderCircle,
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
import { downloadCsv } from "@/lib/csv";
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
}: {
  collection: CrmCollection;
  initialSearch?: string;
}) {
  const moduleConfig = crmModules[collection];
  const { records, mode, error, reload, save, remove } = useCrmCollection(collection);
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState("All records");
  const [sortBy, setSortBy] = useState("recent");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CrmRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedFacets, setSelectedFacets] = useState<Record<string, string>>({});
  const router = useRouter();
  const facets = "facets" in moduleConfig ? moduleConfig.facets : noFacets;

  const statuses = useMemo(
    () => Array.from(new Set(records.map((record) => String(record.status ?? record.verification_status ?? ""))).values()).filter(Boolean),
    [records],
  );
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
  const visibleRecords = useMemo(() => [...filteredRecords].sort((left, right) => {
    if (sortBy === "name") {
      const primaryKey = moduleConfig.columns.find((column) => "primary" in column && column.primary)?.key;
      return String(left[primaryKey ?? "id"] ?? "").localeCompare(String(right[primaryKey ?? "id"] ?? ""));
    }
    if (sortBy === "status") {
      return String(left.status ?? left.verification_status ?? "").localeCompare(String(right.status ?? right.verification_status ?? ""));
    }
    const leftDate = new Date(String(left.updated_at ?? left.created_at ?? 0)).getTime();
    const rightDate = new Date(String(right.updated_at ?? right.created_at ?? 0)).getTime();
    return (Number.isNaN(rightDate) ? 0 : rightDate) - (Number.isNaN(leftDate) ? 0 : leftDate);
  }), [filteredRecords, moduleConfig.columns, sortBy]);
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

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const values: Record<string, unknown> = {};
    for (const field of moduleConfig.fields) {
      if (field.type === "file") continue;
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
            uploadedPath = `${user.id}/${crypto.randomUUID()}-${fileEntry.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
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
    toast.success("CSV export downloaded.");
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

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 md:space-y-7">
      <header className="crm-page-heading flex flex-col justify-between gap-4 px-5 py-5 md:flex-row md:items-center md:px-7 md:py-6">
        <div className="relative z-10">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[9px] font-bold tracking-[0.17em] text-primary"><span className="h-1.5 w-1.5 rounded-full bg-[#fe661d]" />{moduleConfig.eyebrow}</span>
            {mode === "demo" && (
              <Badge variant="outline" className="h-5 border-amber-200 bg-amber-50 px-2 text-[10px] font-semibold text-amber-700">
                DEMO MODE
              </Badge>
            )}
            {mode === "supabase" && (
              <Badge variant="outline" className="h-5 border-emerald-200 bg-emerald-50 px-2 text-[10px] font-semibold text-emerald-700">
                SUPABASE LIVE
              </Badge>
            )}
          </div>
          <h1 className="text-[26px] font-semibold tracking-[-0.04em] text-slate-900 sm:text-[32px]">{moduleConfig.title}</h1>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-slate-500">{moduleConfig.description}</p>
        </div>
        <div className="relative z-10 flex flex-wrap gap-2">
          <Button variant="outline" className="h-10 border-slate-200 bg-white/90 px-4 shadow-sm hover:border-blue-200 hover:bg-blue-50/50" onClick={exportCsv} disabled={filteredRecords.length === 0}>
            <ArrowDownToLine className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button className="h-10 rounded-xl bg-[#075fa3] px-4 shadow-[0_7px_16px_-10px_rgba(7,95,163,0.8)] hover:bg-[#064f88]" onClick={openCreate}>
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

      {error && (
        <div role="alert" className="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void reload()}>Retry</Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="relative overflow-hidden rounded-2xl border-border/80">
          <span className="absolute inset-x-5 top-0 h-[2px] rounded-b-full bg-primary/75" />
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total {moduleConfig.title.toLowerCase()}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{mode === "loading" ? "—" : records.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">Records in your workspace</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden rounded-2xl border-border/80">
          <span className="absolute inset-x-5 top-0 h-[2px] rounded-b-full bg-[#fe661d]/80" />
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
        <div className="flex flex-col gap-4 border-b border-slate-200/80 bg-gradient-to-r from-slate-50/95 via-white to-blue-50/35 p-4 md:p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold">{moduleConfig.title} directory</h2>
                <Badge variant="secondary" className="h-5 px-2 text-[10px] tabular-nums">{filteredRecords.length}</Badge>
                <span className="text-xs text-muted-foreground">of {records.length} records</span>
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
            <Select value={sortBy} onValueChange={(value) => value && setSortBy(value)}>
              <SelectTrigger aria-label="Sort records" className="h-10 w-full bg-background lg:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recently updated</SelectItem>
                <SelectItem value="name">Name A–Z</SelectItem>
                <SelectItem value="status">Status A–Z</SelectItem>
              </SelectContent>
            </Select>
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
      </Card>

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
                <FormField key={field.key} field={field} value={editing?.[field.key]} wide={field.type === "textarea" || field.type === "file"} />
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

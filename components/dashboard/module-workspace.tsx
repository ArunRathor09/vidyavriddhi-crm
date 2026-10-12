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
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300";
  }
  if (["overdue", "needs correction", "rejected", "hot"].includes(status)) {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300";
  }
  if (["new", "open", "pending", "registration", "document verification"].includes(status)) {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300";
  }
  return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
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

  const openCount = records.filter((record) =>
    ["Open", "Pending", "Overdue", "Needs correction"].includes(String(record.status ?? record.verification_status)),
  ).length;
  const highlight = collection === "leads" ? records.filter((record) => record.priority === "Hot").length : openCount;

  return (
    <div className="mx-auto max-w-[1440px] space-y-7">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-[0.17em] text-primary">{moduleConfig.eyebrow}</span>
            {mode === "demo" && (
              <Badge variant="outline" className="h-5 border-amber-200 bg-amber-50 px-2 text-[10px] font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                DEMO MODE
              </Badge>
            )}
            {mode === "supabase" && (
              <Badge variant="outline" className="h-5 border-emerald-200 bg-emerald-50 px-2 text-[10px] font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                SUPABASE LIVE
              </Badge>
            )}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{moduleConfig.title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{moduleConfig.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={filteredRecords.length === 0}>
            <ArrowDownToLine className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add {moduleConfig.singular}
          </Button>
        </div>
      </div>

      {mode === "demo" && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-sm dark:border-amber-900/60 dark:bg-amber-950/20 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-amber-900 dark:text-amber-200">
            <span className="font-semibold">Demo workspace.</span> Changes are saved in this browser only, not to a database.
          </p>
          <Button variant="link" className="h-auto justify-start p-0 text-amber-800 dark:text-amber-200" onClick={() => router.push("/settings")}>
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
        <Card className="rounded-2xl border-border/80 shadow-sm">
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
        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">{collection === "leads" ? "Hot-priority leads" : "Needs attention"}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{mode === "loading" ? "—" : highlight}</p>
              <p className="mt-1 text-xs text-muted-foreground">{collection === "leads" ? "Ready for counsellor outreach" : "Open, pending, or overdue"}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
              <Filter className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="hidden rounded-2xl border-border/80 shadow-sm xl:block">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Workspace security</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">Private</p>
              <p className="mt-1 text-xs text-muted-foreground">Student records stay access-controlled</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden rounded-2xl border-border/80 shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold">{moduleConfig.title} directory</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {filteredRecords.length} {filteredRecords.length === 1 ? "record" : "records"}
              {statusFilter !== "All records" ? ` · ${statusFilter}` : ""}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                  placeholder={`Search ${moduleConfig.title.toLowerCase()}...`}
                  aria-label={`Search ${moduleConfig.title.toLowerCase()}`}
                className="h-9 pl-9"
              />
            </div>
            {statuses.length > 0 && (
              <Select value={statusFilter} onValueChange={(value) => value && setStatusFilter(value)}>
                <SelectTrigger aria-label="Filter by status" className="h-9 sm:w-44">
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
                  <SelectTrigger aria-label={`Filter by ${facet.label.toLowerCase()}`} className="h-9 sm:w-36">
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
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {moduleConfig.columns.map((column) => (
                <TableHead key={column.key} className="h-11 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {column.label}
                </TableHead>
              ))}
              <TableHead className="w-24 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mode === "loading" ? (
              <TableRow><TableCell colSpan={moduleConfig.columns.length + 1} className="h-32 text-center text-sm text-muted-foreground"><LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" />Loading {moduleConfig.title.toLowerCase()}…</TableCell></TableRow>
            ) : filteredRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={moduleConfig.columns.length + 1} className="h-44">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted"><Search className="h-4 w-4 text-muted-foreground" /></div>
                    <p className="text-sm font-medium">{records.length ? "No matching records" : `No ${moduleConfig.title.toLowerCase()} yet`}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{records.length ? "Try another search or filter." : `Add your first ${moduleConfig.singular} to get started.`}</p>
                    {!records.length && <Button size="sm" className="mt-3" onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" />Add {moduleConfig.singular}</Button>}
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredRecords.map((record) => (
              <TableRow key={record.id} className="group">
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
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
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

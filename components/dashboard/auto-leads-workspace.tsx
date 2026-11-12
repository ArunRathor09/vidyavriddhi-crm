"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import {
  Activity,
  ArrowUpRight,
  Check,
  CircleAlert,
  Clock3,
  Copy,
  Database,
  KeyRound,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Webhook,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AutoLeadSource = {
  id: string;
  name: string;
  created_at: string;
  last_received_at: string | null;
  leads_received: number;
  revoked_at: string | null;
};

function googleAppsScript(endpoint: string) {
  return `const AUTO_LEADS_URL = "${endpoint}";
const LEAD_FIELDS = new Set([
  "full_name", "phone", "email", "source", "status", "priority",
  "whatsapp_opt_in", "counselor_name", "preferred_destination",
  "budget", "next_follow_up_date"
]);

// Run once from the Apps Script editor and authorize the edit trigger.
function setupAutoLeadsTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === "syncLeadRowToCrm")
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger("syncLeadRowToCrm")
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
}

function syncLeadRowToCrm(e) {
  if (!e || !e.range) throw new Error("Run setupAutoLeadsTrigger once, then edit a sheet row to sync it.");
  const sheet = e.range.getSheet();
  const firstRow = Math.max(2, e.range.getRow());
  const lastRow = Math.min(sheet.getLastRow(), e.range.getLastRow());
  if (firstRow > lastRow) return;
  syncLeadRows_(sheet, firstRow, lastRow - firstRow + 1);
}

// Run once to import existing rows. Later edits sync automatically.
function syncAllExistingRows() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error("Add lead rows below the header before running the import.");
  syncLeadRows_(sheet, 2, lastRow - 1);
}

function syncLeadRows_(sheet, firstRow, rowCount) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(value => String(value).trim());
  if (!headers.includes("full_name") || !headers.includes("phone")) {
    throw new Error("Row 1 must contain the exact required headers: full_name and phone.");
  }
  const token = PropertiesService.getScriptProperties().getProperty("AUTO_LEADS_TOKEN");
  if (!token) throw new Error("Set AUTO_LEADS_TOKEN in Apps Script Project Settings > Script Properties.");

  for (let offset = 0; offset < rowCount; offset += 100) {
    const batchSize = Math.min(100, rowCount - offset);
    const rows = sheet.getRange(firstRow + offset, 1, batchSize, sheet.getLastColumn()).getValues();
    const leads = rows.map(values => {
      const lead = {};
      headers.forEach((header, index) => {
        if (!LEAD_FIELDS.has(header)) return;
        const value = values[index];
        if (header !== "full_name" && header !== "phone" && (value === "" || value === null || value === undefined)) return;
        if (header === "whatsapp_opt_in") {
          lead[header] = typeof value === "boolean" ? value : ["true", "yes", "1"].includes(String(value).trim().toLowerCase());
        } else {
          lead[header] = value instanceof Date
            ? Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd")
            : value === null || value === undefined ? "" : String(value).trim();
        }
      });
      return lead;
    }).filter(lead => lead.full_name && lead.phone);
    if (leads.length === 0) continue;

    const response = UrlFetchApp.fetch(AUTO_LEADS_URL, {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + token },
      payload: JSON.stringify({ leads: leads }),
      muteHttpExceptions: true
    });
    if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
      throw new Error("Auto Leads sync failed (" + response.getResponseCode() + "): " + response.getContentText());
    }
  }
}`;
}

async function readJson(response: Response) {
  const payload: unknown = await response.json();
  if (typeof payload !== "object" || payload === null) throw new Error("The server returned an invalid response.");
  return payload as Record<string, unknown>;
}

function subscribeToOrigin() {
  return () => {};
}

function getWebhookEndpoint() {
  return `${window.location.origin}/api/auto-leads`;
}

function getServerWebhookEndpoint() {
  return "/api/auto-leads";
}

export function AutoLeadsWorkspace() {
  const [sources, setSources] = useState<AutoLeadSource[]>([]);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const endpoint = useSyncExternalStore(subscribeToOrigin, getWebhookEndpoint, getServerWebhookEndpoint);

  async function loadSources() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auto-leads/sources", { cache: "no-store" });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Could not load integrations.");
      if (!Array.isArray(payload.sources)) throw new Error("The integrations response is incomplete.");
      setSources(payload.sources as AutoLeadSource[]);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Could not load integrations.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadSources(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const activeCount = useMemo(() => sources.filter((source) => !source.revoked_at).length, [sources]);

  async function createSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/auto-leads/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Could not create integration.");
      if (typeof payload.apiKey !== "string" || typeof payload.source !== "object" || payload.source === null) {
        throw new Error("The integration was created, but its API key could not be displayed. Revoke it and create another.");
      }
      setSources((current) => [payload.source as AutoLeadSource, ...current]);
      setNewKey(payload.apiKey);
      setName("");
      toast.success("Auto Leads source created. Copy the key now; it is only shown once.");
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Could not create integration.";
      setError(message);
      toast.error(message);
    } finally {
      setCreating(false);
    }
  }

  async function revokeSource(id: string) {
    if (!window.confirm("Revoke this source? Its Google Sheet or API client will stop syncing immediately.")) return;
    setRevoking(id);
    setError(null);
    try {
      const response = await fetch("/api/auto-leads/sources", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Could not revoke integration.");
      setSources((current) => current.map((source) => source.id === id
        ? { ...source, revoked_at: new Date().toISOString() }
        : source));
      toast.success("Integration token revoked.");
    } catch (revokeError) {
      const message = revokeError instanceof Error ? revokeError.message : "Could not revoke integration.";
      setError(message);
      toast.error(message);
    } finally {
      setRevoking(null);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      toast.success("Copied to clipboard.");
    } catch {
      toast.error("Clipboard access was blocked. Select and copy the text instead.");
    }
  }

  const script = googleAppsScript(endpoint);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-[#0b374c] to-[#087b83] p-6 text-white shadow-xl shadow-slate-900/10 sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-20 h-72 w-72 rounded-full border border-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-2 -top-8 h-48 w-48 rounded-full border border-white/10" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/10">
              <Webhook className="mr-1.5 h-3 w-3" /> AUTOMATION · LIVE INGESTION
            </Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Auto Leads</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-200">
              Keep your CRM in sync with spreadsheets and external forms. Every edit can securely create or update a lead, keyed by phone number, and trigger the existing follow-up workflow.
            </p>
          </div>
          <div className="grid min-w-[250px] grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <div className="flex items-center gap-2 text-xs text-slate-200"><Activity className="h-4 w-4" /> Active sources</div>
              <p className="mt-3 text-3xl font-semibold tabular-nums">{loading ? "—" : activeCount}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <div className="flex items-center gap-2 text-xs text-slate-200"><Database className="h-4 w-4" /> Lead sync events</div>
              <p className="mt-3 text-3xl font-semibold tabular-nums">{loading ? "—" : sources.reduce((sum, source) => sum + Number(source.leads_received), 0).toLocaleString("en-IN")}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Integration sources</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Create a separate, revocable key for each sheet or external system. Lost keys cannot be recovered; revoke that source and create a replacement.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void loadSources()} disabled={loading} aria-label="Refresh integration sources">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={createSource} className="flex flex-col gap-2 rounded-xl border bg-slate-50/80 p-3 sm:flex-row">
              <div className="min-w-0 flex-1">
                <Label htmlFor="source-name" className="sr-only">Integration name</Label>
                <Input
                  id="source-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Website enquiry sheet"
                  maxLength={120}
                  required
                />
              </div>
              <Button type="submit" disabled={creating || !name.trim()} className="rounded-lg bg-[#075fa3] hover:bg-[#064f88]">
                {creating ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Create source
              </Button>
            </form>

            {newKey && (
              <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
                <div className="flex gap-2 text-sm font-semibold text-amber-950">
                  <KeyRound className="mt-0.5 h-4 w-4 shrink-0" /> Copy this API key now
                </div>
                <p className="text-xs leading-5 text-amber-900">For security, the full key is shown only once. Copy it into Apps Script Project Settings → Script Properties with the name <code>AUTO_LEADS_TOKEN</code>, then close this notice.</p>
                <div className="flex gap-2">
                  <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-slate-700">{newKey}</code>
                  <Button variant="outline" size="sm" onClick={() => void copy(newKey)} aria-label="Copy API key"><Copy className="h-4 w-4" /></Button>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setNewKey(null)} className="h-7 px-2 text-xs text-amber-900">I’ve saved the key</Button>
              </div>
            )}

            {loading ? (
              <div className="flex min-h-28 items-center justify-center text-sm text-muted-foreground"><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Loading sources…</div>
            ) : sources.length === 0 ? (
              <div className="rounded-xl border border-dashed py-10 text-center">
                <Webhook className="mx-auto h-7 w-7 text-slate-400" />
                <p className="mt-3 text-sm font-medium">No sources connected yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Create a source to get a private webhook key.</p>
              </div>
            ) : (
              <div className="divide-y rounded-xl border">
                {sources.map((source) => (
                  <div key={source.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${source.revoked_at ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700"}`}>
                      {source.revoked_at ? <ShieldCheck className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">{source.name}</p>
                        <Badge variant="outline" className={source.revoked_at ? "text-slate-500" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>
                          {source.revoked_at ? "Revoked" : "Active"}
                        </Badge>
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        <span>{Number(source.leads_received).toLocaleString("en-IN")} sync events</span>
                        <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{source.last_received_at ? new Date(source.last_received_at).toLocaleString("en-IN") : "Never synced"}</span>
                      </p>
                    </div>
                    {!source.revoked_at && (
                      <Button variant="ghost" size="sm" disabled={revoking === source.id} onClick={() => void revokeSource(source.id)} className="self-start text-rose-700 hover:bg-rose-50 hover:text-rose-800 sm:self-center">
                        {revoking === source.id ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
                        Revoke
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Connect a spreadsheet or API</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Use the same endpoint for Google Sheets, Zapier, Make, or your own service.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Webhook URL</Label>
              <div className="mt-1.5 flex gap-2">
                <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border bg-slate-50 px-3 py-2.5 text-xs">{endpoint}</code>
                <Button variant="outline" size="sm" onClick={() => void copy(endpoint)} aria-label="Copy webhook URL"><Copy className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-3">
              <p className="flex items-center gap-2 text-xs font-semibold text-sky-950"><ShieldCheck className="h-4 w-4" /> Secure, idempotent sync</p>
              <ul className="mt-2 space-y-1.5 text-[11px] leading-5 text-sky-950/80">
                <li>• Each source has a unique key; only its SHA-256 hash is stored.</li>
                <li>• Rows are matched by phone: new rows create leads; matching rows update.</li>
                <li>• New and newly Hot leads automatically get follow-up tasks.</li>
                <li>• Revoking a key immediately stops that source from syncing.</li>
              </ul>
            </div>
            <details className="group rounded-xl border">
              <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-3 text-xs font-semibold">
                Google Sheets setup
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-45" />
              </summary>
              <div className="space-y-2 border-t px-3 py-3 text-[11px] leading-5 text-muted-foreground">
                <ol className="list-decimal space-y-1 pl-4">
                  <li>Create a source above and copy its one-time API key. Keep it private.</li>
                  <li>In row 1, use exact headers <code>full_name</code> and <code>phone</code>. Optional headers: <code>email</code>, <code>source</code>, <code>status</code>, <code>priority</code>, <code>whatsapp_opt_in</code>, <code>counselor_name</code>, <code>preferred_destination</code>, <code>budget</code>, <code>next_follow_up_date</code>. Use the allowed source/status/priority values shown below.</li>
                  <li>Open <strong>Extensions → Apps Script</strong>, replace the editor contents with the script below, and save.</li>
                  <li>In Apps Script, open <strong>Project Settings → Script Properties → Add script property</strong>. Set property <code>AUTO_LEADS_TOKEN</code> to the key you copied. Never put the key in a public sheet or browser code.</li>
                  <li>Select <code>setupAutoLeadsTrigger</code> and click <strong>Run</strong> once. Review and approve Google’s authorization prompt. This installs the edit trigger.</li>
                  <li>To import rows already in the sheet, select <code>syncAllExistingRows</code> and click <strong>Run</strong>. Later edits and multi-row pastes sync automatically.</li>
                </ol>
                <p><strong>Allowed values:</strong> source: Website, Google, Facebook, Instagram, Referral, Walk-in, Other. Status: New, Contacted, Interested, Documents, Applied, Offer letter, Admitted, Payment complete. Priority: Hot, Warm, Cold. Phone numbers should be plain text with country code. Rows are matched by phone; repeated syncs update instead of creating duplicates.</p>
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => void copy(script)}><Copy className="mr-1.5 h-3.5 w-3.5" />{copied ? "Copied" : "Copy Apps Script"}</Button>
                </div>
                <pre className="max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 text-[10px] leading-4 text-slate-100"><code>{script}</code></pre>
              </div>
            </details>
            <details className="group rounded-xl border">
              <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-3 text-xs font-semibold">
                Push leads from another API client
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-45" />
              </summary>
              <div className="space-y-3 border-t px-3 py-3 text-[11px] leading-5 text-muted-foreground">
                <p>Send an HTTPS <code>POST</code> to the webhook URL. Add the source key as a bearer token and send JSON. Required fields are <code>full_name</code> and <code>phone</code>; send a lead object or <code>{"{ \"leads\": [...] }"}</code> with up to 100 leads.</p>
                <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-[10px] leading-4 text-slate-100"><code>{`{
  "leads": [
    {
      "full_name": "Aarav Sharma",
      "phone": "+919876543210",
      "email": "aarav@example.com",
      "source": "Website",
      "status": "New",
      "priority": "Warm",
      "preferred_destination": "Georgia",
      "budget": 2500000
    }
  ]
}`}</code></pre>
                <p>A successful response returns <code>success</code> and created/updated counts. Repeated phone numbers update the same workspace lead. Keep the bearer key on a server or in your automation provider’s secret store—never expose it in browser JavaScript.</p>
                <p>Common responses: <code>401</code> missing/revoked key, <code>400</code> invalid data or duplicate email, <code>413</code> body over 1 MB, <code>503</code> missing Supabase setup.</p>
              </div>
            </details>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><Database className="h-4 w-4" /></span>
            <div>
              <p className="text-sm font-semibold">Direct API format</p>
              <p className="mt-1 text-xs text-muted-foreground">Send one lead or a <code>{"{ leads: [...] }"}</code> batch of up to 100. Required fields are <code>full_name</code> and <code>phone</code>; use the bearer key for this source.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void copy(`curl -X POST "${endpoint}" \\\n  -H "Authorization: Bearer YOUR_AUTO_LEADS_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"full_name":"Aarav Sharma","phone":"+919876543210","email":"aarav@example.com","source":"Website","priority":"Warm"}'`)}>
            <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy cURL example
          </Button>
        </CardContent>
      </Card>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{error}
        </p>
      )}
      {!loading && !error && sources.length > 0 && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground"><Check className="h-3.5 w-3.5 text-emerald-600" />Keys are scoped to this workspace and can only write leads, not read CRM data.</p>
      )}
    </div>
  );
}

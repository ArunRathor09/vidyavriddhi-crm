"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowUpRight, CheckCircle2, CircleHelp, Database, KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCrmCollection } from "@/hooks/use-crm-collection";
import { createClient } from "@/lib/supabase/client";
import { z } from "zod";

const workspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  role: z.enum(["owner", "admin", "member"]),
});
const workspacesResponseSchema = z.object({
  data: z.array(workspaceSchema),
  active: workspaceSchema,
});
type Workspace = z.infer<typeof workspaceSchema>;

export function SettingsWorkspace() {
  const connection = useCrmCollection("leads");
  const [account, setAccount] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [switchingWorkspace, setSwitchingWorkspace] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [whatsappReady, setWhatsappReady] = useState<boolean | null>(null);
  const [whatsappError, setWhatsappError] = useState<string | null>(null);

  useEffect(() => {
    if (connection.mode !== "supabase") return;
    let active = true;
    void createClient().auth.getUser().then(({ data, error }) => {
      if (!active) return;
      if (error) setAccountError(error.message);
      else setAccount(data.user?.email ?? "Authenticated Supabase user");
    });
    return () => { active = false; };
  }, [connection.mode]);

  useEffect(() => {
    if (connection.mode !== "supabase") return;
    let active = true;
    void fetch("/api/workspaces", { cache: "no-store" }).then(async (response) => {
      const payload: unknown = await response.json();
      if (!response.ok) {
        const errorPayload = z.object({ error: z.string() }).safeParse(payload);
        throw new Error(errorPayload.success ? errorPayload.data.error : "Could not load workspaces.");
      }
      const result = workspacesResponseSchema.safeParse(payload);
      if (!result.success) throw new Error("Workspace service returned an invalid response.");
      if (active) {
        setWorkspaces(result.data.data);
        setActiveWorkspace(result.data.active);
      }
    }).catch((loadError: unknown) => {
      if (active) setWorkspaceError(loadError instanceof Error ? loadError.message : "Could not load workspaces.");
    });
    return () => { active = false; };
  }, [connection.mode]);

  useEffect(() => {
    if (connection.mode !== "supabase") return;
    let active = true;
    void fetch("/api/integrations/whatsapp/status", { cache: "no-store" }).then(async (response) => {
      const payload: unknown = await response.json();
      if (typeof payload !== "object" || payload === null) throw new Error("Integration readiness returned an invalid response.");
      if (!response.ok || !("data" in payload) || typeof payload.data !== "object" || payload.data === null || !("configured" in payload.data) || typeof payload.data.configured !== "boolean") {
        const message = "error" in payload && typeof payload.error === "string" ? payload.error : "Could not check WhatsApp readiness.";
        throw new Error(message);
      }
      if (active) setWhatsappReady(payload.data.configured);
    }).catch((statusError: unknown) => {
      if (active) setWhatsappError(statusError instanceof Error ? statusError.message : "Could not check WhatsApp readiness.");
    });
    return () => { active = false; };
  }, [connection.mode]);

  const connected = connection.mode === "supabase";
  const error = connection.mode === "error" ? connection.error : accountError ?? workspaceError ?? whatsappError;

  async function switchWorkspace(organizationId: string) {
    setSwitchingWorkspace(true);
    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      const payload: unknown = await response.json();
      if (typeof payload !== "object" || payload === null || !("success" in payload) || !payload.success) {
        const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "Could not switch workspaces.";
        throw new Error(message);
      }
      window.location.reload();
    } catch (switchError) {
      toast.error(switchError instanceof Error ? switchError.message : "Could not switch workspaces.");
      setSwitchingWorkspace(false);
    }
  }

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviting(true);
    try {
      const response = await fetch("/api/workspaces/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const payload: unknown = await response.json();
      if (typeof payload !== "object" || payload === null || !("success" in payload) || !payload.success) {
        const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "Could not send the invitation.";
        throw new Error(message);
      }
      toast.success(`Workspace invitation sent to ${inviteEmail.trim()}.`);
      setInviteEmail("");
    } catch (inviteError) {
      toast.error(inviteError instanceof Error ? inviteError.message : "Could not send the invitation.");
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1180px] space-y-6 md:space-y-7">
      <header className="crm-page-heading px-5 py-5 sm:px-7 sm:py-6">
        <span className="inline-flex items-center gap-1.5 text-[9px] font-bold tracking-[0.17em] text-primary"><span className="h-1.5 w-1.5 rounded-full bg-[#fe661d]" />WORKSPACE ADMINISTRATION</span>
        <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.04em] text-slate-900 sm:text-[32px]">Settings</h1>
        <p className="mt-1.5 max-w-2xl text-[13px] text-slate-500">Manage your account, database connection, and student-data protections.</p>
      </header>

      {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}

      <Card className="overflow-hidden rounded-2xl border-border/80 shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between border-b bg-gradient-to-r from-slate-50 to-white">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4 text-primary" />Database connection</CardTitle>
            <p className="mt-1.5 text-xs text-muted-foreground">Private PostgreSQL storage powered by Supabase.</p>
          </div>
          {connected ? (
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700"><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Connected</Badge>
          ) : connection.mode === "error" ? (
            <Badge variant="outline" className="border-destructive/30 text-destructive"><CircleHelp className="mr-1.5 h-3.5 w-3.5" />Needs attention</Badge>
          ) : (
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">{connection.mode === "loading" ? "Checking…" : "Not configured"}</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-5 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <ConnectionRow title="Supabase project" value={connected ? "Connected and responding" : "Awaiting project credentials"} connected={connected} />
            <ConnectionRow title="Authentication" value={account ?? (connected ? "Checking signed-in account…" : "Email and password sign-in")} connected={connected && Boolean(account)} />
            <ConnectionRow title="Row-level security" value="Organization membership policies are applied by the multi-tenant migration." connected />
            <ConnectionRow title="Private document storage" value="Private Supabase Storage bucket with organization-scoped access policies." connected />
          </div>
          {connection.mode === "demo" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm">
              <p className="font-semibold text-amber-900">Connect your Supabase project to enable production data.</p>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs leading-relaxed text-amber-900/80">
                <li>Create a project at <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">supabase.com/dashboard <ArrowUpRight className="inline h-3 w-3" /></a>.</li>
                <li>Run <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">supabase/schema.sql</code>, then apply the versioned SQL migration in <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">supabase/migrations</code>.</li>
                <li>Copy the Project URL and publishable key into <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">.env.local</code> as <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="font-mono">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>.</li>
                <li>Restart the Next.js server, then create your workspace account.</li>
              </ol>
              <p className="mt-3 text-[11px] font-medium text-amber-800">Never put a Supabase service-role key in a NEXT_PUBLIC_ variable or browser code.</p>
            </div>
          )}
          {connection.mode === "error" && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
              <p className="font-semibold">The Supabase request failed.</p>
              <p className="mt-1 text-xs">Verify the project URL and anon key, apply the database schema, then sign in again. {connection.error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {connected && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Organization workspace</CardTitle>
              <p className="text-xs text-muted-foreground">Switch between organizations you belong to. CRM data is isolated by organization membership.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeWorkspace ? (
                <>
                  <Label htmlFor="active-workspace" className="text-xs font-medium">Active workspace</Label>
                  <Select value={activeWorkspace.id} onValueChange={(value) => value && void switchWorkspace(value)} disabled={switchingWorkspace}>
                    <SelectTrigger id="active-workspace" className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {workspaces.map((workspace) => <SelectItem key={workspace.id} value={workspace.id}>{workspace.name} · {workspace.role}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </>
              ) : <p className="text-sm text-muted-foreground">Loading organization access…</p>}
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Invite a team member</CardTitle>
              <p className="text-xs text-muted-foreground">Owners and admins can invite new Supabase Auth accounts into this workspace.</p>
            </CardHeader>
            <CardContent>
              {activeWorkspace?.role === "owner" || activeWorkspace?.role === "admin" ? (
                <form onSubmit={(event) => void inviteMember(event)} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="invite-email" className="text-xs font-medium">Work email</Label>
                    <Input id="invite-email" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} required maxLength={254} placeholder="colleague@company.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-role" className="text-xs font-medium">Role</Label>
                    <Select value={inviteRole} onValueChange={(value) => {
                      if (value === "member" || value === "admin") setInviteRole(value);
                    }}>
                      <SelectTrigger id="invite-role" className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" disabled={inviting || !activeWorkspace}>{inviting ? "Sending invitation…" : "Send invitation"}</Button>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">Requires a server-only <code>SUPABASE_SERVICE_ROLE_KEY</code> and Supabase Auth email delivery configuration.</p>
                </form>
              ) : (
                <p className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">Only workspace owners and admins can invite team members.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {connected && (
        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">WhatsApp Cloud API</CardTitle>
              <p className="mt-1.5 text-xs text-muted-foreground">One-to-one messages use an approved template and require recorded lead consent.</p>
            </div>
            <Badge variant="outline" className={whatsappReady ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}>
              {whatsappReady === null ? "Checking…" : whatsappReady ? "Configured" : "Setup required"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs leading-relaxed text-muted-foreground">Configure these server-only environment variables and restart the app. The template must be approved by Meta and have one body text variable for the student name.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_GRAPH_API_VERSION", "WHATSAPP_TEMPLATE_NAME", "WHATSAPP_TEMPLATE_LANGUAGE", "SUPABASE_SERVICE_ROLE_KEY"].map((key) => (
                <code key={key} className="rounded-lg border bg-muted/30 px-3 py-2 text-[11px]">{key}</code>
              ))}
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">Tokens are read only on the server and never returned by the status endpoint. SMS and cloud telephony remain disconnected because no provider was selected or configured.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4 text-primary" />Account access</CardTitle>
            <p className="text-xs text-muted-foreground">Members sign in separately and access only the organizations they belong to.</p>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <SettingLine title="Signed-in account" value={account ?? (connected ? "Loading account…" : "Not connected")} />
            <SettingLine title="Workspace role" value={activeWorkspace?.role ?? (connected ? "Loading role…" : "Available after sign-in")} />
            <SettingLine title="User management" value="Workspace invitations are sent through Supabase Auth; organization membership is enforced by RLS." />
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-primary" />Data protection</CardTitle>
            <p className="text-xs text-muted-foreground">Student and payment information is private by default.</p>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <SettingLine title="Database access" value="Authenticated requests only; organization-scoped row-level security is enabled." />
            <SettingLine title="Student documents" value="Private Supabase Storage bucket; signed download links expire after 60 seconds." />
            <SettingLine title="Application key" value="Browser access uses the publishable key. Invitation service-role credentials are server-only." />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ConnectionRow({ title, value, connected }: { title: string; value: string; connected: boolean }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border p-3">
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${connected ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
        {connected ? <CheckCircle2 className="h-4 w-4" /> : <CircleHelp className="h-4 w-4" />}
      </span>
      <div className="min-w-0"><p className="text-xs font-semibold">{title}</p><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{value}</p></div>
    </div>
  );
}

function SettingLine({ title, value }: { title: string; value: string }) {
  return <div className="flex flex-col justify-between gap-1 border-b pb-3 last:border-0 last:pb-0 sm:flex-row sm:gap-4"><span className="text-muted-foreground">{title}</span><span className="font-medium sm:text-right">{value}</span></div>;
}

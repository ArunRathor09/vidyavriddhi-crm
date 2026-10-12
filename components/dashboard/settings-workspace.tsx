"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, CheckCircle2, CircleHelp, Database, KeyRound, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCrmCollection } from "@/hooks/use-crm-collection";
import { createClient } from "@/lib/supabase/client";

export function SettingsWorkspace() {
  const connection = useCrmCollection("leads");
  const [account, setAccount] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);

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

  const connected = connection.mode === "supabase";
  const error = connection.mode === "error" ? connection.error : accountError;

  return (
    <div className="mx-auto max-w-[1180px] space-y-7">
      <div>
        <span className="text-[10px] font-bold tracking-[0.17em] text-primary">WORKSPACE ADMINISTRATION</span>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Manage your account, database connection, and student-data protections.</p>
      </div>

      {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}

      <Card className="overflow-hidden rounded-2xl border-border/80 shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between border-b bg-muted/20">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4 text-primary" />Database connection</CardTitle>
            <p className="mt-1.5 text-xs text-muted-foreground">Private PostgreSQL storage powered by Supabase.</p>
          </div>
          {connected ? (
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Connected</Badge>
          ) : connection.mode === "error" ? (
            <Badge variant="outline" className="border-destructive/30 text-destructive"><CircleHelp className="mr-1.5 h-3.5 w-3.5" />Needs attention</Badge>
          ) : (
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">{connection.mode === "loading" ? "Checking…" : "Not configured"}</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-5 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <ConnectionRow title="Supabase project" value={connected ? "Connected and responding" : "Awaiting project credentials"} connected={connected} />
            <ConnectionRow title="Authentication" value={account ?? (connected ? "Checking signed-in account…" : "Email and password sign-in")} connected={connected && Boolean(account)} />
            <ConnectionRow title="Row-level security" value="Per-user access policies included in schema.sql" connected />
            <ConnectionRow title="Private document storage" value="Private bucket and file policies included in schema.sql" connected />
          </div>
          {connection.mode === "demo" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm dark:border-amber-900/60 dark:bg-amber-950/20">
              <p className="font-semibold text-amber-900 dark:text-amber-200">Connect your Supabase project to enable production data.</p>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs leading-relaxed text-amber-900/80 dark:text-amber-100/80">
                <li>Create a project at <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">supabase.com/dashboard <ArrowUpRight className="inline h-3 w-3" /></a>.</li>
                <li>Run <code className="rounded bg-amber-100 px-1 py-0.5 font-mono dark:bg-amber-900/50">supabase/schema.sql</code> in the project&apos;s SQL Editor.</li>
                <li>Copy the Project URL and anon/publishable key into <code className="rounded bg-amber-100 px-1 py-0.5 font-mono dark:bg-amber-900/50">.env.local</code> as <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.</li>
                <li>Restart the Next.js server, then create your workspace account.</li>
              </ol>
              <p className="mt-3 text-[11px] font-medium text-amber-800 dark:text-amber-200">Never put a Supabase service-role key in a NEXT_PUBLIC_ variable or browser code.</p>
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

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4 text-primary" />Account access</CardTitle>
            <p className="text-xs text-muted-foreground">Every team member signs in to their own protected workspace.</p>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <SettingLine title="Signed-in account" value={account ?? (connected ? "Loading account…" : "Not connected")} />
            <SettingLine title="Workspace role" value={connected ? "Authenticated member" : "Available after sign-in"} />
            <SettingLine title="User management" value="Invite and manage team access in Supabase Authentication." />
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-primary" />Data protection</CardTitle>
            <p className="text-xs text-muted-foreground">Student and payment information is private by default.</p>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <SettingLine title="Database access" value="Authenticated requests only; row-level security is enabled." />
            <SettingLine title="Student documents" value="Private Supabase Storage bucket; signed download links expire after 60 seconds." />
            <SettingLine title="Application key" value="Uses the public anon key with user-scoped RLS; never a service-role key." />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ConnectionRow({ title, value, connected }: { title: string; value: string; connected: boolean }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border p-3">
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${connected ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
        {connected ? <CheckCircle2 className="h-4 w-4" /> : <CircleHelp className="h-4 w-4" />}
      </span>
      <div className="min-w-0"><p className="text-xs font-semibold">{title}</p><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{value}</p></div>
    </div>
  );
}

function SettingLine({ title, value }: { title: string; value: string }) {
  return <div className="flex flex-col justify-between gap-1 border-b pb-3 last:border-0 last:pb-0 sm:flex-row sm:gap-4"><span className="text-muted-foreground">{title}</span><span className="font-medium sm:text-right">{value}</span></div>;
}

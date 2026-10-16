"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";

export function AuthForm() {
  const configured = Boolean(getSupabaseConfig());
  const [isSignUp, setIsSignUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "confirmation_failed") {
      toast.error("Email confirmation failed. Please request a new confirmation link.");
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    setBusy(true);

    try {
      const supabase = createClient();
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
        if (!data.session) {
          setConfirmationSent(true);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      toast.success(isSignUp ? "Your workspace account is ready." : "Welcome back.");
      router.push("/dashboard");
      router.refresh();
    } catch (authError) {
      toast.error(authError instanceof Error ? authError.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-md rounded-3xl border bg-card p-7 shadow-sm sm:p-9">
          <Brand />
          <div className="mt-9">
            <h1 className="text-2xl font-semibold tracking-tight">Your admissions workspace</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Connect your Supabase project to enable account sign-in and private, persistent CRM data.</p>
          </div>
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
            <p className="font-semibold text-amber-900">Supabase is not configured yet.</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-800">Add your project URL and publishable key to <code className="rounded bg-amber-100 px-1 font-mono">.env.local</code>, then restart Next.js. You can still explore the sample CRM in local demo mode.</p>
          </div>
          <Button className="mt-5 w-full" asChild>
            <Link href="/dashboard">Continue in demo mode<ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
          <p className="mt-5 text-center text-[11px] text-muted-foreground">Demo changes are stored only in this browser.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-dvh bg-background lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden border-r border-border bg-[linear-gradient(145deg,#eef6fc_0%,#ffffff_55%,#fff4ed_100%)] px-12 py-10 text-foreground lg:flex lg:flex-col lg:justify-between xl:px-20">
        <div className="absolute -right-36 -top-28 h-[480px] w-[480px] rounded-full border border-primary/10 bg-white/40" />
        <div className="absolute -bottom-40 -left-24 h-[520px] w-[520px] rounded-full border border-orange-200/50 bg-white/35" />
        <Brand inverted />
        <div className="relative z-10 max-w-lg">
          <BadgeLine />
          <h2 className="mt-6 text-4xl font-semibold leading-[1.12] tracking-tight xl:text-5xl">Every student story, <span className="text-primary">one clear path.</span></h2>
          <p className="mt-5 max-w-md text-sm leading-7 text-slate-600">Bring enquiries, counsellor follow-ups, university applications, and fee collections into one calm, connected workspace.</p>
          <div className="mt-10 grid grid-cols-3 gap-3">
            {[
              ["01", "Enquiries"],
              ["02", "Applications"],
              ["03", "Admissions"],
            ].map(([number, label]) => (
              <div key={number} className="rounded-xl border border-white/80 bg-white/75 p-3 shadow-sm">
                <p className="text-[10px] font-semibold tracking-wider text-primary">{number}</p>
                <p className="mt-2 text-xs font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative z-10 text-[11px] text-slate-500">Secure, student-first admissions management.</p>
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden"><Brand /></div>
          <div className="mb-8">
            <BadgeLine />
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">{isSignUp ? "Create your workspace" : "Welcome back"}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{isSignUp ? "Get your team started with a secure admissions workspace." : "Sign in to pick up where your team left off."}</p>
          </div>

          {confirmationSent ? (
            <div role="status" className="rounded-2xl border bg-card p-5">
              <p className="font-semibold">Check your email</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">We sent a confirmation link. Open it to verify your account and continue to your CRM.</p>
            </div>
          ) : (
            <form onSubmit={(event) => void submit(event)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@yourcompany.com" className="h-11" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {isSignUp && <span className="text-[11px] text-muted-foreground">At least 8 characters</span>}
                </div>
                <Input id="password" name="password" type="password" autoComplete={isSignUp ? "new-password" : "current-password"} minLength={8} required placeholder="Enter your password" className="h-11" />
              </div>
              <Button type="submit" className="h-11 w-full" disabled={busy}>
                {busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isSignUp ? "Create account" : "Sign in"}
                {!busy && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isSignUp ? "Already have an account?" : "New to Vidyavriddhi?"}{" "}
            <button type="button" className="font-semibold text-primary hover:underline" onClick={() => { setConfirmationSent(false); setIsSignUp((current) => !current); }}>
              {isSignUp ? "Sign in" : "Create a workspace account"}
            </button>
          </p>
          <p className="mt-10 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5 text-primary" />Your workspace is protected with Supabase authentication and row-level security.</p>
        </div>
      </section>
    </main>
  );
}

function Brand({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link href="/dashboard" aria-label="Vidyavriddhi CRM home" className={`relative z-10 inline-flex w-fit items-center rounded-xl bg-white p-2 shadow-sm ${inverted ? "ring-1 ring-white" : "ring-1 ring-border"}`}>
      <Image
        src="/vidyavriddhi-logo.png"
        alt="Vidyavriddhi — a unit of JP Technologies"
        width={500}
        height={200}
        priority
        className="h-auto w-[210px] object-contain sm:w-[230px]"
      />
    </Link>
  );
}

function BadgeLine() {
  return <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-primary" />STUDENT ADMISSIONS PLATFORM</span>;
}

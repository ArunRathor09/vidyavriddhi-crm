import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const supabase = await createClient();

  if (!code || !supabase) {
    return NextResponse.redirect(new URL("/login?error=confirmation_failed", request.url));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("Supabase email confirmation failed.", error);
    return NextResponse.redirect(new URL("/login?error=confirmation_failed", request.url));
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}

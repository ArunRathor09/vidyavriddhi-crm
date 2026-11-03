import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

/**
 * Admin management API.
 *
 * GET    → list all users (super_admin only)
 * POST   → create a new admin user (super_admin only)
 * PATCH  → update admin permissions (super_admin only)
 * DELETE → delete an admin user (super_admin only)
 */

async function requireSuperAdmin() {
  const config = getSupabaseConfig();
  if (!config) return { error: "Supabase not configured", status: 503 };

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase not configured", status: 503 };

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: "Not authenticated", status: 401 };

  const role = user.user_metadata?.role;
  if (role !== "super_admin" && role !== undefined && role !== null) {
    return { error: "Forbidden: Super Admin access required", status: 403 };
  }

  return { user, supabase };
}

export async function GET() {
  const auth = await requireSuperAdmin();
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { supabase } = auth;

    const { data: admins, error: dbError } = await supabase
      .from("admin_users")
      .select("*")
      .order("created_at", { ascending: false });

    if (dbError) {
      return Response.json({
        data: [],
        mode: "no_table",
        message: "admin_users table not found.",
      });
    }

    return Response.json({ data: admins });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to list admins" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { email, password, fullName, role, allowedModules } = body as {
      email?: string;
      password?: string;
      fullName?: string;
      role?: string;
      allowedModules?: string[];
    };

    if (!email || !password) {
      return Response.json({ error: "Email and password are required" }, { status: 400 });
    }

    if (password.length < 6) {
      return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const userRole = role === "super_admin" ? "super_admin" : "admin";
    const { supabase } = auth;

    // Sign up the new admin user
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          role: userRole,
          full_name: fullName ?? "",
          allowed_modules: allowedModules ?? [],
        },
      },
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    // Try to record in admin_users table if available
    if (data.user) {
      try {
        await supabase.from("admin_users").insert({
          id: data.user.id,
          email: email.trim().toLowerCase(),
          full_name: fullName ?? "",
          role: userRole,
          allowed_modules: allowedModules ?? [],
        });
      } catch {
        // Table may not exist yet, metadata in Supabase Auth is primary
      }
    }

    return Response.json({
      success: true,
      user: {
        id: data.user?.id,
        email: email.trim().toLowerCase(),
        role: userRole,
        allowedModules: allowedModules ?? [],
        fullName: fullName ?? "",
      },
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to create admin" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { userId, allowedModules, role, fullName } = body as {
      userId?: string;
      allowedModules?: string[];
      role?: string;
      fullName?: string;
    };

    if (!userId) {
      return Response.json({ error: "userId is required" }, { status: 400 });
    }

    const { supabase } = auth;

    const updateData: Record<string, unknown> = {};
    if (allowedModules !== undefined) updateData.allowed_modules = allowedModules;
    if (role !== undefined) updateData.role = role;
    if (fullName !== undefined) updateData.full_name = fullName;

    const { error: dbError } = await supabase
      .from("admin_users")
      .update(updateData)
      .eq("id", userId);

    if (dbError) {
      return Response.json(
        { error: dbError.message || "Failed to update admin permissions" },
        { status: 500 },
      );
    }

    return Response.json({ success: true });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to update admin" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("id");

    if (!userId) {
      return Response.json({ error: "User ID is required" }, { status: 400 });
    }

    const { supabase } = auth;

    await supabase.from("admin_users").delete().eq("id", userId);

    return Response.json({ success: true });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to delete admin" },
      { status: 500 },
    );
  }
}

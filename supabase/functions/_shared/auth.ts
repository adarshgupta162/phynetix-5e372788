import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, any>;
}

export interface AuthClients {
  user: AuthUser;
  client: SupabaseClient;
  admin: SupabaseClient;
}

/**
 * Verify user authentication from request headers
 * Returns authenticated user and both client (user) and admin Supabase clients
 */
export async function verifyAuth(req: Request): Promise<AuthClients> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("Missing authorization header");
  }

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  
  if (authError || !user) {
    console.error("[auth] Authentication failed:", authError?.message);
    throw new Error("Unauthorized");
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      user_metadata: user.user_metadata,
    },
    client: userClient,
    admin: adminClient,
  };
}

/**
 * Verify admin role from authenticated user
 */
export async function verifyAdminAuth(
  user: AuthUser,
  adminClient: SupabaseClient
): Promise<void> {
  const { data: profile, error } = await adminClient
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[auth] Failed to fetch user profile:", error.message);
    throw new Error("Failed to verify admin status");
  }

  if (!profile || profile.role !== "admin") {
    console.warn(`[auth] Non-admin user ${user.id} attempted admin action`);
    throw new Error("Admin access required");
  }
}

/**
 * Verify staff role (admin or staff)
 */
export async function verifyStaffAuth(
  user: AuthUser,
  adminClient: SupabaseClient
): Promise<void> {
  const { data: profile, error } = await adminClient
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[auth] Failed to fetch user profile:", error.message);
    throw new Error("Failed to verify staff status");
  }

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    console.warn(`[auth] Non-staff user ${user.id} attempted staff action`);
    throw new Error("Staff access required");
  }
}

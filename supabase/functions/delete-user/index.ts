import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { verifyAuth, verifyAdminAuth } from "../_shared/auth.ts";
import { handleCorsPreFlight, successResponse, errorResponse } from "../_shared/response.ts";
import { AppError, logError } from "../_shared/errors.ts";
import { validateRequestBody, validateUUID } from "../_shared/validation.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight();
  }

  try {
    // Verify admin authentication
    const { user, client: userClient, admin: adminClient } = await verifyAuth(req);
    await verifyAdminAuth(user, adminClient);

    // Parse and validate request body
    const body = await req.json();
    const { user_id } = validateRequestBody(body, ["user_id"]);
    validateUUID(user_id, "user_id");

    // Prevent admin from deleting themselves
    if (user_id === user.id) {
      throw new AppError("Cannot delete your own account", 403);
    }

    console.log(`[delete-user] Deleting user=${user_id} by admin=${user.id}`);

    // Delete user's test attempts first
    const { error: attemptsError } = await supabaseAdmin
      .from("test_attempts")
      .delete()
      .eq("user_id", userId);

    if (attemptsError) {
      console.error("Error deleting test attempts:", attemptsError);
    }

    // Delete user's roles
    const { error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    if (rolesError) {
      console.error("Error deleting user roles:", rolesError);
    }

    // Delete user's profile
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileError) {
      console.error("Error deleting profile:", profileError);
    }

    // Delete the auth user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      throw new Error(`Failed to delete user: ${deleteError.message}`);
    }

    console.log("User deleted successfully:", userId);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in delete-user:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});

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

    // Delete user's profile (cascades to related records due to ON DELETE CASCADE)
    const { error: profileError } = await adminClient
      .from("user_profiles")
      .delete()
      .eq("id", user_id);

    if (profileError) {
      console.error("[delete-user] Failed to delete user profile:", profileError);
      throw new AppError("Failed to delete user profile", 500);
    }

    // Delete the auth user (cascades to test_attempts and proctoring records)
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user_id);

    if (deleteError) {
      console.error("[delete-user] Failed to delete auth user:", deleteError);
      throw new AppError(`Failed to delete auth user: ${deleteError.message}`, 500);
    }

    // Log audit trail
    const { error: auditError } = await adminClient
      .from("audit_logs")
      .insert({
        user_id: user.id,
        action: "delete_user",
        entity_type: "user",
        entity_id: user_id,
        new_value: { deleted_at: new Date().toISOString() },
      });

    if (auditError) {
      console.warn("[delete-user] Failed to create audit log:", auditError);
    }

    console.log(`[delete-user] Successfully deleted user=${user_id}`);

    return successResponse({ user_id, deleted_at: new Date().toISOString() });
  } catch (error: any) {
    logError("[delete-user]", error);
    const message = error?.message || "Failed to delete user";
    const status = error?.status || 400;
    return errorResponse(message, status);
  }
});

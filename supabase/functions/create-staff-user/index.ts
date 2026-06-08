import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { verifyAuth, verifyAdminAuth } from "../_shared/auth.ts";
import { handleCorsPreFlight, successResponse, errorResponse } from "../_shared/response.ts";
import { AppError, logError } from "../_shared/errors.ts";
import { validateRequestBody, validateEmail, validatePassword, validateEnum } from "../_shared/validation.ts";
import type { CreateStaffUserRequest, CreateStaffUserResponse } from "../_shared/types.ts";

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
    const { email, password, first_name, last_name, role, phone } = 
      validateRequestBody(body, ["email", "password", "first_name", "role"]) as CreateStaffUserRequest;

    // Validate inputs
    validateEmail(email);
    validatePassword(password);
    validateEnum(role, "role", ["admin", "staff"]);

    console.log(`[create-staff-user] Creating user=${email} role=${role}`);

    // Create the user in Supabase Auth
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name,
        last_name,
      },
    });

    if (createError || !newUser.user) {
      console.error("[create-staff-user] Auth user creation failed:", createError);
      throw new AppError(`Failed to create user: ${createError?.message || "Unknown error"}`, 500);
    }

    const newUserId = newUser.user.id;
    console.log(`[create-staff-user] Created auth user=${newUserId} email=${email}`);

    // Create user profile
    const { error: profileError } = await adminClient
      .from("user_profiles")
      .insert({
        id: newUserId,
        role: role,
        first_name,
        last_name,
        phone: phone || null,
      });

    if (profileError) {
      console.error("[create-staff-user] Profile creation failed:", profileError);
      // Rollback - delete the user
      await adminClient.auth.admin.deleteUser(newUserId);
      throw new AppError("Failed to create user profile", 500);
    }

    console.log(`[create-staff-user] Created profile for user=${newUserId}`);

    // Log audit trail
    const { error: auditError } = await adminClient
      .from("audit_logs")
      .insert({
        user_id: user.id,
        action: "create_user",
        entity_type: "user",
        entity_id: newUserId,
        new_value: { email, role, first_name, last_name, phone },
      });

    if (auditError) {
      console.warn("[create-staff-user] Failed to create audit log:", auditError);
    }

    console.log(`[create-staff-user] Successfully created user=${newUserId} role=${role}`);

    const response: CreateStaffUserResponse = {
      user_id: newUserId,
      email,
      first_name,
      last_name,
      role,
      created_at: new Date().toISOString(),
    };

    return successResponse(response, 201);
  } catch (error: any) {
    logError("[create-staff-user]", error);
    const message = error?.message || "Failed to create user";
    const status = error?.status || 400;
    return errorResponse(message, status);
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { handleCorsPreFlight, successResponse, errorResponse } from "../_shared/response.ts";
import { AppError, logError } from "../_shared/errors.ts";
import { validateRequestBody, validateUUID } from "../_shared/validation.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight();

  try {
    const { user, client: userClient, admin: adminClient } = await verifyAuth(req);

    const body = await req.json();
    const { attempt_id, consent_accepted, devices = {}, metadata = {} } = validateRequestBody(body, ["attempt_id", "consent_accepted"]);
    validateUUID(attempt_id, "attempt_id");

    if (!consent_accepted) {
      throw new AppError("Live proctoring consent is required", 400);
    }

    const { data: attempt, error: attemptError } = await userClient
      .from("test_attempts")
      .select("id, test_id, user_id, completed_at")
      .eq("id", attempt_id)
      .maybeSingle();

    if (attemptError || !attempt) {
      throw new AppError("Test attempt not found", 404);
    }

    if (attempt.user_id !== user.id) {
      throw new AppError("Unauthorized: cannot access this attempt", 403);
    }

    if (attempt.completed_at) {
      throw new AppError("Cannot start proctoring for a completed attempt", 403);
    }

    // Fetch proctoring settings for this test
    const { data: settings, error: settingsError } = await adminClient
      .from("proctoring_test_settings")
      .select("*")
      .eq("test_id", attempt.test_id)
      .maybeSingle();

    if (!settings?.enabled) {
      return successResponse({ enabled: false, message: "Proctoring is disabled for this test" });
    }

    // Check user-specific overrides
    const { data: override } = await userClient
      .from("proctoring_user_overrides")
      .select("allowed, enabled, require_camera, require_microphone, require_screen, allow_optional_device_fallback")
      .eq("test_id", attempt.test_id)
      .eq("user_id", user.id)
      .maybeSingle();

    const requireCamera = override?.require_camera ?? settings.require_camera;
    const requireMicrophone = override?.require_microphone ?? settings.require_microphone;
    const requireScreen = override?.require_screen ?? settings.require_screen;
    const allowFallback = override?.allow_optional_device_fallback ?? settings.allow_optional_device_fallback;

    if (override && !override.allowed) {
      throw new AppError("Proctoring is not enabled for this user on this test", 403);
    }

    // Check device permissions
    const missingRequired = [
      requireCamera && !devices.camera ? "camera" : null,
      requireMicrophone && !devices.microphone ? "microphone" : null,
      requireScreen && !devices.screen ? "screen" : null,
    ].filter(Boolean);

    if (missingRequired.length && !allowFallback) {
      throw new AppError(`Required device permission missing: ${missingRequired.join(", ")}`, 400);
    }

    console.log(`[start-proctoring] Starting session for attempt=${attempt_id} user=${user.id}`);

    const roomName = `proctoring-${attempt_id}`;
    const now = new Date().toISOString();

    // Create or update proctoring session
    const { data: session, error: sessionError } = await userClient
      .from("proctoring_sessions")
      .upsert({
        attempt_id: attempt.id,
        test_id: attempt.test_id,
        user_id: user.id,
        status: "active",
        provider: "livekit",
        provider_room_name: roomName,
        camera_enabled: !!devices.camera,
        microphone_enabled: !!devices.microphone,
        screen_enabled: !!devices.screen,
        recording_enabled: settings.recording_enabled,
        consent_accepted_at: now,
        last_heartbeat_at: now,
        metadata: { ...metadata, device_requirements: { camera: requireCamera, microphone: requireMicrophone, screen: requireScreen } },
      }, { onConflict: "attempt_id" })
      .select("*")
      .single();

    if (sessionError || !session) {
      console.error("[start-proctoring] Failed to create session:", sessionError);
      throw new AppError("Failed to create proctoring session", 500);
    }

    // Log consent accepted event
    const { error: eventError } = await userClient.from("proctoring_events").insert({
      session_id: session.id,
      attempt_id: attempt.id,
      test_id: attempt.test_id,
      user_id: user.id,
      event_type: "consent_accepted",
      payload: { devices_requested: { camera: requireCamera, microphone: requireMicrophone, screen: requireScreen } },
    });

    if (eventError) {
      console.warn("[start-proctoring] Failed to log consent event:", eventError);
    }

    // Insert permission record
    const { error: permError } = await userClient.from("monitoring_permissions").insert({
      session_id: session.id,
      attempt_id: attempt.id,
      test_id: attempt.test_id,
      user_id: user.id,
      camera_granted: !!devices.camera,
      microphone_granted: !!devices.microphone,
      screen_granted: !!devices.screen,
      permissions_payload: { devices_provided: { camera: !!devices.camera, microphone: !!devices.microphone, screen: !!devices.screen }, missing_required: missingRequired },
    });

    if (permError) {
      console.warn("[start-proctoring] Failed to create permission record:", permError);
    }

    // Log session started event
    const { error: startError } = await userClient.from("proctoring_events").insert({
      session_id: session.id,
      attempt_id: attempt.id,
      test_id: attempt.test_id,
      user_id: user.id,
      event_type: "session_started",
      payload: { provider: "livekit", room_name: roomName },
    });

    if (startError) {
      console.warn("[start-proctoring] Failed to log session_started event:", startError);
    }

    console.log(`[start-proctoring] Session created=${session.id} room=${roomName}`);

    return successResponse({ 
      enabled: true, 
      session_id: session.id,
      room_name: roomName,
      recording_enabled: session.recording_enabled,
      devices_enabled: {
        camera: session.camera_enabled,
        microphone: session.microphone_enabled,
        screen: session.screen_enabled,
      }
    });
  } catch (error: any) {
    logError("[start-proctoring-session]", error);
    const message = error?.message || "Failed to start proctoring session";
    const status = error?.status || 400;
    return errorResponse(message, status);
  }
});

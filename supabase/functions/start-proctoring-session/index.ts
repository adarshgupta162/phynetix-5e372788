import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, createLiveKitToken, getAdminClient, jsonResponse, requireUser, resolveSettings, roomNameForAttempt } from "../_shared/proctoring.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = getAdminClient();
    const user = await requireUser(req, supabaseAdmin);
    const { attempt_id, consent_accepted, devices = {}, metadata = {} } = await req.json();
    if (!attempt_id) throw new Error("attempt_id is required");
    if (!consent_accepted) throw new Error("Live monitoring consent is required");

    const { data: attempt, error: attemptError } = await supabaseAdmin
      .from("test_attempts")
      .select("id, test_id, user_id, completed_at")
      .eq("id", attempt_id)
      .maybeSingle();
    if (attemptError || !attempt) throw new Error("Attempt not found");
    if (attempt.user_id !== user.id) throw new Error("Unauthorized attempt access");
    if (attempt.completed_at) throw new Error("Cannot start monitoring for a completed attempt");

    const settings = await resolveSettings(supabaseAdmin, attempt.test_id, user.id);
    if (!settings.enabled) return jsonResponse({ enabled: false, message: "Live monitoring is disabled for this test." });
    if (!settings.allowed) throw new Error("Live monitoring is not enabled for this user on this test");

    const missingRequired = [
      settings.require_camera && !devices.camera ? "camera" : null,
      settings.require_microphone && !devices.microphone ? "microphone" : null,
      settings.require_screen && !devices.screen ? "screen" : null,
    ].filter(Boolean);
    if (missingRequired.length && !settings.allow_optional_device_fallback) {
      throw new Error(`Required monitoring permission missing: ${missingRequired.join(", ")}`);
    }

    const room = roomNameForAttempt(attempt.id);
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("proctoring_sessions")
      .upsert({
        attempt_id: attempt.id,
        test_id: attempt.test_id,
        user_id: user.id,
        status: "active",
        provider: "livekit",
        provider_room_name: room,
        camera_enabled: !!devices.camera,
        microphone_enabled: !!devices.microphone,
        screen_enabled: !!devices.screen,
        recording_enabled: settings.recording_enabled,
        consent_accepted_at: new Date().toISOString(),
        last_heartbeat_at: new Date().toISOString(),
        failure_reason: null,
        metadata: { ...metadata, requirements: settings },
      }, { onConflict: "attempt_id" })
      .select("*")
      .single();
    if (sessionError) throw sessionError;

    await supabaseAdmin.from("proctoring_events").insert([
      {
        session_id: session.id,
        attempt_id: attempt.id,
        test_id: attempt.test_id,
        user_id: user.id,
        event_type: "consent_accepted",
        payload: { consent_version: session.consent_version, settings },
      },
      {
        session_id: session.id,
        attempt_id: attempt.id,
        test_id: attempt.test_id,
        user_id: user.id,
        event_type: "permission_state",
        payload: { devices, missing_required: missingRequired },
      },
      {
        session_id: session.id,
        attempt_id: attempt.id,
        test_id: attempt.test_id,
        user_id: user.id,
        event_type: "session_started",
        payload: { provider: "livekit", room },
      },
    ]);

    const token = await createLiveKitToken(`student-${user.id}`, room, true, false);
    return jsonResponse({ enabled: true, session, settings, provider: token });
  } catch (error) {
    console.error("start-proctoring-session error", error);
    return jsonResponse({ error: error.message ?? "Failed to start proctoring session" }, 400);
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, getAdminClient, jsonResponse, requireUser } from "../_shared/proctoring.ts";

const heartbeatTypes = new Set(["heartbeat", "provider_connected", "provider_disconnected"]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = getAdminClient();
    const user = await requireUser(req, supabaseAdmin);
    const { session_id, event_type, payload = {}, question_id = null, subject_name = null } = await req.json();
    if (!session_id || !event_type) throw new Error("session_id and event_type are required");

    const { data: session, error: sessionError } = await supabaseAdmin
      .from("proctoring_sessions")
      .select("*")
      .eq("id", session_id)
      .maybeSingle();
    if (sessionError || !session) throw new Error("Proctoring session not found");
    if (session.user_id !== user.id) throw new Error("Unauthorized session access");

    const { data: event, error: insertError } = await supabaseAdmin
      .from("proctoring_events")
      .insert({
        session_id: session.id,
        attempt_id: session.attempt_id,
        test_id: session.test_id,
        user_id: user.id,
        event_type,
        question_id,
        subject_name,
        payload,
      })
      .select("*")
      .single();
    if (insertError) throw insertError;

    if (heartbeatTypes.has(event_type)) {
      await supabaseAdmin
        .from("proctoring_sessions")
        .update({ status: "active", last_heartbeat_at: new Date().toISOString() })
        .eq("id", session.id);
    }

    return jsonResponse({ event });
  } catch (error) {
    console.error("log-proctoring-event error", error);
    return jsonResponse({ error: error.message ?? "Failed to log event" }, 400);
  }
});

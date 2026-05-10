import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, getAdminClient, isAdmin, jsonResponse, requireUser } from "../_shared/proctoring.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = getAdminClient();
    const user = await requireUser(req, supabaseAdmin);
    const { session_id, attempt_id, reason = "stopped" } = await req.json();
    if (!session_id && !attempt_id) throw new Error("session_id or attempt_id is required");

    let query = supabaseAdmin.from("proctoring_sessions").select("*");
    query = session_id ? query.eq("id", session_id) : query.eq("attempt_id", attempt_id);
    const { data: session, error: sessionError } = await query.maybeSingle();
    if (sessionError || !session) return jsonResponse({ stopped: false, message: "No active proctoring session found" });

    const admin = await isAdmin(supabaseAdmin, user.id);
    if (!admin && session.user_id !== user.id) throw new Error("Unauthorized session access");

    const endedAt = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("proctoring_sessions")
      .update({ status: "ended", ended_at: endedAt, last_heartbeat_at: endedAt })
      .eq("id", session.id);
    if (updateError) throw updateError;

    await supabaseAdmin.from("proctoring_events").insert({
      session_id: session.id,
      attempt_id: session.attempt_id,
      test_id: session.test_id,
      user_id: session.user_id,
      event_type: "session_stopped",
      payload: { reason, stopped_by: user.id, stopped_by_admin: admin },
    });

    return jsonResponse({ stopped: true });
  } catch (error) {
    console.error("stop-proctoring-session error", error);
    return jsonResponse({ error: error.message ?? "Failed to stop proctoring session" }, 400);
  }
});

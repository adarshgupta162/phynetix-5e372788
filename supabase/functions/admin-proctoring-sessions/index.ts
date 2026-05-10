import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, createLiveKitToken, getAdminClient, isAdmin, jsonResponse, requireUser } from "../_shared/proctoring.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = getAdminClient();
    const user = await requireUser(req, supabaseAdmin);
    if (!(await isAdmin(supabaseAdmin, user.id))) throw new Error("Admin access required");

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const sessionId = body.session_id;

    let query = supabaseAdmin
      .from("proctoring_sessions")
      .select("*, tests(name, exam_type, test_type), test_attempts(answers, time_per_question, fullscreen_exit_count, started_at, completed_at)")
      .order("started_at", { ascending: false })
      .limit(100);

    if (sessionId) query = query.eq("id", sessionId);
    else query = query.in("status", ["pending", "active", "stale"]);

    const { data: sessions, error: sessionsError } = await query;
    if (sessionsError) throw sessionsError;

    const studentIds = Array.from(new Set((sessions ?? []).map((session) => session.user_id).filter(Boolean)));
    const { data: profiles } = studentIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, avatar_url").in("id", studentIds)
      : { data: [] };
    const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const hydratedSessions = (sessions ?? []).map((session) => ({
      ...session,
      profiles: profileMap.get(session.user_id) ?? null,
    }));

    const sessionIds = hydratedSessions.map((session) => session.id);
    const { data: events } = sessionIds.length
      ? await supabaseAdmin
        .from("proctoring_events")
        .select("*")
        .in("session_id", sessionIds)
        .order("created_at", { ascending: false })
        .limit(300)
      : { data: [] };

    const viewerTokens: Record<string, unknown> = {};
    if (sessionId && hydratedSessions?.[0]) {
      viewerTokens[sessionId] = await createLiveKitToken(`admin-${user.id}`, hydratedSessions[0].provider_room_name, false, true);
      await supabaseAdmin.from("audit_logs").insert({
        user_id: user.id,
        action: "open_live_proctoring_viewer",
        entity_type: "proctoring_session",
        entity_id: sessionId,
        new_value: { student_user_id: hydratedSessions[0].user_id, test_id: hydratedSessions[0].test_id },
      });
    }

    return jsonResponse({ sessions: hydratedSessions, events: events ?? [], viewer_tokens: viewerTokens });
  } catch (error) {
    console.error("admin-proctoring-sessions error", error);
    return jsonResponse({ error: error.message ?? "Failed to load live monitoring sessions" }, 400);
  }
});

// Cloudflare Realtime (Calls) proxy — keeps APP_TOKEN server-side.
// Endpoints:
//   POST { action: "new-session" }                                  -> { sessionId }
//   POST { action: "tracks-publish", sessionId, sdp, tracks }       -> CF response (answer SDP + assigned trackNames)
//   POST { action: "tracks-pull", sessionId, tracks }               -> CF response (offer SDP + tracks, requiresImmediateRenegotiation)
//   POST { action: "renegotiate", sessionId, sdp, type }            -> CF response
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APP_ID = Deno.env.get("CLOUDFLARE_REALTIME_APP_ID")!;
const APP_TOKEN = Deno.env.get("CLOUDFLARE_REALTIME_APP_TOKEN")!;
const CF_BASE = `https://rtc.live.cloudflare.com/v1/apps/${APP_ID}`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function cf(path: string, init: RequestInit = {}) {
  const res = await fetch(`${CF_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${APP_TOKEN}`,
      "Content-Type": "application/json",
    },
  });
  const text = await res.text();
  let body: unknown;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  return { ok: res.ok, status: res.status, body };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (!APP_ID || !APP_TOKEN) {
    return json({ error: "Cloudflare Realtime not configured (CLOUDFLARE_REALTIME_APP_ID / CLOUDFLARE_REALTIME_APP_TOKEN missing)" }, 500);
  }

  // Auth — require any logged-in user (student publishes, admin pulls)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const action = String(payload?.action || "");

  try {
    if (action === "new-session") {
      const r = await cf(`/sessions/new`, { method: "POST", body: JSON.stringify({}) });
      if (!r.ok) return json({ error: "cf_new_session_failed", detail: r.body }, 502);
      return json(r.body);
    }

    if (action === "tracks-publish") {
      const { sessionId, sdp, tracks } = payload;
      if (!sessionId || !sdp || !Array.isArray(tracks)) return json({ error: "Missing fields" }, 400);
      const r = await cf(`/sessions/${encodeURIComponent(sessionId)}/tracks/new`, {
        method: "POST",
        body: JSON.stringify({
          sessionDescription: { sdp, type: "offer" },
          tracks: tracks.map((t: any) => ({ location: "local", mid: t.mid, trackName: t.trackName })),
        }),
      });
      if (!r.ok) return json({ error: "cf_publish_failed", detail: r.body }, 502);
      return json(r.body);
    }

    if (action === "tracks-pull") {
      const { sessionId, tracks } = payload;
      if (!sessionId || !Array.isArray(tracks)) return json({ error: "Missing fields" }, 400);
      const r = await cf(`/sessions/${encodeURIComponent(sessionId)}/tracks/new`, {
        method: "POST",
        body: JSON.stringify({
          tracks: tracks.map((t: any) => ({
            location: "remote",
            sessionId: t.sessionId,
            trackName: t.trackName,
          })),
        }),
      });
      if (!r.ok) return json({ error: "cf_pull_failed", detail: r.body }, 502);
      return json(r.body);
    }

    if (action === "renegotiate") {
      const { sessionId, sdp, type } = payload;
      if (!sessionId || !sdp) return json({ error: "Missing fields" }, 400);
      const r = await cf(`/sessions/${encodeURIComponent(sessionId)}/renegotiate`, {
        method: "PUT",
        body: JSON.stringify({ sessionDescription: { sdp, type: type || "answer" } }),
      });
      if (!r.ok) return json({ error: "cf_renegotiate_failed", detail: r.body }, 502);
      return json(r.body);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: "internal", message: String(e) }, 500);
  }
});

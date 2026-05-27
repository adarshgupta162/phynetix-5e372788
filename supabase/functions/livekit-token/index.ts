// Mints LiveKit access tokens for publisher (student) and subscriber (admin).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { AccessToken } from "npm:livekit-server-sdk@2.9.4";

const LIVEKIT_URL = Deno.env.get("LIVEKIT_URL")!;
const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY")!;
const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return json({ error: "LiveKit secrets not configured" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const role: "publisher" | "subscriber" = body.role === "subscriber" ? "subscriber" : "publisher";
    const room: string = String(body.room || `proc-${userId}`);
    const identity: string = String(body.identity || `${role}-${userId}-${crypto.randomUUID().slice(0, 8)}`);
    const name: string = String(body.name || identity);

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      name,
      ttl: 60 * 60 * 6, // 6h
    });
    at.addGrant({
      room,
      roomJoin: true,
      canPublish: role === "publisher",
      canSubscribe: true,
      canPublishData: true,
      hidden: role === "subscriber",
    });

    const token = await at.toJwt();
    return json({ token, url: LIVEKIT_URL, room, identity });
  } catch (e) {
    console.error("livekit-token error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Mints LiveKit access tokens for publisher (student) and subscriber (admin).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LIVEKIT_URL = Deno.env.get("LIVEKIT_URL")?.trim() ?? "";
const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY")?.trim() ?? "";
const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET")?.trim() ?? "";

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

    const token = await createLiveKitJwt({
      apiKey: LIVEKIT_API_KEY,
      apiSecret: LIVEKIT_API_SECRET,
      identity,
      name,
      room,
      canPublish: role === "publisher",
      hidden: role === "subscriber",
    });
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

async function createLiveKitJwt(opts: {
  apiKey: string;
  apiSecret: string;
  identity: string;
  name: string;
  room: string;
  canPublish: boolean;
  hidden: boolean;
}) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    iss: opts.apiKey,
    sub: opts.identity,
    name: opts.name,
    iat: now,
    nbf: now - 10,
    exp: now + 60 * 60 * 6,
    video: {
      room: opts.room,
      roomJoin: true,
      canPublish: opts.canPublish,
      canSubscribe: true,
      canPublishData: true,
      hidden: opts.hidden,
    },
  };

  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(opts.apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64Url(signature)}`;
}

function base64Url(input: string | ArrayBuffer) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = "";
  bytes.forEach((byte) => binary += String.fromCharCode(byte));
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

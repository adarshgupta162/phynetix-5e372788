import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export const getAdminClient = () => createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export const requireUser = async (req: Request, supabaseAdmin = getAdminClient()) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Missing authorization header");
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");
  return user;
};

export const isAdmin = async (supabaseAdmin: ReturnType<typeof getAdminClient>, userId: string) => {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
};

export type EffectiveProctoringSettings = {
  enabled: boolean;
  allowed: boolean;
  require_camera: boolean;
  require_microphone: boolean;
  require_screen: boolean;
  allow_optional_device_fallback: boolean;
  recording_enabled: boolean;
  retention_days: number;
  instructions: string | null;
  allow_specific_users_only: boolean;
};

export const resolveSettings = async (
  supabaseAdmin: ReturnType<typeof getAdminClient>,
  testId: string,
  userId: string,
): Promise<EffectiveProctoringSettings> => {
  const { data: settings } = await supabaseAdmin
    .from("proctoring_test_settings")
    .select("*")
    .eq("test_id", testId)
    .maybeSingle();

  const base: EffectiveProctoringSettings = {
    enabled: settings?.enabled ?? false,
    allowed: true,
    require_camera: settings?.require_camera ?? true,
    require_microphone: settings?.require_microphone ?? true,
    require_screen: settings?.require_screen ?? true,
    allow_optional_device_fallback: settings?.allow_optional_device_fallback ?? false,
    recording_enabled: settings?.recording_enabled ?? false,
    retention_days: settings?.retention_days ?? 30,
    instructions: settings?.instructions ?? null,
    allow_specific_users_only: settings?.allow_specific_users_only ?? false,
  };

  const { data: override } = await supabaseAdmin
    .from("proctoring_user_overrides")
    .select("*")
    .eq("test_id", testId)
    .eq("user_id", userId)
    .maybeSingle();

  if (base.allow_specific_users_only && !override) base.allowed = false;
  if (override) {
    base.allowed = override.allowed ?? base.allowed;
    if (override.enabled !== null && override.enabled !== undefined) base.enabled = override.enabled;
    if (override.require_camera !== null && override.require_camera !== undefined) base.require_camera = override.require_camera;
    if (override.require_microphone !== null && override.require_microphone !== undefined) base.require_microphone = override.require_microphone;
    if (override.require_screen !== null && override.require_screen !== undefined) base.require_screen = override.require_screen;
    if (override.allow_optional_device_fallback !== null && override.allow_optional_device_fallback !== undefined) {
      base.allow_optional_device_fallback = override.allow_optional_device_fallback;
    }
  }

  return base;
};

const base64Url = (input: ArrayBuffer | string) => {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = "";
  bytes.forEach((b) => binary += String.fromCharCode(b));
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
};

export const createLiveKitToken = async (identity: string, room: string, canPublish: boolean, canSubscribe: boolean) => {
  const apiKey = Deno.env.get("LIVEKIT_API_KEY");
  const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
  const livekitUrl = Deno.env.get("LIVEKIT_URL");
  if (!apiKey || !apiSecret || !livekitUrl) return { provider_configured: false, token: null, livekit_url: livekitUrl ?? null };

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    iss: apiKey,
    sub: identity,
    nbf: now - 10,
    exp: now + 60 * 60 * 4,
    video: {
      room,
      roomJoin: true,
      canPublish,
      canSubscribe,
      canPublishData: true,
    },
  };

  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(unsigned));
  return { provider_configured: true, token: `${unsigned}.${base64Url(signature)}`, livekit_url: livekitUrl };
};

export const roomNameForAttempt = (attemptId: string) => `proctoring-${attemptId}`;

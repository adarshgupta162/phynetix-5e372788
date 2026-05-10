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

type SupabaseErrorLike = { code?: string | null; message?: string | null; details?: string | null };

const isMissingSupabaseTableError = (error: SupabaseErrorLike | null | undefined) => {
  if (!error) return false;
  const code = error.code ?? "";
  const message = error.message ?? "";
  return code === "42P01" || code === "PGRST205" || code === "42703" || code === "42883" || message.includes("schema cache");
};

export const PROCTORING_SCHEMA_ERROR_CODE = "PROCTORING_SCHEMA_MISSING";
export const PROCTORING_SCHEMA_MISSING_MESSAGE = "Live monitoring schema is missing. Run latest Supabase migrations and reload.";

const REQUIRED_TABLE_COLUMNS: Record<string, string[]> = {
  proctoring_test_settings: ["id", "test_id", "enabled", "allow_specific_users_only"],
  proctoring_user_overrides: ["id", "test_id", "user_id", "allowed"],
  proctoring_sessions: ["id", "attempt_id", "test_id", "user_id", "status", "provider_room_name", "last_heartbeat_at"],
  proctoring_events: ["id", "session_id", "attempt_id", "event_type", "created_at"],
};

const REQUIRED_MIGRATIONS = [
  "20260510090000_add_live_proctoring.sql",
  "20260510100500_fix_proctoring_settings_table_compat.sql",
  "20260510113000_fix_proctoring_user_overrides_compat.sql",
  "20260510140000_repair_live_monitoring_schema.sql",
];

const PROCTORING_SCHEMA_CACHE_TTL_MS = 30_000;

type ProctoringSchemaDiagnostics = {
  checked_at: string;
  missing_tables: string[];
  missing_columns: Record<string, string[]>;
  stale_migrations: string[];
};

type ProctoringSchemaHealth = {
  ready: boolean;
  diagnostics: ProctoringSchemaDiagnostics | null;
};

let schemaHealthCache: { checkedAtMs: number; value: ProctoringSchemaHealth } | null = null;

const missingColumnFromError = (error: SupabaseErrorLike | null | undefined) => {
  const text = `${error?.message ?? ""} ${error?.details ?? ""}`;
  const quoted = text.match(/column\\s+\"([^\"]+)\"/i)?.[1];
  if (quoted) return quoted;
  return text.match(/column\\s+([a-zA-Z0-9_]+)/i)?.[1] ?? null;
};

const buildProctoringSchemaDiagnostics = (
  missingTables: string[],
  missingColumns: Record<string, string[]>,
): ProctoringSchemaDiagnostics => ({
  checked_at: new Date().toISOString(),
  missing_tables: missingTables,
  missing_columns: missingColumns,
  stale_migrations: missingTables.length || Object.keys(missingColumns).length ? REQUIRED_MIGRATIONS : [],
});

export const validateProctoringSchema = async (
  supabaseAdmin: ReturnType<typeof getAdminClient>,
  forceRefresh = false,
): Promise<ProctoringSchemaHealth> => {
  const now = Date.now();
  if (!forceRefresh && schemaHealthCache && (now - schemaHealthCache.checkedAtMs) < PROCTORING_SCHEMA_CACHE_TTL_MS) {
    return schemaHealthCache.value;
  }

  const missingTables = new Set<string>();
  const missingColumns = new Map<string, Set<string>>();

  await Promise.all(Object.entries(REQUIRED_TABLE_COLUMNS).map(async ([table, requiredColumns]) => {
    const { error: tableError } = await supabaseAdmin
      .from(table)
      .select("id", { head: true, count: "exact" })
      .limit(1);

    if (tableError && isMissingSupabaseTableError(tableError)) {
      missingTables.add(table);
      return;
    }
    if (tableError) return;

    await Promise.all(requiredColumns.map(async (column) => {
      const { error: columnError } = await supabaseAdmin
        .from(table)
        .select(column, { head: true, count: "exact" })
        .limit(1);

      if (!columnError) return;
      if (isMissingSupabaseTableError(columnError)) {
        const resolvedColumn = missingColumnFromError(columnError) ?? column;
        const existing = missingColumns.get(table) ?? new Set<string>();
        existing.add(resolvedColumn);
        missingColumns.set(table, existing);
      }
    }));
  }));

  const diagnostics = buildProctoringSchemaDiagnostics(
    Array.from(missingTables).sort(),
    Object.fromEntries(Array.from(missingColumns.entries()).map(([table, columns]) => [table, Array.from(columns).sort()])),
  );

  const value: ProctoringSchemaHealth = {
    ready: diagnostics.missing_tables.length === 0 && Object.keys(diagnostics.missing_columns).length === 0,
    diagnostics: diagnostics.missing_tables.length || Object.keys(diagnostics.missing_columns).length ? diagnostics : null,
  };

  schemaHealthCache = { checkedAtMs: now, value };
  return value;
};

export const buildProctoringSchemaErrorPayload = (diagnostics: ProctoringSchemaDiagnostics | null) => ({
  code: PROCTORING_SCHEMA_ERROR_CODE,
  error: PROCTORING_SCHEMA_MISSING_MESSAGE,
  diagnostics,
});

export const requireProctoringSchema = async (
  supabaseAdmin: ReturnType<typeof getAdminClient>,
): Promise<Response | null> => {
  const health = await validateProctoringSchema(supabaseAdmin);
  if (health.ready) return null;
  return jsonResponse(buildProctoringSchemaErrorPayload(health.diagnostics), 503);
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

const DEFAULT_EFFECTIVE_PROCTORING_SETTINGS: EffectiveProctoringSettings = {
  enabled: false,
  allowed: true,
  require_camera: true,
  require_microphone: true,
  require_screen: true,
  allow_optional_device_fallback: false,
  recording_enabled: false,
  retention_days: 30,
  instructions: null,
  allow_specific_users_only: false,
};

export const resolveSettings = async (
  supabaseAdmin: ReturnType<typeof getAdminClient>,
  testId: string,
  userId: string,
): Promise<EffectiveProctoringSettings> => {
  const { data: settings, error: settingsError } = await supabaseAdmin
    .from("proctoring_test_settings")
    .select("*")
    .eq("test_id", testId)
    .maybeSingle();

  if (settingsError && isMissingSupabaseTableError(settingsError)) {
    return DEFAULT_EFFECTIVE_PROCTORING_SETTINGS;
  }

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

  const { data: override, error: overrideError } = await supabaseAdmin
    .from("proctoring_user_overrides")
    .select("*")
    .eq("test_id", testId)
    .eq("user_id", userId)
    .maybeSingle();

  if (overrideError && isMissingSupabaseTableError(overrideError)) {
    return { ...base, allowed: !base.allow_specific_users_only };
  }

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

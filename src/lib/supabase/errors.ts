type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

export const PROCTORING_SCHEMA_ERROR_CODE = 'PROCTORING_SCHEMA_MISSING';
export const LIVE_MONITORING_SCHEMA_MISSING_MESSAGE = 'Live monitoring schema is missing. Run latest Supabase migrations and reload.';

export const isMissingSupabaseTableError = (error: SupabaseErrorLike | null | undefined): boolean => {
  if (!error) return false;
  const code = error.code ?? '';
  const message = error.message ?? '';
  return code === '42P01' || code === 'PGRST205' || code === '42703' || code === '42883' || message.includes('schema cache');
};

export const isProctoringSchemaMissingError = (
  error: SupabaseErrorLike | null | undefined,
  payload?: { code?: string | null; error?: string | null } | null,
): boolean => {
  if (payload?.code === PROCTORING_SCHEMA_ERROR_CODE) return true;
  if (payload?.error?.includes('schema')) return true;
  return isMissingSupabaseTableError(error);
};

export type ProctoringSchemaDiagnostics = {
  checked_at?: string;
  missing_tables?: string[];
  missing_columns?: Record<string, string[]>;
  stale_migrations?: string[];
} | null;

export const extractProctoringSchemaDiagnostics = (payload: unknown): ProctoringSchemaDiagnostics => {
  if (!payload || typeof payload !== 'object') return null;
  return (payload as { diagnostics?: ProctoringSchemaDiagnostics }).diagnostics ?? null;
};

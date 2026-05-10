type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

export const isMissingSupabaseTableError = (error: SupabaseErrorLike | null | undefined): boolean => {
  if (!error) return false;
  const code = error.code ?? '';
  const message = error.message ?? '';
  return code === '42P01' || code === 'PGRST205' || message.includes('schema cache');
};

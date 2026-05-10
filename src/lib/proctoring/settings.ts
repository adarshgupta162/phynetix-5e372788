import { supabase } from '@/integrations/supabase/client';
import { isMissingSupabaseTableError } from '@/lib/supabase/errors';
import type { ProctoringSettings } from './types';

export const DEFAULT_PROCTORING_SETTINGS: ProctoringSettings = {
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

export async function loadEffectiveProctoringSettings(testId: string, userId?: string | null): Promise<ProctoringSettings> {
  const { data: settings, error: settingsError } = await supabase
    .from('proctoring_test_settings')
    .select('*')
    .eq('test_id', testId)
    .maybeSingle();

  if (settingsError && isMissingSupabaseTableError(settingsError)) return DEFAULT_PROCTORING_SETTINGS;
  if (!settings) return DEFAULT_PROCTORING_SETTINGS;

  let effective: ProctoringSettings = {
    enabled: settings.enabled ?? false,
    allowed: true,
    require_camera: settings.require_camera ?? true,
    require_microphone: settings.require_microphone ?? true,
    require_screen: settings.require_screen ?? true,
    allow_optional_device_fallback: settings.allow_optional_device_fallback ?? false,
    recording_enabled: settings.recording_enabled ?? false,
    retention_days: settings.retention_days ?? 30,
    instructions: settings.instructions ?? null,
    allow_specific_users_only: settings.allow_specific_users_only ?? false,
  };

  if (userId) {
    const { data: override, error: overrideError } = await supabase
      .from('proctoring_user_overrides')
      .select('*')
      .eq('test_id', testId)
      .eq('user_id', userId)
      .maybeSingle();

    if (overrideError && isMissingSupabaseTableError(overrideError)) {
      return {
        ...effective,
        allowed: !effective.allow_specific_users_only,
      };
    }
    if (effective.allow_specific_users_only && !override) effective.allowed = false;
    if (override) {
      effective = {
        ...effective,
        allowed: override.allowed ?? effective.allowed,
        enabled: override.enabled ?? effective.enabled,
        require_camera: override.require_camera ?? effective.require_camera,
        require_microphone: override.require_microphone ?? effective.require_microphone,
        require_screen: override.require_screen ?? effective.require_screen,
        allow_optional_device_fallback: override.allow_optional_device_fallback ?? effective.allow_optional_device_fallback,
      };
    }
  }

  return effective;
}

export type ProctoringSettings = {
  enabled: boolean;
  allowed: boolean;
  require_camera: boolean;
  require_microphone: boolean;
  require_screen: boolean;
  allow_optional_device_fallback: boolean;
  recording_enabled: boolean;
  retention_days: number;
  instructions?: string | null;
  allow_specific_users_only?: boolean;
};

export type ProctoringDeviceState = {
  camera: boolean;
  microphone: boolean;
  screen: boolean;
};

export type ProctoringSession = {
  id: string;
  attempt_id: string;
  test_id: string;
  user_id: string;
  status: 'pending' | 'active' | 'ended' | 'failed' | 'stale';
  provider: string;
  provider_room_name: string;
  camera_enabled: boolean;
  microphone_enabled: boolean;
  screen_enabled: boolean;
  recording_enabled: boolean;
  last_heartbeat_at: string | null;
  started_at: string;
  ended_at: string | null;
  failure_reason: string | null;
  metadata?: Record<string, unknown>;
};

export type ProctoringEventPayload = {
  questionId?: string | null;
  subjectName?: string | null;
  payload?: Record<string, unknown>;
};

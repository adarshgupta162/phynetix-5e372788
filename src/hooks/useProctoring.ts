import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { loadEffectiveProctoringSettings } from '@/lib/proctoring/settings';
import { publishStreams, type PublishHandle } from '@/lib/proctoring/livekit';
import type {
  MonitoringSessionRecord,
  ProctoringDeviceState,
  ProctoringEventPayload,
  ProctoringSession,
  ProctoringSettings,
} from '@/lib/proctoring/types';

const stopStream = (stream: MediaStream | null) => stream?.getTracks().forEach((track) => track.stop());
const nowIso = () => new Date().toISOString();

const isMonitoringSessionRecord = (value: unknown): value is MonitoringSessionRecord => {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<MonitoringSessionRecord>;
  return typeof row.id === 'string' && typeof row.attempt_id === 'string' && typeof row.started_at === 'string';
};

const buildSessionModel = (
  row: MonitoringSessionRecord,
  fallback: { testId?: string | null; studentId?: string | null; devices: ProctoringDeviceState },
): ProctoringSession => ({
  id: row.id,
  attempt_id: row.attempt_id,
  test_id: fallback.testId ?? '',
  user_id: row.student_id ?? fallback.studentId ?? '',
  status: (row.status as ProctoringSession['status']) ?? 'active',
  provider: '',
  provider_room_name: '',
  camera_enabled: fallback.devices.camera,
  microphone_enabled: fallback.devices.microphone,
  screen_enabled: fallback.devices.screen,
  recording_enabled: false,
  last_heartbeat_at: null,
  started_at: row.started_at,
  ended_at: row.ended_at,
  failure_reason: null,
  metadata: row.metadata ?? {},
});

type ProctoringStartResult = ProctoringSession & { session: ProctoringSession };

export function useProctoring(testId?: string | null, userId?: string | null) {
  const [settings, setSettings] = useState<ProctoringSettings | null>(null);
  const [session, setSession] = useState<ProctoringSession | null>(null);
  const [devices, setDevices] = useState<ProctoringDeviceState>({ camera: false, microphone: false, screen: false });
  const [isPreparing, setIsPreparing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const connectionRef = useRef<PublishHandle | null>(null);
  const sessionRef = useRef<ProctoringSession | null>(null);
  const devicesRef = useRef<ProctoringDeviceState>({ camera: false, microphone: false, screen: false });

  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { devicesRef.current = devices; }, [devices]);

  const loadSettings = useCallback(async () => {
    if (!testId) return null;
    const next = await loadEffectiveProctoringSettings(testId, userId);
    setSettings(next);
    return next;
  }, [testId, userId]);

  useEffect(() => {
    loadSettings().catch((error) => console.error('Failed to load proctoring settings', error));
  }, [loadSettings]);

  const logEvent = useCallback(async (eventType: string, event?: ProctoringEventPayload) => {
    const activeSession = sessionRef.current;
    if (!activeSession?.id) return;
    const { error } = await supabase.from('monitoring_events').insert({
      session_id: String(activeSession.id),
      event_type: eventType,
      metadata: {
        question_id: event?.questionId ?? null,
        subject_name: event?.subjectName ?? null,
        ...(event?.payload ?? {}),
      },
      created_at: nowIso(),
    } as any);
    if (error) console.warn('Failed to log proctoring event', error);
  }, []);

  // Screenshot capture removed: live camera + screen share + activity events only.


  const prepare = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!testId) return { settings: null, devices: { camera: false, microphone: false, screen: false } };
    setIsPreparing(true);
    const effective = settings ?? await loadSettings();
    if (!effective?.enabled) {
      setIsPreparing(false);
      return { settings: effective, devices: { camera: false, microphone: false, screen: false } };
    }
    if (!effective.allowed) {
      setIsPreparing(false);
      throw new Error('Live monitoring is enabled only for selected students on this test. Your account is not allowed for this monitored attempt.');
    }

    if (!opts.silent) {
      const consentText = [
        'This test uses live monitoring.',
        effective.require_camera ? 'Camera is required.' : 'Camera may be optional.',
        effective.require_microphone ? 'Microphone is required.' : 'Microphone may be optional.',
        effective.require_screen ? 'Screen sharing is required.' : 'Screen sharing may be optional.',
        effective.recording_enabled ? `Recording may be retained for ${effective.retention_days} days.` : 'The session is live-view only unless your institute enables recording.',
        effective.instructions || '',
        'Do you consent to start monitoring for this attempt?',
      ].filter(Boolean).join('\n');

      if (!window.confirm(consentText)) {
        setIsPreparing(false);
        throw new Error('Live monitoring consent is required to start this test.');
      }
    }

    const nextDevices: ProctoringDeviceState = { camera: false, microphone: false, screen: false };
    const failures: string[] = [];

    try {
      if (effective.require_camera || effective.require_microphone) {
        cameraStreamRef.current = await navigator.mediaDevices.getUserMedia({
          video: effective.require_camera,
          audio: effective.require_microphone,
        });
        nextDevices.camera = effective.require_camera ? cameraStreamRef.current.getVideoTracks().length > 0 : false;
        nextDevices.microphone = effective.require_microphone ? cameraStreamRef.current.getAudioTracks().length > 0 : false;
        cameraStreamRef.current.getVideoTracks().forEach((track) => {
          track.onended = () => logEvent('camera_stopped', { payload: { label: track.label } });
        });
        cameraStreamRef.current.getAudioTracks().forEach((track) => {
          track.onmute = () => logEvent('microphone_muted', { payload: { label: track.label } });
        });
      }
    } catch (error) {
      failures.push('camera/microphone');
      console.error('Camera/microphone permission failed', error);
    }

    try {
      if (effective.require_screen) {
        screenStreamRef.current = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        nextDevices.screen = screenStreamRef.current.getVideoTracks().length > 0;
        screenStreamRef.current.getTracks().forEach((track) => {
          track.onended = () => logEvent('screen_share_stopped', { payload: { label: track.label, kind: track.kind } });
        });
      }
    } catch (error) {
      failures.push('screen');
      console.error('Screen permission failed', error);
    }

    const missingRequired = [
      effective.require_camera && !nextDevices.camera ? 'camera' : null,
      effective.require_microphone && !nextDevices.microphone ? 'microphone' : null,
      effective.require_screen && !nextDevices.screen ? 'screen' : null,
    ].filter(Boolean);

    if (missingRequired.length && !effective.allow_optional_device_fallback) {
      stopStream(cameraStreamRef.current);
      stopStream(screenStreamRef.current);
      cameraStreamRef.current = null;
      screenStreamRef.current = null;
      setIsPreparing(false);
      throw new Error(`Please allow required monitoring permission(s): ${missingRequired.join(', ')}`);
    }

    setDevices(nextDevices);
    devicesRef.current = nextDevices;
    setIsPreparing(false);
    return { settings: effective, devices: nextDevices, failures };
  }, [loadSettings, logEvent, settings, testId]);

  const start = useCallback(async (attemptId: string, metadata: Record<string, unknown> = {}): Promise<ProctoringStartResult | null> => {
    if (!attemptId) return null;
    const effective = settings ?? await loadSettings();
    if (!effective?.enabled) return null;

    const studentId = userId ?? (await supabase.auth.getUser()).data.user?.id ?? null;
    const deviceState = devicesRef.current;

    const roomName = `proc-${attemptId}`;
    let publish: PublishHandle | null = null;
    const liveStreamRequired = effective.require_camera || effective.require_microphone || effective.require_screen || deviceState.camera || deviceState.microphone || deviceState.screen;
    if (liveStreamRequired && !cameraStreamRef.current && !screenStreamRef.current) {
      throw new Error('Live stream could not start. Please allow camera and screen sharing permissions, then resume the test again.');
    }

    // Fetch denormalized names for the admin grid
    let studentName: string | null = null;
    let testName: string | null = null;
    try {
      if (studentId) {
        const { data: p } = await supabase.from('profiles').select('full_name').eq('id', studentId).maybeSingle();
        studentName = (p as any)?.full_name ?? null;
      }
      if (testId) {
        const { data: t } = await supabase.from('tests').select('name').eq('id', testId).maybeSingle();
        testName = (t as any)?.name ?? null;
      }
    } catch { /* best effort */ }

    const basePayload = {
      attempt_id: String(attemptId),
      student_id: studentId ? String(studentId) : null,
      test_id: testId ?? null,
      student_name: studentName,
      test_name: testName,
      status: 'active',
      cf_session_id: liveStreamRequired ? roomName : null,
      last_heartbeat_at: new Date().toISOString(),
      metadata: {
        ...metadata,
        devices: deviceState,
        test_id: testId ?? null,
        test_name: testName,
        student_name: studentName,
        consent_accepted: true,
        provider: 'supabase-webrtc',
      },
    } as any;

    const { data: existingRows, error: existingError } = await supabase
      .from('monitoring_sessions')
      .select('*')
      .eq('attempt_id', String(attemptId))
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1);
    if (existingError) throw new Error(`Live monitoring session lookup failed: ${existingError.message}`);

    const existing = Array.isArray(existingRows) ? existingRows[0] : null;
    const initialResult = existing
      ? await supabase.from('monitoring_sessions').update(basePayload).eq('id', existing.id).select('*').single()
      : await supabase.from('monitoring_sessions').insert(basePayload).select('*').single();

    if (initialResult.error || !initialResult.data || !isMonitoringSessionRecord(initialResult.data)) {
      throw new Error(`Live monitoring session could not be created: ${initialResult.error?.message || 'Unknown database error'}`);
    }

    let data = initialResult.data;
    const initialSession = buildSessionModel(data, { devices: deviceState, studentId, testId });
    setSession(initialSession);
    sessionRef.current = initialSession;

    // Start LiveKit publisher before admins subscribe. Non-fatal: session still records activity.
    try {
      if (cameraStreamRef.current || screenStreamRef.current) {
        publish = await publishStreams({
          roomName,
          cameraStream: cameraStreamRef.current,
          screenStream: screenStreamRef.current,
        });
      }
    } catch (e) {
      console.error('WebRTC publisher start failed', e);
      await logEvent('stream_failed', { payload: { reason: (e as Error)?.message || String(e) } });
    }

    if (publish) {
      const { data: updated, error: updateError } = await supabase
        .from('monitoring_sessions')
        .update({
          cf_session_id: publish.roomName,
          cf_camera_track: deviceState.camera ? '1' : null,
          cf_microphone_track: deviceState.microphone ? '1' : null,
          cf_screen_track: deviceState.screen ? '1' : null,
          last_heartbeat_at: new Date().toISOString(),
          metadata: {
            ...(data.metadata ?? {}),
            provider: 'livekit',
            livekit_room: publish.roomName,
            livekit_identity: publish.identity,
          },
        } as any)
        .eq('id', data.id)
        .select('*')
        .single();
      if (!updateError && updated && isMonitoringSessionRecord(updated)) {
        data = updated;
      }
    }


    connectionRef.current = publish;
    const nextSession = buildSessionModel(data, { devices: deviceState, studentId, testId });
    setSession(nextSession);
    sessionRef.current = nextSession;
    await logEvent('session_started', { payload: { devices: deviceState, session_id: data.id } });
    if (deviceState.camera) await logEvent('camera_started');
    if (deviceState.screen) await logEvent('screen_share_started');
    if (publish) await logEvent('provider_connected', { payload: { provider: 'livekit', room: publish.roomName } });

    setIsStreaming(true);
    return { ...nextSession, session: nextSession };
  }, [loadSettings, logEvent, settings, testId, userId]);

  const stop = useCallback(async (reason = 'student_stop') => {
    const activeSession = sessionRef.current;
    if (activeSession?.id) {
      await logEvent('session_stopped', { payload: { reason } });
    }
    connectionRef.current?.close();
    connectionRef.current = null;
    stopStream(cameraStreamRef.current);
    stopStream(screenStreamRef.current);
    cameraStreamRef.current = null;
    screenStreamRef.current = null;
    devicesRef.current = { camera: false, microphone: false, screen: false };
    setDevices(devicesRef.current);
    setIsStreaming(false);
    if (activeSession?.id) {
      const { error } = await supabase
        .from('monitoring_sessions')
        .update({
          status: 'ended',
          ended_at: nowIso(),
          metadata: {
            ...(activeSession.metadata ?? {}),
            ended_reason: reason,
            devices: devicesRef.current,
          },
        })
        .eq('id', String(activeSession.id));
      if (error) console.warn('Failed to stop live monitoring session', error);
      setSession(null);
      sessionRef.current = null;
    }
  }, [logEvent]);

  useEffect(() => {
    if (!session?.id) return;
    const tick = async () => {
      void logEvent('heartbeat', { payload: { devices } });
      try {
        await supabase
          .from('monitoring_sessions')
          .update({ last_heartbeat_at: new Date().toISOString() } as any)
          .eq('id', session.id);
      } catch { /* best effort */ }
    };
    const interval = window.setInterval(tick, 15000);
    void tick();
    return () => window.clearInterval(interval);
  }, [devices, logEvent, session?.id]);

  // Screenshot timer removed.

  useEffect(() => {
    if (!session?.id) return;
    const onBlur = () => {
      void logEvent('focus_lost');
      void logEvent('tab_switch', { payload: { source: 'blur' } });
    };
    const onFocus = () => { void logEvent('focus_returned'); };
    const onVisibility = () => {
      const eventType = document.hidden ? 'visibility_hidden' : 'visibility_visible';
      void logEvent(eventType);
      if (document.hidden) void logEvent('tab_switch', { payload: { source: 'visibilitychange' } });
    };
    const onFullscreen = () => {
      void logEvent(document.fullscreenElement ? 'fullscreen_enter' : 'fullscreen_exit');
    };
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('fullscreenchange', onFullscreen);
    };
  }, [logEvent, session?.id]);

  useEffect(() => () => {
    connectionRef.current?.close();
    stopStream(cameraStreamRef.current);
    stopStream(screenStreamRef.current);
  }, []);

  return { settings, session, devices, isPreparing, isStreaming, loadSettings, prepare, start, stop, logEvent };
}

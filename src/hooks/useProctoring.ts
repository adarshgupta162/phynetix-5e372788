import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { loadEffectiveProctoringSettings } from '@/lib/proctoring/settings';
import { publishStreams, type PublishHandle } from '@/lib/proctoring/cloudflare-realtime';
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
  const connectionRef = useRef<LiveKitConnection | null>(null);
  const sessionRef = useRef<ProctoringSession | null>(null);
  const devicesRef = useRef<ProctoringDeviceState>({ camera: false, microphone: false, screen: false });
  const screenshotTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);

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
      question_id: event?.questionId ?? null,
      subject_name: event?.subjectName ?? null,
      payload: event?.payload ?? {},
      created_at: nowIso(),
    });
    if (error) console.warn('Failed to log proctoring event', error);
  }, []);

  const captureScreenshot = useCallback(async () => {
    const activeSession = sessionRef.current;
    if (!activeSession?.id) return;
    if (!screenStreamRef.current) return;
    const track = screenStreamRef.current.getVideoTracks()[0];
    if (!track) return;

    if (!screenVideoRef.current) {
      const video = document.createElement('video');
      video.srcObject = new MediaStream([track]);
      video.muted = true;
      video.playsInline = true;
      try {
        await video.play();
      } catch (error) {
        console.warn('Unable to start screen video for screenshot capture', error);
        return;
      }
      screenVideoRef.current = video;
    }

    const video = screenVideoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.75));
    if (!blob) return;

    const path = `screenshots/${activeSession.id}/${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('monitoring-screenshots')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (uploadError) {
      console.warn('Failed to upload screenshot', uploadError);
      return;
    }

    const { error: insertError } = await supabase
      .from('monitoring_screenshots')
      .insert({
        session_id: activeSession.id,
        attempt_id: activeSession.attempt_id,
        test_id: activeSession.test_id,
        user_id: activeSession.user_id,
        storage_path: path,
        metadata: { width: canvas.width, height: canvas.height },
        captured_at: nowIso(),
      });
    if (insertError) {
      console.warn('Failed to record screenshot metadata', insertError);
    }
  }, []);

  const prepare = useCallback(async () => {
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
        if (screenStreamRef.current.getVideoTracks().length > 0) {
          const video = document.createElement('video');
          video.srcObject = screenStreamRef.current;
          video.muted = true;
          video.playsInline = true;
          video.play().catch((error) => console.warn('Unable to play screen stream for screenshots', error));
          screenVideoRef.current = video;
        }
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
    const { data, error } = await supabase
      .from('monitoring_sessions')
      .insert({
        attempt_id: String(attemptId),
        student_id: studentId ? String(studentId) : null,
        status: 'active',
        metadata: {
          ...metadata,
          devices: deviceState,
          test_id: testId ?? null,
          consent_accepted: true,
        },
      })
      .select('*')
      .single();
    if (error) {
      console.warn('Failed to start live monitoring session', error);
      setIsStreaming(false);
      return null;
    }
    if (!data) {
      console.warn('Live monitoring session response missing data');
      setIsStreaming(false);
      return null;
    }
    if (!isMonitoringSessionRecord(data)) {
      console.warn('Live monitoring session response has unexpected shape');
      setIsStreaming(false);
      return null;
    }

    const nextSession = buildSessionModel(data, { devices: deviceState, studentId, testId });
    setSession(nextSession);
    sessionRef.current = nextSession;
    await logEvent('session_started', { payload: { devices: deviceState } });
    if (deviceState.camera) await logEvent('camera_started', { payload: { camera: true } });
    if (deviceState.screen) await logEvent('screen_share_started', { payload: { screen: true } });
    await logEvent('device_state', { payload: { devices: deviceState } });

    const providerMetadata = metadata.provider;
    const provider = typeof providerMetadata === 'object' && providerMetadata
      ? providerMetadata as { livekit_url?: string; token?: string }
      : null;
    try {
      if (provider?.livekit_url && provider?.token) {
        connectionRef.current = await publishStudentTracks({
          url: provider.livekit_url,
          token: provider.token,
          cameraStream: cameraStreamRef.current,
          screenStream: screenStreamRef.current,
          onDisconnected: () => logEvent('provider_disconnected'),
        });
        if (connectionRef.current) await logEvent('provider_connected');
      }
    } catch (providerError) {
      await logEvent('failure', { payload: { area: 'provider_connect', message: String(providerError) } });
      console.error('Failed to connect live monitoring provider', providerError);
    }

    setIsStreaming(true);
    return { ...nextSession, session: nextSession };
  }, [loadSettings, logEvent, settings, testId, userId]);

  const stop = useCallback(async (reason = 'student_stop') => {
    const activeSession = sessionRef.current;
    if (activeSession?.id) {
      await logEvent('session_stopped', { payload: { reason } });
    }
    connectionRef.current?.disconnect();
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
    const interval = window.setInterval(() => logEvent('heartbeat', { payload: { devices } }), 20000);
    return () => window.clearInterval(interval);
  }, [devices, logEvent, session?.id]);

  useEffect(() => {
    if (!session?.id) return;
    if (!settings?.screenshot_enabled) return;
    const seconds = Math.max(10, settings.screenshot_interval_seconds ?? 120);
    screenshotTimerRef.current = setInterval(() => {
      captureScreenshot().catch((error) => console.warn('Screenshot capture failed', error));
    }, seconds * 1000);
    return () => {
      if (screenshotTimerRef.current) window.clearInterval(screenshotTimerRef.current);
      screenshotTimerRef.current = null;
    };
  }, [captureScreenshot, session?.id, settings?.screenshot_enabled, settings?.screenshot_interval_seconds]);

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
    if (screenshotTimerRef.current) window.clearInterval(screenshotTimerRef.current);
    screenshotTimerRef.current = null;
    connectionRef.current?.disconnect();
    stopStream(cameraStreamRef.current);
    stopStream(screenStreamRef.current);
    if (screenVideoRef.current) {
      screenVideoRef.current.pause();
      screenVideoRef.current.srcObject = null;
      screenVideoRef.current = null;
    }
  }, []);

  return { settings, session, devices, isPreparing, isStreaming, loadSettings, prepare, start, stop, logEvent };
}

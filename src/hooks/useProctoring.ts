import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { loadEffectiveProctoringSettings } from '@/lib/proctoring/settings';
import { publishStudentTracks, type LiveKitConnection } from '@/lib/proctoring/livekit';
import type { ProctoringDeviceState, ProctoringEventPayload, ProctoringSession, ProctoringSettings } from '@/lib/proctoring/types';

const stopStream = (stream: MediaStream | null) => stream?.getTracks().forEach((track) => track.stop());

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

  useEffect(() => { sessionRef.current = session; }, [session]);

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
    const { error } = await supabase.functions.invoke('log-proctoring-event', {
      body: {
        session_id: activeSession.id,
        event_type: eventType,
        question_id: event?.questionId ?? null,
        subject_name: event?.subjectName ?? null,
        payload: event?.payload ?? {},
      },
    });
    if (error) console.error('Failed to log proctoring event', error);
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
    setIsPreparing(false);
    return { settings: effective, devices: nextDevices, failures };
  }, [loadSettings, logEvent, settings, testId]);

  const start = useCallback(async (attemptId: string, metadata: Record<string, unknown> = {}) => {
    if (!attemptId) return null;
    const effective = settings ?? await loadSettings();
    if (!effective?.enabled) return null;

    const { data, error } = await supabase.functions.invoke('start-proctoring-session', {
      body: {
        attempt_id: attemptId,
        consent_accepted: true,
        devices,
        metadata,
      },
    });
    if (error || data?.error) throw new Error(data?.error || error?.message || 'Failed to start live monitoring');
    if (!data?.enabled) return null;

    setSession(data.session);
    sessionRef.current = data.session;

    try {
      connectionRef.current = await publishStudentTracks({
        url: data.provider?.livekit_url,
        token: data.provider?.token,
        cameraStream: cameraStreamRef.current,
        screenStream: screenStreamRef.current,
        onDisconnected: () => logEvent('provider_disconnected'),
      });
      if (connectionRef.current) await logEvent('provider_connected');
    } catch (providerError) {
      await logEvent('failure', { payload: { area: 'provider_connect', message: String(providerError) } });
      console.error('Failed to connect live monitoring provider', providerError);
    }

    setIsStreaming(true);
    return data.session as ProctoringSession;
  }, [devices, loadSettings, logEvent, settings]);

  const stop = useCallback(async (reason = 'student_stop') => {
    const activeSession = sessionRef.current;
    connectionRef.current?.disconnect();
    connectionRef.current = null;
    stopStream(cameraStreamRef.current);
    stopStream(screenStreamRef.current);
    cameraStreamRef.current = null;
    screenStreamRef.current = null;
    setIsStreaming(false);
    if (activeSession?.id) {
      await supabase.functions.invoke('stop-proctoring-session', { body: { session_id: activeSession.id, reason } });
    }
  }, []);

  useEffect(() => {
    if (!session?.id) return;
    const interval = window.setInterval(() => logEvent('heartbeat', { payload: { devices } }), 20000);
    return () => window.clearInterval(interval);
  }, [devices, logEvent, session?.id]);

  useEffect(() => {
    if (!session?.id) return;
    const onBlur = () => logEvent('focus_lost');
    const onFocus = () => logEvent('focus_returned');
    const onVisibility = () => logEvent(document.hidden ? 'visibility_hidden' : 'visibility_visible');
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [logEvent, session?.id]);

  useEffect(() => () => {
    connectionRef.current?.disconnect();
    stopStream(cameraStreamRef.current);
    stopStream(screenStreamRef.current);
  }, []);

  return { settings, session, devices, isPreparing, isStreaming, loadSettings, prepare, start, stop, logEvent };
}

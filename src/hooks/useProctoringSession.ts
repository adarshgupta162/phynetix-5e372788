import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type StartOptions = {
  camera: boolean;
  mic: boolean;
  screen: boolean;
};

type ProctoringRequirements = {
  requireCamera: boolean;
  requireMic: boolean;
  requireScreen: boolean;
};

type ProctoringSessionState = {
  status: "idle" | "starting" | "active" | "blocked" | "error";
  error: string | null;
  sessionId: string | null;
  mediaState: StartOptions;
};

const defaultState: ProctoringSessionState = {
  status: "idle",
  error: null,
  sessionId: null,
  mediaState: { camera: false, mic: false, screen: false },
};

export function useProctoringSession({
  testId,
  attemptId,
  enabled,
  requirements,
}: {
  testId: string | null;
  attemptId: string | null;
  enabled: boolean;
  requirements: ProctoringRequirements;
}) {
  const [state, setState] = useState<ProctoringSessionState>(defaultState);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const viewerIdRef = useRef<string | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const streamsRef = useRef<{ camera?: MediaStream; screen?: MediaStream } | null>(null);

  const cleanup = useCallback(() => {
    channelRef.current && supabase.removeChannel(channelRef.current);
    channelRef.current = null;
    peerRef.current?.getSenders().forEach((sender) => sender.track?.stop());
    peerRef.current?.close();
    peerRef.current = null;
    viewerIdRef.current = null;
    pendingIceRef.current = [];
    streamsRef.current?.camera?.getTracks().forEach((track) => track.stop());
    streamsRef.current?.screen?.getTracks().forEach((track) => track.stop());
    streamsRef.current = null;
  }, []);

  const logEvent = useCallback(async (eventType: string, payload: Record<string, any>) => {
    if (!state.sessionId) return;
    await supabase.functions.invoke("log-proctoring-event", {
      body: { session_id: state.sessionId, event_type: eventType, payload },
    });
  }, [state.sessionId]);

  const sendSignal = useCallback(async (signalType: string, payload: any, recipientId: string) => {
    if (!state.sessionId) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return;
    await supabase.from("proctoring_signals").insert({
      session_id: state.sessionId,
      sender_id: auth.user.id,
      recipient_id: recipientId,
      signal_type: signalType,
      payload,
    });
  }, [state.sessionId]);

  const handleSignal = useCallback(async (record: any) => {
    if (!peerRef.current) return;
    if (record.signal_type === "offer") {
      viewerIdRef.current = record.sender_id;
      await peerRef.current.setRemoteDescription(record.payload);
      const answer = await peerRef.current.createAnswer();
      await peerRef.current.setLocalDescription(answer);
      await sendSignal("answer", answer, record.sender_id);
      for (const candidate of pendingIceRef.current) {
        await sendSignal("ice", candidate, record.sender_id);
      }
      pendingIceRef.current = [];
      return;
    }
    if (record.signal_type === "ice" && record.payload) {
      try {
        await peerRef.current.addIceCandidate(record.payload);
      } catch (err) {
        console.warn("Failed to add ICE candidate", err);
      }
    }
  }, [sendSignal]);

  const setupPeerConnection = useCallback(async () => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    peerRef.current = pc;
    pc.onicecandidate = async (event) => {
      if (!event.candidate) return;
      const payload = event.candidate.toJSON();
      if (viewerIdRef.current) {
        await sendSignal("ice", payload, viewerIdRef.current);
      } else {
        pendingIceRef.current.push(payload);
      }
    };
  }, [sendSignal]);

  const requestMedia = useCallback(async (options: StartOptions) => {
    const nextMedia: StartOptions = { camera: false, mic: false, screen: false };
    const streams: { camera?: MediaStream; screen?: MediaStream } = {};

    if (options.camera || options.mic) {
      const userStream = await navigator.mediaDevices.getUserMedia({
        video: options.camera,
        audio: options.mic,
      });
      streams.camera = userStream;
      nextMedia.camera = options.camera;
      nextMedia.mic = options.mic;
    }

    if (options.screen) {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      streams.screen = screenStream;
      nextMedia.screen = true;
    }

    streamsRef.current = streams;
    return nextMedia;
  }, []);

  const startSession = useCallback(async (options: StartOptions) => {
    if (!enabled || !testId || !attemptId) return false;
    setState((prev) => ({ ...prev, status: "starting", error: null }));
    try {
      const nextMediaState = await requestMedia(options);
      const { data, error } = await supabase.functions.invoke("start-proctoring", {
        body: {
          test_id: testId,
          attempt_id: attemptId,
          camera_enabled: nextMediaState.camera,
          mic_enabled: nextMediaState.mic,
          screen_enabled: nextMediaState.screen,
        },
      });
      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Failed to start monitoring");
      }
      if (!data.enabled) {
        setState({ status: "blocked", error: data.reason || "Monitoring not enabled", sessionId: null, mediaState: nextMediaState });
        return false;
      }

      await setupPeerConnection();
      if (peerRef.current) {
        const cameraStream = streamsRef.current?.camera;
        if (cameraStream) {
          cameraStream.getTracks().forEach((track) => peerRef.current?.addTrack(track, cameraStream));
        }
        const screenStream = streamsRef.current?.screen;
        if (screenStream) {
          screenStream.getTracks().forEach((track) => peerRef.current?.addTrack(track, screenStream));
        }
      }

      const sessionId = data.session?.id as string;
      setState({ status: "active", error: null, sessionId, mediaState: nextMediaState });
      await logEvent("media_state", { ...nextMediaState, requirements });

      channelRef.current = supabase
        .channel(`proctoring-signals-${sessionId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "proctoring_signals", filter: `session_id=eq.${sessionId}` },
          async (payload) => {
            const record = payload.new as any;
            const { data: auth } = await supabase.auth.getUser();
            if (!auth?.user || record.recipient_id !== auth.user.id) return;
            await handleSignal(record);
          },
        )
        .subscribe();

      return true;
    } catch (err: any) {
      setState((prev) => ({ ...prev, status: "error", error: err?.message || "Failed to start monitoring" }));
      await logEvent("monitoring_error", { message: err?.message || "Failed to start monitoring" });
      cleanup();
      return false;
    }
  }, [attemptId, cleanup, enabled, handleSignal, logEvent, requestMedia, requirements, setupPeerConnection, testId]);

  const endSession = useCallback(async () => {
    if (!state.sessionId) return;
    await supabase.functions.invoke("end-proctoring", { body: { session_id: state.sessionId } });
    cleanup();
    setState(defaultState);
  }, [cleanup, state.sessionId]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    state,
    startSession,
    endSession,
    logEvent,
  };
}

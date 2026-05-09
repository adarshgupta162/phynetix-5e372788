import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Camera, MonitorPlay, RefreshCw, Mic, PhoneOff } from "lucide-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type SessionRow = {
  id: string;
  test_id: string;
  attempt_id: string;
  user_id: string;
  status: string;
  provider: string;
  camera_enabled: boolean;
  mic_enabled: boolean;
  screen_enabled: boolean;
  started_at: string;
  ended_at: string | null;
  last_event_at: string | null;
  tests?: { name: string | null } | null;
  profiles?: { full_name: string | null; roll_number: string | null; avatar_url: string | null } | null;
};

type ProctoringEvent = {
  id: string;
  event_type: string;
  payload: Record<string, any> | null;
  created_at: string;
};

export default function LiveMonitoring() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<SessionRow | null>(null);
  const [events, setEvents] = useState<ProctoringEvent[]>([]);
  const [viewerReady, setViewerReady] = useState(false);

  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);

  const cameraRef = useRef<HTMLVideoElement | null>(null);
  const screenRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);

  const sessionLabel = (session: SessionRow) => {
    const name = session.profiles?.full_name || session.profiles?.roll_number || session.user_id;
    const testName = session.tests?.name || "Test";
    return `${name} • ${testName}`;
  };

  const refreshSessions = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("list-proctoring-sessions");
    if (error || data?.error) {
      toast({ title: "Failed to load sessions", description: data?.error || error?.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    setSessions(data.sessions || []);
    setLoading(false);
  };

  useEffect(() => {
    void refreshSessions();
    const channel = supabase
      .channel("proctoring-sessions-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "proctoring_sessions" }, () => {
        void refreshSessions();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (cameraRef.current) {
      cameraRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  useEffect(() => {
    if (screenRef.current) {
      screenRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.srcObject = audioStream;
    }
  }, [audioStream]);

  const resetViewer = () => {
    peerRef.current?.getSenders().forEach((sender) => sender.track?.stop());
    peerRef.current?.close();
    peerRef.current = null;
    setCameraStream(null);
    setScreenStream(null);
    setAudioStream(null);
    setViewerReady(false);
  };

  const handleSignal = async (payload: any, userId: string, sessionId: string) => {
    if (!peerRef.current) return;
    if (payload.signal_type === "answer") {
      await peerRef.current.setRemoteDescription(payload.payload);
    }
    if (payload.signal_type === "ice" && payload.payload) {
      try {
        await peerRef.current.addIceCandidate(payload.payload);
      } catch (err) {
        console.warn("Failed to add ICE candidate", err);
      }
    }
  };

  const startViewer = async (session: SessionRow) => {
    resetViewer();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    peerRef.current = pc;

    pc.addTransceiver("video", { direction: "recvonly" });
    pc.addTransceiver("video", { direction: "recvonly" });
    pc.addTransceiver("audio", { direction: "recvonly" });

    pc.ontrack = (event) => {
      const track = event.track;
      const stream = event.streams[0] || new MediaStream([track]);
      if (track.kind === "audio") {
        setAudioStream(stream);
        return;
      }
      const label = track.label.toLowerCase();
      if (label.includes("screen") || label.includes("display") || label.includes("window")) {
        setScreenStream(stream);
      } else {
        setCameraStream(stream);
      }
    };

    pc.onicecandidate = async (event) => {
      if (!event.candidate) return;
      await supabase.from("proctoring_signals").insert({
        session_id: session.id,
        sender_id: auth.user.id,
        recipient_id: session.user_id,
        signal_type: "ice",
        payload: event.candidate.toJSON(),
      });
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await supabase.from("proctoring_signals").insert({
      session_id: session.id,
      sender_id: auth.user.id,
      recipient_id: session.user_id,
      signal_type: "offer",
      payload: offer,
    });

    setViewerReady(true);
  };

  useEffect(() => {
    if (!selectedSession) return;
    void startViewer(selectedSession);

    const signalChannel = supabase
      .channel(`proctoring-signals-${selectedSession.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "proctoring_signals", filter: `session_id=eq.${selectedSession.id}` },
        async (payload) => {
          const record = payload.new as any;
          const { data: auth } = await supabase.auth.getUser();
          if (!auth?.user || record.recipient_id !== auth.user.id) return;
          await handleSignal(record, auth.user.id, selectedSession.id);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(signalChannel);
    };
  }, [selectedSession]);

  const loadEvents = async (sessionId: string) => {
    const { data } = await supabase
      .from("proctoring_events")
      .select("id, event_type, payload, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(50);
    setEvents(data || []);
  };

  useEffect(() => {
    if (!selectedSession) return;
    void loadEvents(selectedSession.id);
    const eventChannel = supabase
      .channel(`proctoring-events-${selectedSession.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "proctoring_events", filter: `session_id=eq.${selectedSession.id}` },
        (payload) => {
          setEvents((prev) => [payload.new as any, ...prev].slice(0, 50));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(eventChannel);
    };
  }, [selectedSession]);

  const endSession = async () => {
    if (!selectedSession) return;
    const { error } = await supabase.functions.invoke("end-proctoring", { body: { session_id: selectedSession.id } });
    if (error) {
      toast({ title: "Failed to end session", description: error.message, variant: "destructive" });
      return;
    }
    resetViewer();
    setSelectedSession(null);
    void refreshSessions();
  };

  const currentMeta = useMemo(() => {
    if (!selectedSession) return null;
    return {
      user: selectedSession.profiles?.full_name || selectedSession.profiles?.roll_number || selectedSession.user_id,
      test: selectedSession.tests?.name || "Test",
    };
  }, [selectedSession]);

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-display">Live Monitoring</h1>
            <p className="text-muted-foreground">Watch active test sessions in real time.</p>
          </div>
          <Button variant="outline" onClick={refreshSessions} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>

        <div className="grid lg:grid-cols-[340px,1fr] gap-6">
          <div className="glass-card p-4 space-y-3">
            <div className="text-sm font-semibold">Active Sessions</div>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading sessions...</div>
            ) : sessions.length === 0 ? (
              <div className="text-sm text-muted-foreground">No active sessions.</div>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => setSelectedSession(session)}
                    className={cn(
                      "w-full text-left border border-border rounded-lg p-3 transition-colors",
                      selectedSession?.id === session.id ? "bg-primary/10 border-primary" : "hover:bg-secondary/30",
                    )}
                  >
                    <div className="font-semibold text-sm">{sessionLabel(session)}</div>
                    <div className="text-xs text-muted-foreground">
                      Started {formatDistanceToNow(new Date(session.started_at))} ago
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs">
                      <span className={cn("inline-flex items-center gap-1", session.camera_enabled ? "text-emerald-600" : "text-muted-foreground")}>
                        <Camera className="w-3 h-3" /> Cam
                      </span>
                      <span className={cn("inline-flex items-center gap-1", session.mic_enabled ? "text-emerald-600" : "text-muted-foreground")}>
                        <Mic className="w-3 h-3" /> Mic
                      </span>
                      <span className={cn("inline-flex items-center gap-1", session.screen_enabled ? "text-emerald-600" : "text-muted-foreground")}>
                        <MonitorPlay className="w-3 h-3" /> Screen
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            {!selectedSession ? (
              <div className="glass-card p-6 text-center text-muted-foreground">
                Select a session to start monitoring.
              </div>
            ) : (
              <>
                <div className="glass-card p-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Monitoring</div>
                    <div className="text-lg font-semibold">{currentMeta?.user}</div>
                    <div className="text-xs text-muted-foreground">{currentMeta?.test}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => startViewer(selectedSession)} disabled={!viewerReady}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Reconnect
                    </Button>
                    <Button variant="destructive" onClick={endSession}>
                      <PhoneOff className="w-4 h-4 mr-2" />
                      End Session
                    </Button>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="glass-card p-4 space-y-2">
                    <div className="text-sm font-semibold flex items-center gap-2">
                      <Camera className="w-4 h-4" /> Camera Feed
                    </div>
                    <video ref={cameraRef} autoPlay playsInline muted className="w-full rounded-md bg-black/80 aspect-video" />
                  </div>
                  <div className="glass-card p-4 space-y-2">
                    <div className="text-sm font-semibold flex items-center gap-2">
                      <MonitorPlay className="w-4 h-4" /> Screen Feed
                    </div>
                    <video ref={screenRef} autoPlay playsInline muted className="w-full rounded-md bg-black/80 aspect-video" />
                  </div>
                </div>

                <audio ref={audioRef} autoPlay className="hidden" />

                <div className="glass-card p-4">
                  <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
                    <AlertTriangle className="w-4 h-4 text-muted-foreground" /> Latest Events
                  </div>
                  {events.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No events yet.</div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {events.map((event) => (
                        <div key={event.id} className="border border-border rounded-md p-2 text-xs">
                          <div className="font-semibold text-foreground">{event.event_type}</div>
                          <div className="text-muted-foreground">{new Date(event.created_at).toLocaleString()}</div>
                          {event.payload && Object.keys(event.payload).length > 0 && (
                            <pre className="mt-1 whitespace-pre-wrap text-[11px] text-muted-foreground">{JSON.stringify(event.payload, null, 2)}</pre>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

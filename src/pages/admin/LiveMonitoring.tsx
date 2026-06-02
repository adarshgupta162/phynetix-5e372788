import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Activity, AlertTriangle, Camera, Clock, Eye, Mic, MonitorUp,
  RefreshCw, Shield, Timer, Video, VideoOff,
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { subscribeToRoom, type SubscribeHandle } from '@/lib/proctoring/livekit';

const LIVE_HEARTBEAT_MS = 60_000;
const LIVE_START_GRACE_MS = 120_000;

type Session = {
  id: string;
  attempt_id: string | null;
  student_id: string | null;
  test_id: string | null;
  student_name: string | null;
  test_name: string | null;
  status: string;
  started_at: string;
  ended_at: string | null;
  last_heartbeat_at: string | null;
  metadata: any;
  cf_session_id: string | null;
  cf_camera_track: string | null;
  cf_microphone_track: string | null;
  cf_screen_track: string | null;
};

type EventRow = {
  id: string;
  session_id: string;
  event_type: string;
  metadata?: any;
  created_at: string;
};

type AttemptRow = {
  id: string;
  user_id: string | null;
  test_id: string | null;
  started_at: string;
  completed_at: string | null;
  answers?: Record<string, unknown> | null;
  time_per_question?: Record<string, unknown> | null;
  fullscreen_exit_count?: number | null;
  extra_time_minutes?: number | null;
  submit_disabled?: boolean | null;
  time_taken_seconds?: number | null;
};

type TestMeta = { id: string; name: string | null; duration_minutes: number | null };
type QuestionSummary = { id: string; order?: number; question_text?: string | null; subject?: string | null; chapter?: string | null };

const sessionMeta = (s: Session) => s.metadata && typeof s.metadata === 'object' ? s.metadata : {};
const roomOf = (s: Session) => s.cf_session_id || sessionMeta(s).livekit_room || (s.attempt_id ? `proc-${s.attempt_id}` : null);
const normalizeSession = (row: any): Session => {
  const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  return {
    ...row,
    student_id: row.student_id ?? meta.student_id ?? null,
    test_id: row.test_id ?? meta.test_id ?? null,
    student_name: row.student_name ?? meta.student_name ?? null,
    test_name: row.test_name ?? meta.test_name ?? null,
    cf_session_id: row.cf_session_id ?? meta.livekit_room ?? (row.attempt_id ? `proc-${row.attempt_id}` : null),
    cf_camera_track: row.cf_camera_track ?? meta.livekit_identity ?? null,
    cf_microphone_track: row.cf_microphone_track ?? null,
    cf_screen_track: row.cf_screen_track ?? null,
  } as Session;
};

const formatSeconds = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
};

const answerCountOf = (answers?: Record<string, unknown> | null) => Object.values(answers || {}).filter((value) => {
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined && value !== '';
}).length;

const visitedCountOf = (timeMap?: Record<string, unknown> | null) => {
  const visited = timeMap?.__visited_questions__;
  return Array.isArray(visited) ? visited.length : 0;
};

const devicesOf = (s: Session) => {
  const m = s.metadata?.devices ?? {};
  return {
    camera: Boolean(s.cf_camera_track) || Boolean(m.camera),
    microphone: Boolean(s.cf_microphone_track) || Boolean(m.microphone),
    screen: Boolean(s.cf_screen_track) || Boolean(m.screen),
  };
};

function DeviceBadges({ s }: { s: Session }) {
  const d = devicesOf(s);
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge variant={d.camera ? 'default' : 'secondary'} className="gap-1"><Video className="w-3 h-3" /> Cam</Badge>
      <Badge variant={d.microphone ? 'default' : 'secondary'} className="gap-1"><Mic className="w-3 h-3" /> Mic</Badge>
      <Badge variant={d.screen ? 'default' : 'secondary'} className="gap-1"><MonitorUp className="w-3 h-3" /> Screen</Badge>
    </div>
  );
}

function LiveViewer({ session, events, attempt, test, questions }: { session: Session; events: EventRow[]; attempt?: AttemptRow; test?: TestMeta; questions: QuestionSummary[] }) {
  const cameraRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);
  const handleRef = useRef<SubscribeHandle | null>(null);
  const [status, setStatus] = useState<'connecting' | 'live' | 'error' | 'no-stream'>('connecting');
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const roomName = roomOf(session);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      if (!roomName) {
        setStatus('no-stream');
        return;
      }
      try {
        const refresh = () => {
          const h = handleRef.current;
          if (!h) return;
          if (cameraRef.current && cameraRef.current.srcObject !== h.cameraStream) {
            cameraRef.current.srcObject = h.cameraStream;
            cameraRef.current.play().catch(() => {});
          }
          if (screenRef.current && screenRef.current.srcObject !== h.screenStream) {
            screenRef.current.srcObject = h.screenStream;
            screenRef.current.play().catch(() => {});
          }
        };
        const h = await subscribeToRoom({
          roomName,
          publisherIdentity: session.cf_camera_track,
          onUpdate: refresh,
        });
        if (cancelled) { h.close(); return; }
        handleRef.current = h;
        refresh();
        setStatus('live');
      } catch (e: any) {
        console.error('Failed to subscribe to LiveKit room', e);
        setErrMsg(e?.message || String(e));
        setStatus('error');
      }
    }
    connect();

    return () => {
      cancelled = true;
      handleRef.current?.close();
      handleRef.current = null;
    };
  }, [roomName, session.cf_camera_track]);

  const fullscreenExits = events.filter((e) => e.event_type === 'fullscreen_exit').length;
  const tabSwitches = events.filter((e) => e.event_type === 'tab_switch').length;
  const lastQuestionEvent = events.find((e) => e.event_type === 'question_change');
  const currentQuestionId = lastQuestionEvent?.metadata?.question_id as string | undefined;
  const currentQuestion = questions.find((q) => q.id === currentQuestionId);
  const answered = answerCountOf(attempt?.answers);
  const visited = visitedCountOf(attempt?.time_per_question);
  const durationSeconds = ((test?.duration_minutes ?? 0) + (attempt?.extra_time_minutes ?? 0)) * 60;
  const elapsedSeconds = attempt?.completed_at
    ? Math.max(0, Math.floor((new Date(attempt.completed_at).getTime() - new Date(attempt.started_at).getTime()) / 1000))
    : Math.max(0, Math.floor((Date.now() - new Date(attempt?.started_at || session.started_at).getTime()) / 1000));
  const timeLeft = durationSeconds ? Math.max(0, durationSeconds - elapsedSeconds) : null;

  return (
    <div className="grid lg:grid-cols-[2fr,1fr] gap-4">
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3">
          <div className="rounded-xl overflow-hidden border bg-black aspect-video relative">
            <video ref={screenRef} autoPlay playsInline muted className="w-full h-full object-contain" />
            <div className="absolute top-2 left-2"><Badge variant="secondary"><MonitorUp className="w-3 h-3 mr-1" />Screen</Badge></div>
            {!devicesOf(session).screen && (
              <div className="absolute inset-0 flex items-center justify-center text-primary-foreground/70 text-sm">No screen share</div>
            )}
          </div>
          <div className="rounded-xl overflow-hidden border bg-black aspect-video max-h-64 relative">
            <video ref={cameraRef} autoPlay playsInline className="w-full h-full object-cover" />
            <div className="absolute top-2 left-2"><Badge variant="secondary"><Camera className="w-3 h-3 mr-1" />Camera</Badge></div>
            {!devicesOf(session).camera && (
              <div className="absolute inset-0 flex items-center justify-center text-primary-foreground/70 text-sm">No camera</div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={status === 'live' ? 'default' : status === 'error' ? 'destructive' : 'secondary'}>
            {status === 'live' ? 'Live' : status === 'error' ? 'Stream error' : status === 'no-stream' ? 'No live stream' : 'Connecting…'}
          </Badge>
          <DeviceBadges s={session} />
          {errMsg && <span className="text-xs text-destructive">{errMsg}</span>}
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-xl border p-4 space-y-1">
          <h3 className="font-semibold">{session.student_name || session.student_id || 'Unknown student'}</h3>
          <p className="text-sm text-muted-foreground">{session.test_name || session.test_id || ''}</p>
          <p className="text-xs text-muted-foreground">Started {formatDistanceToNow(new Date(session.started_at), { addSuffix: true })}</p>
          <p className="text-xs text-muted-foreground">Last heartbeat: {session.last_heartbeat_at ? formatDistanceToNow(new Date(session.last_heartbeat_at), { addSuffix: true }) : '—'}</p>
          <p className="text-xs text-muted-foreground">Room: {roomName || '—'}</p>
          <div className="grid grid-cols-2 gap-2 pt-2 text-sm">
            <span className="flex items-center gap-1"><Timer className="w-3 h-3 text-primary" /> {timeLeft === null ? 'Time left —' : `${formatSeconds(timeLeft)} left`}</span>
            <span>{answered} answered</span>
            <span>{visited} visited</span>
            <span>{Math.max(0, questions.length - visited)} not visited</span>
            <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-500" /> {tabSwitches} tab switches</span>
            <span className="flex items-center gap-1"><VideoOff className="w-3 h-3 text-amber-500" /> {fullscreenExits} fullscreen exits</span>
          </div>
        </div>
        <div className="rounded-xl border p-4 space-y-2">
          <h3 className="font-semibold">Current activity</h3>
          <p className="text-sm">{currentQuestion ? `Q${(currentQuestion.order ?? 0) + 1}: ${currentQuestion.question_text || 'Question'}` : 'No question movement yet'}</p>
          <p className="text-xs text-muted-foreground">{currentQuestion?.subject || lastQuestionEvent?.metadata?.subject_name || 'Subject —'} · {currentQuestion?.chapter || 'Section —'}</p>
          <p className="text-xs text-muted-foreground">Exited fullscreen: {attempt?.fullscreen_exit_count ?? fullscreenExits}</p>
          <p className="text-xs text-muted-foreground">Submit disabled: {attempt?.submit_disabled ? 'Yes' : 'No'}</p>
        </div>
        <div className="rounded-xl border p-4">
          <h3 className="font-semibold mb-3">Recent events ({events.length})</h3>
          <ScrollArea className="h-96 pr-3">
            <div className="space-y-2">
              {events.map((e) => (
                <div key={e.id} className="rounded-lg bg-secondary/50 p-2 text-xs">
                  <div className="font-medium">{e.event_type}</div>
                  <div className="text-muted-foreground">{new Date(e.created_at).toLocaleTimeString()}</div>
                </div>
              ))}
              {!events.length && <p className="text-sm text-muted-foreground">No events yet.</p>}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

export default function LiveMonitoring() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selected, setSelected] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testFilter, setTestFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    const cutoffIso = new Date(Date.now() - LIVE_HEARTBEAT_MS).toISOString();
    const [s, e] = await Promise.all([
      supabase
        .from('monitoring_sessions')
        .select('*')
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(200),
      supabase
        .from('monitoring_events')
        .select('id, session_id, event_type, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(500),
    ]);
    if (s.error || e.error) {
      const msg = s.error?.message || e.error?.message || 'Failed to load monitoring';
      setError(msg);
      toast({ title: 'Live monitoring error', description: msg, variant: 'destructive' });
      setLoading(false);
      return;
    }
    // Keep sessions whose heartbeat is fresh, OR which were started recently
    // (covers brand-new sessions where the first heartbeat hasn't landed yet).
    const fresh = (s.data || []).filter((row: any) => {
      const hb = row.last_heartbeat_at ? new Date(row.last_heartbeat_at).getTime() : 0;
      const started = row.started_at ? new Date(row.started_at).getTime() : 0;
      const cutoff = Date.now() - LIVE_HEARTBEAT_MS;
      return hb >= cutoff || started >= cutoff;
    });
    setSessions(fresh as Session[]);
    setEvents((e.data || []) as EventRow[]);
    setError(null);
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel('admin-live-monitoring')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monitoring_sessions' }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'monitoring_events' }, (p) => {
        setEvents((prev) => [p.new as EventRow, ...prev].slice(0, 500));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const eventsBySession = events.reduce<Record<string, EventRow[]>>((acc, ev) => {
    (acc[ev.session_id] ||= []).push(ev);
    return acc;
  }, {});

  const testOptions = useMemo(() => {
    const map = new Map<string, string>();
    sessions.forEach((s) => {
      if (s.test_id) map.set(s.test_id, s.test_name || s.test_id);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [sessions]);

  const filteredSessions = useMemo(
    () => (testFilter === 'all' ? sessions : sessions.filter((s) => s.test_id === testFilter)),
    [sessions, testFilter],
  );

  const totals = {
    sessions: filteredSessions.length,
    camera: filteredSessions.filter((s) => devicesOf(s).camera).length,
    screen: filteredSessions.filter((s) => devicesOf(s).screen).length,
    stale: filteredSessions.filter((s) => s.last_heartbeat_at && Date.now() - new Date(s.last_heartbeat_at).getTime() > 45000).length,
  };

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><Shield className="w-8 h-8 text-primary" /> Live Monitoring</h1>
            <p className="text-muted-foreground">Watch students taking monitored tests — live camera, screen and security events.</p>
          </div>
          <Button variant="outline" onClick={() => load()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select value={testFilter} onValueChange={setTestFilter}>
            <SelectTrigger className="w-72"><SelectValue placeholder="Filter by test" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All live tests ({sessions.length})</SelectItem>
              {testOptions.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">Showing only sessions with a heartbeat in the last 60s.</span>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          <div className="glass-card p-4"><p className="text-sm text-muted-foreground">Active sessions</p><p className="text-2xl font-bold">{totals.sessions}</p></div>
          <div className="glass-card p-4"><p className="text-sm text-muted-foreground">Cameras on</p><p className="text-2xl font-bold">{totals.camera}</p></div>
          <div className="glass-card p-4"><p className="text-sm text-muted-foreground">Screens shared</p><p className="text-2xl font-bold">{totals.screen}</p></div>
          <div className="glass-card p-4"><p className="text-sm text-muted-foreground">Stale sessions</p><p className="text-2xl font-bold text-destructive">{totals.stale}</p></div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Unable to load live monitoring</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3">
          {filteredSessions.map((s) => {
            const sEvents = eventsBySession[s.id] || [];
            const stale = s.last_heartbeat_at && Date.now() - new Date(s.last_heartbeat_at).getTime() > 45000;
            return (
              <div key={s.id} className="glass-card p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold truncate">{s.student_name || s.student_id || 'Unknown student'}</h3>
                    <Badge variant={stale ? 'destructive' : 'default'}>{stale ? 'Stale' : s.status}</Badge>
                    {stale && <AlertTriangle className="w-4 h-4 text-destructive" />}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{s.test_name || s.test_id || ''}</p>
                  <DeviceBadges s={s} />
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Activity className="w-3 h-3" /> {sEvents.length} events
                    <Clock className="w-3 h-3 ml-2" /> last heartbeat {s.last_heartbeat_at ? formatDistanceToNow(new Date(s.last_heartbeat_at), { addSuffix: true }) : 'never'}
                  </p>
                </div>
                <Button onClick={() => setSelected(s)} disabled={!s.cf_session_id}>
                  <Eye className="w-4 h-4 mr-2" /> {s.cf_session_id ? 'Watch live' : 'No stream'}
                </Button>
              </div>
            );
          })}
          {!filteredSessions.length && !loading && (
            <div className="glass-card p-12 text-center">
              <Shield className="w-14 h-14 mx-auto mb-3 text-muted-foreground" />
              <h2 className="text-xl font-semibold">No active monitored sessions</h2>
              <p className="text-muted-foreground">Students will appear here when they start a test with live monitoring enabled.</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{selected?.student_name || 'Live viewer'} — {selected?.test_name || ''}</DialogTitle>
          </DialogHeader>
          {selected && <LiveViewer session={selected} events={eventsBySession[selected.id] || []} />}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

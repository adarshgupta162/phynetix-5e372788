import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Activity, AlertTriangle, Clock, Eye, Mic, MonitorUp, RefreshCw, Shield, Video } from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { connectAdminViewer, type LiveKitConnection } from '@/lib/proctoring/livekit';

type LiveSession = any;
type LiveEvent = any;

function deviceBadge(enabled: boolean, label: string, Icon: any) {
  return <Badge variant={enabled ? 'default' : 'secondary'} className="gap-1"><Icon className="w-3 h-3" /> {label}</Badge>;
}

function LiveViewer({ session, token, events }: { session: LiveSession; token?: any; events: LiveEvent[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const connectionRef = useRef<LiveKitConnection | null>(null);
  const [connectionState, setConnectionState] = useState(token?.provider_configured ? 'Connecting…' : 'Provider not configured');

  useEffect(() => {
    let cancelled = false;
    const connect = async () => {
      if (!containerRef.current || !token?.provider_configured) return;
      containerRef.current.innerHTML = '';
      try {
        connectionRef.current = await connectAdminViewer({
          url: token.livekit_url,
          token: token.token,
          container: containerRef.current,
          onDisconnected: () => setConnectionState('Disconnected'),
        });
        if (!cancelled) setConnectionState('Connected');
      } catch (error) {
        console.error(error);
        if (!cancelled) setConnectionState('Unable to connect to stream');
      }
    };
    connect();
    return () => {
      cancelled = true;
      connectionRef.current?.disconnect();
    };
  }, [token]);

  const answers = session.test_attempts?.answers || {};
  const timePerQuestion = session.test_attempts?.time_per_question || {};
  const recentQuestionEvent = events.find((event) => event.event_type === 'question_change');
  const recentSubjectEvent = events.find((event) => event.event_type === 'subject_change');

  return (
    <div className="grid lg:grid-cols-[2fr,1fr] gap-4">
      <div className="space-y-3">
        <div className="rounded-xl border bg-black/90 p-3 min-h-80">
          <div ref={containerRef} className="grid gap-3" />
          {!token?.provider_configured && (
            <div className="h-72 flex flex-col items-center justify-center text-white/80 text-center">
              <Shield className="w-10 h-10 mb-3" />
              <p className="font-semibold">LiveKit credentials are not configured.</p>
              <p className="text-sm">Set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET to view live streams.</p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="outline">{connectionState}</Badge>
          {deviceBadge(session.camera_enabled, 'Camera', Video)}
          {deviceBadge(session.microphone_enabled, 'Mic', Mic)}
          {deviceBadge(session.screen_enabled, 'Screen', MonitorUp)}
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-xl border p-4 space-y-2">
          <h3 className="font-semibold">Attempt activity</h3>
          <p className="text-sm text-muted-foreground">Answered questions: {Object.keys(answers).length}</p>
          <p className="text-sm text-muted-foreground">Fullscreen exits: {session.test_attempts?.fullscreen_exit_count || 0}</p>
          <p className="text-sm text-muted-foreground">Current question: {recentQuestionEvent?.payload?.question_index ?? recentQuestionEvent?.question_id ?? '—'}</p>
          <p className="text-sm text-muted-foreground">Current subject: {recentSubjectEvent?.subject_name || '—'}</p>
          <p className="text-sm text-muted-foreground">Time entries: {Object.keys(timePerQuestion).length}</p>
        </div>
        <div className="rounded-xl border p-4">
          <h3 className="font-semibold mb-3">Recent events</h3>
          <ScrollArea className="h-72 pr-3">
            <div className="space-y-2">
              {events.map((event) => (
                <div key={event.id} className="rounded-lg bg-secondary/50 p-2 text-xs">
                  <div className="font-medium">{event.event_type}</div>
                  <div className="text-muted-foreground">{new Date(event.created_at).toLocaleString()}</div>
                  {(event.subject_name || event.question_id) && <div>{event.subject_name || ''} {event.question_id || ''}</div>}
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
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [selected, setSelected] = useState<LiveSession | null>(null);
  const [viewerTokens, setViewerTokens] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (sessionId?: string) => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('admin-proctoring-sessions', { body: sessionId ? { session_id: sessionId } : {} });
    if (error || data?.error) {
      console.error(error || data?.error);
      setLoading(false);
      return;
    }
    if (sessionId) {
      setSelected(data.sessions?.[0] || null);
      setViewerTokens((prev) => ({ ...prev, ...(data.viewer_tokens || {}) }));
    } else {
      setSessions(data.sessions || []);
    }
    setEvents(data.events || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-live-proctoring')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proctoring_sessions' }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'proctoring_events' }, (payload) => {
        setEvents((prev) => [payload.new, ...prev].slice(0, 300));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const openViewer = async (session: LiveSession) => {
    setSelected(session);
    await load(session.id);
  };

  const eventsBySession = events.reduce<Record<string, LiveEvent[]>>((acc, event) => {
    acc[event.session_id] = acc[event.session_id] || [];
    acc[event.session_id].push(event);
    return acc;
  }, {});

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><Shield className="w-8 h-8 text-primary" /> Live Monitoring</h1>
            <p className="text-muted-foreground">Watch active monitored tests, device state, question movement and security events.</p>
          </div>
          <Button variant="outline" onClick={() => load()} disabled={loading}><RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          <div className="glass-card p-4"><p className="text-sm text-muted-foreground">Active sessions</p><p className="text-2xl font-bold">{sessions.length}</p></div>
          <div className="glass-card p-4"><p className="text-sm text-muted-foreground">Camera on</p><p className="text-2xl font-bold">{sessions.filter((s) => s.camera_enabled).length}</p></div>
          <div className="glass-card p-4"><p className="text-sm text-muted-foreground">Screen shared</p><p className="text-2xl font-bold">{sessions.filter((s) => s.screen_enabled).length}</p></div>
          <div className="glass-card p-4"><p className="text-sm text-muted-foreground">Recent events</p><p className="text-2xl font-bold">{events.length}</p></div>
        </div>

        <div className="grid gap-4">
          {sessions.map((session) => {
            const sessionEvents = eventsBySession[session.id] || [];
            const stale = session.last_heartbeat_at && Date.now() - new Date(session.last_heartbeat_at).getTime() > 45000;
            return (
              <div key={session.id} className="glass-card p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{session.tests?.name || session.test_id}</h3>
                    <Badge variant={stale ? 'destructive' : 'default'}>{stale ? 'Stale' : session.status}</Badge>
                    {stale && <AlertTriangle className="w-4 h-4 text-destructive" />}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {deviceBadge(session.camera_enabled, 'Camera', Video)}
                    {deviceBadge(session.microphone_enabled, 'Mic', Mic)}
                    {deviceBadge(session.screen_enabled, 'Screen', MonitorUp)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Student: {session.profiles?.full_name || session.user_id} • Started {formatDistanceToNow(new Date(session.started_at), { addSuffix: true })}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Activity className="w-3 h-3" /> {sessionEvents.length} recent events • <Clock className="w-3 h-3" /> Last heartbeat {session.last_heartbeat_at ? formatDistanceToNow(new Date(session.last_heartbeat_at), { addSuffix: true }) : 'never'}</p>
                </div>
                <Button onClick={() => openViewer(session)}><Eye className="w-4 h-4 mr-2" /> Open viewer</Button>
              </div>
            );
          })}
          {!sessions.length && !loading && (
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
          <DialogHeader><DialogTitle>Live viewer — {selected?.tests?.name || selected?.test_id}</DialogTitle></DialogHeader>
          {selected && <LiveViewer session={selected} token={viewerTokens[selected.id]} events={eventsBySession[selected.id] || events.filter((event) => event.session_id === selected.id)} />}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

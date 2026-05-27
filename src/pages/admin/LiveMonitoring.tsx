import { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Activity, AlertTriangle, Clock, Eye, Mic, MonitorUp, RefreshCw, Shield, Video } from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
  LIVE_MONITORING_SCHEMA_MISSING_MESSAGE,
  isMissingSupabaseTableError,
  type ProctoringSchemaDiagnostics,
} from '@/lib/supabase/errors';
import type { MonitoringEventRecord, MonitoringSessionRecord, ProctoringDeviceState } from '@/lib/proctoring/types';

type LiveSession = MonitoringSessionRecord;
type LiveEvent = MonitoringEventRecord;
type ScreenshotRecord = {
  id: string;
  session_id: string;
  storage_path: string;
  captured_at: string;
  signed_url?: string | null;
};

const readDevices = (session: LiveSession): ProctoringDeviceState => {
  const metadata = session.metadata && typeof session.metadata === 'object' ? session.metadata : {};
  const devices = (metadata as { devices?: Partial<ProctoringDeviceState> }).devices;
  return {
    camera: Boolean(devices?.camera),
    microphone: Boolean(devices?.microphone),
    screen: Boolean(devices?.screen),
  };
};

const readSessionText = (session: LiveSession, key: string) => {
  const metadata = session.metadata && typeof session.metadata === 'object' ? session.metadata : {};
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
};

function deviceBadge(enabled: boolean, label: string, Icon: any) {
  return <Badge variant={enabled ? 'default' : 'secondary'} className="gap-1"><Icon className="w-3 h-3" /> {label}</Badge>;
}

function LiveViewer({ session, events, screenshots }: { session: LiveSession; events: LiveEvent[]; screenshots: ScreenshotRecord[] }) {
  const devices = readDevices(session);
  const fullscreenExits = events.filter((event) => event.event_type === 'fullscreen_exit').length;
  const recentQuestionEvent = events.find((event) => event.event_type === 'question_change');
  const recentSubjectEvent = events.find((event) => event.event_type === 'subject_change');

  return (
    <div className="grid lg:grid-cols-[2fr,1fr] gap-4">
      <div className="space-y-3">
        <div className="rounded-xl border bg-black/90 p-3 min-h-80">
          <div className="h-72 flex flex-col items-center justify-center text-white/80 text-center">
            <Shield className="w-10 h-10 mb-3" />
            <p className="font-semibold">Live stream viewer is unavailable in table-only mode.</p>
            <p className="text-sm">Session activity below is reading directly from monitoring tables.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="outline">{session.status}</Badge>
          {deviceBadge(devices.camera, 'Camera', Video)}
          {deviceBadge(devices.microphone, 'Mic', Mic)}
          {deviceBadge(devices.screen, 'Screen', MonitorUp)}
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-xl border p-4 space-y-2">
          <h3 className="font-semibold">Attempt activity</h3>
          <p className="text-sm text-muted-foreground">Attempt: {session.attempt_id}</p>
          <p className="text-sm text-muted-foreground">Fullscreen exits: {fullscreenExits}</p>
          <p className="text-sm text-muted-foreground">Current question: {String(recentQuestionEvent?.payload?.question_index ?? recentQuestionEvent?.question_id ?? '—')}</p>
          <p className="text-sm text-muted-foreground">Current subject: {recentSubjectEvent?.subject_name || '—'}</p>
          <p className="text-sm text-muted-foreground">Session ID: {session.id}</p>
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
        <div className="rounded-xl border p-4">
          <h3 className="font-semibold mb-3">Recent screenshots</h3>
          {screenshots.length ? (
            <div className="grid grid-cols-2 gap-3">
              {screenshots.map((shot) => (
                <div key={shot.id} className="rounded-lg border overflow-hidden bg-secondary/40">
                  {shot.signed_url ? (
                    <img src={shot.signed_url} alt={`Screenshot ${shot.id}`} className="w-full h-32 object-cover" />
                  ) : (
                    <div className="h-32 flex items-center justify-center text-xs text-muted-foreground">Unavailable</div>
                  )}
                  <div className="text-[10px] text-muted-foreground p-2">{new Date(shot.captured_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No screenshots captured yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LiveMonitoring() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [screenshots, setScreenshots] = useState<Record<string, ScreenshotRecord[]>>({});
  const [screenshotsLoading, setScreenshotsLoading] = useState(false);
  const [selected, setSelected] = useState<LiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [schemaDiagnostics, setSchemaDiagnostics] = useState<ProctoringSchemaDiagnostics>(null);

  const load = useCallback(async (options?: { toastOnSchemaError?: boolean }) => {
    const toastOnSchemaError = options?.toastOnSchemaError ?? true;
    setLoading(true);
    const [sessionsResult, eventsResult] = await Promise.all([
      supabase.from('monitoring_sessions').select('*').eq('status', 'active').order('started_at', { ascending: false }),
      supabase.from('monitoring_events').select('*').order('created_at', { ascending: false }).limit(300),
    ]);

    if (sessionsResult.error || eventsResult.error) {
      const nextError = sessionsResult.error ?? eventsResult.error;
      console.error(nextError);
      setErrorMessage(nextError?.message || 'Failed to load live monitoring sessions');
      if (isMissingSupabaseTableError(nextError)) {
        setSchemaDiagnostics({ missing_tables: ['monitoring_sessions', 'monitoring_events'] });
        if (toastOnSchemaError) {
          toast({ title: 'Monitoring setup required', description: LIVE_MONITORING_SCHEMA_MISSING_MESSAGE, variant: 'destructive' });
        }
      } else {
        setSchemaDiagnostics(null);
      }
      setLoading(false);
      return;
    }

    setErrorMessage(null);
    setSchemaDiagnostics(null);
    setSessions((sessionsResult.data || []) as LiveSession[]);
    setEvents((eventsResult.data || []) as LiveEvent[]);
    setRetrying(false);
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!schemaDiagnostics) return;
    const timer = window.setTimeout(() => {
      setRetrying(true);
      load({ toastOnSchemaError: false }).catch(() => setRetrying(false));
    }, 10000);
    return () => window.clearTimeout(timer);
  }, [load, schemaDiagnostics]);

  useEffect(() => {
    if (schemaDiagnostics) return;
    const channel = supabase
      .channel('admin-live-proctoring')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monitoring_sessions' }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'monitoring_events' }, (payload) => {
        setEvents((prev) => [payload.new as LiveEvent, ...prev].slice(0, 300));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, schemaDiagnostics]);

  const openViewer = async (session: LiveSession) => {
    setSelected(session);
    await load();
    await loadScreenshots(session.id);
  };

  const loadScreenshots = useCallback(async (sessionId: string) => {
    setScreenshotsLoading(true);
    const { data, error } = await supabase
      .from('monitoring_screenshots')
      .select('id, session_id, storage_path, captured_at')
      .eq('session_id', sessionId)
      .order('captured_at', { ascending: false })
      .limit(12);
    if (error) {
      console.error('Failed to load screenshots', error);
      setScreenshotsLoading(false);
      return;
    }

    const signed = await Promise.all(
      (data || []).map(async (shot) => {
        const { data: signedUrl } = await supabase.storage
          .from('monitoring-screenshots')
          .createSignedUrl(shot.storage_path, 3600);
        return { ...shot, signed_url: signedUrl?.signedUrl ?? null } as ScreenshotRecord;
      }),
    );
    setScreenshots((prev) => ({ ...prev, [sessionId]: signed }));
    setScreenshotsLoading(false);
  }, []);

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
          <div className="glass-card p-4"><p className="text-sm text-muted-foreground">Camera on</p><p className="text-2xl font-bold">{sessions.filter((s) => readDevices(s).camera).length}</p></div>
          <div className="glass-card p-4"><p className="text-sm text-muted-foreground">Screen shared</p><p className="text-2xl font-bold">{sessions.filter((s) => readDevices(s).screen).length}</p></div>
          <div className="glass-card p-4"><p className="text-sm text-muted-foreground">Recent events</p><p className="text-2xl font-bold">{events.length}</p></div>
        </div>

        {schemaDiagnostics && (
          <Alert variant="destructive">
            <AlertTitle>Admin diagnostics panel</AlertTitle>
            <AlertDescription>
              <p>{LIVE_MONITORING_SCHEMA_MISSING_MESSAGE}</p>
              {schemaDiagnostics.missing_tables?.length ? (
                <p className="mt-1">Missing tables: {schemaDiagnostics.missing_tables.join(', ')}</p>
              ) : null}
              {schemaDiagnostics.stale_migrations?.length ? (
                <p className="mt-1">Run migrations: {schemaDiagnostics.stale_migrations.join(', ')}</p>
              ) : null}
              {schemaDiagnostics.missing_columns && Object.keys(schemaDiagnostics.missing_columns).length ? (
                <div className="mt-1">
                  Missing columns:
                  <ul className="list-disc ml-5">
                    {Object.entries(schemaDiagnostics.missing_columns).map(([table, columns]) => (
                      <li key={table}>{table}: {columns.join(', ')}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setRetrying(true); load().catch(() => setRetrying(false)); }} disabled={retrying || loading}>
                  {retrying || loading ? 'Retrying…' : 'Retry now'}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
        {errorMessage && !schemaDiagnostics && (
          <Alert variant="destructive">
            <AlertTitle>Unable to load live monitoring</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4">
          {sessions.map((session) => {
            const sessionEvents = eventsBySession[session.id] || [];
            const devices = readDevices(session);
            const lastHeartbeat = sessionEvents.find((event) => event.event_type === 'heartbeat')?.created_at ?? null;
            const stale = lastHeartbeat && Date.now() - new Date(lastHeartbeat).getTime() > 45000;
            const sessionTestName = readSessionText(session, 'test_name');
            const sessionTestId = readSessionText(session, 'test_id');
            const testName = sessionTestName || sessionTestId || session.attempt_id;
            return (
              <div key={session.id} className="glass-card p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{testName}</h3>
                    <Badge variant={stale ? 'destructive' : 'default'}>{stale ? 'Stale' : session.status}</Badge>
                    {stale && <AlertTriangle className="w-4 h-4 text-destructive" />}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {deviceBadge(devices.camera, 'Camera', Video)}
                    {deviceBadge(devices.microphone, 'Mic', Mic)}
                    {deviceBadge(devices.screen, 'Screen', MonitorUp)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Student: {readSessionText(session, 'student_name') || session.student_id || 'Unknown'} • Started {formatDistanceToNow(new Date(session.started_at), { addSuffix: true })}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Activity className="w-3 h-3" /> {sessionEvents.length} recent events • <Clock className="w-3 h-3" /> Last heartbeat {lastHeartbeat ? formatDistanceToNow(new Date(lastHeartbeat), { addSuffix: true }) : 'never'}</p>
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
          <DialogHeader><DialogTitle>Live viewer — {selected ? (readSessionText(selected, 'test_name') || selected.attempt_id) : 'Monitoring session'}</DialogTitle></DialogHeader>
          {selected && (
            <LiveViewer
              session={selected}
              events={eventsBySession[selected.id] || events.filter((event) => event.session_id === selected.id)}
              screenshots={screenshots[selected.id] || []}
            />
          )}
          {selected && screenshotsLoading && <p className="text-xs text-muted-foreground">Loading screenshots…</p>}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

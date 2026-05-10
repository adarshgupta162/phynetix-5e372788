import { useEffect, useState } from 'react';
import { Shield, Video, Mic, MonitorUp, Users, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import type { ProctoringSettings } from '@/lib/proctoring/types';
import { DEFAULT_PROCTORING_SETTINGS } from '@/lib/proctoring/settings';
import { isMissingSupabaseTableError } from '@/lib/supabase/errors';

type UserOverride = {
  id?: string;
  user_id: string;
  allowed: boolean;
  enabled: boolean | null;
  require_camera: boolean | null;
  require_microphone: boolean | null;
  require_screen: boolean | null;
  notes?: string | null;
  profile?: { full_name?: string | null } | null;
};

interface Props {
  testId: string;
  compact?: boolean;
}

export function ProctoringSettingsCard({ testId, compact = false }: Props) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<ProctoringSettings>(DEFAULT_PROCTORING_SETTINGS);
  const [overrides, setOverrides] = useState<UserOverride[]>([]);
  const [newUserId, setNewUserId] = useState('');
  const [saving, setSaving] = useState(false);
  const missingSchemaMessage = 'Live monitoring schema is missing. Run latest Supabase migrations and reload.';

  const load = async () => {
    const { data, error } = await supabase.from('proctoring_test_settings').select('*').eq('test_id', testId).maybeSingle();
    if (error) {
      if (isMissingSupabaseTableError(error)) {
        toast({ title: 'Monitoring setup required', description: missingSchemaMessage, variant: 'destructive' });
      }
      return;
    }
    if (data) {
      setSettings({
        enabled: data.enabled ?? false,
        allowed: true,
        require_camera: data.require_camera ?? true,
        require_microphone: data.require_microphone ?? true,
        require_screen: data.require_screen ?? true,
        allow_optional_device_fallback: data.allow_optional_device_fallback ?? false,
        recording_enabled: data.recording_enabled ?? false,
        retention_days: data.retention_days ?? 30,
        instructions: data.instructions ?? null,
        allow_specific_users_only: data.allow_specific_users_only ?? false,
      });
    }

    const { data: overrideData, error: overrideError } = await supabase
      .from('proctoring_user_overrides')
      .select('*')
      .eq('test_id', testId)
      .order('created_at', { ascending: false });
    if (overrideError) {
      if (isMissingSupabaseTableError(overrideError)) {
        toast({ title: 'Monitoring setup required', description: missingSchemaMessage, variant: 'destructive' });
      }
      return;
    }
    const userIds = (overrideData || []).map((item) => item.user_id);
    const { data: profiles } = userIds.length
      ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
      : { data: [] };
    const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
    setOverrides(((overrideData || []).map((item) => ({ ...item, profile: profileMap.get(item.user_id) || null })) as UserOverride[]));
  };

  useEffect(() => { load(); }, [testId]);

  const save = async () => {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('proctoring_test_settings').upsert({
      test_id: testId,
      enabled: settings.enabled,
      allow_specific_users_only: settings.allow_specific_users_only,
      require_camera: settings.require_camera,
      require_microphone: settings.require_microphone,
      require_screen: settings.require_screen,
      allow_optional_device_fallback: settings.allow_optional_device_fallback,
      recording_enabled: settings.recording_enabled,
      retention_days: settings.retention_days,
      instructions: settings.instructions,
      updated_by: userData.user?.id,
      created_by: userData.user?.id,
    }, { onConflict: 'test_id' });
    setSaving(false);
    if (error) {
      const description = isMissingSupabaseTableError(error) ? missingSchemaMessage : error.message;
      toast({ title: 'Failed to save monitoring settings', description, variant: 'destructive' });
    }
    else toast({ title: 'Live monitoring settings saved' });
  };

  const addOverride = async () => {
    if (!newUserId.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('proctoring_user_overrides').upsert({
      test_id: testId,
      user_id: newUserId.trim(),
      allowed: true,
      enabled: true,
      created_by: userData.user?.id,
      updated_by: userData.user?.id,
    }, { onConflict: 'test_id,user_id' });
    if (error) {
      const description = isMissingSupabaseTableError(error) ? missingSchemaMessage : error.message;
      toast({ title: 'Failed to add user override', description, variant: 'destructive' });
    }
    else {
      setNewUserId('');
      await load();
      toast({ title: 'Student allowlist updated' });
    }
  };

  const updateOverride = async (override: UserOverride, updates: Partial<UserOverride>) => {
    const { error } = await supabase
      .from('proctoring_user_overrides')
      .update(updates)
      .eq('test_id', testId)
      .eq('user_id', override.user_id);
    if (error) {
      const description = isMissingSupabaseTableError(error) ? missingSchemaMessage : error.message;
      toast({ title: 'Failed to update user override', description, variant: 'destructive' });
      return;
    }
    setOverrides((items) => items.map((item) => item.user_id === override.user_id ? { ...item, ...updates } : item));
  };

  const field = (key: keyof ProctoringSettings, value: any) => setSettings((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><Shield className="w-4 h-4" /> Live Monitoring</h3>
          <p className="text-xs text-muted-foreground">Configure camera, mic, screen-share and student allowlist rules.</p>
        </div>
        <Badge variant={settings.enabled ? 'default' : 'secondary'}>{settings.enabled ? 'Enabled' : 'Disabled'}</Badge>
      </div>

      <div className="grid gap-4">
        <div className="flex items-center justify-between"><Label>Enable monitoring</Label><Switch checked={settings.enabled} onCheckedChange={(v) => field('enabled', v)} /></div>
        <div className="flex items-center justify-between"><Label className="flex items-center gap-2"><Video className="w-4 h-4" /> Require camera</Label><Switch checked={settings.require_camera} onCheckedChange={(v) => field('require_camera', v)} /></div>
        <div className="flex items-center justify-between"><Label className="flex items-center gap-2"><Mic className="w-4 h-4" /> Require microphone</Label><Switch checked={settings.require_microphone} onCheckedChange={(v) => field('require_microphone', v)} /></div>
        <div className="flex items-center justify-between"><Label className="flex items-center gap-2"><MonitorUp className="w-4 h-4" /> Require screen share</Label><Switch checked={settings.require_screen} onCheckedChange={(v) => field('require_screen', v)} /></div>
        <div className="flex items-center justify-between"><Label>Allow fallback if a device fails</Label><Switch checked={settings.allow_optional_device_fallback} onCheckedChange={(v) => field('allow_optional_device_fallback', v)} /></div>
        <div className="flex items-center justify-between"><Label>Only selected students</Label><Switch checked={settings.allow_specific_users_only} onCheckedChange={(v) => field('allow_specific_users_only', v)} /></div>
        <div className="flex items-center justify-between"><Label>Recording enabled</Label><Switch checked={settings.recording_enabled} onCheckedChange={(v) => field('recording_enabled', v)} /></div>
        <div className="space-y-2">
          <Label>Retention days</Label>
          <Input type="number" min={1} max={3650} value={settings.retention_days} onChange={(event) => field('retention_days', Number(event.target.value) || 30)} />
        </div>
        <div className="space-y-2">
          <Label>Student monitoring instructions</Label>
          <Textarea value={settings.instructions || ''} onChange={(event) => field('instructions', event.target.value)} placeholder="Explain test-specific monitoring rules" />
        </div>
      </div>

      {!compact && (
        <div className="space-y-3 border-t pt-4">
          <Label className="flex items-center gap-2"><Users className="w-4 h-4" /> Specific user allowlist / overrides</Label>
          <div className="flex gap-2">
            <Input value={newUserId} onChange={(event) => setNewUserId(event.target.value)} placeholder="Paste student user UUID" />
            <Button type="button" variant="outline" onClick={addOverride}>Add</Button>
          </div>
          <div className="space-y-2 max-h-48 overflow-auto">
            {overrides.map((override) => (
              <div key={override.user_id} className="rounded-lg border p-3 text-sm space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate">
                    <div className="font-medium">{override.profile?.full_name || override.user_id}</div>
                    <div className="text-xs text-muted-foreground truncate">{override.user_id}</div>
                  </div>
                  <Switch checked={override.allowed} onCheckedChange={(v) => updateOverride(override, { allowed: v })} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <Button variant={override.require_camera === false ? 'secondary' : 'outline'} size="sm" onClick={() => updateOverride(override, { require_camera: override.require_camera === false ? null : false })}>Camera override</Button>
                  <Button variant={override.require_microphone === false ? 'secondary' : 'outline'} size="sm" onClick={() => updateOverride(override, { require_microphone: override.require_microphone === false ? null : false })}>Mic override</Button>
                  <Button variant={override.require_screen === false ? 'secondary' : 'outline'} size="sm" onClick={() => updateOverride(override, { require_screen: override.require_screen === false ? null : false })}>Screen override</Button>
                </div>
              </div>
            ))}
            {!overrides.length && <p className="text-xs text-muted-foreground">No student-specific overrides added yet.</p>}
          </div>
        </div>
      )}

      <Button onClick={save} disabled={saving} className="w-full"><Save className="w-4 h-4 mr-2" /> {saving ? 'Saving…' : 'Save monitoring settings'}</Button>
    </div>
  );
}

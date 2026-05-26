import { useEffect, useState } from "react";
import { Users, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { isMissingSupabaseTableError } from "@/lib/supabase/errors";

interface OverrideRecord {
  id: string;
  user_id: string;
  extra_time_minutes: number;
  submit_disabled: boolean;
  result_release_delay_minutes: number | null;
  notes: string | null;
  profile?: { full_name?: string | null } | null;
}

interface Props {
  testId: string;
}

export function TestUserOverridesCard({ testId }: Props) {
  const { toast } = useToast();
  const [overrides, setOverrides] = useState<OverrideRecord[]>([]);
  const [newUserId, setNewUserId] = useState("");
  const [newExtraTime, setNewExtraTime] = useState(0);
  const [newResultDelay, setNewResultDelay] = useState(0);
  const [newSubmitDisabled, setNewSubmitDisabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [schemaMissing, setSchemaMissing] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("test_user_overrides")
      .select("*")
      .eq("test_id", testId)
      .order("created_at", { ascending: false });

    if (error) {
      if (isMissingSupabaseTableError(error)) {
        setSchemaMissing(true);
      } else {
        toast({ title: "Failed to load overrides", description: error.message, variant: "destructive" });
      }
      setLoading(false);
      return;
    }

    const userIds = (data || []).map((item) => item.user_id);
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
      : { data: [] };
    const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));

    setOverrides(
      (data || []).map((item) => ({
        ...(item as OverrideRecord),
        profile: profileMap.get(item.user_id) || null,
      })),
    );
    setSchemaMissing(false);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [testId]);

  const addOverride = async () => {
    if (!newUserId.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    const payload = {
      test_id: testId,
      user_id: newUserId.trim(),
      extra_time_minutes: newExtraTime,
      submit_disabled: newSubmitDisabled,
      result_release_delay_minutes: newResultDelay,
      created_by: userData.user?.id,
      updated_by: userData.user?.id,
    };
    const { error } = await supabase.from("test_user_overrides").upsert(payload, { onConflict: "test_id,user_id" });
    if (error) {
      const description = isMissingSupabaseTableError(error) ? "Overrides table is missing." : error.message;
      toast({ title: "Failed to add override", description, variant: "destructive" });
      return;
    }
    setNewUserId("");
    setNewExtraTime(0);
    setNewResultDelay(0);
    setNewSubmitDisabled(false);
    await load();
    toast({ title: "User override saved" });
  };

  const updateOverride = async (override: OverrideRecord) => {
    const { error } = await supabase
      .from("test_user_overrides")
      .update({
        extra_time_minutes: override.extra_time_minutes,
        submit_disabled: override.submit_disabled,
        result_release_delay_minutes: override.result_release_delay_minutes,
      })
      .eq("id", override.id);
    if (error) {
      toast({ title: "Failed to update override", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Override updated" });
  };

  const removeOverride = async (overrideId: string) => {
    const { error } = await supabase.from("test_user_overrides").delete().eq("id", overrideId);
    if (error) {
      toast({ title: "Failed to remove override", description: error.message, variant: "destructive" });
      return;
    }
    setOverrides((items) => items.filter((item) => item.id !== overrideId));
    toast({ title: "Override removed" });
  };

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div>
        <h3 className="font-semibold flex items-center gap-2"><Users className="w-4 h-4" /> User-specific test overrides</h3>
        <p className="text-xs text-muted-foreground">Adjust time, submissions, and result delays for individual students.</p>
      </div>

      {schemaMissing && (
        <Alert variant="destructive">
          <AlertTitle>Overrides schema missing</AlertTitle>
          <AlertDescription>Run the latest migrations to enable user overrides.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Student user ID</Label>
          <Input value={newUserId} onChange={(event) => setNewUserId(event.target.value)} placeholder="UUID" />
        </div>
        <div className="space-y-1">
          <Label>Extra time (minutes)</Label>
          <Input type="number" min={-120} max={600} value={newExtraTime} onChange={(event) => setNewExtraTime(Number(event.target.value) || 0)} />
        </div>
        <div className="space-y-1">
          <Label>Result delay (minutes)</Label>
          <Input type="number" min={0} max={1440} value={newResultDelay} onChange={(event) => setNewResultDelay(Number(event.target.value) || 0)} />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={newSubmitDisabled} onCheckedChange={setNewSubmitDisabled} />
          <Label>Disable submit</Label>
        </div>
      </div>

      <Button type="button" variant="outline" onClick={addOverride} disabled={loading || schemaMissing}>
        <Save className="w-4 h-4 mr-2" /> Save override
      </Button>

      <div className="space-y-3">
        {overrides.map((override) => (
          <div key={override.id} className="rounded-lg border p-3 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-sm">{override.profile?.full_name || override.user_id}</p>
                <p className="text-xs text-muted-foreground truncate">{override.user_id}</p>
              </div>
              <Button variant="outline" size="icon" onClick={() => removeOverride(override.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label>Extra time</Label>
                <Input
                  type="number"
                  min={-120}
                  max={600}
                  value={override.extra_time_minutes}
                  onChange={(event) => setOverrides((items) => items.map((item) => item.id === override.id ? { ...item, extra_time_minutes: Number(event.target.value) || 0 } : item))}
                />
              </div>
              <div className="space-y-1">
                <Label>Result delay</Label>
                <Input
                  type="number"
                  min={0}
                  max={1440}
                  value={override.result_release_delay_minutes ?? 0}
                  onChange={(event) => setOverrides((items) => items.map((item) => item.id === override.id ? { ...item, result_release_delay_minutes: Number(event.target.value) || 0 } : item))}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={override.submit_disabled}
                  onCheckedChange={(checked) => setOverrides((items) => items.map((item) => item.id === override.id ? { ...item, submit_disabled: checked } : item))}
                />
                <Label>Disable submit</Label>
              </div>
            </div>
            <Button type="button" size="sm" onClick={() => updateOverride(override)}>
              <Save className="w-4 h-4 mr-2" /> Update
            </Button>
          </div>
        ))}
        {!overrides.length && !loading && (
          <p className="text-xs text-muted-foreground">No overrides added yet.</p>
        )}
      </div>
    </div>
  );
}

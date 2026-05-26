import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, RotateCcw, Save, ShieldOff, ShieldCheck } from "lucide-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AttemptRow {
  id: string;
  user_id: string;
  started_at: string;
  completed_at: string | null;
  score: number | null;
  time_taken_seconds: number | null;
  extra_time_minutes: number;
  submit_disabled: boolean;
  result_release_delay_minutes: number;
  result_available_at: string | null;
  awaiting_result: boolean | null;
  profile?: { full_name?: string | null; roll_number?: string | null } | null;
}

export default function TestManagement() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [testName, setTestName] = useState("Test");
  const [defaultReleaseDelay, setDefaultReleaseDelay] = useState(180);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!testId) return;
    setLoading(true);
    const { data: test } = await supabase
      .from("tests")
      .select("name, result_release_delay_minutes")
      .eq("id", testId)
      .single();
    if (test) {
      setTestName(test.name);
      setDefaultReleaseDelay(test.result_release_delay_minutes ?? 180);
    }

    const { data: attemptsData, error } = await supabase
      .from("test_attempts")
      .select("id, user_id, started_at, completed_at, score, time_taken_seconds, extra_time_minutes, submit_disabled, result_release_delay_minutes, result_available_at, awaiting_result")
      .eq("test_id", testId)
      .order("started_at", { ascending: false });

    if (error) {
      toast({ title: "Failed to load attempts", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const userIds = [...new Set((attemptsData || []).map((item) => item.user_id))];
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select("id, full_name, roll_number").in("id", userIds)
      : { data: [] };
    const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));

    setAttempts(
      (attemptsData || []).map((item) => ({
        ...(item as AttemptRow),
        profile: profileMap.get(item.user_id) || null,
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [testId]);

  const updateAttempt = async (attempt: AttemptRow) => {
    const { error } = await supabase
      .from("test_attempts")
      .update({
        extra_time_minutes: attempt.extra_time_minutes,
        submit_disabled: attempt.submit_disabled,
        result_release_delay_minutes: attempt.result_release_delay_minutes,
      })
      .eq("id", attempt.id);
    if (error) {
      toast({ title: "Failed to update attempt", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Attempt updated" });
  };

  const lockResults = async (attempt: AttemptRow, delayMinutes?: number) => {
    const delay = delayMinutes ?? attempt.result_release_delay_minutes ?? defaultReleaseDelay;
    const resultAt = new Date(new Date(attempt.started_at).getTime() + delay * 60_000).toISOString();
    const { error } = await supabase
      .from("test_attempts")
      .update({ result_available_at: resultAt })
      .eq("id", attempt.id);
    if (error) {
      toast({ title: "Failed to lock results", description: error.message, variant: "destructive" });
      return;
    }
    setAttempts((items) => items.map((item) => item.id === attempt.id ? { ...item, result_available_at: resultAt } : item));
    toast({ title: "Results locked", description: `Results available at ${new Date(resultAt).toLocaleString()}` });
  };

  const releaseResults = async (attempt: AttemptRow) => {
    const resultAt = new Date().toISOString();
    const { error } = await supabase
      .from("test_attempts")
      .update({ result_available_at: resultAt })
      .eq("id", attempt.id);
    if (error) {
      toast({ title: "Failed to release results", description: error.message, variant: "destructive" });
      return;
    }
    setAttempts((items) => items.map((item) => item.id === attempt.id ? { ...item, result_available_at: resultAt } : item));
    toast({ title: "Results released" });
  };

  const restartAttempt = async (attempt: AttemptRow) => {
    const delay = attempt.result_release_delay_minutes ?? defaultReleaseDelay;
    const resultAt = new Date(new Date(attempt.started_at).getTime() + delay * 60_000).toISOString();
    const { error } = await supabase
      .from("test_attempts")
      .update({
        completed_at: null,
        awaiting_result: false,
        score: null,
        total_marks: null,
        rank: null,
        percentile: null,
        reopened_at: new Date().toISOString(),
        result_available_at: resultAt,
      })
      .eq("id", attempt.id);
    if (error) {
      toast({ title: "Failed to restart attempt", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Attempt reopened" });
    await load();
  };

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Button variant="ghost" onClick={() => navigate(`/admin/test-analytics/${testId}`)}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to analytics
            </Button>
            <h1 className="text-2xl font-bold mt-2">Test Management — {testName}</h1>
            <p className="text-sm text-muted-foreground">Manage per-student time, submissions, and result locks.</p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading attempts…</p>
        ) : attempts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attempts found.</p>
        ) : (
          <div className="space-y-4">
            {attempts.map((attempt) => (
              <div key={attempt.id} className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {attempt.profile?.full_name || attempt.user_id}
                      {attempt.profile?.roll_number ? ` • ${attempt.profile?.roll_number}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">Started {new Date(attempt.started_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={attempt.completed_at ? "default" : "secondary"}>
                      {attempt.completed_at ? "Submitted" : "In progress"}
                    </Badge>
                    {attempt.submit_disabled && <Badge variant="destructive">Submit disabled</Badge>}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label>Extra time (minutes)</Label>
                    <Input
                      type="number"
                      min={-120}
                      max={600}
                      value={attempt.extra_time_minutes}
                      onChange={(event) => setAttempts((items) => items.map((item) => item.id === attempt.id ? { ...item, extra_time_minutes: Number(event.target.value) || 0 } : item))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Result delay (minutes)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={1440}
                      value={attempt.result_release_delay_minutes}
                      onChange={(event) => setAttempts((items) => items.map((item) => item.id === attempt.id ? { ...item, result_release_delay_minutes: Number(event.target.value) || 0 } : item))}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={attempt.submit_disabled}
                      onCheckedChange={(checked) => setAttempts((items) => items.map((item) => item.id === attempt.id ? { ...item, submit_disabled: checked } : item))}
                    />
                    <Label>Disable submit</Label>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Result available at: {attempt.result_available_at ? new Date(attempt.result_available_at).toLocaleString() : "Immediate"}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => updateAttempt(attempt)}>
                    <Save className="w-4 h-4 mr-2" /> Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => restartAttempt(attempt)}>
                    <RotateCcw className="w-4 h-4 mr-2" /> Restart
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => lockResults(attempt)}>
                    <ShieldOff className="w-4 h-4 mr-2" /> Lock 3h
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => releaseResults(attempt)}>
                    <ShieldCheck className="w-4 h-4 mr-2" /> Release
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

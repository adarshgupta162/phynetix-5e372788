import { useState, useEffect } from "react";
import { 
  Settings, Clock, FileText, Eye, EyeOff, Save, 
  Copy, Trash2, Archive, RotateCcw, AlertTriangle 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Test {
  id: string;
  name: string;
  description: string | null;
  exam_type: string;
  duration_minutes: number;
  is_published: boolean;
  fullscreen_enabled: boolean;
  show_solutions: boolean;
  instructions_json: any;
  proctoring_enabled?: boolean | null;
  proctoring_provider?: string | null;
  proctoring_require_camera?: boolean | null;
  proctoring_require_mic?: boolean | null;
  proctoring_require_screen?: boolean | null;
  proctoring_allowlist_enabled?: boolean | null;
  proctoring_recording_enabled?: boolean | null;
  proctoring_retention_days?: number | null;
}

interface TestSettingsPanelProps {
  test: Test;
  onUpdate: (updates: Partial<Test>) => Promise<void>;
  onDuplicate: () => Promise<void>;
  onDelete: () => Promise<void>;
  onTogglePublish: () => Promise<void>;
  totalQuestions: number;
  isSaving: boolean;
}

export function TestSettingsPanel({
  test,
  onUpdate,
  onDuplicate,
  onDelete,
  onTogglePublish,
  totalQuestions,
  isSaving
}: TestSettingsPanelProps) {
  const [localTest, setLocalTest] = useState(test);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [allowlistEntries, setAllowlistEntries] = useState<{ id: string; user_id: string; full_name: string | null; roll_number: string | null }[]>([]);
  const [allowlistUserId, setAllowlistUserId] = useState("");
  const [allowlistLoading, setAllowlistLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setLocalTest(test);
  }, [test]);

  useEffect(() => {
    void fetchAllowlist();
  }, [test.id]);

  const fetchAllowlist = async () => {
    if (!test.id) return;
    setAllowlistLoading(true);
    const { data: allowlist } = await supabase
      .from("proctoring_allowlist")
      .select("id, user_id, is_allowed")
      .eq("test_id", test.id)
      .eq("is_allowed", true);

    const ids = (allowlist || []).map((entry) => entry.user_id);
    const { data: profiles } = ids.length > 0
      ? await supabase.from("profiles").select("id, full_name, roll_number").in("id", ids)
      : { data: [] };

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    setAllowlistEntries((allowlist || []).map((entry) => ({
      id: entry.id,
      user_id: entry.user_id,
      full_name: profileMap.get(entry.user_id)?.full_name ?? null,
      roll_number: profileMap.get(entry.user_id)?.roll_number ?? null,
    })));
    setAllowlistLoading(false);
  };

  const handleAddAllowlist = async () => {
    if (!allowlistUserId.trim()) return;
    const { error } = await supabase
      .from("proctoring_allowlist")
      .upsert({
        test_id: test.id,
        user_id: allowlistUserId.trim(),
        is_allowed: true,
      }, { onConflict: "test_id,user_id" });
    if (error) {
      toast({ title: "Failed to add user", description: error.message, variant: "destructive" });
      return;
    }
    setAllowlistUserId("");
    void fetchAllowlist();
  };

  const handleRemoveAllowlist = async (id: string) => {
    const { error } = await supabase
      .from("proctoring_allowlist")
      .delete()
      .eq("id", id);
    if (error) {
      toast({ title: "Failed to remove user", description: error.message, variant: "destructive" });
      return;
    }
    void fetchAllowlist();
  };

  const handleChange = (field: keyof Test, value: any) => {
    setLocalTest({ ...localTest, [field]: value });
    setHasChanges(true);
  };

  const handleSave = async () => {
    await onUpdate({
      name: localTest.name,
      description: localTest.description,
      duration_minutes: localTest.duration_minutes,
      fullscreen_enabled: localTest.fullscreen_enabled,
      show_solutions: localTest.show_solutions,
      proctoring_enabled: localTest.proctoring_enabled ?? false,
      proctoring_provider: localTest.proctoring_provider ?? "webrtc",
      proctoring_require_camera: localTest.proctoring_require_camera ?? false,
      proctoring_require_mic: localTest.proctoring_require_mic ?? false,
      proctoring_require_screen: localTest.proctoring_require_screen ?? false,
      proctoring_allowlist_enabled: localTest.proctoring_allowlist_enabled ?? false,
      proctoring_recording_enabled: localTest.proctoring_recording_enabled ?? false,
      proctoring_retention_days: localTest.proctoring_retention_days ?? 0,
    });
    setHasChanges(false);
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm">
          <Settings className="w-4 h-4 mr-1" />
          Settings
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Test Settings</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Test Name */}
          <div className="space-y-2">
            <Label>Test Name</Label>
            <Input
              value={localTest.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Enter test name"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={localTest.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Add test description..."
              className="min-h-[100px]"
            />
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Duration (minutes)
            </Label>
            <Input
              type="number"
              value={localTest.duration_minutes}
              onChange={(e) => handleChange('duration_minutes', parseInt(e.target.value) || 60)}
              min={1}
              max={600}
            />
          </div>

          {/* Toggles */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Fullscreen Mode</Label>
                <p className="text-xs text-muted-foreground">Require fullscreen during test</p>
              </div>
              <Switch
                checked={localTest.fullscreen_enabled}
                onCheckedChange={(checked) => handleChange('fullscreen_enabled', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Show Solutions</Label>
                <p className="text-xs text-muted-foreground">Show solutions after test completion</p>
              </div>
              <Switch
                checked={localTest.show_solutions}
                onCheckedChange={(checked) => handleChange('show_solutions', checked)}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-border space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Live Monitoring</Label>
                <p className="text-xs text-muted-foreground">Enable camera/screen/mic monitoring</p>
              </div>
              <Switch
                checked={localTest.proctoring_enabled ?? false}
                onCheckedChange={(checked) => handleChange("proctoring_enabled", checked)}
              />
            </div>

            {localTest.proctoring_enabled && (
              <div className="space-y-4 rounded-lg border border-border bg-secondary/20 p-3">
                <div className="space-y-2">
                  <Label>Streaming Provider</Label>
                  <select
                    value={localTest.proctoring_provider ?? "webrtc"}
                    onChange={(e) => handleChange("proctoring_provider", e.target.value)}
                    className="h-11 w-full px-3 rounded-lg border border-border bg-background text-foreground"
                  >
                    <option value="webrtc">WebRTC (built-in)</option>
                    <option value="livekit" disabled>LiveKit (coming soon)</option>
                    <option value="twilio" disabled>Twilio (coming soon)</option>
                    <option value="agora" disabled>Agora (coming soon)</option>
                  </select>
                </div>

                <div className="grid gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Require Camera</Label>
                      <p className="text-xs text-muted-foreground">Block test start if camera not granted</p>
                    </div>
                    <Switch
                      checked={localTest.proctoring_require_camera ?? false}
                      onCheckedChange={(checked) => handleChange("proctoring_require_camera", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Require Microphone</Label>
                      <p className="text-xs text-muted-foreground">Block test start if mic not granted</p>
                    </div>
                    <Switch
                      checked={localTest.proctoring_require_mic ?? false}
                      onCheckedChange={(checked) => handleChange("proctoring_require_mic", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Require Screen Share</Label>
                      <p className="text-xs text-muted-foreground">Block test start if screen not granted</p>
                    </div>
                    <Switch
                      checked={localTest.proctoring_require_screen ?? false}
                      onCheckedChange={(checked) => handleChange("proctoring_require_screen", checked)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Allowlist Only</Label>
                    <p className="text-xs text-muted-foreground">Enable monitoring only for selected users</p>
                  </div>
                  <Switch
                    checked={localTest.proctoring_allowlist_enabled ?? false}
                    onCheckedChange={(checked) => handleChange("proctoring_allowlist_enabled", checked)}
                  />
                </div>

                {localTest.proctoring_allowlist_enabled && (
                  <div className="space-y-3 rounded-md border border-border bg-background p-3">
                    <Label>Allowlisted Users</Label>
                    <div className="flex gap-2">
                      <Input
                        value={allowlistUserId}
                        onChange={(e) => setAllowlistUserId(e.target.value)}
                        placeholder="Enter user UUID"
                      />
                      <Button type="button" onClick={handleAddAllowlist}>Add</Button>
                    </div>
                    {allowlistLoading ? (
                      <p className="text-xs text-muted-foreground">Loading allowlist...</p>
                    ) : allowlistEntries.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No users in allowlist.</p>
                    ) : (
                      <div className="space-y-2">
                        {allowlistEntries.map((entry) => (
                          <div key={entry.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                            <div>
                              <div className="font-medium">{entry.full_name || entry.user_id}</div>
                              <div className="text-xs text-muted-foreground">
                                {entry.roll_number ? `Roll: ${entry.roll_number}` : entry.user_id}
                              </div>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => handleRemoveAllowlist(entry.id)}>Remove</Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Recording Enabled</Label>
                    <p className="text-xs text-muted-foreground">Store session recordings when available</p>
                  </div>
                  <Switch
                    checked={localTest.proctoring_recording_enabled ?? false}
                    onCheckedChange={(checked) => handleChange("proctoring_recording_enabled", checked)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Retention (days)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={localTest.proctoring_retention_days ?? 0}
                    onChange={(e) => handleChange("proctoring_retention_days", parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Test Info */}
          <div className="bg-secondary/30 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Questions</span>
              <span className="font-medium">{totalQuestions}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Exam Type</span>
              <span className="font-medium">{localTest.exam_type === 'jee_advanced' ? 'JEE Advanced' : 'JEE Mains'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <span className={`font-medium ${test.is_published ? 'text-green-600' : 'text-yellow-600'}`}>
                {test.is_published ? 'Published' : 'Draft'}
              </span>
            </div>
          </div>

          {/* Save Button */}
          {hasChanges && (
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full"
            >
              {isSaving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-primary-foreground" />
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          )}

          {/* Actions */}
          <div className="pt-4 border-t border-border space-y-2">
            <Button
              variant="outline"
              onClick={onTogglePublish}
              className="w-full"
            >
              {test.is_published ? (
                <>
                  <EyeOff className="w-4 h-4 mr-2" />
                  Unpublish Test
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  Publish Test
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={onDuplicate}
              className="w-full"
            >
              <Copy className="w-4 h-4 mr-2" />
              Duplicate Test
            </Button>

            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Test
            </Button>
          </div>
        </div>

        {/* Delete Confirmation */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Delete Test?
              </DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">
              This will permanently delete "{test.name}" and all its questions. This action cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => {
                onDelete();
                setShowDeleteConfirm(false);
              }}>
                Delete Test
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}

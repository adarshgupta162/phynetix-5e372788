import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarClock, Copy, Eye, EyeOff, Save, Settings2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

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
  scheduled_at?: string | null;
  solution_reopen_mode?: boolean | null;
}

interface AdvancedSettingsPageProps {
  test: Test;
  totalQuestions: number;
  isSaving: boolean;
  onBack: () => void;
  onUpdate: (updates: Partial<Test>) => Promise<void>;
  onTogglePublish: () => Promise<void>;
  onDuplicate: () => Promise<void>;
  onDelete: () => Promise<void>;
}

interface InstructionsConfig {
  customInstructions: string;
  examChecklist: string;
  submissionNotes: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showQuestionPalette: boolean;
  allowSectionJump: boolean;
  autoSubmitOnTimeout: boolean;
  showUnansweredWarning: boolean;
  enableCalculator: boolean;
  maxAttempts: number;
  gracePeriodMinutes: number;
  lowTimeWarningMinutes: number;
}

const defaultInstructions: InstructionsConfig = {
  customInstructions: "",
  examChecklist: "",
  submissionNotes: "",
  shuffleQuestions: false,
  shuffleOptions: false,
  showQuestionPalette: true,
  allowSectionJump: true,
  autoSubmitOnTimeout: true,
  showUnansweredWarning: true,
  enableCalculator: false,
  maxAttempts: 1,
  gracePeriodMinutes: 0,
  lowTimeWarningMinutes: 10
};

const toLocalDateTimeValue = (isoValue?: string | null) => {
  if (!isoValue) return "";
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

const fromLocalDateTimeValue = (localValue: string) => {
  if (!localValue) return null;
  const date = new Date(localValue);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const normalizeInstructions = (value: any): InstructionsConfig => {
  if (!value || typeof value !== "object") return defaultInstructions;
  return {
    customInstructions: typeof value.customInstructions === "string" ? value.customInstructions : "",
    examChecklist: typeof value.examChecklist === "string" ? value.examChecklist : "",
    submissionNotes: typeof value.submissionNotes === "string" ? value.submissionNotes : "",
    shuffleQuestions: Boolean(value.shuffleQuestions),
    shuffleOptions: Boolean(value.shuffleOptions),
    showQuestionPalette: value.showQuestionPalette ?? true,
    allowSectionJump: value.allowSectionJump ?? true,
    autoSubmitOnTimeout: value.autoSubmitOnTimeout ?? true,
    showUnansweredWarning: value.showUnansweredWarning ?? true,
    enableCalculator: Boolean(value.enableCalculator),
    maxAttempts: Number(value.maxAttempts) > 0 ? Number(value.maxAttempts) : 1,
    gracePeriodMinutes: Number(value.gracePeriodMinutes) >= 0 ? Number(value.gracePeriodMinutes) : 0,
    lowTimeWarningMinutes: Number(value.lowTimeWarningMinutes) >= 0 ? Number(value.lowTimeWarningMinutes) : 10
  };
};

export function AdvancedTestSettingsPage({
  test,
  totalQuestions,
  isSaving,
  onBack,
  onUpdate,
  onTogglePublish,
  onDuplicate,
  onDelete
}: AdvancedSettingsPageProps) {
  const [localTest, setLocalTest] = useState(test);
  const [localInstructions, setLocalInstructions] = useState<InstructionsConfig>(normalizeInstructions(test.instructions_json));
  const [scheduledAtLocal, setScheduledAtLocal] = useState(toLocalDateTimeValue(test.scheduled_at));

  useEffect(() => {
    setLocalTest(test);
    setLocalInstructions(normalizeInstructions(test.instructions_json));
    setScheduledAtLocal(toLocalDateTimeValue(test.scheduled_at));
  }, [test]);

  const hasChanges = useMemo(() => {
    const currentSettings = {
      ...localTest,
      scheduled_at: fromLocalDateTimeValue(scheduledAtLocal),
      instructions_json: localInstructions
    };
    const originalSettings = {
      ...test,
      scheduled_at: test.scheduled_at || null,
      instructions_json: normalizeInstructions(test.instructions_json)
    };
    return JSON.stringify(currentSettings) !== JSON.stringify(originalSettings);
  }, [localInstructions, localTest, scheduledAtLocal, test]);

  const handleSave = async () => {
    await onUpdate({
      name: localTest.name,
      description: localTest.description,
      duration_minutes: localTest.duration_minutes,
      fullscreen_enabled: localTest.fullscreen_enabled,
      show_solutions: localTest.show_solutions,
      solution_reopen_mode: localTest.solution_reopen_mode,
      scheduled_at: fromLocalDateTimeValue(scheduledAtLocal),
      instructions_json: localInstructions
    });
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to editor
          </Button>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Advanced Test Settings
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="w-4 h-4 mr-1" />
              Save settings
            </Button>
          )}
          <Button variant={test.is_published ? "destructive" : "default"} onClick={onTogglePublish}>
            {test.is_published ? (
              <>
                <EyeOff className="w-4 h-4 mr-1" />
                Unpublish
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 mr-1" />
                Publish
              </>
            )}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Basic Configuration</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Test name</Label>
            <Input value={localTest.name} onChange={(e) => setLocalTest({ ...localTest, name: e.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Description</Label>
            <Textarea
              value={localTest.description || ""}
              onChange={(e) => setLocalTest({ ...localTest, description: e.target.value })}
              className="min-h-[96px]"
            />
          </div>
          <div className="space-y-2">
            <Label>Duration (minutes)</Label>
            <Input
              type="number"
              min={1}
              max={600}
              value={localTest.duration_minutes}
              onChange={(e) => setLocalTest({ ...localTest, duration_minutes: parseInt(e.target.value) || 60 })}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4" />
              Scheduled start (optional)
            </Label>
            <Input type="datetime-local" value={scheduledAtLocal} onChange={(e) => setScheduledAtLocal(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Behavior & Access Controls</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>Require fullscreen mode</Label>
            <Switch
              checked={localTest.fullscreen_enabled}
              onCheckedChange={(checked) => setLocalTest({ ...localTest, fullscreen_enabled: checked })}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>Show solutions after completion</Label>
            <Switch
              checked={localTest.show_solutions}
              onCheckedChange={(checked) => setLocalTest({ ...localTest, show_solutions: checked })}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>Allow solution reopen mode</Label>
            <Switch
              checked={Boolean(localTest.solution_reopen_mode)}
              onCheckedChange={(checked) => setLocalTest({ ...localTest, solution_reopen_mode: checked })}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>Show unanswered warning before submit</Label>
            <Switch
              checked={localInstructions.showUnansweredWarning}
              onCheckedChange={(checked) => setLocalInstructions({ ...localInstructions, showUnansweredWarning: checked })}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>Auto submit on timeout</Label>
            <Switch
              checked={localInstructions.autoSubmitOnTimeout}
              onCheckedChange={(checked) => setLocalInstructions({ ...localInstructions, autoSubmitOnTimeout: checked })}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>Enable calculator access</Label>
            <Switch
              checked={localInstructions.enableCalculator}
              onCheckedChange={(checked) => setLocalInstructions({ ...localInstructions, enableCalculator: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Navigation, Attempts & Randomization</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>Allow section jumping</Label>
            <Switch
              checked={localInstructions.allowSectionJump}
              onCheckedChange={(checked) => setLocalInstructions({ ...localInstructions, allowSectionJump: checked })}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>Show question palette</Label>
            <Switch
              checked={localInstructions.showQuestionPalette}
              onCheckedChange={(checked) => setLocalInstructions({ ...localInstructions, showQuestionPalette: checked })}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>Shuffle question order</Label>
            <Switch
              checked={localInstructions.shuffleQuestions}
              onCheckedChange={(checked) => setLocalInstructions({ ...localInstructions, shuffleQuestions: checked })}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>Shuffle options</Label>
            <Switch
              checked={localInstructions.shuffleOptions}
              onCheckedChange={(checked) => setLocalInstructions({ ...localInstructions, shuffleOptions: checked })}
            />
          </div>
          <div className="space-y-2">
            <Label>Max attempts</Label>
            <Input
              type="number"
              min={1}
              max={25}
              value={localInstructions.maxAttempts}
              onChange={(e) =>
                setLocalInstructions({ ...localInstructions, maxAttempts: Math.max(1, parseInt(e.target.value) || 1) })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Grace period (minutes)</Label>
            <Input
              type="number"
              min={0}
              max={30}
              value={localInstructions.gracePeriodMinutes}
              onChange={(e) =>
                setLocalInstructions({
                  ...localInstructions,
                  gracePeriodMinutes: Math.max(0, parseInt(e.target.value) || 0)
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Low-time warning trigger (minutes)</Label>
            <Input
              type="number"
              min={0}
              max={60}
              value={localInstructions.lowTimeWarningMinutes}
              onChange={(e) =>
                setLocalInstructions({
                  ...localInstructions,
                  lowTimeWarningMinutes: Math.max(0, parseInt(e.target.value) || 0)
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Instruction Customization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Custom exam instructions</Label>
            <Textarea
              className="min-h-[100px]"
              value={localInstructions.customInstructions}
              onChange={(e) => setLocalInstructions({ ...localInstructions, customInstructions: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Pre-exam checklist</Label>
            <Textarea
              className="min-h-[84px]"
              value={localInstructions.examChecklist}
              onChange={(e) => setLocalInstructions({ ...localInstructions, examChecklist: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Submission notes</Label>
            <Textarea
              className="min-h-[84px]"
              value={localInstructions.submissionNotes}
              onChange={(e) => setLocalInstructions({ ...localInstructions, submissionNotes: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Insights & Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This test currently has {totalQuestions} questions and is set as{" "}
            <span className={test.is_published ? "text-green-600 font-medium" : "text-yellow-600 font-medium"}>
              {test.is_published ? "Published" : "Draft"}
            </span>
            .
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onDuplicate}>
              <Copy className="w-4 h-4 mr-1" />
              Duplicate test
            </Button>
            <Button variant="outline" className="text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="w-4 h-4 mr-1" />
              Delete test
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

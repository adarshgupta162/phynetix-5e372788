import { useState } from "react";
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
      show_solutions: localTest.show_solutions
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

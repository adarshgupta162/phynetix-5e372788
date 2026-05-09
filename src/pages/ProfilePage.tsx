import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import { 
  User, 
  Mail, 
  GraduationCap,
  Edit3,
  Trophy,
  Target,
  Clock,
  BookOpen,
  Save,
  X,
  Hash,
  Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Profile {
  full_name: string | null;
  avatar_url: string | null;
  target_exam: string | null;
  roll_number: string | null;
}

interface Stats {
  testsCompleted: number;
  questionsSolved: number;
  avgAccuracy: number;
  totalTime: number;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats>({ testsCompleted: 0, questionsSolved: 0, avgAccuracy: 0, totalTime: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: "", target_exam: "" });
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchStats();
    }
  }, [user]);

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, avatar_url, target_exam, roll_number")
      .eq("id", user!.id)
      .maybeSingle();

    if (!error && data) {
      setProfile(data);
      setEditForm({ full_name: data.full_name || "", target_exam: data.target_exam || "" });
    }
    setLoading(false);
  };

  const fetchStats = async () => {
    const { data: attempts } = await supabase
      .from("test_attempts")
      .select("score, total_marks, time_taken_seconds, test:tests(id)")
      .eq("user_id", user!.id)
      .not("completed_at", "is", null);

    if (attempts) {
      const testsCompleted = attempts.length;
      const totalTime = attempts.reduce((acc, a) => acc + (a.time_taken_seconds || 0), 0);
      const totalScore = attempts.reduce((acc, a) => acc + (a.score || 0), 0);
      const totalMarks = attempts.reduce((acc, a) => acc + (a.total_marks || 0), 0);
      const avgAccuracy = totalMarks > 0 ? Math.round((totalScore / totalMarks) * 100) : 0;

      // Estimate questions solved based on average 30 questions per test
      const questionsSolved = testsCompleted * 30;

      setStats({ testsCompleted, questionsSolved, avgAccuracy, totalTime: Math.round(totalTime / 60) });
    }
  };

  const handleSave = async () => {
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: editForm.full_name,
        target_exam: editForm.target_exam,
      })
      .eq("id", user!.id);

    if (error) {
      toast({ title: "Error", description: "Failed to update profile", variant: "destructive" });
    } else {
      setProfile({ ...profile, ...editForm } as Profile);
      setIsEditing(false);
      toast({ title: "Success", description: "Profile updated successfully" });
    }
  };

  const handlePhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setUploadingPhoto(true);
    try {
      const photoDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: photoDataUrl })
        .eq("id", user.id);

      if (error) throw error;

      setProfile((prev) => prev ? { ...prev, avatar_url: photoDataUrl } : prev);
      toast({ title: "Success", description: "Profile photo updated successfully" });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to upload profile photo", variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Student";
  const initials = displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  const statItems = [
    { label: "Tests Completed", value: stats.testsCompleted.toString() },
    { label: "Questions Solved", value: stats.questionsSolved.toLocaleString() },
    { label: "Avg Accuracy", value: `${stats.avgAccuracy}%` },
    { label: "Study Hours", value: Math.round(stats.totalTime / 60).toString() },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8">
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="glass-card p-6 lg:p-8 mb-8"
        >
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
            <div className="relative">
              <div className="w-24 h-24 lg:w-32 lg:h-32 rounded-2xl bg-gradient-primary flex items-center justify-center text-3xl lg:text-4xl font-bold overflow-hidden">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              <Button
                type="button"
                variant="glass"
                size="sm"
                className="mt-3"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
              >
                <Upload className="w-4 h-4" />
                {uploadingPhoto ? "Uploading..." : "Upload Photo"}
              </Button>
            </div>

            <div className="flex-1">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
                <div>
                  {isEditing ? (
                    <Input
                      value={editForm.full_name}
                      onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                      className="text-2xl font-bold mb-1"
                      placeholder="Your name"
                    />
                  ) : (
                    <h1 className="text-2xl lg:text-3xl font-bold font-display mb-1">{displayName}</h1>
                  )}
                  {isEditing ? (
                    <Input
                      value={editForm.target_exam}
                      onChange={(e) => setEditForm({ ...editForm, target_exam: e.target.value })}
                      className="text-sm"
                      placeholder="Target exam (e.g., JEE Advanced 2025)"
                    />
                  ) : (
                    <p className="text-muted-foreground">{profile?.target_exam || "No target exam set"}</p>
                  )}
                </div>
                {isEditing ? (
                  <div className="flex gap-2">
                    <Button variant="glass" onClick={() => setIsEditing(false)}>
                      <X className="w-4 h-4" />
                      Cancel
                    </Button>
                    <Button variant="gradient" onClick={handleSave}>
                      <Save className="w-4 h-4" />
                      Save
                    </Button>
                  </div>
                ) : (
                  <Button variant="glass" onClick={() => setIsEditing(true)}>
                    <Edit3 className="w-4 h-4" />
                    Edit Profile
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {statItems.map((stat, index) => (
                  <div key={index} className="text-center p-3 rounded-xl bg-secondary/50">
                    <div className="text-xl lg:text-2xl font-bold font-display gradient-text">
                      {stat.value}
                    </div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Personal Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="glass-card p-6"
          >
            <h2 className="text-lg font-semibold font-display mb-6">Personal Information</h2>
            
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-3 rounded-xl bg-secondary/30">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground">Full Name</div>
                  <div className="font-medium">{displayName}</div>
                </div>
              </div>

              <div className="flex items-center gap-4 p-3 rounded-xl bg-secondary/30">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground">Email</div>
                  <div className="font-medium">{user?.email}</div>
                </div>
              </div>

              <div className="flex items-center gap-4 p-3 rounded-xl bg-secondary/30">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground">Target Exam</div>
                  <div className="font-medium">{profile?.target_exam || "Not set"}</div>
                </div>
              </div>

              <div className="flex items-center gap-4 p-3 rounded-xl bg-secondary/30">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Hash className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground">Roll Number</div>
                  <div className="font-medium font-mono">{profile?.roll_number || "Generating..."}</div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Performance Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="glass-card p-6"
          >
            <h2 className="text-lg font-semibold font-display mb-6">Performance Summary</h2>
            
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 rounded-xl bg-secondary/30">
                <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold mb-1">Tests Completed</div>
                  <div className="text-sm text-muted-foreground">
                    You've completed {stats.testsCompleted} tests so far
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-xl bg-secondary/30">
                <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center">
                  <Target className="w-6 h-6 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold mb-1">Average Accuracy</div>
                  <div className="text-sm text-muted-foreground">
                    Your average accuracy is {stats.avgAccuracy}%
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-xl bg-secondary/30">
                <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center">
                  <Clock className="w-6 h-6 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold mb-1">Study Time</div>
                  <div className="text-sm text-muted-foreground">
                    You've spent {Math.round(stats.totalTime / 60)} hours practicing
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-xl bg-secondary/30">
                <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold mb-1">Questions Solved</div>
                  <div className="text-sm text-muted-foreground">
                    Approximately {stats.questionsSolved.toLocaleString()} questions attempted
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}

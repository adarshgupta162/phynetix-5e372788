import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import { 
  ArrowLeft,
  Users,
  Trophy,
  Clock,
  CheckCircle2,
  XCircle,
  Target,
  ChevronDown,
  ChevronUp,
  Eye,
  Download,
  Search,
  Trash2,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import AdminLayout from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface TestAttempt {
  id: string;
  user_id: string;
  score: number | null;
  total_marks: number | null;
  percentile: number | null;
  rank: number | null;
  time_taken_seconds: number | null;
  completed_at: string | null;
  answers: Record<string, string> | null;
  profile?: {
    full_name: string | null;
    roll_number: string | null;
  };
}

interface TestStats {
  totalAttempts: number;
  completedAttempts: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  averageTime: number;
  averageAccuracy: number;
}

interface QuestionStats {
  id: string;
  question_number: number;
  question_text: string;
  correct_count: number;
  incorrect_count: number;
  skipped_count: number;
  total_attempts: number;
  accuracy: number;
}

export default function NormalTestAnalytics() {
  const { testId } = useParams();
  const navigate = useNavigate();
  
  const [testName, setTestName] = useState("");
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [questionStats, setQuestionStats] = useState<QuestionStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "students" | "questions">("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"rank" | "score" | "time">("rank");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [selectedStudent, setSelectedStudent] = useState<TestAttempt | null>(null);
  const [clearingAttempt, setClearingAttempt] = useState<TestAttempt | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    if (testId) {
      fetchData();
    }
  }, [testId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch test details
      const { data: test, error: testError } = await supabase
        .from("tests")
        .select("name")
        .eq("id", testId)
        .single();
      
      if (testError) {
        console.error("Error fetching test:", testError);
      }
      
      if (test) setTestName(test.name);

      // Fetch all attempts - using separate queries to avoid join issues
      const { data: attemptsData, error: attemptsError } = await supabase
        .from("test_attempts")
        .select("id, user_id, score, total_marks, percentile, rank, time_taken_seconds, completed_at, answers")
        .eq("test_id", testId)
        .not("completed_at", "is", null)
        .order("rank", { ascending: true });

      if (attemptsError) {
        console.error("Error fetching attempts:", attemptsError);
        setLoading(false);
        return;
      }

      if (attemptsData && attemptsData.length > 0) {
        // Fetch profiles separately
        const userIds = [...new Set(attemptsData.map(a => a.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, roll_number")
          .in("id", userIds);

        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        
        const formattedAttempts = attemptsData.map((a: any) => ({
          ...a,
          profile: profilesMap.get(a.user_id) || { full_name: null, roll_number: null },
          answers: a.answers as Record<string, string>
        }));
        setAttempts(formattedAttempts);

        // Calculate question stats
        await calculateQuestionStats(formattedAttempts);
      } else {
        setAttempts([]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAttempt = async () => {
    if (!clearingAttempt) return;
    
    setIsClearing(true);
    try {
      const { error } = await supabase
        .from("test_attempts")
        .delete()
        .eq("id", clearingAttempt.id);

      if (error) throw error;

      toast({
        title: "Attempt Cleared",
        description: `Attempt for ${clearingAttempt.profile?.full_name || "Unknown"} has been cleared. They can now retake the test.`,
      });

      // Refresh data
      setClearingAttempt(null);
      fetchData();
    } catch (error: any) {
      console.error("Error clearing attempt:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to clear attempt",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  const calculateQuestionStats = async (attemptsData: TestAttempt[]) => {
    // Fetch questions
    const { data: questionsData } = await supabase
      .from("test_questions")
      .select("question_id, questions(id, question_text, correct_answer, question_number)")
      .eq("test_id", testId)
      .order("order_index");

    if (!questionsData) return;

    const stats: QuestionStats[] = questionsData.map((tq: any) => {
      const q = tq.questions;
      let correct = 0, incorrect = 0, skipped = 0;

      attemptsData.forEach((attempt) => {
        const userAnswer = attempt.answers?.[q.id];
        if (userAnswer === undefined) {
          skipped++;
        } else if (userAnswer === q.correct_answer) {
          correct++;
        } else {
          incorrect++;
        }
      });

      const total = correct + incorrect + skipped;

      return {
        id: q.id,
        question_number: q.question_number || 0,
        question_text: q.question_text || "",
        correct_count: correct,
        incorrect_count: incorrect,
        skipped_count: skipped,
        total_attempts: total,
        accuracy: total > 0 ? Math.round((correct / total) * 100) : 0
      };
    });

    setQuestionStats(stats);
  };

  const stats: TestStats = useMemo(() => {
    const completed = attempts.filter(a => a.completed_at);
    const scores = completed.map(a => a.score || 0);
    const times = completed.map(a => a.time_taken_seconds || 0);
    const totalMarks = completed[0]?.total_marks || 1;

    return {
      totalAttempts: attempts.length,
      completedAttempts: completed.length,
      averageScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      highestScore: Math.max(...scores, 0),
      lowestScore: scores.length > 0 ? Math.min(...scores) : 0,
      averageTime: times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length / 60) : 0,
      averageAccuracy: scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length / totalMarks) * 100) : 0
    };
  }, [attempts]);

  const filteredAttempts = useMemo(() => {
    let filtered = attempts.filter(a => 
      a.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.profile?.roll_number?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    filtered.sort((a, b) => {
      let valA: number, valB: number;
      switch (sortBy) {
        case "rank":
          valA = a.rank || 9999;
          valB = b.rank || 9999;
          break;
        case "score":
          valA = a.score || 0;
          valB = b.score || 0;
          break;
        case "time":
          valA = a.time_taken_seconds || 0;
          valB = b.time_taken_seconds || 0;
          break;
        default:
          return 0;
      }
      return sortOrder === "asc" ? valA - valB : valB - valA;
    });

    return filtered;
  }, [attempts, searchQuery, sortBy, sortOrder]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/tests")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-display">Test Analytics</h1>
            <p className="text-muted-foreground">{testName}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b border-border pb-4">
          {["overview", "students", "questions"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={cn(
                "px-4 py-2 rounded-lg font-medium capitalize transition-colors",
                activeTab === tab 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <span className="text-muted-foreground">Total Attempts</span>
              </div>
              <div className="text-3xl font-bold">{stats.completedAttempts}</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <Target className="w-5 h-5 text-success" />
                </div>
                <span className="text-muted-foreground">Average Score</span>
              </div>
              <div className="text-3xl font-bold">{stats.averageScore}<span className="text-lg text-muted-foreground">/{attempts[0]?.total_marks || 0}</span></div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-card p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-warning" />
                </div>
                <span className="text-muted-foreground">Highest Score</span>
              </div>
              <div className="text-3xl font-bold">{stats.highestScore}</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-card p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-accent" />
                </div>
                <span className="text-muted-foreground">Avg Time</span>
              </div>
              <div className="text-3xl font-bold">{stats.averageTime}<span className="text-lg text-muted-foreground"> min</span></div>
            </motion.div>
          </div>
        )}

        {activeTab === "students" && (
          <div>
            {/* Search & Sort */}
            <div className="flex items-center gap-4 mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or roll number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="h-10 px-3 rounded-lg border border-border bg-background"
              >
                <option value="rank">Sort by Rank</option>
                <option value="score">Sort by Score</option>
                <option value="time">Sort by Time</option>
              </select>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              >
                {sortOrder === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>

            {/* Students Table */}
            <div className="glass-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="px-4 py-3 text-left text-sm font-medium">Rank</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Student</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Roll Number</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Score</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Percentile</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Time</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttempts.map((attempt) => (
                    <tr key={attempt.id} className="border-b border-border hover:bg-secondary/30">
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold",
                          attempt.rank === 1 && "bg-yellow-500/20 text-yellow-500",
                          attempt.rank === 2 && "bg-gray-400/20 text-gray-400",
                          attempt.rank === 3 && "bg-orange-500/20 text-orange-500",
                          attempt.rank && attempt.rank > 3 && "bg-secondary"
                        )}>
                          {attempt.rank || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">{attempt.profile?.full_name || "Unknown"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{attempt.profile?.roll_number || "-"}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold">{attempt.score}</span>
                        <span className="text-muted-foreground">/{attempt.total_marks}</span>
                      </td>
                      <td className="px-4 py-3">{attempt.percentile?.toFixed(1) || 0}%</td>
                      <td className="px-4 py-3">{Math.round((attempt.time_taken_seconds || 0) / 60)} min</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedStudent(attempt)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setClearingAttempt(attempt)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "questions" && (
          <div className="space-y-4">
            {questionStats.map((q, index) => (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="glass-card p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold">
                      {q.question_number || index + 1}
                    </span>
                    <p className="text-sm text-muted-foreground line-clamp-1 max-w-xl">
                      {q.question_text || "Question text not available"}
                    </p>
                  </div>
                  <span className={cn(
                    "px-2 py-1 rounded text-xs font-medium",
                    q.accuracy >= 70 && "bg-success/10 text-success",
                    q.accuracy >= 40 && q.accuracy < 70 && "bg-warning/10 text-warning",
                    q.accuracy < 40 && "bg-destructive/10 text-destructive"
                  )}>
                    {q.accuracy}% accuracy
                  </span>
                </div>
                
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                    <span>{q.correct_count} correct</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-destructive" />
                    <span>{q.incorrect_count} incorrect</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-muted" />
                    <span>{q.skipped_count} skipped</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden flex">
                  <div 
                    className="bg-success h-full"
                    style={{ width: `${(q.correct_count / Math.max(q.total_attempts, 1)) * 100}%` }}
                  />
                  <div 
                    className="bg-destructive h-full"
                    style={{ width: `${(q.incorrect_count / Math.max(q.total_attempts, 1)) * 100}%` }}
                  />
                  <div 
                    className="bg-muted h-full"
                    style={{ width: `${(q.skipped_count / Math.max(q.total_attempts, 1)) * 100}%` }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Student Detail Modal */}
        {selectedStudent && (
          <div 
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedStudent(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            >
              <h2 className="text-xl font-bold mb-4">
                {selectedStudent.profile?.full_name || "Student Details"}
              </h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 rounded-lg bg-secondary">
                  <div className="text-sm text-muted-foreground">Rank</div>
                  <div className="text-2xl font-bold">#{selectedStudent.rank}</div>
                </div>
                <div className="p-4 rounded-lg bg-secondary">
                  <div className="text-sm text-muted-foreground">Score</div>
                  <div className="text-2xl font-bold">{selectedStudent.score}/{selectedStudent.total_marks}</div>
                </div>
                <div className="p-4 rounded-lg bg-secondary">
                  <div className="text-sm text-muted-foreground">Percentile</div>
                  <div className="text-2xl font-bold">{selectedStudent.percentile?.toFixed(1)}%</div>
                </div>
                <div className="p-4 rounded-lg bg-secondary">
                  <div className="text-sm text-muted-foreground">Time</div>
                  <div className="text-2xl font-bold">{Math.round((selectedStudent.time_taken_seconds || 0) / 60)} min</div>
                </div>
              </div>

              <Button variant="outline" className="w-full" onClick={() => setSelectedStudent(null)}>
                Close
              </Button>
            </motion.div>
          </div>
        )}

        {/* Clear Attempt Confirmation Dialog */}
        <AlertDialog open={!!clearingAttempt} onOpenChange={(open) => !open && setClearingAttempt(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Clear Test Attempt
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to clear the test attempt for <strong>{clearingAttempt?.profile?.full_name || "this student"}</strong>?
                <br /><br />
                This will permanently delete their submission and allow them to retake the test. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleClearAttempt}
                disabled={isClearing}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isClearing ? "Clearing..." : "Clear Attempt"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Plus, 
  FileText, 
  Clock, 
  Users,
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowUpDown,
  Edit,
  Trash2,
  Eye,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AdminLayout from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { withTimeout } from "@/lib/async";
import { isMissingSupabaseTableError } from "@/lib/supabase/errors";

interface PDFTest {
  id: string;
  name: string;
  exam_type: string;
  duration_minutes: number;
  is_published: boolean;
  created_at: string;
  pdf_url: string | null;
  _count?: { questions: number; attempts: number };
  proctoring_enabled?: boolean;
}

export default function PDFTestList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tests, setTests] = useState<PDFTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const fetchIdRef = useRef(0);

  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const testsPerPage = 15;

  const QUERY_TIMEOUT_MS = 15000;
  const COUNT_TIMEOUT_MS = 10000;

  useEffect(() => {
    fetchTests();
  }, [page, sortOrder]);

  const hydrateCounts = async (testIds: string[], fetchId: number) => {
    const results = await Promise.allSettled(
      testIds.map(async (testId) => {
        try {
          const [questionsRes, attemptsRes] = await Promise.all([
            withTimeout(
              supabase
                .from("test_section_questions")
                .select("id", { count: "exact", head: true })
                .eq("test_id", testId),
              COUNT_TIMEOUT_MS
            ),
            withTimeout(
              supabase
                .from("test_attempts")
                .select("id", { count: "exact", head: true })
                .eq("test_id", testId),
              COUNT_TIMEOUT_MS
            ),
          ]);

          if (questionsRes.error || attemptsRes.error) return null;

          return {
            testId,
            questions: questionsRes.count || 0,
            attempts: attemptsRes.count || 0,
          };
        } catch {
          return null;
        }
      })
    );

    if (fetchIdRef.current !== fetchId) return;

    const map = new Map<string, { questions: number; attempts: number }>();
    results.forEach((r) => {
      if (r.status === "fulfilled" && r.value) {
        map.set(r.value.testId, { questions: r.value.questions, attempts: r.value.attempts });
      }
    });

    if (map.size === 0) return;

    setTests((prev) =>
      prev.map((t) => {
        const counts = map.get(t.id);
        if (!counts) return t;
        return { ...t, _count: counts };
      })
    );
  };

  const fetchTests = async (showRetryToast = false) => {
    const fetchId = ++fetchIdRef.current;

    setLoading(true);
    setError(null);
    if (showRetryToast) setRetrying(true);

    try {
      // Total count
      const countRes = await withTimeout(
        supabase.from("tests").select("*", { count: "exact", head: true }).not("pdf_url", "is", null),
        QUERY_TIMEOUT_MS
      );
      if (countRes.error) throw countRes.error;
      if (fetchIdRef.current !== fetchId) return;
      setTotalCount(countRes.count || 0);

      // Page data
      const listRes = await withTimeout(
        supabase
          .from("tests")
          .select("*")
          .not("pdf_url", "is", null)
          .order("created_at", { ascending: sortOrder === "oldest" })
          .range((page - 1) * testsPerPage, page * testsPerPage - 1),
        QUERY_TIMEOUT_MS
      );

      if (listRes.error) throw listRes.error;

      const baseList = (listRes.data || []).map((t: any) => ({
        ...t,
        _count: { questions: 0, attempts: 0 },
      }));

      const { data: monitoringData, error: monitoringError } = await supabase
        .from('proctoring_test_settings')
        .select('test_id, enabled')
        .in('test_id', baseList.map((test: any) => test.id));
      if (monitoringError && !isMissingSupabaseTableError(monitoringError)) {
        console.error("Failed to load monitoring settings", monitoringError);
      }
      const monitoringMap = Object.fromEntries((monitoringData || []).map((item) => [item.test_id, !!item.enabled]));
      const hydratedList = baseList.map((test: any) => ({ ...test, proctoring_enabled: monitoringMap[test.id] || false }));

      if (fetchIdRef.current !== fetchId) return;
      setTests(hydratedList);

      // Non-blocking count hydration (so UI never spins forever)
      void hydrateCounts(
        baseList.map((t: any) => t.id),
        fetchId
      );

      if (showRetryToast) toast({ title: "Tests refreshed" });
    } catch (err: any) {
      const message = err?.message || "Failed to load tests";
      setError(message);
      toast({ title: "Error loading tests", description: message, variant: "destructive" });
    } finally {
      if (fetchIdRef.current === fetchId) {
        setLoading(false);
        setRetrying(false);
      }
    }
  };

  const togglePublish = async (testId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("tests")
        .update({ is_published: !currentStatus })
        .eq("id", testId);

      if (error) throw error;

      setTests(tests.map(t => t.id === testId ? { ...t, is_published: !currentStatus } : t));
      toast({ title: currentStatus ? "Test unpublished" : "Test published" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const deleteTest = async (testId: string) => {
    if (!confirm("Delete this test? This action cannot be undone.")) return;

    try {
      const { error } = await supabase.from("tests").delete().eq("id", testId);
      if (error) throw error;
      
      setTests(tests.filter(t => t.id !== testId));
      toast({ title: "Test deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const filteredTests = tests.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(totalCount / testsPerPage);

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold font-display mb-1">
              PDF <span className="gradient-text">Tests</span>
            </h1>
            <p className="text-muted-foreground">
              Manage PDF-based tests with answer keys
            </p>
          </div>
          <Link to="/admin/pdf-tests/create">
            <Button variant="gradient">
              <Plus className="w-5 h-5 mr-2" />
              Create PDF Test
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="glass-card p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search tests..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setSortOrder(sortOrder === "newest" ? "oldest" : "newest")}
            >
              <ArrowUpDown className="w-4 h-4 mr-2" />
              {sortOrder === "newest" ? "Newest First" : "Oldest First"}
            </Button>
          </div>
        </div>

        {/* Tests Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="glass-card p-12 text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <h2 className="text-xl font-semibold mb-2">Couldn't load PDF Tests</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button onClick={() => fetchTests(true)} disabled={retrying}>
              <RefreshCw className={`w-4 h-4 mr-2 ${retrying ? "animate-spin" : ""}`} />
              {retrying ? "Retrying..." : "Try Again"}
            </Button>
          </div>
        ) : filteredTests.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <h2 className="text-xl font-semibold mb-2">No PDF Tests Found</h2>
            <p className="text-muted-foreground mb-6">
              Create your first PDF test to get started
            </p>
            <Link to="/admin/pdf-tests/create">
              <Button variant="gradient">
                <Plus className="w-5 h-5 mr-2" />
                Create PDF Test
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredTests.map((test, index) => (
              <motion.div
                key={test.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="glass-card p-6"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{test.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {test.exam_type === "jee_advanced" ? "JEE Advanced" : "JEE Mains"} Pattern
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        test.is_published 
                          ? "bg-[hsl(142,76%,36%)]/20 text-[hsl(142,76%,36%)]" 
                          : "bg-[hsl(45,93%,47%)]/20 text-[hsl(45,93%,47%)]"
                      }`}>
                        {test.is_published ? "Active" : "Draft"}
                      </span>
                      {test.proctoring_enabled && (
                        <span className="px-2 py-1 text-xs rounded-full bg-red-500/10 text-red-600 flex items-center gap-1">
                          <Shield className="w-3 h-3" /> Monitored
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {test.duration_minutes} min
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        {test._count?.questions || 0} questions
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {test._count?.attempts || 0} attempts
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => togglePublish(test.id, test.is_published)}
                      title={test.is_published ? "Unpublish" : "Publish"}
                    >
                      {test.is_published ? (
                        <ToggleRight className="w-5 h-5 text-[hsl(142,76%,36%)]" />
                      ) : (
                        <ToggleLeft className="w-5 h-5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/admin/pdf-tests/${test.id}/edit`)}
                    >
                      <Edit className="w-5 h-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/admin/pdf-tests/${test.id}/attempts`)}
                      title="View Attempts"
                    >
                      <Eye className="w-5 h-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteTest(test.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <Button
              variant="outline"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

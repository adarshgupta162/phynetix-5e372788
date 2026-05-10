import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  ClipboardList,
  Eye,
  EyeOff,
  Clock,
  FileQuestion,
  ChevronLeft,
  ChevronRight,
  BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AdminLayout from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Test {
  id: string;
  name: string;
  description: string | null;
  test_type: string;
  duration_minutes: number;
  is_published: boolean | null;
  created_at: string;
  exam_type: string;
}

const TESTS_PER_PAGE = 15;

export default function AdminTests() {
  const [tests, setTests] = useState<Test[]>([]);
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // Only fetch Normal Tests (not PDF tests)
    const { data: testsData, error: testsError } = await supabase
      .from('tests')
      .select('*')
      .neq('test_type', 'pdf')
      .order('created_at', { ascending: false });

    if (!testsError && testsData) {
      setTests(testsData);
      
      // Get question counts for each test from test_section_questions
      const counts: Record<string, number> = {};
      for (const test of testsData) {
        const { count } = await supabase
          .from('test_section_questions')
          .select('*', { count: 'exact', head: true })
          .eq('test_id', test.id);
        counts[test.id] = count || 0;
      }
      setQuestionCounts(counts);
    }
    
    setIsLoading(false);
  };

  const handleTogglePublish = async (test: Test) => {
    const { error } = await supabase
      .from('tests')
      .update({ is_published: !test.is_published })
      .eq('id', test.id);
    
    if (error) {
      toast({ title: "Error updating test", variant: "destructive" });
    } else {
      toast({ title: test.is_published ? "Test unpublished" : "Test published" });
      fetchData();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this test?")) return;
    
    // Delete related data first
    await supabase.from('test_section_questions').delete().eq('test_id', id);
    
    // Get subjects and sections
    const { data: subjects } = await supabase
      .from('test_subjects')
      .select('id')
      .eq('test_id', id);
    
    if (subjects) {
      for (const subject of subjects) {
        await supabase.from('test_sections').delete().eq('subject_id', subject.id);
      }
    }
    await supabase.from('test_subjects').delete().eq('test_id', id);
    
    const { error } = await supabase.from('tests').delete().eq('id', id);
    if (error) {
      toast({ title: "Error deleting test", variant: "destructive" });
    } else {
      toast({ title: "Test deleted successfully" });
      fetchData();
    }
  };

  // Filter and sort tests
  const filteredTests = tests
    .filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

  // Pagination
  const totalPages = Math.ceil(filteredTests.length / TESTS_PER_PAGE);
  const paginatedTests = filteredTests.slice(
    (currentPage - 1) * TESTS_PER_PAGE,
    currentPage * TESTS_PER_PAGE
  );

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold font-display mb-1">
              Normal <span className="gradient-text">Tests</span>
            </h1>
            <p className="text-muted-foreground">
              Create and manage question-based tests
            </p>
          </div>
          <Button variant="gradient" onClick={() => window.location.href = '/admin/test-creator'}>
            <Plus className="w-5 h-5 mr-1" />
            Create Test
          </Button>
        </div>

        {/* Search & Sort */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search tests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12"
            />
          </div>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
            className="h-11 px-4 rounded-lg border border-border bg-secondary/50 text-foreground"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>

        {/* Tests Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : paginatedTests.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <ClipboardList className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No tests yet</h3>
            <p className="text-muted-foreground mb-4">Create your first test</p>
            <Button variant="gradient" onClick={() => window.location.href = '/admin/test-creator'}>
              <Plus className="w-5 h-5 mr-1" />
              Create Test
            </Button>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedTests.map((test, index) => (
                <motion.div
                  key={test.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className="glass-card p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium uppercase">
                        {test.test_type}
                      </span>
                      <span className="px-2 py-1 rounded-md bg-accent/10 text-accent text-xs font-medium">
                        {test.exam_type === 'jee_advanced' ? 'JEE Adv' : 'JEE Mains'}
                      </span>
                      {test.is_published ? (
                        <span className="px-2 py-1 rounded-md bg-[hsl(142,76%,36%)]/10 text-[hsl(142,76%,36%)] text-xs font-medium">
                          Published
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-md bg-secondary text-muted-foreground text-xs">
                          Draft
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold font-display mb-2">{test.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {test.description || "No description"}
                  </p>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {test.duration_minutes} min
                    </span>
                    <span className="flex items-center gap-1">
                      <FileQuestion className="w-4 h-4" />
                      {questionCounts[test.id] || 0} questions
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-4 border-t border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTogglePublish(test)}
                    >
                      {test.is_published ? (
                        <><EyeOff className="w-4 h-4 mr-1" /> Unpublish</>
                      ) : (
                        <><Eye className="w-4 h-4 mr-1" /> Publish</>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.location.href = `/admin/test-analytics/${test.id}`}
                    >
                      <BarChart3 className="w-4 h-4 mr-1" />
                      Analytics
                    </Button>
                    <button
                      onClick={() => window.location.href = `/admin/fullscreen-editor/${test.id}`}
                      className="p-2 rounded-lg hover:bg-secondary transition-colors"
                      title="Edit test"
                    >
                      <Edit2 className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => handleDelete(test.id)}
                      className="p-2 rounded-lg hover:bg-destructive/10 transition-colors"
                      title="Delete test"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-8">
                <Button
                  variant="ghost"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-5 h-5" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="ghost"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}

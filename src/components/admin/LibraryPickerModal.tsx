import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Search, BookOpen, ChevronRight, FolderOpen, ArrowLeft,
  Plus, Loader2, AlertCircle, Check, CheckSquare, Square
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LatexRenderer } from "@/components/ui/latex-renderer";
import { cn } from "@/lib/utils";
import { getSubjects, getChaptersForSubject } from "@/lib/jeeData";
import { Checkbox } from "@/components/ui/checkbox";

interface LibraryQuestion {
  id: string;
  library_id: string;
  subject: string;
  chapter: string | null;
  topic: string | null;
  question_text: string | null;
  question_image_url: string | null;
  options: any;
  correct_answer: any;
  question_type: string;
  marks: number;
  negative_marks: number;
  difficulty: string;
  time_seconds: number;
  solution_text: string | null;
  solution_image_url: string | null;
  tags?: string[] | null;
}

interface LibraryPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (question: LibraryQuestion) => void;
  multiSelect?: boolean;
  onMultiSelect?: (questions: LibraryQuestion[]) => void;
}

const SUBJECTS = getSubjects();

type ViewMode = 'subjects' | 'chapters' | 'questions';

export function LibraryPickerModal({ open, onClose, onSelect, multiSelect = false, onMultiSelect }: LibraryPickerModalProps) {
  const { toast } = useToast();
  
  const [questions, setQuestions] = useState<LibraryQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  
  // Hierarchical navigation
  const [viewMode, setViewMode] = useState<ViewMode>('subjects');
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  
  // Single select
  const [selectedQuestion, setSelectedQuestion] = useState<LibraryQuestion | null>(null);
  // Multi select
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('phynetix_library')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuestions(data || []);
    } catch (error: any) {
      toast({ title: "Error loading questions", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open) {
      fetchQuestions();
      // Reset state when opening
      setViewMode('subjects');
      setSelectedSubject(null);
      setSelectedChapter(null);
      setSelectedQuestion(null);
      setSelectedQuestions(new Set());
      setSearchQuery('');
    }
  }, [open, fetchQuestions]);

  const getSubjectStats = () => {
    const stats: Record<string, number> = {};
    SUBJECTS.forEach(s => {
      stats[s] = questions.filter(q => q.subject === s).length;
    });
    return stats;
  };

  const getChapterStats = (subject: string) => {
    const subjectQuestions = questions.filter(q => q.subject === subject);
    const stats: Record<string, number> = {};
    const chapters = getChaptersForSubject(subject);
    
    chapters.forEach(c => {
      stats[c] = subjectQuestions.filter(q => q.chapter === c).length;
    });
    
    const unmappedCount = subjectQuestions.filter(q => !q.chapter || !chapters.includes(q.chapter)).length;
    if (unmappedCount > 0) {
      stats['__unmapped__'] = unmappedCount;
    }
    
    return stats;
  };

  const getFilteredQuestions = () => {
    let filtered = questions;
    
    if (selectedSubject) {
      filtered = filtered.filter(q => q.subject === selectedSubject);
    }
    
    if (selectedChapter) {
      if (selectedChapter === '__unmapped__') {
        const chapters = getChaptersForSubject(selectedSubject || '');
        filtered = filtered.filter(q => !q.chapter || !chapters.includes(q.chapter));
      } else {
        filtered = filtered.filter(q => q.chapter === selectedChapter);
      }
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(q =>
        q.library_id.toLowerCase().includes(query) ||
        q.question_text?.toLowerCase().includes(query) ||
        q.topic?.toLowerCase().includes(query) ||
        (q.tags || []).some(t => t.toLowerCase().includes(query))
      );
    }

    if (tagFilter.trim()) {
      const tags = tagFilter.toLowerCase().split(',').map(t => t.trim()).filter(Boolean);
      filtered = filtered.filter(q =>
        tags.every(t => (q.tags || []).some(qt => qt.toLowerCase().includes(t)))
      );
    }
    
    return filtered;
  };

  const handleSubjectClick = (subject: string) => {
    setSelectedSubject(subject);
    setSelectedChapter(null);
    setViewMode('chapters');
  };

  const handleChapterClick = (chapter: string) => {
    setSelectedChapter(chapter);
    setViewMode('questions');
  };

  const handleBack = () => {
    if (viewMode === 'questions') {
      setSelectedChapter(null);
      setViewMode('chapters');
    } else if (viewMode === 'chapters') {
      setSelectedSubject(null);
      setViewMode('subjects');
    }
  };

  const toggleQuestionSelection = (question: LibraryQuestion) => {
    if (multiSelect) {
      setSelectedQuestions(prev => {
        const next = new Set(prev);
        if (next.has(question.id)) {
          next.delete(question.id);
        } else {
          next.add(question.id);
        }
        return next;
      });
    } else {
      setSelectedQuestion(question);
    }
  };

  const toggleSelectAll = () => {
    const filtered = getFilteredQuestions();
    const allSelected = filtered.every(q => selectedQuestions.has(q.id));
    if (allSelected) {
      setSelectedQuestions(prev => {
        const next = new Set(prev);
        filtered.forEach(q => next.delete(q.id));
        return next;
      });
    } else {
      setSelectedQuestions(prev => {
        const next = new Set(prev);
        filtered.forEach(q => next.add(q.id));
        return next;
      });
    }
  };

  const handleConfirmSelect = () => {
    if (multiSelect) {
      const selected = questions.filter(q => selectedQuestions.has(q.id));
      if (selected.length > 0 && onMultiSelect) {
        onMultiSelect(selected);
        onClose();
      }
    } else if (selectedQuestion) {
      onSelect(selectedQuestion);
      onClose();
    }
  };

  const subjectStats = getSubjectStats();
  const chapterStats = selectedSubject ? getChapterStats(selectedSubject) : {};
  const filteredQuestions = getFilteredQuestions();
  const allFilteredSelected = filteredQuestions.length > 0 && filteredQuestions.every(q => selectedQuestions.has(q.id));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <span>Import from PhyNetix Library</span>
            {selectedSubject && (
              <>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                <span className="text-primary">{selectedSubject}</span>
              </>
            )}
            {selectedChapter && (
              <>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                <span className="text-primary">
                  {selectedChapter === '__unmapped__' ? 'Unmapped' : selectedChapter}
                </span>
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Navigation bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              {viewMode !== 'subjects' && (
                <Button variant="ghost" size="sm" onClick={handleBack}>
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              )}
              {multiSelect && viewMode === 'questions' && (
                <Button variant="ghost" size="sm" onClick={toggleSelectAll} className="gap-1">
                  {allFilteredSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  {allFilteredSelected ? 'Deselect All' : 'Select All'}
                </Button>
              )}
            </div>
            
            {viewMode === 'questions' && (
              <div className="flex items-center gap-2">
                <div className="relative w-56">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search questions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-8"
                  />
                </div>
                <Input
                  placeholder="Tags (comma)"
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  className="h-8 w-40"
                />
              </div>
            )}
          </div>

          {/* Content */}
          <ScrollArea className="flex-1 p-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* Subjects View */}
                {viewMode === 'subjects' && (
                  <div className="grid gap-4 md:grid-cols-3">
                    {SUBJECTS.map((subject) => (
                      <motion.div
                        key={subject}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => handleSubjectClick(subject)}
                        className="bg-card border border-border rounded-xl p-5 hover:border-primary/50 cursor-pointer transition-all group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center",
                              subject === 'Physics' && "bg-blue-500/20",
                              subject === 'Chemistry' && "bg-green-500/20",
                              subject === 'Mathematics' && "bg-orange-500/20"
                            )}>
                              <BookOpen className={cn(
                                "w-5 h-5",
                                subject === 'Physics' && "text-blue-500",
                                subject === 'Chemistry' && "text-green-500",
                                subject === 'Mathematics' && "text-orange-500"
                              )} />
                            </div>
                            <div>
                              <h3 className="font-semibold">{subject}</h3>
                              <p className="text-sm text-muted-foreground">
                                {subjectStats[subject]} questions
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Chapters View */}
                {viewMode === 'chapters' && selectedSubject && (
                  <div className="grid gap-3 md:grid-cols-2">
                    {chapterStats['__unmapped__'] > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => handleChapterClick('__unmapped__')}
                        className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 hover:border-yellow-500/50 cursor-pointer transition-all col-span-full"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-yellow-500" />
                            <span className="font-medium">Unmapped Questions</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{chapterStats['__unmapped__']}</Badge>
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {Object.entries(chapterStats)
                      .filter(([chapter]) => chapter !== '__unmapped__')
                      .map(([chapter, count]) => (
                        <motion.div
                          key={chapter}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          onClick={() => handleChapterClick(chapter)}
                          className="bg-card border border-border rounded-lg p-3 hover:border-primary/50 cursor-pointer transition-all group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <FolderOpen className="w-4 h-4 text-primary shrink-0" />
                              <span className="font-medium truncate">{chapter}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{count}</Badge>
                              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                            </div>
                          </div>
                        </motion.div>
                      ))}
                  </div>
                )}

                {/* Questions View */}
                {viewMode === 'questions' && (
                  <>
                    {filteredQuestions.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No questions found</p>
                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        {filteredQuestions.map((q) => {
                          const isSelected = multiSelect ? selectedQuestions.has(q.id) : selectedQuestion?.id === q.id;
                          return (
                            <motion.div
                              key={q.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              onClick={() => toggleQuestionSelection(q)}
                              className={cn(
                                "bg-card border rounded-lg p-3 cursor-pointer transition-all",
                                isSelected
                                  ? "border-primary ring-2 ring-primary/20"
                                  : "border-border hover:border-primary/50"
                              )}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  {multiSelect && (
                                    <Checkbox checked={isSelected} className="pointer-events-none" />
                                  )}
                                  <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-mono">
                                    {q.library_id}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {q.question_type.replace('_', ' ')}
                                  </Badge>
                                </div>
                                {isSelected && !multiSelect && (
                                  <Check className="w-5 h-5 text-primary" />
                                )}
                              </div>

                              <div className="mb-2">
                                {q.question_image_url && (
                                  <img
                                    src={q.question_image_url}
                                    alt="Question"
                                    className="w-full h-16 object-cover rounded mb-1 bg-muted"
                                    onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                                  />
                                )}
                                <p className="text-sm line-clamp-2">
                                  {q.question_text ? (
                                    <LatexRenderer content={q.question_text} />
                                  ) : (
                                    <span className="text-muted-foreground italic">Image only</span>
                                  )}
                                </p>
                              </div>

                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className={cn(
                                  "px-1.5 py-0.5 rounded capitalize",
                                  q.difficulty === 'easy' && "bg-green-500/20 text-green-600",
                                  q.difficulty === 'medium' && "bg-yellow-500/20 text-yellow-600",
                                  q.difficulty === 'hard' && "bg-red-500/20 text-red-600"
                                )}>
                                  {q.difficulty}
                                </span>
                                <span>+{q.marks}/-{q.negative_marks}</span>
                                {(q.tags && q.tags.length > 0) && (
                                  <span className="flex gap-1 flex-wrap ml-1">
                                    {q.tags.slice(0, 3).map(t => (
                                      <span key={t} className="px-1.5 py-0.5 rounded bg-primary/15 text-primary text-[10px]">#{t}</span>
                                    ))}
                                    {q.tags.length > 3 && <span className="text-[10px]">+{q.tags.length - 3}</span>}
                                  </span>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </ScrollArea>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t shrink-0 bg-muted/30">
          <p className="text-sm text-muted-foreground">
            {multiSelect ? (
              <>{selectedQuestions.size} question{selectedQuestions.size !== 1 ? 's' : ''} selected</>
            ) : selectedQuestion ? (
              <>Selected: <span className="font-mono text-primary">{selectedQuestion.library_id}</span></>
            ) : (
              'Select a question to import'
            )}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={handleConfirmSelect}
              disabled={multiSelect ? selectedQuestions.size === 0 : !selectedQuestion}
            >
              <Plus className="w-4 h-4 mr-1" />
              Import {multiSelect && selectedQuestions.size > 0 ? `${selectedQuestions.size} Questions` : 'Question'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

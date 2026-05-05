import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Search, BookOpen, Plus, Loader2, Check, CheckSquare, Square, X, Filter
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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

interface MultiPickerProps {
  label: string;
  options: string[];
  selected: Set<string>;
  onToggle: (v: string) => void;
  onClear: () => void;
}

function MultiPicker({ label, options, selected, onToggle, onClear }: MultiPickerProps) {
  const [search, setSearch] = useState("");
  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1">
          <Filter className="w-3.5 h-3.5" />
          {label}
          {selected.size > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">{selected.size}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="flex items-center gap-1 mb-2">
          <Input
            placeholder={`Search ${label.toLowerCase()}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
          {selected.size > 0 && (
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onClear}>
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-64">
          <div className="space-y-1">
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">No options</p>
            )}
            {filtered.map((opt) => (
              <label
                key={opt}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm"
              >
                <Checkbox checked={selected.has(opt)} onCheckedChange={() => onToggle(opt)} />
                <span className="truncate flex-1">{opt}</span>
              </label>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export function LibraryPickerModal({ open, onClose, onSelect, multiSelect = false, onMultiSelect }: LibraryPickerModalProps) {
  const { toast } = useToast();

  const [questions, setQuestions] = useState<LibraryQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');

  const [subjects, setSubjects] = useState<Set<string>>(new Set());
  const [chapters, setChapters] = useState<Set<string>>(new Set());
  const [topics, setTopics] = useState<Set<string>>(new Set());
  const [difficulty, setDifficulty] = useState<Set<string>>(new Set());

  const [selectedQuestion, setSelectedQuestion] = useState<LibraryQuestion | null>(null);
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
      setSelectedQuestion(null);
      setSelectedQuestions(new Set());
      setSearchQuery('');
      setTagFilter('');
      setSubjects(new Set());
      setChapters(new Set());
      setTopics(new Set());
      setDifficulty(new Set());
    }
  }, [open, fetchQuestions]);

  // Build chapter/topic options driven by current subject filter
  const chapterOptions = useMemo(() => {
    const set = new Set<string>();
    const subjList = subjects.size > 0 ? Array.from(subjects) : SUBJECTS;
    subjList.forEach(s => getChaptersForSubject(s).forEach(c => set.add(c)));
    questions.forEach(q => {
      if (q.chapter && (subjects.size === 0 || subjects.has(q.subject))) set.add(q.chapter);
    });
    return Array.from(set).sort();
  }, [subjects, questions]);

  const topicOptions = useMemo(() => {
    const set = new Set<string>();
    questions.forEach(q => {
      if (!q.topic) return;
      if (subjects.size > 0 && !subjects.has(q.subject)) return;
      if (chapters.size > 0 && (!q.chapter || !chapters.has(q.chapter))) return;
      set.add(q.topic);
    });
    return Array.from(set).sort();
  }, [questions, subjects, chapters]);

  const filteredQuestions = useMemo(() => {
    let filtered = questions;

    if (subjects.size > 0) filtered = filtered.filter(q => subjects.has(q.subject));
    if (chapters.size > 0) filtered = filtered.filter(q => q.chapter && chapters.has(q.chapter));
    if (topics.size > 0) filtered = filtered.filter(q => q.topic && topics.has(q.topic));
    if (difficulty.size > 0) filtered = filtered.filter(q => difficulty.has(q.difficulty));

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(q =>
        q.library_id.toLowerCase().includes(query) ||
        q.question_text?.toLowerCase().includes(query) ||
        q.topic?.toLowerCase().includes(query) ||
        q.chapter?.toLowerCase().includes(query) ||
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
  }, [questions, subjects, chapters, topics, difficulty, searchQuery, tagFilter]);

  const toggleSet = (set: Set<string>, val: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    next.has(val) ? next.delete(val) : next.add(val);
    setter(next);
  };

  const toggleQuestionSelection = (question: LibraryQuestion) => {
    if (multiSelect) {
      setSelectedQuestions(prev => {
        const next = new Set(prev);
        next.has(question.id) ? next.delete(question.id) : next.add(question.id);
        return next;
      });
    } else {
      setSelectedQuestion(question);
    }
  };

  const toggleSelectAll = () => {
    const allSelected = filteredQuestions.length > 0 && filteredQuestions.every(q => selectedQuestions.has(q.id));
    setSelectedQuestions(prev => {
      const next = new Set(prev);
      if (allSelected) filteredQuestions.forEach(q => next.delete(q.id));
      else filteredQuestions.forEach(q => next.add(q.id));
      return next;
    });
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

  const clearAllFilters = () => {
    setSubjects(new Set());
    setChapters(new Set());
    setTopics(new Set());
    setDifficulty(new Set());
    setSearchQuery('');
    setTagFilter('');
  };

  const activeFilterCount = subjects.size + chapters.size + topics.size + difficulty.size + (searchQuery ? 1 : 0) + (tagFilter ? 1 : 0);
  const allFilteredSelected = filteredQuestions.length > 0 && filteredQuestions.every(q => selectedQuestions.has(q.id));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-7xl w-[96vw] h-[92vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <span>Import from PhyNetix Library</span>
            <Badge variant="outline" className="ml-2">
              {filteredQuestions.length} of {questions.length}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Filter bar */}
          <div className="px-4 py-3 border-b bg-muted/30 space-y-2 shrink-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search question text, ID, chapter, topic, tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-9"
                />
              </div>
              <Input
                placeholder="Tags (comma-separated)"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="h-9 w-56"
              />
              <MultiPicker
                label="Subject"
                options={SUBJECTS}
                selected={subjects}
                onToggle={(v) => { toggleSet(subjects, v, setSubjects); }}
                onClear={() => setSubjects(new Set())}
              />
              <MultiPicker
                label="Chapter"
                options={chapterOptions}
                selected={chapters}
                onToggle={(v) => toggleSet(chapters, v, setChapters)}
                onClear={() => setChapters(new Set())}
              />
              <MultiPicker
                label="Topic"
                options={topicOptions}
                selected={topics}
                onToggle={(v) => toggleSet(topics, v, setTopics)}
                onClear={() => setTopics(new Set())}
              />
              <MultiPicker
                label="Difficulty"
                options={['easy', 'medium', 'hard']}
                selected={difficulty}
                onToggle={(v) => toggleSet(difficulty, v, setDifficulty)}
                onClear={() => setDifficulty(new Set())}
              />
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-9 gap-1">
                  <X className="w-3.5 h-3.5" /> Clear ({activeFilterCount})
                </Button>
              )}
              {multiSelect && (
                <Button variant="outline" size="sm" onClick={toggleSelectAll} className="h-9 gap-1 ml-auto">
                  {allFilteredSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  {allFilteredSelected ? 'Deselect All' : 'Select All'}
                </Button>
              )}
            </div>

            {/* Active filter chips */}
            {(subjects.size + chapters.size + topics.size + difficulty.size) > 0 && (
              <div className="flex flex-wrap gap-1">
                {[...subjects].map(s => (
                  <Badge key={`s-${s}`} variant="secondary" className="gap-1">
                    {s}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => toggleSet(subjects, s, setSubjects)} />
                  </Badge>
                ))}
                {[...chapters].map(c => (
                  <Badge key={`c-${c}`} variant="secondary" className="gap-1">
                    {c}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => toggleSet(chapters, c, setChapters)} />
                  </Badge>
                ))}
                {[...topics].map(t => (
                  <Badge key={`t-${t}`} variant="secondary" className="gap-1">
                    {t}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => toggleSet(topics, t, setTopics)} />
                  </Badge>
                ))}
                {[...difficulty].map(d => (
                  <Badge key={`d-${d}`} variant="secondary" className="gap-1 capitalize">
                    {d}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => toggleSet(difficulty, d, setDifficulty)} />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Questions Grid */}
          <ScrollArea className="flex-1 p-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No questions match your filters</p>
                {activeFilterCount > 0 && (
                  <Button variant="link" onClick={clearAllFilters}>Clear filters</Button>
                )}
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {filteredQuestions.map((q) => {
                  const isSelected = multiSelect ? selectedQuestions.has(q.id) : selectedQuestion?.id === q.id;
                  return (
                    <motion.div
                      key={q.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => toggleQuestionSelection(q)}
                      className={cn(
                        "bg-card border rounded-lg p-3 cursor-pointer transition-all",
                        isSelected
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className="flex items-start justify-between mb-2 gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {multiSelect && (
                            <Checkbox checked={isSelected} className="pointer-events-none" />
                          )}
                          <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-xs font-mono">
                            {q.library_id}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {q.question_type.replace('_', ' ')}
                          </Badge>
                        </div>
                        {isSelected && !multiSelect && (
                          <Check className="w-5 h-5 text-primary shrink-0" />
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
                        <p className="text-sm line-clamp-3">
                          {q.question_text ? (
                            <LatexRenderer content={q.question_text} />
                          ) : (
                            <span className="text-muted-foreground italic">Image only</span>
                          )}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                        <span className="px-1.5 py-0.5 rounded bg-muted">{q.subject}</span>
                        {q.chapter && <span className="px-1.5 py-0.5 rounded bg-muted truncate max-w-[120px]">{q.chapter}</span>}
                        {q.topic && <span className="px-1.5 py-0.5 rounded bg-muted/60 truncate max-w-[100px]">{q.topic}</span>}
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
                          <span className="flex gap-1 flex-wrap w-full mt-1">
                            {q.tags.slice(0, 4).map(t => (
                              <span key={t} className="px-1.5 py-0.5 rounded bg-primary/15 text-primary text-[10px]">#{t}</span>
                            ))}
                            {q.tags.length > 4 && <span className="text-[10px]">+{q.tags.length - 4}</span>}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
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

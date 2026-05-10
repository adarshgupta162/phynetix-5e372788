import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Eye, EyeOff, Plus, Check, AlertCircle,
  Loader2, Save, RefreshCw, Settings, BookOpen, Import,
  X, ChevronLeft, ChevronRight, Maximize2, Search, Link2, Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { QuestionPalette } from "@/components/admin/NormalTestEditor/QuestionPalette";
import { SectionTabs } from "@/components/admin/NormalTestEditor/SectionTabs";
import { TestSettingsPanel } from "@/components/admin/NormalTestEditor/TestSettingsPanel";
import { LatexRenderer } from "@/components/ui/latex-renderer";
import { QuestionImageUpload } from "@/components/admin/QuestionImageUpload";
import { ImageUrlInput } from "@/components/admin/ImageUrlInput";
import { LibraryPickerModal } from "@/components/admin/LibraryPickerModal";
import { cn } from "@/lib/utils";

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

interface Subject {
  id: string;
  test_id: string;
  name: string;
  order_index: number;
}

interface Section {
  id: string;
  subject_id: string;
  name: string | null;
  section_type: string;
  order_index: number;
}

interface Question {
  id: string;
  section_id: string;
  test_id: string;
  question_number: number;
  question_text: string | null;
  correct_answer: any;
  options: any;
  marks: number;
  negative_marks: number;
  pdf_page: number | null;
  order_index: number;
  is_bonus?: boolean;
  image_url?: string | null;
  solution_text?: string | null;
  solution_image_url?: string | null;
  difficulty?: string;
  time_seconds?: number;
  chapter?: string;
  topic?: string;
  library_question_id?: string;
}

const DIFFICULTIES = ['easy', 'medium', 'hard'];

const DEFAULT_OPTIONS = [
  { label: 'A', text: '', image_url: null },
  { label: 'B', text: '', image_url: null },
  { label: 'C', text: '', image_url: null },
  { label: 'D', text: '', image_url: null }
];

const MARKING_SCHEMES = {
  jee_mains: {
    single_choice: { marks: 4, negative: 1 },
    multiple_choice: { marks: 4, negative: 1 },
    integer: { marks: 4, negative: 1 }
  },
  jee_advanced: {
    single_choice: { marks: 3, negative: 1 },
    multiple_choice: { marks: 4, negative: 2 },
    integer: { marks: 3, negative: 1 }
  }
};

export default function FullscreenTestEditor() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [test, setTest] = useState<Test | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  // Editor state
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [localQuestion, setLocalQuestion] = useState<Question | null>(null);

  // Import dialogs
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [importId, setImportId] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  
  // Migrate to library
  const [showMigrateDialog, setShowMigrateDialog] = useState(false);
  const [migrateLoading, setMigrateLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!testId) return;

    const [testRes, subjectsRes, sectionsRes, questionsRes] = await Promise.all([
      supabase.from('tests').select('*').eq('id', testId).single(),
      supabase.from('test_subjects').select('*').eq('test_id', testId).order('order_index'),
      supabase.from('test_sections').select('*').order('order_index'),
      supabase.from('test_section_questions').select('*').eq('test_id', testId).order('question_number')
    ]);

    if (testRes.error) {
      toast({ title: "Test not found", variant: "destructive" });
      navigate('/admin/tests');
      return;
    }

    setTest(testRes.data as Test);
    setSubjects(subjectsRes.data || []);

    const subjectIds = (subjectsRes.data || []).map(s => s.id);
    const filteredSections = (sectionsRes.data || []).filter(s => subjectIds.includes(s.subject_id));
    setSections(filteredSections);
    setQuestions(questionsRes.data || []);

    if (subjectsRes.data?.length) {
      setActiveSubjectId(subjectsRes.data[0].id);
      const firstSection = filteredSections.find(s => s.subject_id === subjectsRes.data[0].id);
      if (firstSection) {
        setActiveSectionId(firstSection.id);
        const firstQuestion = (questionsRes.data || []).find(q => q.section_id === firstSection.id);
        if (firstQuestion) {
          setActiveQuestionId(firstQuestion.id);
          setLocalQuestion({ ...firstQuestion, options: firstQuestion.options || DEFAULT_OPTIONS });
        }
      }
    }

    setIsLoading(false);
  }, [testId, navigate, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update local question when active changes
  useEffect(() => {
    const q = questions.find(q => q.id === activeQuestionId);
    if (q) {
      setLocalQuestion({ ...q, options: q.options || DEFAULT_OPTIONS });
    }
  }, [activeQuestionId, questions]);

  // Save question
  const handleSaveQuestion = async () => {
    if (!localQuestion) return;
    
    setIsSaving(true);
    setSaveStatus('saving');

    const { error } = await supabase
      .from('test_section_questions')
      .update({
        question_text: localQuestion.question_text,
        correct_answer: localQuestion.correct_answer,
        options: localQuestion.options,
        marks: localQuestion.marks,
        negative_marks: localQuestion.negative_marks,
        is_bonus: localQuestion.is_bonus,
        image_url: localQuestion.image_url,
        solution_text: localQuestion.solution_text,
        solution_image_url: localQuestion.solution_image_url,
        difficulty: localQuestion.difficulty,
        time_seconds: localQuestion.time_seconds,
        chapter: localQuestion.chapter,
        topic: localQuestion.topic
      })
      .eq('id', localQuestion.id);

    if (error) {
      toast({ title: "Failed to save", variant: "destructive" });
    } else {
      setQuestions(questions.map(q => q.id === localQuestion.id ? localQuestion : q));
      setSaveStatus('saved');
      toast({ title: "Saved!" });
    }

    setIsSaving(false);
  };

  // Subject handlers
  const handleAddSubject = async (name: string) => {
    if (!testId) return;
    const { data, error } = await supabase
      .from('test_subjects')
      .insert([{ test_id: testId, name, order_index: subjects.length }])
      .select()
      .single();

    if (!error && data) {
      setSubjects([...subjects, data]);
      setActiveSubjectId(data.id);
      toast({ title: `Added ${name}` });
    }
  };

  const handleRenameSubject = async (subjectId: string, name: string) => {
    await supabase.from('test_subjects').update({ name }).eq('id', subjectId);
    setSubjects(subjects.map(s => s.id === subjectId ? { ...s, name } : s));
  };

  const handleDeleteSubject = async (subjectId: string) => {
    const subjectSections = sections.filter(s => s.subject_id === subjectId);
    for (const section of subjectSections) {
      await supabase.from('test_section_questions').delete().eq('section_id', section.id);
      await supabase.from('test_sections').delete().eq('id', section.id);
    }
    await supabase.from('test_subjects').delete().eq('id', subjectId);

    setSubjects(subjects.filter(s => s.id !== subjectId));
    setSections(sections.filter(s => s.subject_id !== subjectId));
    setQuestions(questions.filter(q => !subjectSections.find(sec => sec.id === q.section_id)));

    if (activeSubjectId === subjectId) {
      const remaining = subjects.filter(s => s.id !== subjectId);
      setActiveSubjectId(remaining[0]?.id || null);
    }
    toast({ title: "Subject deleted" });
  };

  // Section handlers
  const handleAddSection = async (name: string, type: string) => {
    if (!activeSubjectId || !testId) return;

    const { data, error } = await supabase
      .from('test_sections')
      .insert([{
        subject_id: activeSubjectId,
        name: name || null,
        section_type: type,
        order_index: sections.filter(s => s.subject_id === activeSubjectId).length
      }])
      .select()
      .single();

    if (!error && data) {
      setSections([...sections, data]);
      setActiveSectionId(data.id);
      toast({ title: "Section added" });
    }
  };

  const handleRenameSection = async (sectionId: string, name: string) => {
    await supabase.from('test_sections').update({ name }).eq('id', sectionId);
    setSections(sections.map(s => s.id === sectionId ? { ...s, name } : s));
  };

  const handleDeleteSection = async (sectionId: string) => {
    await supabase.from('test_section_questions').delete().eq('section_id', sectionId);
    await supabase.from('test_sections').delete().eq('id', sectionId);

    setSections(sections.filter(s => s.id !== sectionId));
    setQuestions(questions.filter(q => q.section_id !== sectionId));

    if (activeSectionId === sectionId) {
      const remaining = sections.filter(s => s.id !== sectionId && s.subject_id === activeSubjectId);
      setActiveSectionId(remaining[0]?.id || null);
    }
    toast({ title: "Section deleted" });
  };

  // Question handlers
  const handleAddQuestion = async () => {
    if (!activeSectionId || !testId) return;

    const section = sections.find(s => s.id === activeSectionId);
    if (!section) return;

    const examType = test?.exam_type || 'jee_mains';
    const scheme = MARKING_SCHEMES[examType as keyof typeof MARKING_SCHEMES]?.[section.section_type as keyof typeof MARKING_SCHEMES['jee_mains']];

    const defaultAnswer = section.section_type === 'multiple_choice' ? [] : '';

    const { data, error } = await supabase
      .from('test_section_questions')
      .insert([{
        test_id: testId,
        section_id: activeSectionId,
        question_number: questions.length + 1,
        correct_answer: defaultAnswer,
        marks: scheme?.marks || 4,
        negative_marks: scheme?.negative || 0,
        order_index: questions.length,
        options: DEFAULT_OPTIONS
      }])
      .select()
      .single();

    if (!error && data) {
      setQuestions([...questions, data]);
      setActiveQuestionId(data.id);
      setLocalQuestion({ ...data, options: data.options || DEFAULT_OPTIONS });
      toast({ title: `Question ${data.question_number} added` });
    }
  };

  const handleDeleteQuestion = async () => {
    if (!localQuestion) return;
    
    await supabase.from('test_section_questions').delete().eq('id', localQuestion.id);

    const remaining = questions.filter(q => q.id !== localQuestion.id);
    remaining.forEach((q, i) => q.question_number = i + 1);
    setQuestions(remaining);

    if (remaining.length > 0) {
      const next = remaining.find(q => q.section_id === activeSectionId) || remaining[0];
      setActiveQuestionId(next.id);
      setLocalQuestion({ ...next, options: next.options || DEFAULT_OPTIONS });
    } else {
      setActiveQuestionId(null);
      setLocalQuestion(null);
    }
    toast({ title: "Question deleted" });
  };

  // Import from library
  const handleImportFromLibrary = async () => {
    if (!importId.trim() || !activeSectionId || !testId) return;

    setImportLoading(true);
    try {
      const { data: libQuestion, error } = await supabase
        .from('phynetix_library')
        .select('*')
        .eq('library_id', importId.trim().toUpperCase())
        .single();

      if (error || !libQuestion) {
        toast({ title: "Question not found", description: "Check the library ID and try again", variant: "destructive" });
        return;
      }

      const section = sections.find(s => s.id === activeSectionId);

      const { data: newQ, error: insertError } = await supabase
        .from('test_section_questions')
        .insert([{
          test_id: testId,
          section_id: activeSectionId,
          question_number: questions.length + 1,
          question_text: libQuestion.question_text,
          correct_answer: libQuestion.correct_answer,
          options: libQuestion.options,
          marks: libQuestion.marks,
          negative_marks: libQuestion.negative_marks,
          image_url: libQuestion.question_image_url,
          solution_text: libQuestion.solution_text,
          solution_image_url: libQuestion.solution_image_url,
          difficulty: libQuestion.difficulty,
          time_seconds: libQuestion.time_seconds,
          chapter: libQuestion.chapter,
          topic: libQuestion.topic,
          library_question_id: libQuestion.id,
          order_index: questions.length
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      // Update usage count
      await supabase
        .from('phynetix_library')
        .update({ usage_count: (libQuestion.usage_count || 0) + 1 })
        .eq('id', libQuestion.id);

      setQuestions([...questions, newQ]);
      setActiveQuestionId(newQ.id);
      setLocalQuestion({ ...newQ, options: newQ.options || DEFAULT_OPTIONS });
      setShowImportDialog(false);
      setImportId('');
      toast({ title: "Question imported from library!" });
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setImportLoading(false);
    }
  };

  // Migrate question to library
  const handleMigrateToLibrary = async () => {
    if (!localQuestion || !user) return;

    setMigrateLoading(true);
    try {
      const section = sections.find(s => s.id === localQuestion.section_id);
      const subject = subjects.find(sub => section && sections.find(sec => sec.subject_id === sub.id && sec.id === section.id));
      
      const payload = {
        subject: subject?.name || 'Physics',
        chapter: localQuestion.chapter || null,
        topic: localQuestion.topic || null,
        question_text: localQuestion.question_text || null,
        question_image_url: localQuestion.image_url || null,
        options: localQuestion.options,
        correct_answer: localQuestion.correct_answer,
        question_type: section?.section_type || 'single_choice',
        marks: localQuestion.marks,
        negative_marks: localQuestion.negative_marks,
        difficulty: localQuestion.difficulty || 'medium',
        time_seconds: localQuestion.time_seconds || 60,
        solution_text: localQuestion.solution_text || null,
        solution_image_url: localQuestion.solution_image_url || null,
        created_by: user.id
      };

      const { data, error } = await supabase
        .from('phynetix_library')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      // Update the question with library reference
      await supabase
        .from('test_section_questions')
        .update({ library_question_id: data.id })
        .eq('id', localQuestion.id);

      setLocalQuestion({ ...localQuestion, library_question_id: data.id });
      setShowMigrateDialog(false);
      toast({ 
        title: "Migrated to library!",
        description: `Library ID: ${data.library_id}`
      });
    } catch (err: any) {
      toast({ title: "Migration failed", description: err.message, variant: "destructive" });
    } finally {
      setMigrateLoading(false);
    }
  };

  // Import from library picker
  const handleImportFromPicker = async (libQuestion: any) => {
    if (!activeSectionId || !testId) return;

    try {
      const { data: newQ, error: insertError } = await supabase
        .from('test_section_questions')
        .insert([{
          test_id: testId,
          section_id: activeSectionId,
          question_number: questions.length + 1,
          question_text: libQuestion.question_text,
          correct_answer: libQuestion.correct_answer,
          options: libQuestion.options,
          marks: libQuestion.marks,
          negative_marks: libQuestion.negative_marks,
          image_url: libQuestion.question_image_url,
          solution_text: libQuestion.solution_text,
          solution_image_url: libQuestion.solution_image_url,
          difficulty: libQuestion.difficulty,
          time_seconds: libQuestion.time_seconds,
          chapter: libQuestion.chapter,
          topic: libQuestion.topic,
          library_question_id: libQuestion.id,
          order_index: questions.length
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      await supabase
        .from('phynetix_library')
        .update({ usage_count: (libQuestion.usage_count || 0) + 1 })
        .eq('id', libQuestion.id);

      setQuestions([...questions, newQ]);
      setActiveQuestionId(newQ.id);
      setLocalQuestion({ ...newQ, options: newQ.options || DEFAULT_OPTIONS });
      toast({ title: "Question imported from library!" });
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    }
  };

  // Import multiple questions from library picker
  const handleMultiImportFromPicker = async (libQuestions: any[]) => {
    if (!activeSectionId || !testId) return;

    try {
      const rows = libQuestions.map((lq, i) => ({
        test_id: testId,
        section_id: activeSectionId,
        question_number: questions.length + 1 + i,
        question_text: lq.question_text,
        correct_answer: lq.correct_answer,
        options: lq.options,
        marks: lq.marks,
        negative_marks: lq.negative_marks,
        image_url: lq.question_image_url,
        solution_text: lq.solution_text,
        solution_image_url: lq.solution_image_url,
        difficulty: lq.difficulty,
        time_seconds: lq.time_seconds,
        chapter: lq.chapter,
        topic: lq.topic,
        library_question_id: lq.id,
        order_index: questions.length + i
      }));

      const { data: newQs, error } = await supabase
        .from('test_section_questions')
        .insert(rows)
        .select();

      if (error) throw error;

      // Update usage counts
      for (const lq of libQuestions) {
        await supabase
          .from('phynetix_library')
          .update({ usage_count: (lq.usage_count || 0) + 1 })
          .eq('id', lq.id);
      }

      if (newQs && newQs.length > 0) {
        setQuestions([...questions, ...newQs]);
        setActiveQuestionId(newQs[newQs.length - 1].id);
        setLocalQuestion({ ...newQs[newQs.length - 1], options: newQs[newQs.length - 1].options || DEFAULT_OPTIONS });
      }
      toast({ title: `${libQuestions.length} questions imported from library!` });
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    }
  };

  // Paste URL from clipboard
  const handlePasteUrl = async (type: 'question' | 'solution' | 'option', optionIndex?: number) => {
    if (!localQuestion) return;
    try {
      const text = await navigator.clipboard.readText();
      if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
        if (type === 'question') {
          setLocalQuestion({ ...localQuestion, image_url: text });
        } else if (type === 'solution') {
          setLocalQuestion({ ...localQuestion, solution_image_url: text });
        } else if (type === 'option' && optionIndex !== undefined) {
          handleOptionChange(optionIndex, 'image_url', text);
        }
        toast({ title: "URL pasted!" });
      } else {
        toast({ title: "No valid URL in clipboard", variant: "destructive" });
      }
    } catch {
      toast({ title: "Could not access clipboard", variant: "destructive" });
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveQuestion();
      }
      // Ctrl+N to add question
      if ((e.ctrlKey || e.metaKey) && e.key === 'n' && activeSectionId) {
        e.preventDefault();
        handleAddQuestion();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [localQuestion, activeSectionId]);

  // Test handlers
  const handleUpdateTest = async (updates: Partial<Test>) => {
    if (!test) return;
    setIsSaving(true);
    await supabase.from('tests').update(updates).eq('id', test.id);
    setTest({ ...test, ...updates });
    setIsSaving(false);
    toast({ title: "Test updated" });
  };

  const handleTogglePublish = async () => {
    if (!test) return;
    await supabase.from('tests').update({ is_published: !test.is_published }).eq('id', test.id);
    setTest({ ...test, is_published: !test.is_published });
    toast({ title: test.is_published ? "Unpublished" : "Published!" });
  };

  const handleDuplicateTest = async () => {
    toast({ title: "Duplicating test..." });
    navigate('/admin/tests');
  };

  const handleDeleteTest = async () => {
    if (!testId) return;
    await supabase.from('test_section_questions').delete().eq('test_id', testId);
    for (const section of sections) {
      await supabase.from('test_sections').delete().eq('id', section.id);
    }
    await supabase.from('test_subjects').delete().eq('test_id', testId);
    await supabase.from('tests').delete().eq('id', testId);
    toast({ title: "Test deleted" });
    navigate('/admin/tests');
  };

  // Option handlers
  const handleOptionChange = (index: number, field: 'text' | 'image_url', value: string | null) => {
    if (!localQuestion) return;
    const options = [...(localQuestion.options || DEFAULT_OPTIONS)];
    options[index] = { ...options[index], [field]: value };
    setLocalQuestion({ ...localQuestion, options });
  };

  const handleAnswerSelect = (answer: string) => {
    if (!localQuestion) return;
    const activeSection = sections.find(s => s.id === activeSectionId);
    
    if (activeSection?.section_type === 'multiple_choice') {
      const current = Array.isArray(localQuestion.correct_answer) ? localQuestion.correct_answer : [];
      const idx = current.indexOf(answer);
      if (idx > -1) {
        setLocalQuestion({ ...localQuestion, correct_answer: current.filter(a => a !== answer) });
      } else {
        setLocalQuestion({ ...localQuestion, correct_answer: [...current, answer] });
      }
    } else {
      setLocalQuestion({ ...localQuestion, correct_answer: answer });
    }
  };

  const isAnswerSelected = (answer: string) => {
    if (!localQuestion) return false;
    const activeSection = sections.find(s => s.id === activeSectionId);
    if (activeSection?.section_type === 'multiple_choice') {
      return Array.isArray(localQuestion.correct_answer) && localQuestion.correct_answer.includes(answer);
    }
    return localQuestion.correct_answer === answer;
  };

  // Navigation
  const currentSectionQuestions = questions
    .filter(q => q.section_id === activeSectionId)
    .sort((a, b) => a.question_number - b.question_number);

  const activeSection = sections.find(s => s.id === activeSectionId);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Compact Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/tests')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-sm font-semibold">{test?.name}</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-[10px] h-5">
                {test?.exam_type === 'jee_advanced' ? 'JEE Advanced' : 'JEE Mains'}
              </Badge>
              <span>{questions.length} Qs</span>
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1 text-yellow-600">
                  <Loader2 className="w-3 h-3 animate-spin" />
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1 text-green-600">
                  <Check className="w-3 h-3" />
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:block">
            Ctrl+S: Save | Ctrl+N: Add
          </span>
          <Button variant="outline" size="sm" onClick={() => setShowLibraryPicker(true)}>
            <BookOpen className="w-4 h-4 mr-1" />
            Browse Library
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
            <Import className="w-4 h-4 mr-1" />
            Import by ID
          </Button>
          {test && (
            <TestSettingsPanel
              test={test}
              onUpdate={handleUpdateTest}
              onDuplicate={handleDuplicateTest}
              onDelete={handleDeleteTest}
              onTogglePublish={handleTogglePublish}
              totalQuestions={questions.length}
              isSaving={isSaving}
            />
          )}
          <Button
            variant={test?.is_published ? "destructive" : "default"}
            size="sm"
            onClick={handleTogglePublish}
          >
            {test?.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Section Tabs */}
      <SectionTabs
        subjects={subjects}
        sections={sections}
        activeSubjectId={activeSubjectId}
        activeSectionId={activeSectionId}
        onSubjectSelect={(id) => {
          setActiveSubjectId(id);
          const firstSection = sections.find(s => s.subject_id === id);
          setActiveSectionId(firstSection?.id || null);
          const firstQ = questions.find(q => q.section_id === firstSection?.id);
          setActiveQuestionId(firstQ?.id || null);
        }}
        onSectionSelect={(id) => {
          setActiveSectionId(id);
          const firstQ = questions.find(q => q.section_id === id);
          setActiveQuestionId(firstQ?.id || null);
        }}
        onAddSubject={handleAddSubject}
        onAddSection={handleAddSection}
        onRenameSubject={handleRenameSubject}
        onRenameSection={handleRenameSection}
        onDeleteSubject={handleDeleteSubject}
        onDeleteSection={handleDeleteSection}
      />

      {/* Main Content - Full Width */}
      <div className="flex-1 flex overflow-hidden">
        {/* Question Palette - Compact */}
        <div className="w-52 border-r border-border bg-card/30 flex flex-col">
          <ScrollArea className="flex-1 p-2">
            <QuestionPalette
              questions={currentSectionQuestions}
              activeQuestionId={activeQuestionId}
              onSelectQuestion={(id) => setActiveQuestionId(id)}
              sectionType={activeSection?.section_type}
            />
          </ScrollArea>
          <div className="p-2 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddQuestion}
              className="w-full"
              disabled={!activeSectionId}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Question
            </Button>
          </div>
        </div>

        {/* Editor + Preview */}
        {localQuestion ? (
          <div className="flex-1 flex">
            {/* Editor Panel */}
            <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50">
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold text-primary">Q{localQuestion.question_number}</span>
                  <Badge variant="outline">{activeSection?.section_type?.replace('_', ' ')}</Badge>
                  {localQuestion.is_bonus && <Badge className="bg-yellow-500">Bonus</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleSaveQuestion} disabled={isSaving}>
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span className="ml-1">Save</span>
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={handleDeleteQuestion}>
                    Delete
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4 max-w-2xl">
                  {/* Metadata */}
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs">Chapter</Label>
                      <Input
                        value={localQuestion.chapter || ''}
                        onChange={(e) => setLocalQuestion({ ...localQuestion, chapter: e.target.value })}
                        placeholder="Chapter"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Topic</Label>
                      <Input
                        value={localQuestion.topic || ''}
                        onChange={(e) => setLocalQuestion({ ...localQuestion, topic: e.target.value })}
                        placeholder="Topic"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Difficulty</Label>
                      <Select
                        value={localQuestion.difficulty || 'medium'}
                        onValueChange={(v) => setLocalQuestion({ ...localQuestion, difficulty: v })}
                      >
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DIFFICULTIES.map(d => (
                            <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Time (sec)</Label>
                      <Input
                        type="number"
                        value={localQuestion.time_seconds || 60}
                        onChange={(e) => setLocalQuestion({ ...localQuestion, time_seconds: Number(e.target.value) })}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>

                  {/* Marks */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Marks</Label>
                      <Input
                        type="number"
                        value={localQuestion.marks}
                        onChange={(e) => setLocalQuestion({ ...localQuestion, marks: Number(e.target.value) })}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Negative</Label>
                      <Input
                        type="number"
                        value={localQuestion.negative_marks}
                        onChange={(e) => setLocalQuestion({ ...localQuestion, negative_marks: Number(e.target.value) })}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Bonus</Label>
                      <Button
                        type="button"
                        variant={localQuestion.is_bonus ? "default" : "outline"}
                        size="sm"
                        onClick={() => setLocalQuestion({ ...localQuestion, is_bonus: !localQuestion.is_bonus })}
                        className="w-full h-8"
                      >
                        {localQuestion.is_bonus ? "Yes" : "No"}
                      </Button>
                    </div>
                  </div>

                  {/* Question Text */}
                  <div>
                    <Label className="text-xs">Question (LaTeX: $...$)</Label>
                    <Textarea
                      value={localQuestion.question_text || ''}
                      onChange={(e) => setLocalQuestion({ ...localQuestion, question_text: e.target.value })}
                      placeholder="Enter question..."
                      className="min-h-[80px] font-mono text-sm"
                    />
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <QuestionImageUpload
                        value={localQuestion.image_url}
                        onChange={(url) => setLocalQuestion({ ...localQuestion, image_url: url })}
                        compact
                      />
                      <span className="text-xs text-muted-foreground">or</span>
                      <ImageUrlInput
                        value={localQuestion.image_url}
                        onChange={(url) => setLocalQuestion({ ...localQuestion, image_url: url })}
                        compact
                        label="Question Image"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handlePasteUrl('question')}
                        className="h-7 text-xs"
                      >
                        <Link2 className="w-3 h-3 mr-1" />
                        Paste URL
                      </Button>
                    </div>
                  </div>

                  {/* Options */}
                  {activeSection?.section_type !== 'integer' && (
                    <div className="space-y-2">
                      <Label className="text-xs">Options ({activeSection?.section_type === 'multiple_choice' ? 'Multi' : 'Single'})</Label>
                      {(localQuestion.options || DEFAULT_OPTIONS).map((opt: any, i: number) => (
                        <div
                          key={i}
                          className={cn(
                            "flex items-start gap-2 p-2 rounded border transition-colors",
                            isAnswerSelected(opt.label) ? "bg-green-500/10 border-green-500" : "border-border"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => handleAnswerSelect(opt.label)}
                            className={cn(
                              "w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0",
                              isAnswerSelected(opt.label) ? "bg-green-500 text-white" : "bg-muted"
                            )}
                          >
                            {opt.label}
                          </button>
                          <div className="flex-1 space-y-1">
                            <Input
                              value={opt.text || ''}
                              onChange={(e) => handleOptionChange(i, 'text', e.target.value)}
                              placeholder={`Option ${opt.label}...`}
                              className="h-8 text-sm"
                            />
                              <div className="flex items-center gap-2 flex-wrap">
                                <QuestionImageUpload
                                  value={opt.image_url}
                                  onChange={(url) => handleOptionChange(i, 'image_url', url)}
                                  compact
                                />
                                <ImageUrlInput
                                  value={opt.image_url}
                                  onChange={(url) => handleOptionChange(i, 'image_url', url)}
                                  compact
                                  label={`Option ${opt.label} Image`}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handlePasteUrl('option', i)}
                                  className="h-7 text-xs"
                                >
                                  <Link2 className="w-3 h-3 mr-1" />
                                  Paste
                                </Button>
                              </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Integer Answer */}
                  {activeSection?.section_type === 'integer' && (
                    <div>
                      <Label className="text-xs">Correct Answer (Integer)</Label>
                      <Input
                        type="text"
                        value={String(localQuestion.correct_answer || '')}
                        onChange={(e) => setLocalQuestion({ ...localQuestion, correct_answer: e.target.value })}
                        placeholder="Numerical answer"
                        className="font-mono"
                      />
                    </div>
                  )}

                  {/* Solution */}
                  <div className="pt-4 border-t">
                    <Label className="text-xs">Solution</Label>
                    <Textarea
                      value={localQuestion.solution_text || ''}
                      onChange={(e) => setLocalQuestion({ ...localQuestion, solution_text: e.target.value })}
                      placeholder="Solution explanation..."
                      className="min-h-[80px] font-mono text-sm"
                    />
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <QuestionImageUpload
                        value={localQuestion.solution_image_url}
                        onChange={(url) => setLocalQuestion({ ...localQuestion, solution_image_url: url })}
                        compact
                      />
                      <span className="text-xs text-muted-foreground">or</span>
                      <ImageUrlInput
                        value={localQuestion.solution_image_url}
                        onChange={(url) => setLocalQuestion({ ...localQuestion, solution_image_url: url })}
                        compact
                        label="Solution Image"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handlePasteUrl('solution')}
                        className="h-7 text-xs"
                      >
                        <Link2 className="w-3 h-3 mr-1" />
                        Paste URL
                      </Button>
                    </div>
                    
                    {/* Migrate to Library Button */}
                    {!localQuestion.library_question_id && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowMigrateDialog(true)}
                        className="mt-3 w-full"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Add to PhyNetix Library
                      </Button>
                    )}
                    {localQuestion.library_question_id && (
                      <div className="mt-3 p-2 bg-primary/10 rounded-lg text-center text-xs text-primary">
                        ✓ Already in library
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </div>

            {/* Preview Panel */}
            <div className="w-[400px] flex flex-col bg-slate-900 text-white">
              <div className="px-4 py-2 border-b border-white/10 bg-slate-800">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Live Preview</span>
              </div>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {/* Question */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-blue-600 rounded text-xs font-medium">
                      Q.{localQuestion.question_number}
                    </span>
                    {localQuestion.difficulty && (
                      <Badge className={cn(
                        "text-xs",
                        localQuestion.difficulty === 'easy' && "bg-green-500",
                        localQuestion.difficulty === 'medium' && "bg-yellow-500",
                        localQuestion.difficulty === 'hard' && "bg-red-500"
                      )}>
                        {localQuestion.difficulty}
                      </Badge>
                    )}
                  </div>

                  {localQuestion.image_url && (
                    <img src={localQuestion.image_url} alt="Question" className="max-w-full rounded-lg border border-white/20" />
                  )}

                  {localQuestion.question_text && (
                    <div className="text-sm leading-relaxed">
                      <LatexRenderer content={localQuestion.question_text} />
                    </div>
                  )}

                  {/* Options */}
                  {activeSection?.section_type !== 'integer' && (
                    <div className="space-y-2 mt-4">
                      {(localQuestion.options || []).map((opt: any, i: number) => (
                        <div
                          key={i}
                          className={cn(
                            "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                            isAnswerSelected(opt.label) ? "border-green-500 bg-green-500/10" : "border-white/20"
                          )}
                        >
                          <span className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs",
                            isAnswerSelected(opt.label) ? "bg-green-500 text-white" : "bg-white/10"
                          )}>
                            {opt.label}
                          </span>
                          <div className="flex-1">
                            {opt.image_url && (
                              <img src={opt.image_url} alt="" className="max-h-20 rounded mb-1" />
                            )}
                            {opt.text && (
                              <span className="text-sm">
                                <LatexRenderer content={opt.text} />
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeSection?.section_type === 'integer' && localQuestion.correct_answer && (
                    <div className="p-3 bg-green-500/20 border border-green-500 rounded-lg mt-4">
                      <p className="text-xs text-green-300">Correct Answer</p>
                      <p className="text-2xl font-bold text-green-400">{String(localQuestion.correct_answer)}</p>
                    </div>
                  )}

                  {/* Solution Preview */}
                  {(localQuestion.solution_text || localQuestion.solution_image_url) && (
                    <div className="pt-4 mt-4 border-t border-white/10">
                      <p className="text-xs text-slate-400 mb-2 uppercase">Solution</p>
                      {localQuestion.solution_image_url && (
                        <img src={localQuestion.solution_image_url} alt="Solution" className="max-w-full rounded-lg mb-2" />
                      )}
                      {localQuestion.solution_text && (
                        <div className="text-sm text-slate-300">
                          <LatexRenderer content={localQuestion.solution_text} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No question selected</p>
              <Button variant="link" onClick={handleAddQuestion}>Add a question</Button>
            </div>
          </div>
        )}
      </div>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Import from PhyNetix Library
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Library ID (10-digit)</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={importId}
                  onChange={(e) => setImportId(e.target.value.toUpperCase())}
                  placeholder="e.g., AB12345678"
                  className="font-mono"
                />
                <Button onClick={handleImportFromLibrary} disabled={importLoading || !importId.trim()}>
                  {importLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Import"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Enter the 10-digit Library ID to import a question
              </p>
            </div>
            <div className="flex justify-between items-center pt-2 border-t">
              <Button variant="link" size="sm" onClick={() => {
                setShowImportDialog(false);
                setShowLibraryPicker(true);
              }}>
                Browse Library Instead
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowImportDialog(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Library Picker Modal */}
      <LibraryPickerModal
        open={showLibraryPicker}
        onClose={() => setShowLibraryPicker(false)}
        onSelect={handleImportFromPicker}
        multiSelect={true}
        onMultiSelect={handleMultiImportFromPicker}
      />

      {/* Migrate to Library Dialog */}
      <Dialog open={showMigrateDialog} onOpenChange={setShowMigrateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Add to PhyNetix Library
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will copy the current question to the PhyNetix Library for reuse in other tests.
              The question will be linked to the library entry.
            </p>
            {localQuestion && (
              <div className="p-3 bg-secondary/50 rounded-lg text-sm">
                <p className="font-medium mb-1">Question {localQuestion.question_number}</p>
                <p className="line-clamp-2 text-muted-foreground">
                  {localQuestion.question_text || '(Image-based question)'}
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowMigrateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleMigrateToLibrary} disabled={migrateLoading}>
                {migrateLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Add to Library
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

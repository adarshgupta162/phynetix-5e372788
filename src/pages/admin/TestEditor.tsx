import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Eye, EyeOff, Plus, Check, AlertCircle, Trash2, RotateCcw,
  Loader2, Save, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import AdminLayout from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { QuestionPalette } from "@/components/admin/NormalTestEditor/QuestionPalette";
import { QuestionEditorPanel } from "@/components/admin/NormalTestEditor/QuestionEditorPanel";
import { SectionTabs } from "@/components/admin/NormalTestEditor/SectionTabs";
import { TestSettingsPanel } from "@/components/admin/NormalTestEditor/TestSettingsPanel";

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
}

interface DeletedQuestion extends Question {
  deleted_at: number;
}

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

export default function TestEditor() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [test, setTest] = useState<Test | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  // Editor state
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [deletedQuestions, setDeletedQuestions] = useState<DeletedQuestion[]>([]);
  const [showQuestionBin, setShowQuestionBin] = useState(false);

  // Auto-save timer
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getSectionQuestions = useCallback((sectionId: string, sourceQuestions: Question[] = questions) => {
    return sourceQuestions
      .filter((q) => q.section_id === sectionId)
      .sort((a, b) => a.question_number - b.question_number);
  }, [questions]);

  const getNextQuestionNumber = useCallback((sectionId: string, sourceQuestions: Question[] = questions) => {
    const sectionQuestions = getSectionQuestions(sectionId, sourceQuestions);
    if (!sectionQuestions.length) return 1;
    return Math.max(...sectionQuestions.map((q) => q.question_number || 0)) + 1;
  }, [getSectionQuestions, questions]);

  const renumberSectionQuestions = useCallback(async (sectionId: string, sourceQuestions: Question[]) => {
    const sectionQuestions = getSectionQuestions(sectionId, sourceQuestions);
    const updates = sectionQuestions
      .map((q, index) => ({
        id: q.id,
        question_number: index + 1,
        order_index: index
      }))
      .filter((u) => {
        const q = sectionQuestions.find((sq) => sq.id === u.id);
        return q && (q.question_number !== u.question_number || q.order_index !== u.order_index);
      });

    if (updates.length) {
      await Promise.all(
        updates.map((u) =>
          supabase
            .from('test_section_questions')
            .update({ question_number: u.question_number, order_index: u.order_index })
            .eq('id', u.id)
        )
      );
    }

    return sourceQuestions.map((q) => {
      const updated = updates.find((u) => u.id === q.id);
      return updated ? { ...q, question_number: updated.question_number, order_index: updated.order_index } : q;
    });
  }, [getSectionQuestions]);

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

    // Set initial active states
    if (subjectsRes.data?.length) {
      setActiveSubjectId(subjectsRes.data[0].id);
      const firstSection = filteredSections.find(s => s.subject_id === subjectsRes.data[0].id);
      if (firstSection) {
        setActiveSectionId(firstSection.id);
        const firstQuestion = (questionsRes.data || []).find(q => q.section_id === firstSection.id);
        if (firstQuestion) setActiveQuestionId(firstQuestion.id);
      }
    }

    setIsLoading(false);
  }, [testId, navigate, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Unsaved changes warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

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
    toast({ title: "Subject renamed" });
  };

  const handleDeleteSubject = async (subjectId: string) => {
    // Delete all sections and questions in this subject
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
    toast({ title: "Section renamed" });
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
  const handleUpdateQuestion = async (questionId: string, updates: Partial<Question>) => {
    setIsSaving(true);
    setSaveStatus('saving');
    
    const { error } = await supabase
      .from('test_section_questions')
      .update(updates)
      .eq('id', questionId);

    if (error) {
      toast({ title: "Failed to save", variant: "destructive" });
    } else {
      setQuestions(questions.map(q => q.id === questionId ? { ...q, ...updates } : q));
      setSaveStatus('saved');
      setHasUnsavedChanges(false);
    }
    
    setIsSaving(false);
  };

  const handleAddQuestion = async (afterQuestionId?: string) => {
    if (!activeSectionId || !testId) return;
    
    const section = sections.find(s => s.id === activeSectionId);
    if (!section) return;

    const examType = test?.exam_type || 'jee_mains';
    const scheme = MARKING_SCHEMES[examType as keyof typeof MARKING_SCHEMES]?.[section.section_type as keyof typeof MARKING_SCHEMES['jee_mains']];
    
    const nextQuestionNumber = getNextQuestionNumber(activeSectionId);
    const sectionQuestionCount = getSectionQuestions(activeSectionId).length;

    const defaultAnswer = section.section_type === 'multiple_choice' ? [] : '';

    const { data, error } = await supabase
      .from('test_section_questions')
      .insert([{
        test_id: testId,
        section_id: activeSectionId,
        question_number: nextQuestionNumber,
        correct_answer: defaultAnswer,
        marks: scheme?.marks || 4,
        negative_marks: scheme?.negative || 0,
        order_index: sectionQuestionCount
      }])
      .select()
      .single();

    if (!error && data) {
      setQuestions([...questions, data]);
      setActiveQuestionId(data.id);
      toast({ title: `Question ${data.question_number} added` });
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    const questionToDelete = questions.find(q => q.id === questionId);
    if (!questionToDelete) return;

    await supabase.from('test_section_questions').delete().eq('id', questionId);
    
    const remaining = questions.filter(q => q.id !== questionId);
    const renumbered = await renumberSectionQuestions(questionToDelete.section_id, remaining);
    setQuestions(renumbered);
    setDeletedQuestions((prev) => [
      { ...questionToDelete, deleted_at: Date.now() },
      ...prev
    ]);
    
    if (activeQuestionId === questionId) {
      const nextInSection = renumbered.find((q) => q.section_id === questionToDelete.section_id);
      setActiveQuestionId(nextInSection?.id || null);
    }
    toast({ title: "Question deleted" });
  };

  const handleDuplicateQuestion = async (questionId: string) => {
    const original = questions.find(q => q.id === questionId);
    if (!original || !testId) return;

    const { data, error } = await supabase
      .from('test_section_questions')
      .insert([{
        test_id: testId,
        section_id: original.section_id,
        question_number: getNextQuestionNumber(original.section_id),
        question_text: original.question_text,
        correct_answer: original.correct_answer,
        options: original.options,
        marks: original.marks,
        negative_marks: original.negative_marks,
        order_index: getSectionQuestions(original.section_id).length
      }])
      .select()
      .single();

    if (!error && data) {
      setQuestions([...questions, data]);
      setActiveQuestionId(data.id);
      toast({ title: "Question duplicated" });
    }
  };

  const handleRestoreDeletedQuestion = async (deletedQuestionId: string) => {
    if (!testId) return;
    const deletedQuestion = deletedQuestions.find((q) => q.id === deletedQuestionId);
    if (!deletedQuestion) return;

    const targetSectionId = sections.some((s) => s.id === deletedQuestion.section_id)
      ? deletedQuestion.section_id
      : activeSectionId;

    if (!targetSectionId) {
      toast({ title: "No section selected for restore", variant: "destructive" });
      return;
    }

    const { data, error } = await supabase
      .from('test_section_questions')
      .insert([{
        test_id: testId,
        section_id: targetSectionId,
        question_number: getNextQuestionNumber(targetSectionId),
        question_text: deletedQuestion.question_text,
        correct_answer: deletedQuestion.correct_answer,
        options: deletedQuestion.options,
        marks: deletedQuestion.marks,
        negative_marks: deletedQuestion.negative_marks,
        pdf_page: deletedQuestion.pdf_page,
        order_index: getSectionQuestions(targetSectionId).length,
        is_bonus: deletedQuestion.is_bonus
      }])
      .select()
      .single();

    if (error || !data) {
      toast({ title: "Failed to restore question", variant: "destructive" });
      return;
    }

    const targetSection = sections.find((s) => s.id === targetSectionId);
    if (targetSection) setActiveSubjectId(targetSection.subject_id);
    setActiveSectionId(targetSectionId);
    setQuestions((prev) => [...prev, data]);
    setActiveQuestionId(data.id);
    setDeletedQuestions((prev) => prev.filter((q) => q.id !== deletedQuestionId));
    toast({ title: "Question restored from bin" });
  };

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
    
    // Validation before publish
    if (!test.is_published) {
      // Check for empty sections
      const emptySections = sections.filter(sec => 
        !questions.some(q => q.section_id === sec.id)
      );
      if (emptySections.length > 0) {
        toast({ 
          title: "Cannot publish", 
          description: `Section "${emptySections[0].name || emptySections[0].section_type}" has no questions`,
          variant: "destructive" 
        });
        return;
      }

      // Check for questions without answers
      const unanswered = questions.filter(q => {
        const section = sections.find(s => s.id === q.section_id);
        if (section?.section_type === 'multiple_choice') {
          return !Array.isArray(q.correct_answer) || q.correct_answer.length === 0;
        }
        return !q.correct_answer || q.correct_answer === '';
      });
      if (unanswered.length > 0) {
        toast({ 
          title: "Cannot publish", 
          description: `Question ${unanswered[0].question_number} has no correct answer`,
          variant: "destructive" 
        });
        return;
      }
    }

    await supabase.from('tests').update({ is_published: !test.is_published }).eq('id', test.id);
    setTest({ ...test, is_published: !test.is_published });
    toast({ title: test.is_published ? "Unpublished" : "Published!" });
  };

  const handleDuplicateTest = async () => {
    if (!test || !testId) return;
    
    // Create new test
    const { data: newTest, error } = await supabase
      .from('tests')
      .insert([{
        name: `${test.name} (Copy)`,
        description: test.description,
        exam_type: test.exam_type,
        duration_minutes: test.duration_minutes,
        test_type: 'full',
        is_published: false,
        fullscreen_enabled: test.fullscreen_enabled,
        show_solutions: test.show_solutions
      }])
      .select()
      .single();

    if (error || !newTest) {
      toast({ title: "Failed to duplicate", variant: "destructive" });
      return;
    }

    // Copy subjects, sections, questions
    for (const subject of subjects) {
      const { data: newSubject } = await supabase
        .from('test_subjects')
        .insert([{ test_id: newTest.id, name: subject.name, order_index: subject.order_index }])
        .select()
        .single();

      if (newSubject) {
        const subjectSections = sections.filter(s => s.subject_id === subject.id);
        for (const section of subjectSections) {
          const { data: newSection } = await supabase
            .from('test_sections')
            .insert([{ 
              subject_id: newSubject.id, 
              name: section.name, 
              section_type: section.section_type,
              order_index: section.order_index 
            }])
            .select()
            .single();

          if (newSection) {
            const sectionQuestions = questions.filter(q => q.section_id === section.id);
            if (sectionQuestions.length > 0) {
              await supabase.from('test_section_questions').insert(
                sectionQuestions.map(q => ({
                  test_id: newTest.id,
                  section_id: newSection.id,
                  question_number: q.question_number,
                  question_text: q.question_text,
                  correct_answer: q.correct_answer,
                  options: q.options,
                  marks: q.marks,
                  negative_marks: q.negative_marks,
                  order_index: q.order_index
                }))
              );
            }
          }
        }
      }
    }

    toast({ title: "Test duplicated!" });
    navigate(`/admin/test-editor/${newTest.id}`);
  };

  const handleDeleteTest = async () => {
    if (!testId) return;
    
    // Delete all related data
    await supabase.from('test_section_questions').delete().eq('test_id', testId);
    for (const section of sections) {
      await supabase.from('test_sections').delete().eq('id', section.id);
    }
    await supabase.from('test_subjects').delete().eq('test_id', testId);
    await supabase.from('tests').delete().eq('id', testId);
    
    toast({ title: "Test deleted" });
    navigate('/admin/tests');
  };

  // Get questions for current section
  const currentSectionQuestions = questions
    .filter(q => q.section_id === activeSectionId)
    .sort((a, b) => a.question_number - b.question_number);

  const activeQuestion = questions.find(q => q.id === activeQuestionId);
  const activeSection = sections.find(s => s.id === activeSectionId);

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="h-[calc(100vh-2rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border bg-card/50">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/tests')}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <div>
              <h1 className="text-lg font-bold">{test?.name}</h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="px-2 py-0.5 rounded bg-primary/10 text-primary">
                  {test?.exam_type === 'jee_advanced' ? 'JEE Advanced' : 'JEE Mains'}
                </span>
                <span>{questions.length} questions</span>
                {saveStatus === 'saving' && (
                  <span className="flex items-center gap-1 text-yellow-600">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Saving...
                  </span>
                )}
                {saveStatus === 'saved' && (
                  <span className="flex items-center gap-1 text-green-600">
                    <Check className="w-3 h-3" />
                    Saved
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
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
              {test?.is_published ? (
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

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Question Palette */}
          <div className="w-48 border-r border-border bg-card/30 p-3 flex flex-col">
            <ScrollArea className="flex-1">
              <QuestionPalette
                questions={currentSectionQuestions}
                activeQuestionId={activeQuestionId}
                onSelectQuestion={setActiveQuestionId}
                sectionType={activeSection?.section_type}
              />
            </ScrollArea>
            
            {/* Add Question Button */}
            <div className="pt-3 border-t border-border mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAddQuestion()}
                className="w-full"
                disabled={!activeSectionId}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Question
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowQuestionBin(true)}
                className="w-full mt-2"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Bin ({deletedQuestions.length})
              </Button>
            </div>
          </div>

          {/* Right: Question Editor */}
          <QuestionEditorPanel
            question={activeQuestion || null}
            sectionType={activeSection?.section_type || 'single_choice'}
            onUpdate={handleUpdateQuestion}
            onDelete={handleDeleteQuestion}
            onDuplicate={handleDuplicateQuestion}
            onAddAbove={(id) => handleAddQuestion(id)}
            onAddBelow={(id) => handleAddQuestion(id)}
            isSaving={isSaving}
            hasUnsavedChanges={hasUnsavedChanges}
          />
        </div>
      </div>

      <Dialog open={showQuestionBin} onOpenChange={setShowQuestionBin}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Deleted Questions Bin</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {deletedQuestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No deleted questions yet.</p>
            ) : (
              deletedQuestions.map((deletedQuestion) => {
                const section = sections.find((s) => s.id === deletedQuestion.section_id);
                return (
                  <div key={`${deletedQuestion.id}-${deletedQuestion.deleted_at}`} className="border rounded-md p-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">
                        Q{deletedQuestion.question_number}
                        {section ? ` • ${section.name || section.section_type}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {deletedQuestion.question_text?.trim() || "Untitled question"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestoreDeletedQuestion(deletedQuestion.id)}
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      Restore
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

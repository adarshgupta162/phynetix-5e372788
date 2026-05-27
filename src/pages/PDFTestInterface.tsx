import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useProctoring } from '@/hooks/useProctoring';
import ScrollPDFViewer from '@/components/test/ScrollPDFViewer';
import EnhancedOMRPanel from '@/components/test/EnhancedOMRPanel';
import SectionTaskbar from '@/components/test/SectionTaskbar';
import FullscreenGuard from '@/components/test/FullscreenGuard';
import AccessibilityToolbar from '@/components/test/AccessibilityToolbar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, AlertTriangle, Play, Clock } from 'lucide-react';

interface Question {
  id: string;
  question_number: number;
  question_type: string;
  options?: string[];
  marks: number;
  negative_marks: number;
  pdf_page_number: number | null;
  section_id: string;
}

interface Section {
  id: string;
  name: string;
  type: string;
  subjectName: string;
  questionIds: string[];
}

interface TestData {
  id: string;
  name: string;
  duration_minutes: number;
  exam_type: string;
  pdf_url: string | null;
  instructions_json: any;
  fullscreen_enabled: boolean;
  answer_key_uploaded: boolean;
  scheduled_at: string | null;
}

interface ExistingAttempt {
  id: string;
  started_at: string;
  answers: Record<string, any> | null;
  roll_number: string | null;
  fullscreen_exit_count: number | null;
  extra_time_minutes?: number | null;
  submit_disabled?: boolean | null;
  result_release_delay_minutes?: number | null;
  result_available_at?: string | null;
}

export default function PDFTestInterface() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const proctoring = useProctoring(testId, user?.id);

  // States
  const [phase, setPhase] = useState<'loading' | 'instructions' | 'resume' | 'test' | 'submitting'>('loading');
  const [testData, setTestData] = useState<TestData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [rollNumber, setRollNumber] = useState('');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [existingAttempt, setExistingAttempt] = useState<ExistingAttempt | null>(null);
  const [submitDisabled, setSubmitDisabled] = useState(false);

  // Test state
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set());
  const [viewedQuestions, setViewedQuestions] = useState<Set<string>>(new Set());
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [fullscreenExitCount, setFullscreenExitCount] = useState(0);
  const [activeSection, setActiveSection] = useState<string>('');
  const [targetPdfPage, setTargetPdfPage] = useState<number | undefined>();

  // Instructions state
  const [agreedToInstructions, setAgreedToInstructions] = useState(false);
  const [instructions, setInstructions] = useState<string[]>([]);

  // Student info
  const [studentName, setStudentName] = useState('');
  const [targetExam, setTargetExam] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();

  // Generate roll number
  const generateRollNumber = useCallback(() => {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    const random = Math.floor(Math.random() * 10);
    return `${dd}${mm}${yy}${random}`;
  }, []);

  // Mark current question as viewed
  useEffect(() => {
    if (phase === 'test' && questions[currentQuestion]) {
      setViewedQuestions(prev => new Set([...prev, questions[currentQuestion].id]));
      
      // Navigate to PDF page if question has mapping
      const q = questions[currentQuestion];
      if (q.pdf_page_number) {
        setTargetPdfPage(q.pdf_page_number);
      }
    }
  }, [currentQuestion, phase, questions]);

  useEffect(() => {
    if (phase !== 'test' || !proctoring.session?.id || !questions[currentQuestion]) return;
    const question = questions[currentQuestion];
    const section = sections.find((item) => item.id === question.section_id || item.questionIds.includes(question.id));
    proctoring.logEvent('question_change', {
      questionId: question.id,
      subjectName: section?.subjectName,
      payload: { question_index: currentQuestion + 1, section_id: question.section_id },
    });
  }, [currentQuestion, phase, proctoring.session?.id, questions, sections]);

  useEffect(() => {
    if (phase !== 'test' || !proctoring.session?.id || !activeSection) return;
    const section = sections.find((item) => item.id === activeSection);
    if (section?.subjectName) proctoring.logEvent('subject_change', { subjectName: section.subjectName, payload: { section_id: activeSection } });
  }, [activeSection, phase, proctoring.session?.id, sections]);

  // Initialize test
  useEffect(() => {
    const initializeTest = async () => {
      if (!testId || !user) return;

      try {
        // Fetch test data
        const { data: test, error: testError } = await supabase
          .from('tests')
          .select('*')
          .eq('id', testId)
          .single();

        if (testError || !test) {
          toast({ title: 'Test not found', variant: 'destructive' });
          navigate('/tests');
          return;
        }

        // Check if test is scheduled for future
        if (test.scheduled_at && new Date(test.scheduled_at) > new Date()) {
          toast({ title: 'Test not available yet', description: 'This test is scheduled for a later time', variant: 'destructive' });
          navigate('/tests');
          return;
        }

        setTestData({
          ...test,
          fullscreen_enabled: test.fullscreen_enabled ?? true,
          answer_key_uploaded: test.answer_key_uploaded ?? true,
          scheduled_at: test.scheduled_at
        });

        // Check for existing incomplete attempt
        const { data: existingAttemptData } = await supabase
          .from('test_attempts')
          .select('id, started_at, answers, roll_number, fullscreen_exit_count, completed_at, extra_time_minutes, submit_disabled, result_release_delay_minutes, result_available_at')
          .eq('test_id', testId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (existingAttemptData) {
          if (existingAttemptData.completed_at) {
            toast({ title: 'Test already completed', description: 'Redirecting to results...' });
            navigate(`/test/${testId}/detailed-analysis?attemptId=${existingAttemptData.id}`);
            return;
          }

          const startTime = new Date(existingAttemptData.started_at).getTime();
          const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
          const extraMinutes = existingAttemptData.extra_time_minutes ?? 0;
          const totalSeconds = (test.duration_minutes + extraMinutes) * 60;
          const remainingTime = totalSeconds - elapsedSeconds;

          if (remainingTime <= 0) {
            toast({ title: 'Time expired', description: 'Submitting your test...' });
            setAttemptId(existingAttemptData.id);
            const savedAnswers = (existingAttemptData.answers as Record<string, any>) || {};
            setAnswers(savedAnswers);
            await autoSubmitExpiredTest(existingAttemptData.id, savedAnswers, totalSeconds);
            return;
          }

          setExistingAttempt({
            id: existingAttemptData.id,
            started_at: existingAttemptData.started_at,
            answers: (existingAttemptData.answers as Record<string, any>) || null,
            roll_number: existingAttemptData.roll_number,
            fullscreen_exit_count: existingAttemptData.fullscreen_exit_count,
            extra_time_minutes: existingAttemptData.extra_time_minutes,
            submit_disabled: existingAttemptData.submit_disabled,
            result_release_delay_minutes: existingAttemptData.result_release_delay_minutes,
            result_available_at: existingAttemptData.result_available_at,
          });
          setSubmitDisabled(Boolean(existingAttemptData.submit_disabled));
          setTimeLeft(remainingTime);
          setPhase('resume');
        } else {
          setTimeLeft(test.duration_minutes * 60);
          setPhase('instructions');
        }

        // Fetch questions with section info
        const { data: sectionQuestions, error: sectionQuestionsError } = await supabase
          .from('test_section_questions')
          .select(`
            id,
            question_number,
            marks,
            negative_marks,
            pdf_page,
            section_id,
            test_sections!inner (
              id,
              name,
              section_type,
              subject:test_subjects(name)
            )
          `)
          .eq('test_id', testId)
          .order('question_number');

        if (!sectionQuestionsError && sectionQuestions && sectionQuestions.length > 0) {
          const sectionMap = new Map<string, Section>();
          
          const qs = sectionQuestions.map((q: any) => {
            const sectionType = q.test_sections?.section_type || 'single_choice';
            let questionType = 'single';
            if (sectionType === 'single_choice') questionType = 'single';
            else if (sectionType === 'multiple_choice') questionType = 'multi';
            else if (sectionType === 'integer') questionType = 'integer';

            const sectionId = q.test_sections?.id || q.section_id;
            const subjectName = q.test_sections?.subject?.name || 'Unknown';

            if (!sectionMap.has(sectionId)) {
              sectionMap.set(sectionId, {
                id: sectionId,
                name: q.test_sections?.name || sectionType.replace('_', ' '),
                type: sectionType,
                subjectName,
                questionIds: []
              });
            }
            sectionMap.get(sectionId)!.questionIds.push(q.id);
            
            return {
              id: q.id,
              question_number: q.question_number,
              question_type: questionType,
              marks: q.marks || 4,
              negative_marks: q.negative_marks ?? 1,
              pdf_page_number: q.pdf_page || null,
              section_id: sectionId
            };
          });
          
          setQuestions(qs);
          const sectionsArr = Array.from(sectionMap.values());
          setSections(sectionsArr);
          if (sectionsArr.length > 0) {
            setActiveSection(sectionsArr[0].id);
          }
        }

        // Get PDF URL
        if (test.pdf_url) {
          const { data: urlData } = await supabase.storage
            .from('test-pdfs')
            .createSignedUrl(test.pdf_url, 3600 * 3);
          
          if (urlData?.signedUrl) {
            setPdfUrl(urlData.signedUrl);
          }
        }

        // Generate instructions
        const examInstructions = generateInstructions(test.exam_type, test.fullscreen_enabled ?? true);
        setInstructions(examInstructions);

        setRollNumber(generateRollNumber());
      } catch (err) {
        console.error('Error initializing test:', err);
        toast({ title: 'Error loading test', variant: 'destructive' });
      }
    };

    initializeTest();
  }, [testId, user, navigate, toast, generateRollNumber]);

  // Fetch student profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name, target_exam, avatar_url')
        .eq('id', user.id)
        .single();
      if (data) {
        setStudentName(data.full_name || '');
        setTargetExam(data.target_exam || '');
        setAvatarUrl(data.avatar_url || undefined);
      }
    };
    fetchProfile();
  }, [user]);

  const autoSubmitExpiredTest = async (attemptId: string, savedAnswers: Record<string, any>, totalSeconds: number) => {
    try {
      setPhase('submitting');
      
      const { data, error } = await supabase.functions.invoke('submit-test', {
        body: {
          attempt_id: attemptId,
          answers: savedAnswers,
          time_taken_seconds: totalSeconds,
          force_submit: true,
        }
      });

      if (error) throw error;

      await proctoring.stop('auto_submitted_time_expired');
      toast({ title: 'Test auto-submitted', description: 'Time expired' });
      navigate(`/test/${testId}/detailed-analysis?attemptId=${attemptId}`);
    } catch (err: any) {
      console.error('Error auto-submitting:', err);
      toast({ title: 'Error submitting test', variant: 'destructive' });
    }
  };

  const generateInstructions = (examType: string, fullscreenEnabled: boolean) => {
    const commonInstructions = [
      'Read each question carefully before answering.',
      'You can navigate between questions using the question palette.',
      'Mark questions for review if you want to revisit them later.',
      'The test will auto-submit when the timer reaches zero.',
      'Your answers are auto-saved every 10 seconds.',
      'If you leave the test, you can resume from where you left off.',
    ];

    if (fullscreenEnabled) {
      commonInstructions.push('Do not exit fullscreen mode during the test.');
      commonInstructions.push('Maximum 7 fullscreen exits allowed. 8th exit will auto-submit the test.');
    }

    if (examType === 'jee_advanced') {
      return [
        ...commonInstructions,
        'Single Correct Questions: +3 marks for correct, -1 for incorrect.',
        'Multiple Correct Questions: +4 marks for all correct (partial marking applies).',
        'Numerical Questions: +3 marks for correct, 0 for incorrect.',
      ];
    } else {
      return [
        ...commonInstructions,
        'Single Correct Questions: +4 marks for correct, -1 for incorrect.',
        'Multiple Correct Questions: +4 marks for correct, 0 for incorrect.',
        'Numerical Questions: +4 marks for correct, -1 for incorrect.',
      ];
    }
  };

  const resumeTest = async () => {
    if (!existingAttempt) return;
    try {
      await proctoring.prepare();
      await proctoring.start(existingAttempt.id, { interface: 'pdf', resumed: true });
    } catch (error: any) {
      toast({ title: 'Live monitoring required', description: error.message || 'Please allow required monitoring permissions.', variant: 'destructive' });
      return;
    }
    setAttemptId(existingAttempt.id);
    setAnswers(existingAttempt.answers || {});
    setRollNumber(existingAttempt.roll_number || generateRollNumber());
    setSubmitDisabled(Boolean(existingAttempt.submit_disabled));
    setFullscreenExitCount(existingAttempt.fullscreen_exit_count || 0);
    setPhase('test');
  };

  const startTest = async () => {
    if (!testId || !user) return;

    try {
      await proctoring.prepare();
      const { data, error } = await supabase.functions.invoke('start-test', {
        body: { test_id: testId }
      });

      if (error) throw error;

      setAttemptId(data.attempt_id);
      setSubmitDisabled(Boolean(data.submit_disabled));
      if (testData) {
        const extraMinutes = Number(data.extra_time_minutes) || 0;
        setTimeLeft((testData.duration_minutes + extraMinutes) * 60);
      }
      await proctoring.start(data.attempt_id, { interface: 'pdf', test_name: testData?.name });

      await supabase
        .from('test_attempts')
        .update({ roll_number: rollNumber })
        .eq('id', data.attempt_id);

      setPhase('test');
    } catch (err: any) {
      console.error('Error starting test:', err);
      toast({ title: 'Error starting test', description: err.message, variant: 'destructive' });
    }
  };

  // Auto-save
  useEffect(() => {
    if (phase !== 'test' || !attemptId) return;

    const saveInterval = setInterval(async () => {
      const timeTaken = testData ? (testData.duration_minutes * 60) - timeLeft : 0;
      
      await supabase
        .from('test_attempts')
        .update({ 
          answers,
          time_taken_seconds: timeTaken,
        })
        .eq('id', attemptId);
      
      console.log('Auto-saved at', new Date().toLocaleTimeString());
    }, 10000);

    return () => clearInterval(saveInterval);
  }, [phase, attemptId, answers, timeLeft, testData]);

  // Timer
  useEffect(() => {
    if (phase !== 'test' || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase, timeLeft]);

  const handleAnswerChange = useCallback((questionId: string, answer: string | string[]) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  }, []);

  const handleToggleReview = useCallback((questionId: string) => {
    setMarkedForReview(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async (forceSubmit = false) => {
    if (!attemptId || phase === 'submitting') return;
    if (submitDisabled && !forceSubmit) {
      toast({ title: 'Submission disabled', description: 'Submission is disabled by your admin.', variant: 'destructive' });
      return;
    }

    setPhase('submitting');

    try {
      const timeTaken = testData ? (testData.duration_minutes * 60) - timeLeft : 0;

      // Check if answer key is uploaded
      if (!testData?.answer_key_uploaded) {
        // Mark as awaiting result
        const delayMinutes = existingAttempt?.result_release_delay_minutes ?? testData?.result_release_delay_minutes ?? 0;
        const startedAt = existingAttempt?.started_at ? new Date(existingAttempt.started_at).getTime() : Date.now();
        const resultAvailableAt = delayMinutes > 0
          ? new Date(startedAt + delayMinutes * 60 * 1000).toISOString()
          : null;
        await supabase
          .from('test_attempts')
          .update({ 
            answers,
            time_taken_seconds: timeTaken,
            completed_at: new Date().toISOString(),
            awaiting_result: true,
            last_submitted_at: new Date().toISOString(),
            result_available_at: resultAvailableAt,
          })
          .eq('id', attemptId);

        if (document.fullscreenElement) {
          document.exitFullscreen();
        }

        await proctoring.stop('submitted_awaiting_result');
        toast({ title: 'Test submitted!', description: 'Results will be available once answer key is uploaded.' });
        navigate('/tests');
        return;
      }

      const { data, error } = await supabase.functions.invoke('submit-test', {
        body: {
          attempt_id: attemptId,
          answers,
          time_taken_seconds: timeTaken,
          force_submit: forceSubmit,
        }
      });

      if (error) throw error;

      if (document.fullscreenElement) {
        document.exitFullscreen();
      }

      await proctoring.stop('submitted');
      toast({ title: 'Test submitted successfully!' });
      navigate(`/test/${testId}/detailed-analysis?attemptId=${attemptId}`);
    } catch (err: any) {
      console.error('Error submitting test:', err);
      toast({ title: 'Error submitting test', description: err.message, variant: 'destructive' });
      setPhase('test');
    }
  }, [attemptId, answers, timeLeft, testData, testId, navigate, toast, phase, submitDisabled, existingAttempt]);

  const handleMaxExitsReached = useCallback(() => {
    toast({
      title: 'Maximum exits reached',
      description: 'Test is being auto-submitted.',
      variant: 'destructive'
    });
    handleSubmit(true);
  }, [handleSubmit, toast]);

  const handleExitCountChange = useCallback(async (count: number) => {
    setFullscreenExitCount(count);
    
    if (attemptId) {
      await supabase
        .from('test_attempts')
        .update({ fullscreen_exit_count: count })
        .eq('id', attemptId);
    }
  }, [attemptId]);

  const handleNext = useCallback(() => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    }
  }, [currentQuestion, questions.length]);

  const handleSectionChange = useCallback((sectionId: string) => {
    setActiveSection(sectionId);
    // Jump to first question of the section
    const section = sections.find(s => s.id === sectionId);
    if (section && section.questionIds.length > 0) {
      const firstQId = section.questionIds[0];
      const index = questions.findIndex(q => q.id === firstQId);
      if (index >= 0) {
        setCurrentQuestion(index);
      }
    }
  }, [sections, questions]);

  const filteredQuestionIds = useMemo(() => {
    const section = sections.find(s => s.id === activeSection);
    return section?.questionIds || questions.map(q => q.id);
  }, [sections, activeSection, questions]);

  const formatTimeForDisplay = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Loading phase
  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading test...</p>
        </div>
      </div>
    );
  }

  // Resume phase
  if (phase === 'resume' && existingAttempt) {
    return (
      <div className="min-h-screen bg-background p-4 lg:p-8">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Play className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold font-display">Resume Test</h1>
                <p className="text-muted-foreground">{testData?.name}</p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-[hsl(45,93%,47%)]/10 border border-[hsl(45,93%,47%)]/30 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-[hsl(45,93%,47%)] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-[hsl(45,93%,47%)]">Test in Progress</p>
                  <p className="text-sm text-muted-foreground">
                    You have an ongoing test attempt. Resume to continue.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="p-4 rounded-lg bg-secondary/50 text-center">
                <p className="text-2xl font-bold text-primary">{formatTimeForDisplay(timeLeft)}</p>
                <p className="text-sm text-muted-foreground">Time Remaining</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/50 text-center">
                <p className="text-2xl font-bold text-primary">
                  {Object.keys(existingAttempt.answers || {}).length}
                </p>
                <p className="text-sm text-muted-foreground">Questions Answered</p>
              </div>
            </div>

            <Button variant="gradient" size="lg" className="w-full" onClick={resumeTest}>
              <Play className="w-5 h-5 mr-2" />
              Resume Test
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  // Instructions phase
  if (phase === 'instructions') {
    return (
      <div className="min-h-screen bg-background p-4 lg:p-8">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold font-display">{testData?.name}</h1>
                <p className="text-muted-foreground">
                  {testData?.exam_type === 'jee_advanced' ? 'JEE Advanced' : 'JEE Mains'} Pattern
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="p-4 rounded-lg bg-secondary/50 text-center">
                <p className="text-2xl font-bold text-primary">{questions.length}</p>
                <p className="text-sm text-muted-foreground">Questions</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/50 text-center">
                <p className="text-2xl font-bold text-primary">{testData?.duration_minutes}</p>
                <p className="text-sm text-muted-foreground">Minutes</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/50 text-center">
                <p className="text-2xl font-bold text-primary">{rollNumber}</p>
                <p className="text-sm text-muted-foreground">Roll Number</p>
              </div>
            </div>

            <h2 className="text-lg font-semibold mb-4">Instructions</h2>
            <ul className="space-y-3 mb-8">
              {instructions.map((instruction, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-medium flex-shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-muted-foreground">{instruction}</span>
                </li>
              ))}
            </ul>

            {testData?.fullscreen_enabled && (
              <div className="p-4 rounded-lg bg-[hsl(45,93%,47%)]/10 border border-[hsl(45,93%,47%)]/30 mb-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-[hsl(45,93%,47%)] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-[hsl(45,93%,47%)]">Important</p>
                    <p className="text-sm text-muted-foreground">
                      The test will enter fullscreen mode when you start.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 mb-6">
              <Checkbox
                id="agree"
                checked={agreedToInstructions}
                onCheckedChange={(checked) => setAgreedToInstructions(checked === true)}
              />
              <label htmlFor="agree" className="text-sm cursor-pointer">
                I have read and understood all the instructions
              </label>
            </div>

            <Button
              variant="gradient"
              size="lg"
              className="w-full"
              disabled={!agreedToInstructions || (pdfUrl && !pdfLoaded)}
              onClick={startTest}
            >
              {pdfUrl && !pdfLoaded ? 'Loading PDF...' : 'Start Test'}
            </Button>

            {pdfUrl && !pdfLoaded && (
              <div className="hidden">
                <ScrollPDFViewer pdfUrl={pdfUrl} onLoadComplete={() => setPdfLoaded(true)} />
              </div>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  // Submitting phase
  if (phase === 'submitting') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Submitting your test...</p>
        </div>
      </div>
    );
  }

  // Test phase
  const TestContent = (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Section Taskbar */}
      <SectionTaskbar
        sections={sections}
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        answers={answers}
        markedForReview={markedForReview}
        viewedQuestions={viewedQuestions}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* PDF Viewer (Left - 70%) - scrolls independently */}
        <div className="h-full overflow-auto" style={{ width: '70%' }}>
          {pdfUrl ? (
            <ScrollPDFViewer
              pdfUrl={pdfUrl}
              targetPage={targetPdfPage}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No PDF attached to this test</p>
              </div>
            </div>
          )}
        </div>

        {/* OMR Panel (Right - 30%) - fixed, does NOT scroll with PDF */}
        <div className="h-full border-l border-border" style={{ width: '30%' }}>
          <EnhancedOMRPanel
            questions={questions}
            filteredQuestionIds={filteredQuestionIds}
            answers={answers}
            markedForReview={markedForReview}
            viewedQuestions={viewedQuestions}
            currentQuestion={currentQuestion}
            timeLeft={timeLeft}
            studentName={studentName}
            rollNumber={rollNumber}
            targetExam={targetExam}
            avatarUrl={avatarUrl}
            testName={testData?.name || ''}
            onAnswerChange={handleAnswerChange}
            onToggleReview={handleToggleReview}
            onQuestionClick={setCurrentQuestion}
            onSubmit={handleSubmit}
            onNext={handleNext}
            submitDisabled={submitDisabled}
          />
        </div>
      </div>
    </div>
  );

  // Wrap with fullscreen guard if enabled
  if (testData?.fullscreen_enabled) {
    return (
      <FullscreenGuard
        maxExits={7}
        onMaxExitsReached={handleMaxExitsReached}
        onExitCountChange={handleExitCountChange}
        initialExitCount={fullscreenExitCount}
      >
        {TestContent}
      </FullscreenGuard>
    );
  }

  return TestContent;
}

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, Flag, ChevronLeft, ChevronRight, AlertCircle,
  CheckCircle2, XCircle, Loader2, WifiOff, Info
} from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useProctoring } from "@/hooks/useProctoring";
import FullscreenGuard from "@/components/test/FullscreenGuard";
import AccessibilityToolbar from "@/components/test/AccessibilityToolbar";
import { LatexRenderer } from "@/components/ui/latex-renderer";

/* ─── TYPES ─── */
interface Question {
  id: string; order: number; question_text: string;
  options: string[] | null; difficulty: string; marks: number;
  negative_marks: number; question_type: string; subject: string;
  chapter: string; image_url?: string; image_urls?: string[];
  section_id?: string; section_order?: number;
  section_type?: string; paragraph_id?: string; paragraph_text?: string;
  paragraph_image_urls?: string[];
}
interface Section { id: string; name: string; questions: Question[]; section_type?: string; }
type AttemptProgressPayload = {
  answers?: Record<string, string | string[]>;
  time_per_question?: Record<string, number | string[]>;
};

const VISITED_QUESTIONS_META_KEY = "__visited_questions__";

/* ─── EXACT COLOURS FROM SCREENSHOT ─── */
const C = {
  // screens 1-3
  blueStripe:   "#4a90d9",
  headerGrey:   "#636363",
  yellow:       "#f5c518",
  instHdr:      "#add8e6",
  signInBlue:   "#29abe2",
  loginCard:    "#e8e8e8",
  loginHdr:     "#d0d0d0",
  // screen 4
  topbarDark:   "#1a1a2e",
  sectionTabBg: "#f0f0f0",
  secActive:    "#2979c5",
  secInactive:  "#dce8f4",
  sidebarBg:    "#dce8f5",
  sidebarTitle: "#2979c5",
  bottomBg:     "#f0f0f0",
  // palette exact
  palGrey:      "#c8c8c8",   // not visited — square
  palRed:       "#cc0000",   // not answered (visited) — round
  palRed2:      "#cc0000",   // current — red square
  palGreen:     "#26a65b",   // answered — round
  palPurple:    "#7b2fbf",   // marked — round
};

/* ─── PALETTE BUTTON ─── */
function PaletteBtn({ num, status, onClick }: { num: number; status: string; onClick: () => void }) {
  let bg = C.palGrey, color = "#555", borderRadius = "4px", border = "1px solid #aaa", outline = "none";
  if (status === "current") {
    bg = C.palRed2; color = "#fff"; borderRadius = "4px"; border = "none";
    outline = `2px solid ${C.palRed2}`; 
  } else if (status === "not-answered") {
    bg = C.palRed; color = "#fff"; borderRadius = "50%"; border = "none";
  } else if (status === "answered") {
    bg = C.palGreen; color = "#fff"; borderRadius = "50%"; border = "none";
  } else if (status === "marked" || status === "answered-marked") {
    bg = C.palPurple; color = "#fff"; borderRadius = "50%"; border = "none";
  }
  return (
    <div onClick={onClick} style={{
      width: 36, height: 36, background: bg, color, borderRadius, border,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 13, fontWeight: "bold", cursor: "pointer",
      fontFamily: "Arial,sans-serif", position: "relative", flexShrink: 0,
      outline, outlineOffset: "2px", boxSizing: "border-box", userSelect: "none",
    }}>
      {num}
      {status === "answered-marked" && (
        <span style={{ position: "absolute", bottom: -2, right: -2, width: 11, height: 11, background: C.palGreen, borderRadius: "50%", border: "2px solid #fff" }} />
      )}
    </div>
  );
}

/* ─── LEGEND ICON ─── */
type StatusCounts = { answered: number; notAnswered: number; notVisited: number; marked: number; answeredMarked: number };

function StatusSymbol({ n, type, size = 28 }: { n: number; type: "answered"|"notans"|"notvisit"|"marked"|"ansmarked"; size?: number }) {
  const s = {
    answered:  { bg: C.palGreen,  color: "#fff", br: "50%",              border: "none" },
    notans:    { bg: C.palRed,    color: "#fff", br: "50%",              border: "none" },
    notvisit:  { bg: C.palGrey,   color: "#555", br: "4px",              border: "1px solid #aaa" },
    marked:    { bg: C.palPurple, color: "#fff", br: "50%",              border: "none" },
    ansmarked: { bg: C.palPurple, color: "#fff", br: "50%",              border: "none" },
  }[type];
  const fontSize = size <= 20 ? 10 : 12;
  const markerSize = size <= 20 ? 8 : 9;
  return (
    <div style={{ position: "relative", width: size, height: size, background: s.bg, color: s.color, borderRadius: s.br, border: s.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize, fontWeight: "bold", flexShrink: 0 }}>
      {n}
      {type === "ansmarked" && <span style={{ position: "absolute", bottom: -2, right: -2, width: markerSize, height: markerSize, background: C.palGreen, borderRadius: "50%", border: "2px solid #fff" }} />}
    </div>
  );
}

function LegIcon({ n, type }: { n: number; type: "answered"|"notans"|"notvisit"|"marked"|"ansmarked" }) {
  return <StatusSymbol n={n} type={type} />;
}

/* ─── TOOLTIP POPUP ─── */
function StatusTooltip({ counts, visible }: { counts: StatusCounts; visible: boolean }) {
  if (!visible) return null;
  return (
    <div style={{
      position: "absolute", top: "110%", left: "50%", transform: "translateX(-50%)",
      background: "#fff", border: "1px solid #bbb", borderRadius: 4, padding: "10px 14px",
      boxShadow: "0 4px 16px rgba(0,0,0,.18)", zIndex: 9999, minWidth: 200,
      fontFamily: "Arial,sans-serif", fontSize: 12, color: "#222", whiteSpace: "nowrap",
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {[
          { type: "answered",  label: "Answered",                     val: counts.answered },
          { type: "notans",    label: "Not Answered",                 val: counts.notAnswered },
          { type: "notvisit",  label: "Not Visited",                  val: counts.notVisited },
          { type: "marked",    label: "Marked for Review",            val: counts.marked },
          { type: "ansmarked", label: "Answered & Marked for Review", val: counts.answeredMarked },
        ].map((row, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <StatusSymbol n={row.val} type={row.type} size={20} />
            <span>{row.label}</span>
          </div>
        ))}
      </div>
      {/* Arrow */}
      <div style={{ position: "absolute", top: -6, left: "50%", transform: "translateX(-50%)", width: 10, height: 10, background: "#fff", border: "1px solid #bbb", borderBottom: "none", borderRight: "none", rotate: "45deg" }} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════ */
export default function NormalTestInterface() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const proctoring = useProctoring(testId, user?.id);

  /* ── ALL STATE (100% identical to original) ── */
  const [attemptId, setAttemptId]               = useState<string | null>(null);
  const [testName, setTestName]                 = useState("Loading...");
  const [questions, setQuestions]               = useState<Question[]>([]);
  const [sections, setSections]                 = useState<Section[]>([]);
  const [activeSection, setActiveSection]       = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers]                   = useState<Record<string, string | string[]>>({});
  const [draftQuestionId, setDraftQuestionId]   = useState<string | null>(null);
  const [draftAnswer, setDraftAnswer]           = useState<string | string[] | undefined>(undefined);
  const [markedForReview, setMarkedForReview]   = useState<Set<string>>(new Set());
  const [visitedQuestions, setVisitedQuestions] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft]                 = useState(0);
  const [showSubmitModal, setShowSubmitModal]   = useState(false);
  const [loading, setLoading]                   = useState(true);
  const [submitting, setSubmitting]             = useState(false);
  const [fullscreenEnabled, setFullscreenEnabled] = useState(true);
  const [fullscreenExitCount, setFullscreenExitCount] = useState(0);
  const [currentScreen, setCurrentScreen]       = useState(1);
  const [agreedToTerms, setAgreedToTerms]       = useState(false);
  const [testDuration, setTestDuration]         = useState(0);
  const [hasExistingAttempt, setHasExistingAttempt] = useState(false);
  const [systemId, setSystemId]                 = useState("");
  const [studentName, setStudentName]           = useState("Student");
  const [studentAvatar, setStudentAvatar]       = useState<string | null>(null);
  const [examType, setExamType]                 = useState<string>("custom");
  const [testType, setTestType]                 = useState<string>("full");
  const [studentRollNumber, setStudentRollNumber] = useState("");
  const [timePerQuestion, setTimePerQuestion]   = useState<Record<string, number>>({});
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [isSaving, setIsSaving]                 = useState(false);
  const [timeExpired, setTimeExpired]           = useState(false);
  const [showPalette, setShowPalette]           = useState(true);
  const [isOffline, setIsOffline]               = useState(!navigator.onLine);
  const [isMobileDevice, setIsMobileDevice]     = useState(false);
  const [integerCursorPosition, setIntegerCursorPosition] = useState(0);
  const persistQueueRef = useRef<Promise<void>>(Promise.resolve());
  const persistSequenceRef = useRef(0);

  // tooltip hover state
  const [hoveredSectionTooltip, setHoveredSectionTooltip] = useState<string | null>(null);
  const [hoveredTestTooltip, setHoveredTestTooltip] = useState(false);
  const [unlockDate, setUnlockDate]             = useState<string | null>((location.state as { unlockDate?: string | null } | null)?.unlockDate || null);
  const [showUnlockPopup, setShowUnlockPopup]   = useState(false);

  /* ════ ALL API/BACKEND LOGIC — 100% IDENTICAL TO ORIGINAL ════ */

  // Online/offline detection
  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => { window.removeEventListener("offline", goOffline); window.removeEventListener("online", goOnline); };
  }, []);

  useEffect(() => {
    const ua = navigator.userAgent || "";
    const isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const isCoarsePointer = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    setIsMobileDevice(isMobileUA || isCoarsePointer);
  }, []);

  useEffect(() => { if (testId) checkExistingAttemptFn(); }, [testId]);

  const checkExistingAttemptFn = async () => {
    try {
      const { data: testData } = await supabase.from("tests")
        .select("name, duration_minutes, fullscreen_enabled, exam_type, test_type")
        .eq("id", testId).single();
      if (testData) {
        setTestName(testData.name); setTestDuration(testData.duration_minutes);
        setFullscreenEnabled(testData.fullscreen_enabled ?? true);
        setExamType(testData.exam_type || "custom"); setTestType(testData.test_type || "full");
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles")
          .select("full_name, avatar_url, roll_number").eq("id", user.id).single();
        setStudentName(profile?.full_name || "Student");
        setStudentAvatar(profile?.avatar_url);
        setStudentRollNumber(profile?.roll_number || user.id.substring(0, 8));
        const storageKey = `systemId_${testId}`;
        let sid = localStorage.getItem(storageKey);
        if (!sid) { sid = `C${Math.floor(100 + Math.random() * 900)}`; localStorage.setItem(storageKey, sid); }
        setSystemId(sid);
        const { data: ea } = await supabase.from("test_attempts")
          .select("id, completed_at, fullscreen_exit_count")
          .eq("test_id", testId).eq("user_id", user.id).maybeSingle();
        if (ea) {
          if (ea.completed_at) { navigate(`/test/${testId}/analysis`); return; }
          setHasExistingAttempt(true); setCurrentScreen(4);
          setFullscreenExitCount(ea.fullscreen_exit_count || 0);
          initializeTest(); return;
        }
        const releaseDate = await getEffectiveUnlockDate(user.id);
        setUnlockDate(releaseDate);
      }
      setLoading(false);
    } catch (e) { console.error(e); setLoading(false); }
  };

  const getEffectiveUnlockDate = async (userId: string) => {
    if (!testId) return null;
    const { data: enrollments, error: enrollmentError } = await supabase
      .from("batch_enrollments")
      .select("batch_id")
      .eq("user_id", userId)
      .eq("is_active", true);
    if (enrollmentError || !enrollments?.length) return null;

    const batchIds = enrollments.map((enrollment) => enrollment.batch_id);
    const { data: batchTests, error: batchTestsError } = await supabase
      .from("batch_tests")
      .select("unlock_date")
      .eq("test_id", testId)
      .in("batch_id", batchIds);
    if (batchTestsError || !batchTests?.length) return null;

    const unlockDates = batchTests
      .map((batchTest) => batchTest.unlock_date)
      .filter((date): date is string => !!date)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    return unlockDates[0] || null;
  };

  const getTimeUntilRelease = (releaseDate: string) => {
    const diff = new Date(releaseDate).getTime() - Date.now();
    if (diff <= 0) return "0m 0s";
    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (days > 0) return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    return `${minutes}m ${seconds}s`;
  };

  const startTest = async () => {
    if (!agreedToTerms) {
      toast({ title: "Please agree to the terms", description: "You must agree to the test rules before starting.", variant: "destructive" }); return;
    }
    if (unlockDate && new Date(unlockDate) > new Date()) {
      setShowUnlockPopup(true);
      return;
    }
    try {
      await proctoring.prepare();
    } catch (error: any) {
      toast({ title: "Live monitoring required", description: error.message || "Please allow required monitoring permissions.", variant: "destructive" });
      return;
    }
    if (fullscreenEnabled) {
      const el = document.documentElement;
      (el.requestFullscreen?.() || (el as any).webkitRequestFullscreen?.() || (el as any).mozRequestFullScreen?.() || (el as any).msRequestFullscreen?.())?.catch?.(() => {});
    }
    setCurrentScreen(4); setLoading(true); initializeTest();
  };

  const initializeTest = async () => {
    try {
      const { data: td } = await supabase.from("tests").select("fullscreen_enabled").eq("id", testId).single();
      if (td) setFullscreenEnabled(td.fullscreen_enabled ?? true);
      const { data: startData, error: startError } = await supabase.functions.invoke("start-test", { body: { test_id: testId } });
      if (startError || startData?.error) throw new Error(startData?.error || startError?.message || "Failed to start test");
      setAttemptId(startData.attempt_id); setTestName(startData.test_name);
      await proctoring.start(startData.attempt_id, { test_name: startData.test_name, interface: "normal" });
      setTimeLeft(startData.remaining_seconds ?? startData.duration_minutes * 60);
      if (startData.fullscreen_exit_count) setFullscreenExitCount(startData.fullscreen_exit_count);
      if (startData.is_resume && startData.existing_answers) setAnswers(startData.existing_answers);
      const existingTimeMapRaw = (startData.is_resume && startData.existing_time_per_question)
        ? startData.existing_time_per_question
        : {};
      const numericTimeMap = Object.entries(existingTimeMapRaw || {}).reduce<Record<string, number>>((acc, [qid, value]) => {
        if (qid === VISITED_QUESTIONS_META_KEY) return acc;
        const numericValue = Number(value);
        if (Number.isFinite(numericValue)) acc[qid] = numericValue;
        return acc;
      }, {});
      setTimePerQuestion(numericTimeMap);
      const { data: qData, error: qErr } = await supabase.functions.invoke("get-test-questions", { body: { test_id: testId } });
      if (qErr || qData?.error) throw new Error(qData?.error || qErr?.message || "Failed to load questions");
      if (!qData.questions?.length) throw new Error("No questions found for this test");
      const allQ: Question[] = qData.questions;
      setQuestions(allQ);
      const secMap = new Map<string, { section: Section; questions: Question[] }>();
      allQ.forEach((q: Question) => {
        const subj = q.subject || "General";
        const qt = q.question_type || q.section_type || "single_choice";
        const label = qt === "single_choice" ? "SCQ" : qt === "multiple_choice" || qt === "multi" ? "MCQ" : qt === "integer" || qt === "numerical" ? "Integer" : "SCQ";
        const key = q.section_id ? `section-${q.section_id}` : `${subj}(${label})`;
        if (!secMap.has(key)) {
          secMap.set(key, {
            section: {
              id: q.section_id ? `section-${q.section_id}` : key.toLowerCase().replace(/[^a-z0-9]/g, "-"),
              name: q.section_id ? (q.chapter || `${subj} (${label})`) : `${subj}(${label})`,
              questions: [],
              section_type: q.section_type || q.question_type || "single_choice",
            },
            questions: [],
          });
        }
        secMap.get(key)!.questions.push(q);
      });
      const secList: Section[] = Array.from(secMap.values()).map(({ section, questions: qs }) => ({
        ...section,
        questions: qs.sort((a, b) => a.order - b.order),
        section_type: qs[0]?.section_type || qs[0]?.question_type || section.section_type || "single_choice",
      }));
      setSections(secList);
      if (secList.length) setActiveSection(secList[0].id);
      if (allQ.length) {
        const persistedVisited = Array.isArray(existingTimeMapRaw?.[VISITED_QUESTIONS_META_KEY])
          ? new Set((existingTimeMapRaw?.[VISITED_QUESTIONS_META_KEY] as string[]).filter(Boolean))
          : new Set<string>();
        let nextVisitedSet: Set<string>;

        if (startData.is_resume && persistedVisited.size > 0) {
          persistedVisited.add(allQ[0].id);
          nextVisitedSet = persistedVisited;
        } else if (startData.is_resume && startData.existing_answers) {
          // On resume: answered questions → visited (will show green via "answered" status)
          // Questions the user SAW but didn't answer → visited (will show red "not-answered")
          // Questions never seen → NOT visited (will show grey "not-visited" / white)
          // We only know which ones were answered, so mark only those as visited
          const answeredIds = new Set(
            Object.entries(startData.existing_answers)
              .filter(([_, v]) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && (v as any[]).length === 0))
              .map(([id]) => id)
          );
          // Also mark the first question as visited (since user will see it)
          answeredIds.add(allQ[0].id);
          nextVisitedSet = answeredIds;
        } else {
          nextVisitedSet = new Set([allQ[0].id]);
        }
        setVisitedQuestions(nextVisitedSet);
        await supabase
          .from("test_attempts")
          .update({ time_per_question: buildPersistedTimePayload(numericTimeMap, nextVisitedSet) })
          .eq("id", startData.attempt_id);
      }
      setLoading(false);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e.message || "Failed to start test.", variant: "destructive" });
      navigate("/tests");
    }
  };

  useEffect(() => {
    if (timeLeft <= 0 || loading || currentScreen !== 4) return;
    const t = setInterval(() => {
      setTimeLeft(p => { if (p <= 1) { clearInterval(t); setTimeExpired(true); return 0; } return p - 1; });
    }, 1000);
    return () => clearInterval(t);
  }, [loading, currentScreen]);

  useEffect(() => { if (timeExpired && attemptId && !submitting) handleSubmit(); }, [timeExpired]);

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const currentSection  = sections.find(s => s.id === activeSection);
  const currentQuestion = currentSection?.questions[currentQuestionIndex];
  const isMultipleChoice  = ["multiple_choice", "multi"].includes(currentQuestion?.question_type || "") || ["multiple_choice", "multi"].includes(currentQuestion?.section_type || "");
  const isIntegerQuestion = ["integer", "numerical"].includes(currentQuestion?.question_type || "");
  const currentQuestionId = currentQuestion?.id;

  useEffect(() => {
    if (!currentQuestionId || !proctoring.session?.id) return;
    proctoring.logEvent("question_change", {
      questionId: currentQuestionId,
      subjectName: currentQuestion?.subject || currentSection?.name,
      payload: { question_index: currentQuestionIndex + 1, section_id: activeSection },
    });
  }, [activeSection, currentQuestion?.subject, currentQuestionId, currentQuestionIndex, currentSection?.name, proctoring.session?.id]);

  useEffect(() => {
    if (!proctoring.session?.id || !currentSection?.name) return;
    proctoring.logEvent("subject_change", { subjectName: currentSection.name, payload: { section_id: currentSection.id } });
  }, [currentSection?.id, currentSection?.name, proctoring.session?.id]);

  const buildPersistedTimePayload = useCallback((nextTimeMap: Record<string, number>, nextVisitedQuestions: Set<string>) => ({
    ...nextTimeMap,
    [VISITED_QUESTIONS_META_KEY]: Array.from(nextVisitedQuestions),
  }), []);

  const cloneAnswerValue = (answer?: string | string[]) => Array.isArray(answer) ? [...answer] : answer;
  const normalizeAnswerValue = (answer?: string | string[]) => {
    if (Array.isArray(answer)) return answer.length > 0 ? [...answer] : undefined;
    if (typeof answer === "string") return answer === "" ? undefined : answer;
    return answer;
  };
  const isAnswerPresent = (answer?: string | string[]) => Array.isArray(answer) ? answer.length > 0 : answer !== undefined && answer !== "";
  const displayedCurrentAnswer = currentQuestionId && draftQuestionId === currentQuestionId
    ? draftAnswer
    : cloneAnswerValue(currentQuestionId ? answers[currentQuestionId] : undefined);

  useEffect(() => {
    if (!currentQuestionId) {
      setDraftQuestionId(null);
      setDraftAnswer(undefined);
      return;
    }

    setDraftQuestionId(currentQuestionId);
    setDraftAnswer(cloneAnswerValue(answers[currentQuestionId]));
  }, [currentQuestionId, answers]);

  useEffect(() => {
    if (!isIntegerQuestion) {
      setIntegerCursorPosition(0);
      return;
    }
    const currentValue = typeof displayedCurrentAnswer === "string" ? displayedCurrentAnswer : "";
    setIntegerCursorPosition(currentValue.length);
  }, [currentQuestionId, isIntegerQuestion]);

  /* single choice — only one option selectable, cannot deselect */
  const handleAnswer = (idx: number) => {
    if (!currentQuestion) return;
    setDraftQuestionId(currentQuestion.id);

    if (isMultipleChoice) {
      const cur = Array.isArray(displayedCurrentAnswer)
        ? displayedCurrentAnswer
        : displayedCurrentAnswer
          ? [displayedCurrentAnswer as string]
          : [];
      const s = String(idx);
      setDraftAnswer(cur.includes(s) ? cur.filter(a => a !== s) : [...cur, s]);
    } else {
      // single choice — just set, never deselect
      setDraftAnswer(String(idx));
    }
  };

  const handleIntegerAnswer = (v: string) => {
    if (!currentQuestion) return;
    setDraftQuestionId(currentQuestion.id);
    const cursor = Math.min(integerCursorPosition, v.length);
    const cleaned = v.replace(/[^0-9.-]/g, "");
    setDraftAnswer(cleaned);
    setIntegerCursorPosition(Math.min(cursor, cleaned.length));
  };

  const setIntegerAnswerWithCursor = (nextValue: string, nextCursor: number) => {
    if (!currentQuestion) return;
    setDraftQuestionId(currentQuestion.id);
    setDraftAnswer(nextValue);
    setIntegerCursorPosition(Math.max(0, Math.min(nextCursor, nextValue.length)));
  };

  const handleIntegerKeypadInsert = (token: string) => {
    const currentValue = typeof displayedCurrentAnswer === "string" ? displayedCurrentAnswer : "";
    const cursor = Math.max(0, Math.min(integerCursorPosition, currentValue.length));
    const nextValue = `${currentValue.slice(0, cursor)}${token}${currentValue.slice(cursor)}`;
    setIntegerAnswerWithCursor(nextValue, cursor + token.length);
  };

  const handleIntegerKeypadBackspace = () => {
    const currentValue = typeof displayedCurrentAnswer === "string" ? displayedCurrentAnswer : "";
    if (!currentValue) return;
    const nextValue = currentValue.slice(0, -1);
    setIntegerAnswerWithCursor(nextValue, Math.min(integerCursorPosition, nextValue.length));
  };

  const moveIntegerCursor = (direction: "left" | "right") => {
    const currentValue = typeof displayedCurrentAnswer === "string" ? displayedCurrentAnswer : "";
    setIntegerCursorPosition((prev) => {
      if (direction === "left") return Math.max(0, prev - 1);
      return Math.min(currentValue.length, prev + 1);
    });
  };

  const clearIntegerAnswer = () => setIntegerAnswerWithCursor("", 0);

  const clearResponse = () => {
    if (!currentQuestion) return;
    setDraftQuestionId(currentQuestion.id);
    setDraftAnswer(undefined);
  };

  const buildCurrentTimeSnapshot = useCallback(() => {
    if (!currentQuestion) return timePerQuestion;

    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - questionStartTime) / 1000));
    if (elapsedSeconds === 0) return timePerQuestion;

    return {
      ...timePerQuestion,
      [currentQuestion.id]: (timePerQuestion[currentQuestion.id] || 0) + elapsedSeconds,
    };
  }, [currentQuestion, questionStartTime, timePerQuestion]);

  const commitCurrentQuestionTime = useCallback(() => {
    const nextTimeMap = buildCurrentTimeSnapshot();
    setTimePerQuestion(nextTimeMap);
    setQuestionStartTime(Date.now());
    return nextTimeMap;
  }, [buildCurrentTimeSnapshot]);

  const enqueueAttemptUpdate = useCallback((payload: AttemptProgressPayload) => {
    if (!attemptId) return Promise.resolve();

    const requestId = ++persistSequenceRef.current;
    setIsSaving(true);

    const nextRequest = persistQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const { error } = await supabase.from("test_attempts").update(payload).eq("id", attemptId);
        if (error) throw error;
      })
      .catch((error) => {
        console.error("Failed to save progress:", error);
      })
      .finally(() => {
        if (persistSequenceRef.current === requestId) {
          setIsSaving(false);
        }
      });

    persistQueueRef.current = nextRequest;
    return nextRequest;
  }, [attemptId]);

  useEffect(() => {
    if (currentScreen !== 4 || !attemptId || loading) return;
    const i = setInterval(() => {
      const nextTimeMap = buildCurrentTimeSnapshot();
      void enqueueAttemptUpdate({ time_per_question: buildPersistedTimePayload(nextTimeMap, visitedQuestions) });
    }, 10000);
    return () => clearInterval(i);
  }, [currentScreen, attemptId, loading, buildCurrentTimeSnapshot, enqueueAttemptUpdate, buildPersistedTimePayload, visitedQuestions]);

  const buildCommittedAnswers = useCallback(() => {
    if (!currentQuestion) return answers;

    const nextAnswers = { ...answers };
    const normalizedDraft = normalizeAnswerValue(displayedCurrentAnswer);

    if (normalizedDraft === undefined) delete nextAnswers[currentQuestion.id];
    else nextAnswers[currentQuestion.id] = normalizedDraft;

    return nextAnswers;
  }, [answers, currentQuestion, displayedCurrentAnswer]);

  const commitCurrentQuestionProgress = useCallback(async (options: { markForReview?: boolean; nextVisitedQuestions?: Set<string> } = {}) => {
    if (!currentQuestion) return;

    const nextAnswers = buildCommittedAnswers();
    const nextTimeMap = commitCurrentQuestionTime();

    if (options.markForReview) {
      setMarkedForReview(prev => {
        const next = new Set(prev);
        next.add(currentQuestion.id);
        return next;
      });
    }

    setAnswers(nextAnswers);
    await enqueueAttemptUpdate({ answers: nextAnswers, time_per_question: buildPersistedTimePayload(nextTimeMap, options.nextVisitedQuestions || visitedQuestions) });
  }, [buildCommittedAnswers, commitCurrentQuestionTime, currentQuestion, enqueueAttemptUpdate, buildPersistedTimePayload, visitedQuestions]);

  const navigateWithoutSavingAnswer = useCallback((navigateFn: () => void, nextVisitedQuestions?: Set<string>) => {
    const nextTimeMap = commitCurrentQuestionTime();
    void enqueueAttemptUpdate({ time_per_question: buildPersistedTimePayload(nextTimeMap, nextVisitedQuestions || visitedQuestions) });
    navigateFn();
  }, [commitCurrentQuestionTime, enqueueAttemptUpdate, buildPersistedTimePayload, visitedQuestions]);

  /* Commit answers only on explicit save actions */
  const getNextQuestionId = () => {
    if (!currentSection) return null;
    if (currentQuestionIndex < currentSection.questions.length - 1) {
      return currentSection.questions[currentQuestionIndex + 1]?.id || null;
    }
    const currentSectionIndex = sections.findIndex(s => s.id === activeSection);
    if (currentSectionIndex >= 0 && currentSectionIndex < sections.length - 1) {
      return sections[currentSectionIndex + 1]?.questions?.[0]?.id || null;
    }
    return null;
  };

  const saveAndNext = async () => {
    const nextQuestionId = getNextQuestionId();
    const nextVisited = new Set(visitedQuestions);
    if (nextQuestionId) nextVisited.add(nextQuestionId);
    await commitCurrentQuestionProgress({ nextVisitedQuestions: nextVisited });
    goToNextQuestion();
  };

  const markForReviewAndNext = async () => {
    const nextQuestionId = getNextQuestionId();
    const nextVisited = new Set(visitedQuestions);
    if (nextQuestionId) nextVisited.add(nextQuestionId);
    await commitCurrentQuestionProgress({ markForReview: true, nextVisitedQuestions: nextVisited });
    goToNextQuestion();
  };

  const goToNextQuestion = () => {
    if (!currentSection) return;
    if (currentQuestionIndex < currentSection.questions.length - 1) {
      const ni = currentQuestionIndex + 1; setCurrentQuestionIndex(ni);
      const nq = currentSection.questions[ni];
      if (nq) setVisitedQuestions(p => new Set([...p, nq.id]));
    } else {
      const ci = sections.findIndex(s => s.id === activeSection);
      if (ci < sections.length - 1) {
        const ns = sections[ci + 1]; setActiveSection(ns.id); setCurrentQuestionIndex(0);
        if (ns.questions[0]) setVisitedQuestions(p => new Set([...p, ns.questions[0].id]));
      }
    }
  };

  const handleSubmit = useCallback(async (fromMax = false) => {
    if (!attemptId || submitting) return;
    setSubmitting(true);
    try {
      const nextTimeMap = buildCurrentTimeSnapshot();
      setTimePerQuestion(nextTimeMap);
      await enqueueAttemptUpdate({ time_per_question: buildPersistedTimePayload(nextTimeMap, visitedQuestions) });

      const { data, error } = await supabase.functions.invoke("submit-test", {
        body: { attempt_id: attemptId, answers, time_taken_seconds: Math.max(1, (testDuration * 60) - timeLeft), fullscreen_exit_count: fullscreenExitCount },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Failed to submit test");
      await proctoring.stop(fromMax ? "max_fullscreen_exits" : "submitted");
      navigate(`/test/${testId}/analysis`, { state: { results: data, testName } });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e.message || "Failed to submit test.", variant: "destructive" });
      setSubmitting(false);
    }
  }, [attemptId, answers, timeLeft, testId, testName, navigate, submitting, fullscreenExitCount, buildCurrentTimeSnapshot, enqueueAttemptUpdate, testDuration, buildPersistedTimePayload, visitedQuestions]);

  const handleFullscreenExitCountChange = useCallback((count: number) => {
    setFullscreenExitCount(count);
    if (attemptId) supabase.from("test_attempts").update({ fullscreen_exit_count: count }).eq("id", attemptId).then(({ error }) => { if (error) console.error(error); });
    proctoring.logEvent("fullscreen_exit", { payload: { count } });
  }, [attemptId, proctoring]);

  const handleMaxFullscreenExits = useCallback(() => {
    toast({ title: "Test Auto-Submitted", description: "You exceeded the maximum allowed fullscreen exits.", variant: "destructive" });
    handleSubmit(true);
  }, [handleSubmit]);

  const getQuestionStatus = (qid: string) => {
    if (currentQuestion?.id === qid) return "current";
    if (markedForReview.has(qid) && isAnswerPresent(answers[qid])) return "answered-marked";
    if (markedForReview.has(qid)) return "marked";
    if (isAnswerPresent(answers[qid])) return "answered";
    if (visitedQuestions.has(qid)) return "not-answered";
    return "not-visited";
  };

  const getStatusCounts = (filterSection?: Section) => {
    const qs = filterSection ? filterSection.questions : questions;
    const answered       = qs.filter(q => isAnswerPresent(answers[q.id])).length;
    const notAnswered    = qs.filter(q => visitedQuestions.has(q.id) && !isAnswerPresent(answers[q.id])).length;
    const markedCount    = qs.filter(q => markedForReview.has(q.id)).length;
    const answeredMarked = qs.filter(q => markedForReview.has(q.id) && isAnswerPresent(answers[q.id])).length;
    const notVisited     = qs.filter(q => !visitedQuestions.has(q.id)).length;
    return { answered, notAnswered, markedCount, answeredMarked, notVisited };
  };

  const options = Array.isArray(currentQuestion?.options)
    ? currentQuestion.options.map((o: any) => typeof o === "object" && o !== null ? { text: o.text || o.label || "", image_url: o.image_url || null } : { text: o, image_url: null }).filter((o: any) => o.text?.trim())
    : typeof currentQuestion?.options === "object" && currentQuestion?.options !== null
      ? Object.values(currentQuestion.options as Record<string, any>).map((o: any) => typeof o === "object" && o !== null ? { text: o.text || o.label || "", image_url: o.image_url || null } : { text: o, image_url: null }).filter((o: any) => o.text?.trim())
      : [];

  /* ── LOADING ── */
  if (loading && currentScreen === 4) {
    return (
      <div style={{ minHeight: "100vh", background: "#eaf0f7", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, fontFamily: "Arial,sans-serif" }}>
        <Loader2 style={{ width: 48, height: 48, color: C.secActive }} className="animate-spin" />
        <p style={{ color: "#555" }}>Loading test, please wait…</p>
      </div>
    );
  }

  /* ════════════════════════════════════════════
     SHARED HEADER — screens 1–3
  ════════════════════════════════════════════ */
  const renderHeader = () => (
    <>
      <div style={{ height: 40, background: C.blueStripe }} />
      <div style={{ background: C.headerGrey, display: "flex", alignItems: "stretch" }}>
        <div style={{ flex: 1, padding: "10px 16px", fontFamily: "Arial,sans-serif", color: "#fff" }}>
          <div style={{ fontSize: 13, color: "#ccc" }}>System Name :</div>
          <div style={{ fontSize: 30, fontWeight: "bold", color: C.yellow, lineHeight: 1.2, letterSpacing: 1 }}>{systemId || "C001"}</div>
          <div style={{ fontSize: 11, color: "#ccc", marginTop: 5 }}>Kindly contact the invigilator if there are any discrepancies in the Name and Photograph displayed on the screen or if the photograph is not yours</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", padding: "10px 0" }}>
          <div style={{ textAlign: "right", paddingRight: 12, fontFamily: "Arial,sans-serif" }}>
            <div style={{ fontSize: 13, color: "#ccc" }}>Candidate Name :</div>
            <div style={{ fontSize: 26, fontWeight: "bold", color: C.yellow }}>{studentName}</div>
            <div style={{ fontSize: 13, color: "#ccc" }}>Subject : <span style={{ color: C.yellow }}>{testName}</span></div>
          </div>
          <div style={{ width: 76, height: 88, border: "3px solid #ccc", background: "#d8d8d8", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {studentAvatar ? <img data-a11y-preserve-img src={studentAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 46 }}>👤</span>}
          </div>
        </div>
      </div>
    </>
  );

  /* ════════════════════════════════════════════
     SCREEN 1 — Login
  ════════════════════════════════════════════ */
  if (currentScreen === 1) {
    return (
      <div style={{ minHeight: "100vh", background: "#fff", display: "flex", flexDirection: "column", fontFamily: "Arial,sans-serif" }}>
        {renderHeader()}
        <div style={{ flex: 1, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 370, background: C.loginCard, border: "1px solid #bbb", boxShadow: "2px 2px 8px rgba(0,0,0,.18)", borderRadius: 2 }}>
            <div style={{ background: C.loginHdr, padding: "8px 14px", borderBottom: "1px solid #bbb", fontSize: 13, fontWeight: "bold", color: "#333" }}>Login</div>
            <div style={{ padding: "18px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 10 }}>
                <div style={{ width: 40, height: 36, background: "#d0d0d0", border: "1px solid #aaa", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#555", flexShrink: 0 }}>👤</div>
                <input type="text" value={studentRollNumber} disabled readOnly style={{ flex: 1, height: 36, padding: "0 8px", border: "1px solid #bbb", background: "#f5f5f5", fontSize: 13, color: "#444", outline: "none" }} />
                <div style={{ width: 40, height: 36, background: "#d0d0d0", border: "1px solid #aaa", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#555", cursor: "pointer", flexShrink: 0 }}>⌨</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 22 }}>
                <div style={{ width: 40, height: 36, background: "#d0d0d0", border: "1px solid #aaa", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#555", flexShrink: 0 }}>🔒</div>
                <input type="password" value="•••••" disabled readOnly style={{ flex: 1, height: 36, padding: "0 8px", border: "1px solid #bbb", background: "#f5f5f5", fontSize: 13, color: "#666", outline: "none" }} />
                <div style={{ width: 40, height: 36, background: "#d0d0d0", border: "1px solid #aaa", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#555", cursor: "pointer", flexShrink: 0 }}>⌨</div>
              </div>
              <button onClick={() => setCurrentScreen(2)} style={{ width: "100%", height: 44, background: C.signInBlue, border: "none", color: "#fff", fontSize: 16, fontWeight: "bold", cursor: "pointer", borderRadius: 2 }}>
                Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════
     SCREEN 2 — General Instructions
  ════════════════════════════════════════════ */
  if (currentScreen === 2) {
    return (
      <div style={{ minHeight: "100vh", background: "#fff", display: "flex", flexDirection: "column", fontFamily: "Arial,sans-serif" }}>
        <div style={{ height: 40, background: C.blueStripe }} />
        <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ background: C.instHdr, padding: "7px 16px", fontSize: 14, fontWeight: "bold", color: "#222", borderBottom: "1px solid #90c0d8" }}>Instructions</div>
            <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px", fontSize: 13, color: "#1a1a1a", lineHeight: 1.85, background: "#fff" }}>
              <p style={{ fontWeight: "bold", fontSize: 14 }}>Please read the instructions carefully</p>
              <p style={{ color: "#cc2200", fontWeight: "bold", fontSize: 13, marginTop: 3 }}>This Mock Exam Only for Practice Purpose</p>
              <p style={{ fontWeight: "bold", textDecoration: "underline", marginTop: 24, marginBottom: 10, fontSize: 13 }}>General Instructions:</p>
              <ol style={{ marginLeft: 22, lineHeight: 2.1 }}>
                <li>Total duration of examination is <strong>{testDuration || 180} minutes</strong>.</li>
                <li>The clock will be set at the server. The countdown timer in the top right corner of screen will display the remaining time available for you to complete the examination. When the timer reaches zero, the examination will end by itself. You will not be required to end or submit your examination.</li>
                <li>The Question Palette displayed on the right side of screen will show the status of each question using one of the following symbols:</li>
              </ol>
              <div style={{ marginLeft: 30, marginTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  { bg: C.palGrey,   br: "4px", border: "1px solid #aaa", color: "#555", label: "You have not visited the question yet.", num: 1 },
                  { bg: C.palRed,    br: "50%", border: "none",           color: "#fff", label: "You have not answered the question.", num: 2 },
                  { bg: C.palGreen,  br: "50%", border: "none",           color: "#fff", label: "You have answered the question.", num: 3 },
                  { bg: C.palPurple, br: "50%", border: "none",           color: "#fff", label: "You have NOT answered the question, but have marked the question for review.", num: 4 },
                ].map(item => (
                  <div key={item.num} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 28, height: 28, background: item.bg, borderRadius: item.br, border: item.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: "bold", color: item.color, flexShrink: 0 }}>{item.num}</div>
                    <span>{item.label}</span>
                  </div>
                ))}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ position: "relative", width: 28, height: 28, background: C.palPurple, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: "bold", color: "#fff", flexShrink: 0 }}>
                    5
                    <span style={{ position: "absolute", bottom: -2, right: -2, width: 10, height: 10, background: C.palGreen, borderRadius: "50%", border: "2px solid #fff" }} />
                  </div>
                  <span>The question(s) "Answered and Marked for Review" will be considered for evaluation.</span>
                </div>
              </div>
              <p style={{ marginTop: 16, fontSize: 12, color: "#555" }}>The Marked for Review status for a question simply indicates that you would like to look at that question again.</p>
            </div>
            <div style={{ padding: "10px 16px", borderTop: "1px solid #ddd", display: "flex", justifyContent: "flex-end", background: "#fff" }}>
              <button onClick={() => setCurrentScreen(3)} style={{ padding: "6px 22px", background: "#fff", border: "1px solid #999", fontSize: 13, cursor: "pointer", color: "#333" }}>
                Next &gt;
              </button>
            </div>
          </div>
          <div style={{ width: 190, borderLeft: "2px solid #000", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 26 }}>
            <div style={{ width: 100, height: 112, background: "#e0e0e0", border: "2px solid #aaa", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              {studentAvatar ? <img data-a11y-preserve-img src={studentAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 54 }}>👤</span>}
            </div>
            <p style={{ fontSize: 13, fontWeight: "bold", color: "#1a1a1a", textAlign: "center", padding: "0 8px" }}>{studentName}</p>
          </div>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════
     SCREEN 3 — Other Important Instructions (JEE)
  ════════════════════════════════════════════ */
  if (currentScreen === 3) {
    return (
      <div style={{ minHeight: "100vh", background: "#fff", display: "flex", flexDirection: "column", fontFamily: "Arial,sans-serif" }}>
        <div style={{ height: 40, background: C.blueStripe }} />
        <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ background: C.instHdr, padding: "7px 16px", fontSize: 14, fontWeight: "bold", color: "#222", borderBottom: "1px solid #90c0d8" }}>Other Important Instructions</div>
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px", fontSize: 13, color: "#1a1a1a", lineHeight: 1.9, background: "#fff" }}>
              <p style={{ textAlign: "center", fontWeight: "bold", marginBottom: 20 }}>General instructions:</p>
              <p style={{ fontWeight: "bold" }}>The motive for enabling this mock SAMPLE test is to familiarize the candidates with the Computer Based Test (CBT) environment of the JEE Main conducted by NTA.</p>
              <br />
              <p style={{ fontWeight: "bold" }}>The types of questions and marking scheme is only illustrative and is in no way indicative or representative of the actual JEE Main question paper.</p>
              <br />
              <p style={{ fontWeight: "bold" }}>Section wise Instructions</p>
              <br />
              <p style={{ fontWeight: "bold" }}>Note: There will be 25% negative marking for MCQ (Section A) only. No negative marking for Integer type (Section B).</p>
              <p style={{ fontWeight: "bold" }}>SECTION A: Multiple Choice Questions — Each question has 4 options, only 1 is correct.<br />+4 for correct answer, –1 for wrong answer, 0 for unattempted.</p>
              <br />
              <p style={{ fontWeight: "bold" }}>SECTION B: Integer / Numerical Value Questions — Enter a numerical answer.<br />+4 for correct answer, 0 for wrong or unattempted.</p>
              <br />
              <p style={{ fontWeight: "bold" }}>No clarification will be provided during the exam.</p>
              <br />
              <p style={{ fontWeight: "bold" }}>Calculators and other electronic devices are not allowed during the exam. Rough sheets and pens will be provided in the exam center. A virtual on-screen calculator is available for use.</p>
              <br />
              <p style={{ fontWeight: "bold" }}>Some questions may have more than one answer correct. Points will be given only when <span style={{ textDecoration: "underline" }}>ALL</span> the correct answers are marked and <span style={{ textDecoration: "underline" }}>NONE</span> of the incorrect are marked.</p>
            </div>
            <div style={{ borderTop: "1px solid #ddd", background: "#fff" }}>
              <div style={{ padding: "10px 20px 10px", display: "flex", alignItems: "flex-start", gap: 8, borderBottom: "1px solid #ddd" }}>
                <input type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} style={{ marginTop: 3, width: 14, height: 14, flexShrink: 0, cursor: "pointer" }} />
                <span style={{ fontSize: 11.5, color: "#333", lineHeight: 1.65 }}>
                  I have read and understood the instructions. All computer hardware allotted to me are in proper working condition. I declare that I am not in possession of / not wearing / not carrying any prohibited gadget like mobile phone, bluetooth devices etc. /any prohibited material with me into the Examination Hall. I agree that in case of not adhering to the instructions, I shall be liable to be debarred from this Test and/or to disciplinary action, which may include ban from future Tests / Examinations
                </span>
              </div>
              <div style={{ padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button onClick={() => setCurrentScreen(2)} style={{ padding: "7px 18px", background: "#fff", border: "1px solid #888", fontSize: 13, cursor: "pointer", color: "#333" }}>
                  &lt; Previous
                </button>
                <button onClick={startTest} disabled={!agreedToTerms || loading}
                  style={{ padding: "9px 30px", background: agreedToTerms ? "#5ba3d9" : "#9ab8cc", border: "none", color: "#fff", fontSize: 14, fontWeight: "bold", cursor: agreedToTerms ? "pointer" : "not-allowed", borderRadius: 2 }}>
                  {loading ? "Loading…" : "I am ready to begin"}
                </button>
              </div>
            </div>
          </div>
          <div style={{ width: 190, borderLeft: "2px solid #000", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 26 }}>
            <div style={{ width: 100, height: 112, background: "#e0e0e0", border: "2px solid #aaa", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              {studentAvatar ? <img data-a11y-preserve-img src={studentAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 54 }}>👤</span>}
            </div>
            <p style={{ fontSize: 13, fontWeight: "bold", color: "#1a1a1a", textAlign: "center", padding: "0 8px" }}>{studentName}</p>
          </div>
        </div>
        <AnimatePresence>
          {showUnlockPopup && unlockDate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
              onClick={() => setShowUnlockPopup(false)}
            >
              <motion.div
                initial={{ scale: .95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: .95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                style={{ background: "#fff", border: "1px solid #bbb", borderRadius: 4, padding: 20, width: 420, maxWidth: "90vw", fontFamily: "Arial,sans-serif", boxShadow: "0 8px 32px rgba(0,0,0,.25)" }}
              >
                <div style={{ borderBottom: "2px solid #2979c5", paddingBottom: 8, marginBottom: 12, fontSize: 15, fontWeight: "bold", color: "#1a3a5c" }}>
                  Test not released yet
                </div>
                <p style={{ fontSize: 13, color: "#333", lineHeight: 1.6 }}>
                  This test will start in <strong>{getTimeUntilRelease(unlockDate)}</strong>.
                </p>
                <p style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
                  Release time: {new Date(unlockDate).toLocaleString()}
                </p>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                  <button
                    onClick={() => setShowUnlockPopup(false)}
                    style={{ padding: "8px 20px", background: "#fff", border: "1px solid #aaa", fontSize: 13, cursor: "pointer", borderRadius: 2, color: "#333" }}
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  /* ════════════════════════════════════════════
     SCREEN 4 — MAIN TEST
  ════════════════════════════════════════════ */
  const sc = getStatusCounts();

  const testContent = (
    <div data-test-content style={{ height: "100vh", display: "flex", flexDirection: "column", fontFamily: "Arial,sans-serif", fontSize: 13, overflow: "hidden", background: "#f5f5f5" }}>

      {/* ── ROW 1: Full-width dark top bar ── */}
      <div style={{ background: C.topbarDark, color: "#fff", height: 32, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", flexShrink: 0, zIndex: 10 }}>
        <span style={{ fontSize: 13, fontWeight: "bold", color: "#fff" }}>PHYNETIX</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button style={{ background: "transparent", border: "none", color: "#aaccee", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{ width: 15, height: 15, background: C.secActive, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9, fontWeight: "bold", flexShrink: 0 }}>i</span>
            Instructions
          </button>
          <button style={{ background: "transparent", border: "none", color: "#aaccee", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{ width: 15, height: 15, background: C.palGreen, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9, flexShrink: 0 }}>≡</span>
            Question Paper
          </button>
          <AccessibilityToolbar />
        </div>
      </div>

      {/* ── BODY: left column + sidebar ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── LEFT COLUMN ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* ROW 2: Test name + i tooltip + Time Left — left area only */}
          <div style={{ background: C.sectionTabBg, borderBottom: "1px solid #ccc", padding: "4px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, position: "relative" }}>
              <span style={{ fontSize: 13, fontWeight: "bold", color: "#111" }}>{testName}</span>
              <button
                onMouseEnter={() => setHoveredTestTooltip(true)}
                onMouseLeave={() => setHoveredTestTooltip(false)}
                aria-label="View test status summary"
                style={{ width: 16, height: 16, borderRadius: "50%", border: "none", background: C.secActive, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
              >
                <Info size={10} />
              </button>
              <StatusTooltip counts={{ answered: sc.answered, notAnswered: sc.notAnswered, notVisited: sc.notVisited, marked: sc.markedCount, answeredMarked: sc.answeredMarked }} visible={hoveredTestTooltip} />
            </div>
            <span style={{ fontSize: 13, fontWeight: "bold", color: timeLeft < 300 ? "#cc0000" : "#000" }}>
              Time Left : {formatTime(timeLeft)}
            </span>
          </div>

          {/* ROW 3: Sections + ◀ subject pills ▶ — left area only */}
          <div style={{ background: "#fff", borderBottom: "1px solid #ccc", padding: "3px 8px", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: "#555", fontWeight: "bold", flexShrink: 0 }}>Sections</span>
            <button style={{ width: 20, height: 20, background: "#e0e0e0", border: "1px solid #bbb", cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, color: "#333", flexShrink: 0 }}>◀</button>
            {/* Scrollable section pills */}
            <div style={{ display: "flex", gap: 4, overflowX: "auto", flex: 1, scrollbarWidth: "none" }}>
              {sections.map(sec => {
                const secCounts = getStatusCounts(sec);
                return (
                  <div key={sec.id} style={{ position: "relative", flexShrink: 0 }}
                    onMouseEnter={() => setHoveredSectionTooltip(sec.id)}
                    onMouseLeave={() => setHoveredSectionTooltip(null)}>
                    <button
                      onClick={() => {
                        const firstQ = sec.questions[0];
                        const nextVisited = new Set(visitedQuestions);
                        if (firstQ) nextVisited.add(firstQ.id);
                        navigateWithoutSavingAnswer(() => {
                          setActiveSection(sec.id);
                          setCurrentQuestionIndex(0);
                          if (firstQ) setVisitedQuestions(nextVisited);
                        }, nextVisited);
                      }}
                      style={{ display: "flex", alignItems: "center", gap: 3, padding: "4px 12px", border: "1px solid", borderColor: activeSection === sec.id ? "#1a60b0" : "#b0c8e0", borderRadius: 3, background: activeSection === sec.id ? C.secActive : C.secInactive, color: activeSection === sec.id ? "#fff" : "#1a1a1a", fontSize: 12, fontWeight: "bold", cursor: "pointer", whiteSpace: "nowrap" }}>
                      {sec.name}
                      <span style={{ width: 14, height: 14, background: activeSection === sec.id ? "rgba(255,255,255,.3)" : C.secActive, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9, fontWeight: "bold" }}>i</span>
                    </button>
                    <StatusTooltip counts={{ answered: secCounts.answered, notAnswered: secCounts.notAnswered, notVisited: secCounts.notVisited, marked: secCounts.markedCount, answeredMarked: secCounts.answeredMarked }} visible={hoveredSectionTooltip === sec.id} />
                  </div>
                );
              })}
            </div>
            <button style={{ width: 20, height: 20, background: "#e0e0e0", border: "1px solid #bbb", cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, color: "#333", flexShrink: 0 }}>▶</button>
          </div>

          {/* Question area */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px", background: "#fff" }}>

            <div style={{ fontWeight: "bold", fontSize: 13, marginBottom: 12, color: "#000" }}>
              Question No. {currentQuestionIndex + 1}
            </div>

            {currentQuestion?.paragraph_text && (
              <div style={{ marginBottom: 14, padding: "10px 14px", background: "#fffde7", border: "1px solid #f0c040", fontSize: 13, lineHeight: 1.7 }}>
                <div style={{ fontSize: 10, fontWeight: "bold", color: "#9a6500", marginBottom: 5, textTransform: "uppercase" }}>Paragraph</div>
                <LatexRenderer content={currentQuestion.paragraph_text} />
                {currentQuestion.paragraph_image_urls?.map((img, i) => (
                  <img key={i} src={img} alt="" style={{ maxWidth: "100%", marginTop: 6, border: "none", display: "block" }} />
                ))}
              </div>
            )}

            {(() => {
              const imgs = currentQuestion?.image_urls?.length ? currentQuestion.image_urls : currentQuestion?.image_url ? [currentQuestion.image_url] : [];
              return imgs.length > 0 && <div style={{ marginBottom: 10 }}>{imgs.map((u, i) => <img key={i} src={u} alt="" style={{ maxWidth: "100%", border: "none", marginBottom: 0, display: "block" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />)}</div>;
            })()}

            {currentQuestion?.question_text && (
              <div style={{ fontSize: 14, lineHeight: 1.85, color: "#000", marginBottom: 16 }}>
                <LatexRenderer content={currentQuestion.question_text} />
              </div>
            )}

            {/* Options */}
            {isIntegerQuestion ? (
              <div style={{ marginTop: 10, width: 180 }}>
                <div style={{ fontSize: 13, color: "#444", marginBottom: 8 }}>Enter your answer (integer only):</div>
                <input
                  type="text"
                  inputMode={isMobileDevice ? "none" : "decimal"}
                  readOnly={isMobileDevice}
                  value={typeof displayedCurrentAnswer === "string" ? displayedCurrentAnswer : ""}
                  onChange={e => handleIntegerAnswer(e.target.value)}
                  onClick={(e) => {
                    const target = e.target as HTMLInputElement;
                    const nextCursor = target.selectionStart ?? target.value.length;
                    setIntegerCursorPosition(Math.min(nextCursor, target.value.length));
                  }}
                  onSelect={(e) => {
                    const target = e.target as HTMLInputElement;
                    const nextCursor = target.selectionStart ?? target.value.length;
                    setIntegerCursorPosition(Math.min(nextCursor, target.value.length));
                  }}
                  placeholder="Type answer"
                  style={{ padding: "8px 12px", border: "2px solid #888", width: "100%", fontSize: 16, fontFamily: "monospace", textAlign: "center", outline: "none", background: "#ffffff", color: "#000", borderRadius: 6, boxSizing: "border-box" }}
                />
                <div style={{ marginTop: 8, background: "#eef3f9", border: "1px solid #d2dce8", borderRadius: 8, padding: 8, width: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 6 }}>
                  <button type="button" onClick={handleIntegerKeypadBackspace} style={{ width: "100%", height: 34, border: "1px solid #b8c5d8", borderRadius: 6, background: "#f8fbff", fontWeight: "bold", cursor: "pointer", color: "#000" }}>
                    Backspace
                  </button>
                  {[
                    ["7", "8", "9"],
                    ["4", "5", "6"],
                    ["1", "2", "3"],
                    ["0", ".", "-"],
                  ].map((row, rowIndex) => (
                    <div key={rowIndex} style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
                      {row.map((key) => (
                        <button key={key} type="button" onClick={() => handleIntegerKeypadInsert(key)} style={{ width: "100%", height: 34, border: "1px solid #b8c5d8", borderRadius: 6, background: "#f8fbff", cursor: "pointer", fontWeight: 600, color: "#000" }}>
                          {key}
                        </button>
                      ))}
                    </div>
                  ))}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
                    <button type="button" onClick={() => moveIntegerCursor("left")} style={{ width: "100%", height: 34, border: "1px solid #b8c5d8", borderRadius: 6, background: "#f8fbff", cursor: "pointer", fontWeight: 600, color: "#000" }}>
                      ←
                    </button>
                    <button type="button" onClick={() => moveIntegerCursor("right")} style={{ width: "100%", height: 34, border: "1px solid #b8c5d8", borderRadius: 6, background: "#f8fbff", cursor: "pointer", fontWeight: 600, color: "#000" }}>
                      →
                    </button>
                  </div>
                  <button type="button" onClick={clearIntegerAnswer} style={{ width: "100%", height: 34, border: "1px solid #b8c5d8", borderRadius: 6, background: "#f8fbff", cursor: "pointer", fontWeight: "bold", color: "#000" }}>
                    Clear All
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {options.map((opt, idx) => {
                  const optStr = String(idx);
                  const curAns = displayedCurrentAnswer;
                  const selected = isMultipleChoice
                    ? Array.isArray(curAns) && curAns.includes(optStr)
                    : curAns === optStr;
                  return (
                    <label key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                      {/* Custom radio — white bg + dark border unselected, blue fill selected */}
                      <div
                        onClick={() => handleAnswer(idx)}
                        style={{
                          width: 18, height: 18, borderRadius: "50%",
                          border: selected ? `2px solid #1a73e8` : `2px solid #333`,
                          background: selected ? "#1a73e8" : "#ffffff",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0, marginTop: 3, cursor: "pointer", boxSizing: "border-box",
                          transition: "border-color .1s, background .1s",
                        }}>
                        {selected && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
                      </div>
                      <div style={{ flex: 1, fontSize: 14, lineHeight: 1.75, color: "#000" }} onClick={() => handleAnswer(idx)}>
                        <LatexRenderer content={opt.text} />
                        {opt.image_url && (
                          <img src={opt.image_url} alt="" style={{ maxWidth: "100%", marginTop: 6, border: "none", display: "block" }}
                            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── BOTTOM ACTION BAR ──
              [Mark for Review & Next] [Clear Response]  spacer  [Save & Next]
          */}
          <div style={{ background: C.bottomBg, borderTop: "2px solid #c8c8c8", padding: "7px 10px", display: "flex", alignItems: "center", flexShrink: 0 }}>
            <button onClick={markForReviewAndNext}
              style={{ padding: "8px 16px", background: "#fff", border: "1px solid #888", fontSize: 13, cursor: "pointer", borderRadius: 2, marginRight: 8, color: "#333" }}>
              Mark for Review &amp; Next
            </button>
            <button onClick={clearResponse}
              style={{ padding: "8px 14px", background: "#fff", border: "1px solid #888", fontSize: 13, cursor: "pointer", borderRadius: 2, color: "#333" }}>
              Clear Response
            </button>
            <div style={{ flex: 1 }} />
            <button onClick={saveAndNext}
              style={{ padding: "8px 22px", background: "#fff", border: "1px solid #888", fontSize: 13, fontWeight: "bold", cursor: "pointer", borderRadius: 2, marginRight: 8, color: "#333" }}>
              Save &amp; Next
            </button>
          </div>
        </div>

        {/* ── Mobile palette toggle button ── */}
        <button
          onClick={() => setShowPalette(p => !p)}
          style={{
            display: "none", position: "fixed", bottom: 70, right: 10, zIndex: 9998,
            width: 40, height: 40, borderRadius: "50%", background: C.secActive,
            border: "none", color: "#fff", fontSize: 11, fontWeight: "bold",
            cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,.3)",
            alignItems: "center", justifyContent: "center",
          }}
          className="mobile-palette-toggle"
        >
          {showPalette ? "✕" : "Q"}
        </button>
        <style>{`
          @media (max-width: 768px) {
            .mobile-palette-toggle { display: flex !important; }
          }
        `}</style>

        {/* ── SIDEBAR — starts from below Row 1, full height ── */}
        <div className="test-sidebar" style={{
          width: 235, background: C.sidebarBg, display: "flex", flexDirection: "column",
          overflow: "hidden", flexShrink: 0, borderLeft: "1px solid #bbb",
        }}>
          <style>{`
            @media (max-width: 768px) {
              .test-sidebar {
                position: fixed !important; top: 0 !important; right: 0 !important;
                bottom: 0 !important; z-index: 9997 !important;
                box-shadow: -4px 0 16px rgba(0,0,0,.25) !important;
                display: ${showPalette ? 'flex' : 'none'} !important;
              }
            }
          `}</style>

          {/* Candidate photo + name */}
          <div style={{ background: "#fff", borderBottom: "1px solid #ccc", padding: "10px 8px", display: "flex", flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{ fontSize: 13, fontWeight: "bold", color: "#111", textAlign: "left", flex: 1 }}>{studentName}</div>
            <div style={{ width: 82, height: 92, background: "#ccc", border: "1px solid #aaa", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, flexShrink: 0 }}>
              {studentAvatar ? <img data-a11y-preserve-img src={studentAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 34 }}>👤</span>}
            </div>
          </div>

          {/* Legend — icon + count + text, 2-col grid */}
          <div style={{ background: "#fff", borderBottom: "1px solid #ccc", padding: "8px 10px", flexShrink: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto 1fr", gap: "6px 6px", alignItems: "center" }}>
              <LegIcon n={sc.answered}    type="answered" />
              <span style={{ fontSize: 11, color: "#222" }}>Answered</span>
              <LegIcon n={sc.notAnswered} type="notans" />
              <span style={{ fontSize: 11, color: "#222" }}>Not Answered</span>
              <LegIcon n={sc.notVisited}  type="notvisit" />
              <span style={{ fontSize: 11, color: "#222" }}>Not Visited</span>
              <LegIcon n={sc.markedCount} type="marked" />
              <span style={{ fontSize: 11, color: "#222" }}>Marked for Review</span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 6 }}>
              <LegIcon n={sc.answeredMarked} type="ansmarked" />
              <span style={{ fontSize: 11, color: "#222", lineHeight: 1.4 }}>Answered &amp; Marked for Review (will also be evaluated)</span>
            </div>
          </div>

          {/* Section title */}
          <div style={{ background: C.sidebarTitle, color: "#fff", padding: "5px 10px", fontSize: 13, fontWeight: "bold", flexShrink: 0 }}>
            {currentSection?.name || "Section"}
          </div>
          <div style={{ padding: "3px 10px 3px", fontSize: 11, color: "#444", background: "#fff", flexShrink: 0, borderBottom: "1px solid #ddd" }}>
            Choose a Question
          </div>

          {/* Palette grid */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px", background: C.sidebarBg }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
              {currentSection?.questions.map((q, idx) => (
                <PaletteBtn
                  key={q.id}
                  num={idx + 1}
                  status={getQuestionStatus(q.id)}
                  onClick={() => {
                    const nextVisited = new Set(visitedQuestions);
                    nextVisited.add(q.id);
                    navigateWithoutSavingAnswer(() => {
                      setCurrentQuestionIndex(idx);
                      setVisitedQuestions(nextVisited);
                    }, nextVisited);
                    // Auto-close palette on mobile after selecting
                    if (window.innerWidth <= 768) setShowPalette(false);
                  }}
                />
              ))}
            </div>
          </div>

          {/* Submit button at bottom of sidebar */}
          <div style={{ padding: "8px", borderTop: "1px solid #ccc", background: "#fff", flexShrink: 0 }}>
            <button onClick={() => setShowSubmitModal(true)} disabled={submitting}
              style={{ width: "100%", padding: "9px 0", background: C.secActive, border: "none", color: "#fff", fontSize: 14, fontWeight: "bold", cursor: "pointer", borderRadius: 2 }}>
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </div>
        </div>
      </div>

      {/* ── OFFLINE POPUP ── */}
      <AnimatePresence>
        {isOffline && (
          <motion.div
            initial={{ opacity: 0, y: -40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -40 }}
            style={{
              position: "fixed", top: 36, left: "50%", transform: "translateX(-50%)", zIndex: 99999,
              background: "#cc0000", color: "#fff", padding: "10px 24px", borderRadius: 6,
              boxShadow: "0 4px 16px rgba(0,0,0,.3)", display: "flex", alignItems: "center", gap: 8,
              fontFamily: "Arial,sans-serif", fontSize: 13, fontWeight: "bold",
            }}>
            <WifiOff style={{ width: 16, height: 16 }} />
            No internet connection. Your progress may not be saved.
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SUBMIT MODAL ── */}
      <AnimatePresence>
        {showSubmitModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => setShowSubmitModal(false)}>
            <motion.div initial={{ scale: .95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: .95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ background: "#fff", border: "1px solid #bbb", borderRadius: 4, padding: 22, width: 420, fontFamily: "Arial,sans-serif", boxShadow: "0 8px 32px rgba(0,0,0,.25)" }}>
              <div style={{ borderBottom: "2px solid #2979c5", paddingBottom: 8, marginBottom: 14, fontSize: 15, fontWeight: "bold", color: "#1a3a5c" }}>⚠ Submit Test — Confirmation</div>
              <p style={{ fontSize: 12, color: "#555", marginBottom: 12 }}>Are you sure you want to submit? Once submitted, you cannot change your answers.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                {[
                  { bg: "#e8f5e9", color: "#2e7d32", val: sc.answered,                  lbl: "Answered" },
                  { bg: "#ffebee", color: "#c62828", val: questions.length - sc.answered, lbl: "Not Answered" },
                  { bg: "#f3e5f5", color: "#6a1b9a", val: sc.markedCount,                lbl: "Marked for Review" },
                  { bg: "#eceff1", color: "#455a64", val: sc.notVisited,                 lbl: "Not Visited" },
                ].map((s, i) => (
                  <div key={i} style={{ background: s.bg, padding: "10px 8px", textAlign: "center", borderRadius: 3 }}>
                    <div style={{ fontSize: 24, fontWeight: "bold", color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{s.lbl}</div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 11, color: "#888", marginBottom: 14 }}>Answered &amp; Marked for Review questions will also be evaluated.</p>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={() => setShowSubmitModal(false)}
                  style={{ padding: "8px 20px", background: "#fff", border: "1px solid #aaa", fontSize: 13, cursor: "pointer", borderRadius: 2, color: "#333" }}>Cancel</button>
                <button onClick={() => handleSubmit()} disabled={submitting}
                  style={{ padding: "8px 20px", background: "#cc0000", border: "none", color: "#fff", fontSize: 13, fontWeight: "bold", cursor: "pointer", borderRadius: 2 }}>
                  {submitting ? "Submitting…" : "Yes, Submit"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  if (fullscreenEnabled) {
    return (
      <FullscreenGuard maxExits={7} onMaxExitsReached={handleMaxFullscreenExits} onExitCountChange={handleFullscreenExitCountChange} initialExitCount={fullscreenExitCount}>
        {testContent}
      </FullscreenGuard>
    );
  }
  return testContent;
}

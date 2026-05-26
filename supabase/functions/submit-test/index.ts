import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { evaluateQuestionScore } from "../_shared/scoring.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SubjectScore = {
  correct: number;
  incorrect: number;
  skipped: number;
  total: number;
  marks: number;
  totalMarks: number;
};

type QuestionResult = {
  question_number?: number;
  question_text?: string | null;
  options?: unknown;
  image_url?: string | null;

  correct_answer: unknown;
  user_answer: unknown;
  is_correct: boolean;
  is_bonus?: boolean;

  marks_obtained: number;
  marks: number;
  negative_marks: number;

  subject: string;
  section_type?: string;
  chapter?: string;
};

// Helper to convert user answer index (0, 1, 2, 3) to letter (A, B, C, D)
const indexToLetter = (index: any): string => {
  const num = parseInt(String(index));
  if (!isNaN(num) && num >= 0 && num <= 25) {
    return String.fromCharCode(65 + num); // 0 -> A, 1 -> B, etc.
  }
  return String(index).toUpperCase();
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { attempt_id, answers, time_taken_seconds, force_submit } = await req.json();
    if (!attempt_id) {
      throw new Error("attempt_id is required");
    }

    console.log(`[submit-test] Submitting attempt=${attempt_id} user=${user.id}`);

    const { data: attempt, error: attemptError } = await supabaseClient
      .from("test_attempts")
      .select("id, test_id, user_id, completed_at, submit_disabled, started_at, result_release_delay_minutes")
      .eq("id", attempt_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (attemptError || !attempt) {
      console.error("[submit-test] Attempt not found:", attemptError);
      throw new Error("Test attempt not found");
    }

    if (attempt.completed_at) {
      console.log("[submit-test] Attempt already completed");
      throw new Error("Test already submitted");
    }

    if (attempt.submit_disabled && !force_submit) {
      throw new Error("Submission is disabled for this attempt. Please contact the administrator.");
    }

    const { data: test } = await supabaseAdmin
      .from("tests")
      .select("test_type, exam_type")
      .eq("id", attempt.test_id)
      .single();

    let score = 0;
    let totalMarks = 0;
    let correct = 0;
    let incorrect = 0;
    let skipped = 0;

    const questionResults: Record<string, QuestionResult> = {};
    const subjectScores: Record<string, SubjectScore> = {};

    const ensureSubject = (subject: string) => {
      if (!subjectScores[subject]) {
        subjectScores[subject] = {
          correct: 0,
          incorrect: 0,
          skipped: 0,
          total: 0,
          marks: 0,
          totalMarks: 0,
        };
      }
    };

    const pushResult = (questionId: string, result: QuestionResult) => {
      questionResults[questionId] = result;
    };

    const gradeSectionBased = async () => {
      console.log("[submit-test] Grading section-based questions (test_section_questions)");

      const { data: sectionQuestions, error: sqError } = await supabaseAdmin
        .from("test_section_questions")
        .select(`
          id,
          question_number,
          question_text,
          options,
          image_url,
          correct_answer,
          marks,
          negative_marks,
          is_bonus,
          test_sections!inner (
            section_type,
            name,
            test_subjects!inner (name)
          )
        `)
        .eq("test_id", attempt.test_id)
        .order("question_number");

      if (sqError) {
        console.error("[submit-test] Failed to fetch section questions:", sqError);
        throw new Error("Failed to calculate score");
      }

      for (const q of sectionQuestions || []) {
        const questionId = q.id as string;
        const correctAnswer = (q as any).correct_answer;
        const marks = (q as any).marks ?? 4;
        const negativeMarks = (q as any).negative_marks ?? 1;
        const isBonus = (q as any).is_bonus ?? false;
        const userAnswer = (answers as any)?.[questionId];

        const section = (q as any).test_sections;
        const sectionType = section?.section_type || "single_choice";
        const subject = section?.test_subjects?.name ?? "General";
        const chapterName = section?.name ?? "General";

        ensureSubject(subject);
        subjectScores[subject].total++;
        subjectScores[subject].totalMarks += marks;
        totalMarks += marks;

        const evaluation = evaluateQuestionScore({
          sectionType,
          correctAnswer,
          userAnswer,
          marks,
          negativeMarks,
          isBonus,
        });

        score += evaluation.marksObtained;
        subjectScores[subject].marks += evaluation.marksObtained;

        if (evaluation.status === "correct") {
          correct++;
          subjectScores[subject].correct++;
        } else if (evaluation.status === "incorrect") {
          incorrect++;
          subjectScores[subject].incorrect++;
        } else {
          skipped++;
          subjectScores[subject].skipped++;
        }

        pushResult(questionId, {
          question_number: (q as any).question_number,
          question_text: (q as any).question_text ?? null,
          options: (q as any).options,
          image_url: (q as any).image_url ?? null,
          correct_answer: correctAnswer,
          user_answer: userAnswer ?? null,
          is_correct: evaluation.isCorrect,
          is_bonus: isBonus,
          marks_obtained: evaluation.marksObtained,
          marks,
          negative_marks: negativeMarks,
          subject,
          section_type: sectionType,
          chapter: chapterName,
        });
      }
    };

    const gradeRegular = async () => {
      console.log("[submit-test] Grading regular test_questions -> questions");

      const { data: testQuestions, error: questionsError } = await supabaseAdmin
        .from("test_questions")
        .select(
          `order_index, questions(id, question_text, options, image_url, question_type, correct_answer, marks, negative_marks, chapters(name, courses(name)))`,
        )
        .eq("test_id", attempt.test_id)
        .order("order_index");

      if (questionsError) {
        console.error("[submit-test] Failed to fetch questions:", questionsError);
        throw new Error("Failed to calculate score");
      }

      // If this test was built using the section-based structure, test_questions will be empty.
      if (!testQuestions || testQuestions.length === 0) {
        await gradeSectionBased();
        return;
      }

      for (let idx = 0; idx < testQuestions.length; idx++) {
        const tq: any = testQuestions[idx];
        const q: any = tq.questions;
        if (!q) continue;

        const questionId = q.id as string;
        const correctAnswer = q.correct_answer;
        const marks = q.marks ?? 4;
        const negativeMarks = q.negative_marks ?? 1;
        const userAnswer = (answers as any)?.[questionId];
        const chapter = q.chapters as any;
        const course = chapter?.courses as any;
        const subject = course?.name ?? "General";
        const chapterName = chapter?.name ?? "General";

        ensureSubject(subject);
        subjectScores[subject].total++;
        subjectScores[subject].totalMarks += marks;
        totalMarks += marks;

        const evaluation = evaluateQuestionScore({
          sectionType: q.question_type,
          correctAnswer,
          userAnswer,
          marks,
          negativeMarks,
        });

        score += evaluation.marksObtained;
        subjectScores[subject].marks += evaluation.marksObtained;

        if (evaluation.status === "correct") {
          correct++;
          subjectScores[subject].correct++;
        } else if (evaluation.status === "incorrect") {
          incorrect++;
          subjectScores[subject].incorrect++;
        } else {
          skipped++;
          subjectScores[subject].skipped++;
        }

        pushResult(questionId, {
          question_number: idx + 1,
          question_text: q.question_text ?? null,
          options: q.options,
          image_url: q.image_url ?? null,
          correct_answer: correctAnswer,
          user_answer: userAnswer ?? null,
          is_correct: evaluation.isCorrect,
          marks_obtained: evaluation.marksObtained,
          marks,
          negative_marks: negativeMarks,
          subject,
          section_type: q.question_type,
          chapter: chapterName,
        });
      }
    };

    if (test?.test_type === "pdf") {
      console.log("[submit-test] Test type is pdf");
      await gradeSectionBased();
    } else {
      await gradeRegular();
    }

    const { data: allAttempts } = await supabaseAdmin
      .from("test_attempts")
      .select("id, score")
      .eq("test_id", attempt.test_id)
      .not("completed_at", "is", null)
      .order("score", { ascending: false });

    let rank = 1;
    let percentile = 100;

    if (allAttempts && allAttempts.length > 0) {
      const scoresWithCurrent = [...allAttempts.map((a) => a.score ?? 0), score].sort((a, b) => b - a);
      rank = scoresWithCurrent.indexOf(score) + 1;

      const scoresBelow = scoresWithCurrent.filter((s) => s < score).length;
      percentile = Math.round((scoresBelow / scoresWithCurrent.length) * 100 * 10) / 10;
    }

    const delayMinutes = attempt.result_release_delay_minutes ?? 0;
    const resultAvailableAt = delayMinutes > 0
      ? new Date(new Date(attempt.started_at).getTime() + delayMinutes * 60 * 1000).toISOString()
      : null;

    const { error: updateError } = await supabaseClient
      .from("test_attempts")
      .update({
        answers,
        score,
        total_marks: totalMarks,
        time_taken_seconds,
        completed_at: new Date().toISOString(),
        last_submitted_at: new Date().toISOString(),
        result_available_at: resultAvailableAt,
        rank,
        percentile,
      })
      .eq("id", attempt_id);

    if (updateError) {
      console.error("[submit-test] Failed to update attempt:", updateError);
      throw new Error("Failed to save results");
    }

    if (allAttempts && allAttempts.length > 0) {
      const updatedAttempts = [...allAttempts, { id: attempt_id, score }]
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

      for (let i = 0; i < updatedAttempts.length; i++) {
        const newRank = i + 1;
        const newPercentile = Math.round(((updatedAttempts.length - newRank) / updatedAttempts.length) * 100 * 10) / 10;

        await supabaseAdmin
          .from("test_attempts")
          .update({ rank: newRank, percentile: newPercentile })
          .eq("id", updatedAttempts[i].id);
      }
    }

    console.log(`[submit-test] Completed attempt=${attempt_id} score=${score}/${totalMarks} rank=${rank} percentile=${percentile}`);

    return new Response(
      JSON.stringify({
        score,
        total_marks: totalMarks,
        correct,
        incorrect,
        skipped,
        rank,
        percentile,
        question_results: questionResults,
        subject_scores: subjectScores,
        time_taken_seconds,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[submit-test] Error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

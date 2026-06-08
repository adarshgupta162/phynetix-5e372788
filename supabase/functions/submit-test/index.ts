import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { evaluateQuestionScore } from "../_shared/scoring.ts";
import { handleCorsPreFlight, successResponse, errorResponse } from "../_shared/response.ts";
import { AppError, logError } from "../_shared/errors.ts";
import { validateRequestBody, validateUUID } from "../_shared/validation.ts";
import type { SubmitTestRequest, SubmitTestResponse, QuestionResult, SubjectScore } from "../_shared/types.ts";

// Types are imported from _shared/types.ts

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight();
  }

  try {
    // Verify user authentication
    const { user, client: userClient, admin: adminClient } = await verifyAuth(req);

    // Parse and validate request body
    const body = await req.json();
    const { attempt_id, answers, time_taken_seconds, force_submit } = 
      validateRequestBody(body, ["attempt_id", "answers", "time_taken_seconds"]) as SubmitTestRequest & { force_submit?: boolean };
    
    validateUUID(attempt_id, "attempt_id");

    if (!answers || typeof answers !== "object") {
      throw new AppError("Answers must be an object", 400, "VALIDATION_ERROR");
    }

    if (typeof time_taken_seconds !== "number" || time_taken_seconds < 0) {
      throw new AppError("time_taken_seconds must be a non-negative number", 400, "VALIDATION_ERROR");
    }

    console.log(`[submit-test] Submitting attempt=${attempt_id} user=${user.id}`);

    const { data: attempt, error: attemptError } = await userClient
      .from("test_attempts")
      .select("id, test_id, user_id, completed_at, submit_disabled, started_at, result_release_delay_minutes")
      .eq("id", attempt_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (attemptError || !attempt) {
      console.error("[submit-test] Attempt not found:", attemptError);
      throw new AppError("Test attempt not found", 404);
    }

    if (attempt.completed_at) {
      console.warn("[submit-test] Attempt already completed:", attempt_id);
      throw new AppError("Test already submitted", 403);
    }

    if (attempt.submit_disabled && !force_submit) {
      throw new AppError(
        "Submission is disabled for this attempt. Please contact the administrator.",
        403
      );
    }

    const { data: test, error: testError } = await adminClient
      .from("tests")
      .select("test_type, exam_type")
      .eq("id", attempt.test_id)
      .single();

    if (testError || !test) {
      console.error("[submit-test] Test not found:", testError);
      throw new AppError("Test not found", 404);
    }

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

      const { data: sectionQuestions, error: sqError } = await adminClient
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
        throw new AppError("Failed to calculate score", 500);
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

      const { data: testQuestions, error: questionsError } = await adminClient
        .from("test_questions")
        .select(
          `order_index, questions(id, question_text, options, image_url, question_type, correct_answer, marks, negative_marks, chapters(name, courses(name)))`,
        )
        .eq("test_id", attempt.test_id)
        .order("order_index");

      if (questionsError) {
        console.error("[submit-test] Failed to fetch questions:", questionsError);
        throw new AppError("Failed to calculate score", 500);
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

    // Calculate rank and percentile based on all completed attempts
    const { data: allAttempts, error: allAttemptsError } = await adminClient
      .from("test_attempts")
      .select("id, score")
      .eq("test_id", attempt.test_id)
      .not("completed_at", "is", null)
      .order("score", { ascending: false });

    if (allAttemptsError) {
      console.error("[submit-test] Failed to fetch all attempts:", allAttemptsError);
      throw new AppError("Failed to calculate ranking", 500);
    }

    let rank = 1;
    let percentile = 100;

    if (allAttempts && allAttempts.length > 0) {
      // Include current score in ranking
      const scoresWithCurrent = [...allAttempts.map((a) => a.score ?? 0), score].sort((a, b) => b - a);
      rank = scoresWithCurrent.indexOf(score) + 1;
      
      // Calculate percentile: (scores below current / total scores) * 100
      const scoresBelow = scoresWithCurrent.filter((s) => s < score).length;
      percentile = Math.round((scoresBelow / scoresWithCurrent.length) * 100 * 10) / 10;
    }

    const delayMinutes = attempt.result_release_delay_minutes ?? 0;
    const resultAvailableAt = delayMinutes > 0
      ? new Date(new Date(attempt.started_at).getTime() + delayMinutes * 60 * 1000).toISOString()
      : null;

    // Update current attempt with score and ranking
    const { error: updateError } = await userClient
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
      throw new AppError("Failed to save results", 500);
    }

    // Recalculate ranks and percentiles for all attempts if this isn't the first submission
    if (allAttempts && allAttempts.length > 0) {
      console.log("[submit-test] Recalculating ranks for", allAttempts.length + 1, "attempts");
      
      const updatedAttempts = [...allAttempts, { id: attempt_id, score }]
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

      // Use batch update to avoid race conditions
      for (let i = 0; i < updatedAttempts.length; i++) {
        const newRank = i + 1;
        const newPercentile = Math.round(((updatedAttempts.length - newRank) / updatedAttempts.length) * 100 * 10) / 10;

        const { error: rankError } = await adminClient
          .from("test_attempts")
          .update({ rank: newRank, percentile: newPercentile })
          .eq("id", updatedAttempts[i].id);

        if (rankError) {
          console.warn("[submit-test] Failed to update rank for attempt", updatedAttempts[i].id, rankError);
        }
      }
    }

    console.log(`[submit-test] Completed attempt=${attempt_id} score=${score}/${totalMarks} rank=${rank} percentile=${percentile}`);

    const response: SubmitTestResponse = {
      score,
      total_marks: totalMarks,
      correct,
      incorrect,
      skipped,
      rank,
      percentile,
      question_results: questionResults as Record<string, QuestionResult>,
      subject_scores: subjectScores as Record<string, SubjectScore>,
      time_taken_seconds,
    };

    return successResponse(response);
  } catch (error: any) {
    logError("[submit-test]", error);
    const message = error?.message || "Unknown error";
    const status = error?.status || 400;
    return errorResponse(message, status);
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { handleCorsPreFlight, successResponse, errorResponse } from "../_shared/response.ts";
import { AppError, logError } from "../_shared/errors.ts";
import { validateRequestBody, validateUUID } from "../_shared/validation.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight();
  }

  try {
    // Verify user authentication
    const { user, client: userClient, admin: adminClient } = await verifyAuth(req);

    // Parse and validate request body
    const body = await req.json();
    const { test_id } = validateRequestBody(body, ["test_id"]);
    validateUUID(test_id, "test_id");

    console.log(`[get-test-questions] Fetching for test=${test_id} user=${user.id}`);

    // Check if user is admin via user_profiles table
    const { data: profile } = await adminClient
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const isAdmin = profile?.role === "admin";

    // Check if user has completed this test
    const { data: attemptData, error: attemptError } = await userClient
      .from("test_attempts")
      .select("completed_at")
      .eq("test_id", test_id)
      .eq("user_id", user.id)
      .not("completed_at", "is", null)
      .limit(1)
      .maybeSingle();

    if (attemptError) {
      console.warn("[get-test-questions] Failed to check attempt status:", attemptError);
    }

    const hasCompleted = !!attemptData?.completed_at;

    // Fetch test metadata
    const { data: testData, error: testError } = await userClient
      .from("tests")
      .select("test_type, exam_type, show_solutions")
      .eq("id", test_id)
      .single();

    if (testError || !testData) {
      console.error("[get-test-questions] Test not found:", testError);
      throw new AppError("Test not found", 404);
    }

    const testType = testData.test_type;
    const showAnswers = isAdmin || (hasCompleted && testData.show_solutions !== false);
    
    console.log(`[get-test-questions] test=${test_id} isAdmin=${isAdmin} hasCompleted=${hasCompleted} showAnswers=${showAnswers}`);

    let questions = [];

    let questions: any[] = [];

    if (testType === "pdf") {
      const { data: sectionQuestions, error: sqError } = await adminClient
        .from("test_section_questions")
        .select(`
          id, question_number, question_text, options, correct_answer,
          marks, negative_marks, order_index, pdf_page, image_url, image_urls,
          paragraph_id,
          section:test_sections(id, name, section_type, subject:test_subjects(id, name))
        `)
        .eq("test_id", test_id)
        .order("question_number");

      if (sqError) {
        console.error("[get-test-questions] Failed to fetch section questions:", sqError);
        throw new AppError("Failed to fetch questions", 500);
      }

      if (!sectionQuestions || sectionQuestions.length === 0) {
        console.log("[get-test-questions] No section questions found for test");
        return successResponse({ questions: [] });
      }

      const { data: paragraphs, error: paraError } = await adminClient
        .from("question_paragraphs")
        .select("*")
        .eq("test_id", test_id);

      if (paraError) {
        console.warn("[get-test-questions] Failed to fetch paragraphs:", paraError);
      }

      const paragraphMap: Record<string, any> = {};
      (paragraphs || []).forEach((p: any) => { paragraphMap[p.id] = p; });

      questions = (sectionQuestions || []).map((q: any, index: number) => {
        const imageUrls: string[] = [];
        if (q.image_url) imageUrls.push(q.image_url);
        if (Array.isArray(q.image_urls)) {
          for (const u of q.image_urls) {
            if (u && !imageUrls.includes(u)) imageUrls.push(u);
          }
        }
        const paragraph = q.paragraph_id ? paragraphMap[q.paragraph_id] : null;
        const result: any = {
          id: q.id,
          order: q.order_index ?? q.question_number ?? index,
          question_text: q.question_text || `Question ${q.question_number}`,
          options: q.options,
          difficulty: "medium",
          marks: q.marks ?? 4,
          negative_marks: q.negative_marks ?? 1,
          question_type: q.section?.section_type || "single_choice",
          subject: q.section?.subject?.name ?? "General",
          chapter: q.section?.name ?? "General",
          pdf_page: q.pdf_page,
          image_url: imageUrls[0] || null,
          image_urls: imageUrls,
          paragraph_id: q.paragraph_id,
          paragraph_text: paragraph?.paragraph_text || null,
          paragraph_image_urls: paragraph?.paragraph_image_urls || [],
        };
        if (showAnswers) {
          result.correct_answer = q.correct_answer;
        }
        return result;
      });
    } else {
      // Try to fetch from test_questions (regular test)
      const { data: testQuestions, error: questionsError } = await userClient
        .from("test_questions")
        .select(`
          order_index, question_id,
          questions(id, question_text, options, difficulty, marks, negative_marks, question_type, image_url, correct_answer, chapters(id, name, courses(id, name)))
        `)
        .eq("test_id", test_id)
        .order("order_index");

      if (questionsError) {
        console.warn("[get-test-questions] Failed to fetch test_questions:", questionsError);
      }

      if (testQuestions && testQuestions.length > 0) {
        questions = testQuestions.map((tq: any, index: number) => {
        const q = tq.questions;
        const chapter = q?.chapters;
        const course = chapter?.courses;
        const result: any = {
          id: q?.id,
          order: tq.order_index ?? index,
          question_text: q?.question_text,
          options: q?.options,
          difficulty: q?.difficulty,
          marks: q?.marks ?? 4,
          negative_marks: q?.negative_marks ?? 1,
          question_type: q?.question_type,
          image_url: q?.image_url,
          subject: course?.name ?? "General",
          chapter: chapter?.name ?? "General",
        };
        if (showAnswers) {
          result.correct_answer = q?.correct_answer;
        }
          return result;
        });
      }

      // Fallback: try test_section_questions if test_questions was empty
      if (questions.length === 0) {
        console.log("[get-test-questions] No questions in test_questions, trying test_section_questions...");
        
        const { data: sectionQuestions, error: sqError } = await adminClient
          .from("test_section_questions")
          .select(`
            id, question_number, question_text, options, correct_answer,
            marks, negative_marks, order_index, image_url, image_urls, paragraph_id,
            section:test_sections(id, name, section_type, order_index, subject:test_subjects(id, name, order_index))
          `)
          .eq("test_id", test_id)
          .order("question_number");

        if (sqError) {
          console.warn("[get-test-questions] Failed to fetch fallback section questions:", sqError);
        }

        const { data: paragraphs2, error: paraError2 } = await adminClient
          .from("question_paragraphs")
          .select("*")
          .eq("test_id", test_id);

        if (paraError2) {
          console.warn("[get-test-questions] Failed to fetch paragraphs:", paraError2);
        }

        const paragraphMap2: Record<string, any> = {};
        (paragraphs2 || []).forEach((p: any) => { paragraphMap2[p.id] = p; });

        if (sectionQuestions && sectionQuestions.length > 0) {
          const sorted = sectionQuestions.sort((a: any, b: any) => {
            const subjectOrderA = a.section?.subject?.order_index ?? 0;
            const subjectOrderB = b.section?.subject?.order_index ?? 0;
            if (subjectOrderA !== subjectOrderB) return subjectOrderA - subjectOrderB;
            const sectionOrderA = a.section?.order_index ?? 0;
            const sectionOrderB = b.section?.order_index ?? 0;
            if (sectionOrderA !== sectionOrderB) return sectionOrderA - sectionOrderB;
            return (a.question_number ?? 0) - (b.question_number ?? 0);
          });

          questions = sorted.map((q: any, index: number) => {
            const imageUrls: string[] = [];
            if (q.image_url) imageUrls.push(q.image_url);
            if (Array.isArray(q.image_urls)) {
              for (const u of q.image_urls) {
                if (u && !imageUrls.includes(u)) imageUrls.push(u);
              }
            }
            const paragraph = q.paragraph_id ? paragraphMap2[q.paragraph_id] : null;
            const result: any = {
              id: q.id,
              order: index,
              question_text: q.question_text || null,
              options: q.options,
              difficulty: "medium",
              marks: q.marks ?? 4,
              negative_marks: q.negative_marks ?? 1,
              question_type: q.section?.section_type || "single_choice",
              subject: q.section?.subject?.name ?? "General",
              chapter: q.section?.name ?? "General",
              section_id: q.section?.id ?? null,
              section_order: q.section?.order_index ?? 0,
              image_url: imageUrls[0] || null,
              image_urls: imageUrls,
              paragraph_id: q.paragraph_id,
              paragraph_text: paragraph?.paragraph_text || null,
              paragraph_image_urls: paragraph?.paragraph_image_urls || [],
            };
            if (showAnswers) {
              result.correct_answer = q.correct_answer;
            }
            return result;
          });
        }
      }
    }

    console.log(`[get-test-questions] Returning ${questions.length} questions for test=${test_id}`);

    return successResponse({ questions });
  } catch (error: any) {
    logError("[get-test-questions]", error);
    const message = error?.message || "Failed to fetch test questions";
    const status = error?.status || 400;
    return errorResponse(message, status);
  }
});

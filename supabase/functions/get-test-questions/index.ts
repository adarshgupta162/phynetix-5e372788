import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { test_id } = await req.json();
    if (!test_id || typeof test_id !== "string") {
      throw new Error("test_id is required");
    }

    console.log(`Fetching questions for test ${test_id}`);

    // Check if user is admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();
    const isAdmin = !!roleData;

    // Check if user has completed this test
    const { data: attemptData } = await supabaseAdmin
      .from("test_attempts")
      .select("completed_at")
      .eq("test_id", test_id)
      .eq("user_id", user.id)
      .not("completed_at", "is", null)
      .limit(1)
      .maybeSingle();
    const hasCompleted = !!attemptData?.completed_at;

    // Check if test has show_solutions enabled
    const { data: testData, error: testError } = await supabaseAdmin
      .from("tests")
      .select("test_type, exam_type, show_solutions")
      .eq("id", test_id)
      .single();

    if (testError) {
      console.error("Failed to fetch test:", testError);
      throw new Error("Failed to fetch test");
    }

    const testType = testData?.test_type;
    const showAnswers = isAdmin || (hasCompleted && testData?.show_solutions !== false);

    let questions = [];

    if (testType === "pdf") {
      const { data: sectionQuestions, error: sqError } = await supabaseAdmin
        .from("test_section_questions")
        .select(`
          id, question_number, question_text, options, correct_answer,
          marks, negative_marks, order_index, pdf_page, image_url, image_urls,
          paragraph_id,
          section:test_sections(id, name, section_type, subject:test_subjects(id, name))
        `)
        .eq("test_id", test_id)
        .order("question_number");

      if (sqError) throw new Error("Failed to fetch questions");

      const { data: paragraphs } = await supabaseAdmin
        .from("question_paragraphs")
        .select("*")
        .eq("test_id", test_id);

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
      const { data: testQuestions, error: questionsError } = await supabaseClient
        .from("test_questions")
        .select(`
          order_index, question_id,
          questions(id, question_text, options, difficulty, marks, negative_marks, question_type, image_url, correct_answer, chapters(id, name, courses(id, name)))
        `)
        .eq("test_id", test_id)
        .order("order_index");

      if (questionsError) throw new Error("Failed to fetch questions");

      questions = (testQuestions || []).map((tq: any, index: number) => {
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

      if (questions.length === 0) {
        console.log("No questions in test_questions, trying test_section_questions...");
        
        const { data: sectionQuestions, error: sqError } = await supabaseAdmin
          .from("test_section_questions")
          .select(`
            id, question_number, question_text, options, correct_answer,
            marks, negative_marks, order_index, image_url, image_urls, paragraph_id,
            section:test_sections(id, name, section_type, order_index, subject:test_subjects(id, name, order_index))
          `)
          .eq("test_id", test_id)
          .order("question_number");

        const { data: paragraphs2 } = await supabaseAdmin
          .from("question_paragraphs")
          .select("*")
          .eq("test_id", test_id);

        const paragraphMap2: Record<string, any> = {};
        (paragraphs2 || []).forEach((p: any) => { paragraphMap2[p.id] = p; });

        if (!sqError && sectionQuestions && sectionQuestions.length > 0) {
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

    console.log(`Returning ${questions.length} questions for test ${test_id}`);

    return new Response(
      JSON.stringify({ questions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in get-test-questions:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

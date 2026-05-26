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

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { test_id } = await req.json();
    if (!test_id) {
      throw new Error("test_id is required");
    }

    console.log(`Starting test ${test_id} for user ${user.id}`);

    // Check if user has already attempted this test
    const { data: existingAttempt, error: existingError } = await supabaseClient
      .from("test_attempts")
      .select("id, completed_at, started_at, fullscreen_exit_count, answers, time_per_question, extra_time_minutes, submit_disabled, result_release_delay_minutes, result_available_at")
      .eq("test_id", test_id)
      .eq("user_id", user.id)
      .maybeSingle();

    // If there's an existing attempt that's not completed, return it for resume
    if (existingAttempt && !existingAttempt.completed_at) {
      console.log(`User ${user.id} resuming test ${test_id}, attempt: ${existingAttempt.id}`);
      
      // Get test info
      const { data: test } = await supabaseClient
        .from("tests")
        .select("id, name, duration_minutes")
        .eq("id", test_id)
        .single();

      if (!test) {
        throw new Error("Test not found");
      }

      // Calculate remaining time
      const startedAt = new Date(existingAttempt.started_at).getTime();
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - startedAt) / 1000);
      const extraMinutes = existingAttempt.extra_time_minutes ?? 0;
      const totalSeconds = (test.duration_minutes + extraMinutes) * 60;
      const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);

      return new Response(
        JSON.stringify({
          attempt_id: existingAttempt.id,
          test_name: test.name,
          duration_minutes: test.duration_minutes,
          remaining_seconds: remainingSeconds,
          fullscreen_exit_count: existingAttempt.fullscreen_exit_count || 0,
          existing_answers: existingAttempt.answers || {},
          existing_time_per_question: existingAttempt.time_per_question || {},
          submit_disabled: existingAttempt.submit_disabled ?? false,
          extra_time_minutes: extraMinutes,
          result_release_delay_minutes: existingAttempt.result_release_delay_minutes ?? 0,
          result_available_at: existingAttempt.result_available_at ?? null,
          is_resume: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If attempt is completed, don't allow re-attempt
    if (existingAttempt && existingAttempt.completed_at) {
      console.log(`User ${user.id} already completed test ${test_id}`);
      throw new Error("You have already completed this test. Each test can only be attempted once.");
    }

    const { data: test, error: testError } = await supabaseClient
      .from("tests")
      .select("id, name, duration_minutes, is_published, result_release_delay_minutes")
      .eq("id", test_id)
      .eq("is_published", true)
      .maybeSingle();

    if (testError || !test) {
      console.error("Test not found:", testError);
      throw new Error("Test not found or not published");
    }

    const { data: enrollments } = await supabaseClient
      .from("batch_enrollments")
      .select("batch_id")
      .eq("user_id", user.id)
      .eq("is_active", true);

    const batchIds = enrollments?.map((enrollment) => enrollment.batch_id) || [];
    if (batchIds.length > 0) {
      const { data: batchTests, error: batchTestsError } = await supabaseClient
        .from("batch_tests")
        .select("unlock_date")
        .eq("test_id", test_id)
        .in("batch_id", batchIds);

      if (batchTestsError) {
        console.error("Failed to fetch batch test unlock details:", batchTestsError);
        throw new Error("Failed to validate test release time");
      }

      if (batchTests && batchTests.length > 0) {
        const unlockDates = batchTests
          .map((batchTest) => batchTest.unlock_date)
          .filter((date): date is string => !!date)
          .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

        const unlockAt = unlockDates[0];
        if (unlockAt && new Date(unlockAt).getTime() > Date.now()) {
          throw new Error(`Test will be available on ${new Date(unlockAt).toLocaleString()}`);
        }
      }
    }

    let overrideExtraTime = 0;
    let overrideSubmitDisabled = false;
    let overrideResultDelay = test.result_release_delay_minutes ?? 0;

    const { data: override, error: overrideError } = await supabaseClient
      .from("test_user_overrides")
      .select("extra_time_minutes, submit_disabled, result_release_delay_minutes")
      .eq("test_id", test_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (overrideError) {
      console.warn("Failed to load test overrides", overrideError);
    } else if (override) {
      overrideExtraTime = override.extra_time_minutes ?? 0;
      overrideSubmitDisabled = override.submit_disabled ?? false;
      overrideResultDelay = override.result_release_delay_minutes ?? overrideResultDelay;
    }

    const { data: attempt, error: attemptError } = await supabaseClient
      .from("test_attempts")
      .insert({
        test_id: test_id,
        user_id: user.id,
        started_at: new Date().toISOString(),
        answers: {},
        extra_time_minutes: overrideExtraTime,
        submit_disabled: overrideSubmitDisabled,
        result_release_delay_minutes: overrideResultDelay ?? 0,
      })
      .select()
      .single();

    if (attemptError) {
      console.error("Failed to create attempt:", attemptError);
      throw new Error("Failed to start test");
    }

    console.log(`Created attempt ${attempt.id} for test ${test_id}`);

    return new Response(
      JSON.stringify({
        attempt_id: attempt.id,
        test_name: test.name,
        duration_minutes: test.duration_minutes,
        extra_time_minutes: overrideExtraTime,
        submit_disabled: overrideSubmitDisabled,
        result_release_delay_minutes: overrideResultDelay ?? 0,
        is_resume: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in start-test:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { handleCorsPreFlight, successResponse, errorResponse } from "../_shared/response.ts";
import { AppError, logError } from "../_shared/errors.ts";
import { validateRequestBody, validateUUID } from "../_shared/validation.ts";
import type { StartTestRequest, StartTestResponse } from "../_shared/types.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight();
  }

  try {
    // Verify user authentication
    const { user, client: userClient, admin: adminClient } = await verifyAuth(req);

    // Parse and validate request body
    const body = await req.json();
    const { test_id } = validateRequestBody(body, ["test_id"]) as StartTestRequest;
    validateUUID(test_id, "test_id");

    console.log(`[start-test] Starting test=${test_id} user=${user.id}`);

    // Check if user has an existing attempt
    const { data: existingAttempt, error: existingError } = await userClient
      .from("test_attempts")
      .select("id, completed_at, started_at, fullscreen_exit_count, answers, time_per_question, extra_time_minutes, submit_disabled, result_release_delay_minutes, result_available_at")
      .eq("test_id", test_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingError) {
      console.error("[start-test] Failed to check existing attempt:", existingError);
      throw new AppError("Failed to check test attempt", 500);
    }

    // If there's an incomplete attempt, return it for resume
    if (existingAttempt && !existingAttempt.completed_at) {
      console.log(`[start-test] Resuming attempt=${existingAttempt.id} user=${user.id}`);
      
      const { data: test, error: testError } = await userClient
        .from("tests")
        .select("id, name, duration_minutes")
        .eq("id", test_id)
        .single();

      if (testError || !test) {
        console.error("[start-test] Test not found:", testError);
        throw new AppError("Test not found", 404);
      }

      // Calculate remaining time
      const startedAt = new Date(existingAttempt.started_at).getTime();
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - startedAt) / 1000);
      const extraMinutes = existingAttempt.extra_time_minutes ?? 0;
      const totalSeconds = (test.duration_minutes + extraMinutes) * 60;
      const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);

      const response: StartTestResponse = {
        attempt_id: existingAttempt.id,
        test_name: test.name,
        duration_minutes: test.duration_minutes,
        remaining_seconds: remainingSeconds,
        existing_answers: existingAttempt.answers || {},
        is_resume: true,
        extra_time_minutes: extraMinutes,
        submit_disabled: existingAttempt.submit_disabled ?? false,
        result_release_delay_minutes: existingAttempt.result_release_delay_minutes ?? 0,
      };

      return successResponse(response);
    }

    // If attempt is completed, don't allow restart
    if (existingAttempt && existingAttempt.completed_at) {
      console.warn(`[start-test] User ${user.id} attempted to restart completed test ${test_id}`);
      throw new AppError(
        "You have already completed this test. Each test can only be attempted once.",
        403
      );
    }

    // Fetch test details
    const { data: test, error: testError } = await userClient
      .from("tests")
      .select("id, name, duration_minutes, is_published, result_release_delay_minutes")
      .eq("id", test_id)
      .eq("is_published", true)
      .maybeSingle();

    if (testError || !test) {
      console.error("[start-test] Test not found:", testError);
      throw new AppError("Test not found or not published", 404);
    }

    // Check batch enrollments and unlock dates
    const { data: enrollments, error: enrollmentError } = await userClient
      .from("batch_enrollments")
      .select("batch_id")
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (enrollmentError) {
      console.warn("[start-test] Failed to fetch enrollments:", enrollmentError);
    }

    const batchIds = enrollments?.map((enrollment) => enrollment.batch_id) || [];
    if (batchIds.length > 0) {
      const { data: batchTests, error: batchTestsError } = await userClient
        .from("batch_tests")
        .select("unlock_date")
        .eq("test_id", test_id)
        .in("batch_id", batchIds);

      if (batchTestsError) {
        console.warn("[start-test] Failed to fetch batch unlock dates:", batchTestsError);
      } else if (batchTests && batchTests.length > 0) {
        const unlockDates = batchTests
          .map((batchTest) => batchTest.unlock_date)
          .filter((date): date is string => !!date)
          .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

        const unlockAt = unlockDates[0];
        if (unlockAt && new Date(unlockAt).getTime() > Date.now()) {
          throw new AppError(
            `Test will be available on ${new Date(unlockAt).toLocaleString()}`,
            403
          );
        }
      }
    }

    // Get user overrides
    let overrideExtraTime = 0;
    let overrideSubmitDisabled = false;
    let overrideResultDelay = test.result_release_delay_minutes ?? 0;

    const { data: override, error: overrideError } = await userClient
      .from("test_user_overrides")
      .select("extra_time_minutes, submit_disabled, result_release_delay_minutes")
      .eq("test_id", test_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (overrideError) {
      console.warn("[start-test] Failed to load test overrides:", overrideError);
    } else if (override) {
      overrideExtraTime = override.extra_time_minutes ?? 0;
      overrideSubmitDisabled = override.submit_disabled ?? false;
      overrideResultDelay = override.result_release_delay_minutes ?? overrideResultDelay;
    }

    // Create new test attempt
    const { data: attempt, error: attemptError } = await userClient
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

    if (attemptError || !attempt) {
      console.error("[start-test] Failed to create attempt:", attemptError);
      throw new AppError("Failed to start test", 500);
    }

    console.log(`[start-test] Created attempt=${attempt.id} test=${test_id} user=${user.id}`);

    const response: StartTestResponse = {
      attempt_id: attempt.id,
      test_name: test.name,
      duration_minutes: test.duration_minutes,
      extra_time_minutes: overrideExtraTime,
      submit_disabled: overrideSubmitDisabled,
      result_release_delay_minutes: overrideResultDelay ?? 0,
      is_resume: false,
    };

    return successResponse(response);
  } catch (error: any) {
    logError("[start-test]", error);
    const message = error?.message || "Unknown error";
    const status = error?.status || 400;
    return errorResponse(message, status);
  }
});

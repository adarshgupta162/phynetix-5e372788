/**
 * Shared TypeScript types and interfaces for all edge functions
 */

// Database Models
export interface User {
  id: string;
  email: string;
  user_metadata?: Record<string, any>;
  created_at?: string;
}

export interface UserProfile {
  id: string;
  role: "admin" | "staff" | "student" | "instructor";
  first_name?: string;
  last_name?: string;
  phone?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Test {
  id: string;
  name: string;
  description?: string;
  duration_minutes: number;
  test_type: "regular" | "pdf" | "adaptive";
  exam_type?: string;
  is_published: boolean;
  result_release_delay_minutes?: number;
  created_at?: string;
  updated_at?: string;
}

export interface TestAttempt {
  id: string;
  test_id: string;
  user_id: string;
  started_at: string;
  completed_at?: string;
  answers: Record<string, any>;
  score?: number;
  total_marks?: number;
  rank?: number;
  percentile?: number;
  time_taken_seconds?: number;
  fullscreen_exit_count?: number;
  extra_time_minutes?: number;
  submit_disabled?: boolean;
  result_release_delay_minutes?: number;
  result_available_at?: string;
  last_submitted_at?: string;
}

export interface Question {
  id: string;
  question_text: string;
  options?: unknown;
  image_url?: string;
  correct_answer: unknown;
  question_type: string;
  marks?: number;
  negative_marks?: number;
  created_at?: string;
}

export interface TestQuestion {
  id: string;
  test_id: string;
  question_id: string;
  order_index: number;
  questions?: Question;
}

export interface TestSection {
  id: string;
  test_id: string;
  name: string;
  section_type: string;
  test_subjects?: TestSubject;
}

export interface TestSectionQuestion {
  id: string;
  test_id: string;
  question_number: number;
  question_text: string;
  options?: unknown;
  image_url?: string;
  correct_answer: unknown;
  marks?: number;
  negative_marks?: number;
  is_bonus?: boolean;
  test_sections?: TestSection;
}

export interface TestSubject {
  id: string;
  name: string;
}

export interface ProctoringSession {
  id: string;
  test_attempt_id: string;
  user_id: string;
  started_at: string;
  ended_at?: string;
  violation_count?: number;
  violation_severity?: "low" | "medium" | "high";
  status: "active" | "completed" | "flagged";
}

export interface ProctoringEvent {
  id: string;
  proctoring_session_id: string;
  event_type: string;
  severity: "low" | "medium" | "high";
  description?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface BatchEnrollment {
  id: string;
  user_id: string;
  batch_id: string;
  is_active: boolean;
  enrolled_at: string;
}

export interface BatchTest {
  id: string;
  batch_id: string;
  test_id: string;
  unlock_date?: string;
  available_from?: string;
}

export interface TestUserOverride {
  id: string;
  test_id: string;
  user_id: string;
  extra_time_minutes?: number;
  submit_disabled?: boolean;
  result_release_delay_minutes?: number;
}

// API Request/Response Types

export interface StartTestRequest {
  test_id: string;
}

export interface StartTestResponse {
  attempt_id: string;
  test_name: string;
  duration_minutes: number;
  extra_time_minutes?: number;
  submit_disabled?: boolean;
  result_release_delay_minutes?: number;
  remaining_seconds?: number;
  existing_answers?: Record<string, any>;
  is_resume: boolean;
}

export interface SubmitTestRequest {
  attempt_id: string;
  answers: Record<string, any>;
  time_taken_seconds: number;
  force_submit?: boolean;
}

export interface QuestionResult {
  question_number?: number;
  question_text?: string;
  options?: unknown;
  image_url?: string;
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
}

export interface SubjectScore {
  correct: number;
  incorrect: number;
  skipped: number;
  total: number;
  marks: number;
  totalMarks: number;
}

export interface SubmitTestResponse {
  score: number;
  total_marks: number;
  correct: number;
  incorrect: number;
  skipped: number;
  rank: number;
  percentile: number;
  question_results: Record<string, QuestionResult>;
  subject_scores: Record<string, SubjectScore>;
  time_taken_seconds: number;
}

export interface CreateStaffUserRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: "admin" | "staff";
  phone?: string;
}

export interface CreateStaffUserResponse {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  created_at: string;
}

export interface StartProctoringSessionRequest {
  test_attempt_id: string;
  browser_info?: Record<string, any>;
  system_info?: Record<string, any>;
}

export interface StartProctoringSessionResponse {
  session_id: string;
  started_at: string;
}

export interface LogProctoringEventRequest {
  session_id: string;
  event_type: string;
  severity: "low" | "medium" | "high";
  description?: string;
  metadata?: Record<string, any>;
}

export interface SendNotificationRequest {
  user_id: string;
  subject: string;
  template: string;
  variables?: Record<string, any>;
}

export interface SendNotificationResponse {
  message_id?: string;
  status: "sent" | "queued" | "failed";
  error?: string;
}

// Utility Types

export type DbError = {
  code?: string;
  message: string;
  details?: string;
};

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
};

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          new_value: Json | null
          old_value: Json | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      batch_enrollments: {
        Row: {
          batch_id: string
          enrolled_at: string | null
          enrolled_by: string | null
          enrollment_type: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          payment_id: string | null
          payment_status: string | null
          user_id: string
        }
        Insert: {
          batch_id: string
          enrolled_at?: string | null
          enrolled_by?: string | null
          enrollment_type?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          payment_id?: string | null
          payment_status?: string | null
          user_id: string
        }
        Update: {
          batch_id?: string
          enrolled_at?: string | null
          enrolled_by?: string | null
          enrollment_type?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          payment_id?: string | null
          payment_status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_enrollments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_tests: {
        Row: {
          batch_id: string
          created_at: string | null
          id: string
          is_bonus: boolean | null
          order_index: number | null
          test_id: string
          unlock_date: string | null
        }
        Insert: {
          batch_id: string
          created_at?: string | null
          id?: string
          is_bonus?: boolean | null
          order_index?: number | null
          test_id: string
          unlock_date?: string | null
        }
        Update: {
          batch_id?: string
          created_at?: string | null
          id?: string
          is_bonus?: boolean | null
          order_index?: number | null
          test_id?: string
          unlock_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_tests_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_tests_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string | null
          current_students: number | null
          description: string | null
          end_date: string | null
          enrollment_deadline: string | null
          features: Json | null
          id: string
          institution_id: string | null
          is_active: boolean | null
          is_featured: boolean | null
          join_code: string | null
          max_students: number | null
          name: string
          original_price: number | null
          price: number
          short_description: string | null
          start_date: string | null
          syllabus: Json | null
          thumbnail_url: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          current_students?: number | null
          description?: string | null
          end_date?: string | null
          enrollment_deadline?: string | null
          features?: Json | null
          id?: string
          institution_id?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          join_code?: string | null
          max_students?: number | null
          name: string
          original_price?: number | null
          price?: number
          short_description?: string | null
          start_date?: string | null
          syllabus?: Json | null
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          current_students?: number | null
          description?: string | null
          end_date?: string | null
          enrollment_deadline?: string | null
          features?: Json | null
          id?: string
          institution_id?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          join_code?: string | null
          max_students?: number | null
          name?: string
          original_price?: number | null
          price?: number
          short_description?: string | null
          start_date?: string | null
          syllabus?: Json | null
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batches_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          order_index: number | null
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          order_index?: number | null
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          order_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chapters_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      community_messages: {
        Row: {
          created_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          id: string
          is_deleted: boolean | null
          message: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          id?: string
          is_deleted?: boolean | null
          message: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          id?: string
          is_deleted?: boolean | null
          message?: string
          user_id?: string
        }
        Relationships: []
      }
      coupon_usage: {
        Row: {
          coupon_id: string
          id: string
          payment_id: string | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          coupon_id: string
          id?: string
          payment_id?: string | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          coupon_id?: string
          id?: string
          payment_id?: string | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usage_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usage_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          applicable_batches: string[] | null
          code: string
          created_at: string | null
          created_by: string | null
          current_uses: number | null
          description: string | null
          discount_type: string | null
          discount_value: number
          id: string
          is_active: boolean | null
          max_uses: number | null
          min_purchase_amount: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          applicable_batches?: string[] | null
          code: string
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          description?: string | null
          discount_type?: string | null
          discount_value: number
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_purchase_amount?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          applicable_batches?: string[] | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          description?: string | null
          discount_type?: string | null
          discount_value?: number
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_purchase_amount?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      courses: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      dpp_attempts: {
        Row: {
          answers: Json | null
          completed_at: string | null
          dpp_id: string
          id: string
          score: number | null
          started_at: string
          time_taken_seconds: number | null
          total_marks: number | null
          user_id: string
        }
        Insert: {
          answers?: Json | null
          completed_at?: string | null
          dpp_id: string
          id?: string
          score?: number | null
          started_at?: string
          time_taken_seconds?: number | null
          total_marks?: number | null
          user_id: string
        }
        Update: {
          answers?: Json | null
          completed_at?: string | null
          dpp_id?: string
          id?: string
          score?: number | null
          started_at?: string
          time_taken_seconds?: number | null
          total_marks?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dpp_attempts_dpp_id_fkey"
            columns: ["dpp_id"]
            isOneToOne: false
            referencedRelation: "dpps"
            referencedColumns: ["id"]
          },
        ]
      }
      dpp_questions: {
        Row: {
          correct_answer: Json
          created_at: string
          difficulty: string | null
          dpp_id: string
          id: string
          marks: number | null
          negative_marks: number | null
          options: Json | null
          order_index: number | null
          question_image_url: string | null
          question_image_urls: Json | null
          question_number: number
          question_text: string | null
          question_type: string
          solution_image_url: string | null
          solution_image_urls: Json | null
          solution_text: string | null
          updated_at: string
        }
        Insert: {
          correct_answer: Json
          created_at?: string
          difficulty?: string | null
          dpp_id: string
          id?: string
          marks?: number | null
          negative_marks?: number | null
          options?: Json | null
          order_index?: number | null
          question_image_url?: string | null
          question_image_urls?: Json | null
          question_number: number
          question_text?: string | null
          question_type?: string
          solution_image_url?: string | null
          solution_image_urls?: Json | null
          solution_text?: string | null
          updated_at?: string
        }
        Update: {
          correct_answer?: Json
          created_at?: string
          difficulty?: string | null
          dpp_id?: string
          id?: string
          marks?: number | null
          negative_marks?: number | null
          options?: Json | null
          order_index?: number | null
          question_image_url?: string | null
          question_image_urls?: Json | null
          question_number?: number
          question_text?: string | null
          question_type?: string
          solution_image_url?: string | null
          solution_image_urls?: Json | null
          solution_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dpp_questions_dpp_id_fkey"
            columns: ["dpp_id"]
            isOneToOne: false
            referencedRelation: "dpps"
            referencedColumns: ["id"]
          },
        ]
      }
      dpps: {
        Row: {
          access_type: string | null
          batch_id: string | null
          chapter: string | null
          created_at: string
          created_by: string | null
          description: string | null
          difficulty: string | null
          duration_minutes: number | null
          id: string
          is_published: boolean | null
          is_timed: boolean | null
          publish_date: string | null
          subject: string
          title: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          access_type?: string | null
          batch_id?: string | null
          chapter?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty?: string | null
          duration_minutes?: number | null
          id?: string
          is_published?: boolean | null
          is_timed?: boolean | null
          publish_date?: string | null
          subject: string
          title: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          access_type?: string | null
          batch_id?: string | null
          chapter?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty?: string | null
          duration_minutes?: number | null
          id?: string
          is_published?: boolean | null
          is_timed?: boolean | null
          publish_date?: string | null
          subject?: string
          title?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dpps_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      institution_members: {
        Row: {
          created_at: string | null
          id: string
          institution_id: string
          invited_by: string | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          institution_id: string
          invited_by?: string | null
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          institution_id?: string
          invited_by?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "institution_members_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          code: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          code?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      monitoring_events: {
        Row: {
          created_at: string | null
          event_type: string | null
          id: string
          metadata: Json | null
          session_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type?: string | null
          id?: string
          metadata?: Json | null
          session_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string | null
          id?: string
          metadata?: Json | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monitoring_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "monitoring_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoring_permissions: {
        Row: {
          attempt_id: string
          camera_granted: boolean
          camera_state: string | null
          created_at: string
          created_by: string | null
          id: string
          last_checked_at: string
          microphone_granted: boolean
          microphone_state: string | null
          permissions_payload: Json
          screen_granted: boolean
          screen_state: string | null
          session_id: string
          test_id: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          attempt_id: string
          camera_granted?: boolean
          camera_state?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_checked_at?: string
          microphone_granted?: boolean
          microphone_state?: string | null
          permissions_payload?: Json
          screen_granted?: boolean
          screen_state?: string | null
          session_id: string
          test_id: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          attempt_id?: string
          camera_granted?: boolean
          camera_state?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_checked_at?: string
          microphone_granted?: boolean
          microphone_state?: string | null
          permissions_payload?: Json
          screen_granted?: boolean
          screen_state?: string | null
          session_id?: string
          test_id?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monitoring_permissions_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: true
            referencedRelation: "test_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monitoring_permissions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "proctoring_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monitoring_permissions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoring_sessions: {
        Row: {
          id: string
          started_at: string | null
          status: string | null
          student_id: string | null
          test_id: string | null
        }
        Insert: {
          id?: string
          started_at?: string | null
          status?: string | null
          student_id?: string | null
          test_id?: string | null
        }
        Update: {
          id?: string
          started_at?: string | null
          status?: string | null
          student_id?: string | null
          test_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_read: boolean | null
          message: string
          requires_action: boolean | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          requires_action?: boolean | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          requires_action?: boolean | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          batch_id: string
          created_at: string | null
          currency: string | null
          gateway_order_id: string | null
          gateway_response: Json | null
          id: string
          payment_gateway: string | null
          payment_method: string | null
          refund_amount: number | null
          refund_reason: string | null
          refunded_at: string | null
          refunded_by: string | null
          status: string | null
          transaction_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          batch_id: string
          created_at?: string | null
          currency?: string | null
          gateway_order_id?: string | null
          gateway_response?: Json | null
          id?: string
          payment_gateway?: string | null
          payment_method?: string | null
          refund_amount?: number | null
          refund_reason?: string | null
          refunded_at?: string | null
          refunded_by?: string | null
          status?: string | null
          transaction_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          batch_id?: string
          created_at?: string | null
          currency?: string | null
          gateway_order_id?: string | null
          gateway_response?: Json | null
          id?: string
          payment_gateway?: string | null
          payment_method?: string | null
          refund_amount?: number | null
          refund_reason?: string | null
          refunded_at?: string | null
          refunded_by?: string | null
          status?: string | null
          transaction_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      phynetix_library: {
        Row: {
          chapter: string | null
          correct_answer: Json
          created_at: string
          created_by: string | null
          difficulty: string | null
          id: string
          institution_id: string | null
          is_active: boolean | null
          library_id: string
          marks: number | null
          negative_marks: number | null
          options: Json | null
          question_image_url: string | null
          question_image_urls: Json | null
          question_text: string | null
          question_type: string
          solution_image_url: string | null
          solution_image_urls: Json | null
          solution_text: string | null
          subject: string
          tags: string[] | null
          time_seconds: number | null
          topic: string | null
          updated_at: string
          usage_count: number | null
          visibility: string
        }
        Insert: {
          chapter?: string | null
          correct_answer: Json
          created_at?: string
          created_by?: string | null
          difficulty?: string | null
          id?: string
          institution_id?: string | null
          is_active?: boolean | null
          library_id?: string
          marks?: number | null
          negative_marks?: number | null
          options?: Json | null
          question_image_url?: string | null
          question_image_urls?: Json | null
          question_text?: string | null
          question_type?: string
          solution_image_url?: string | null
          solution_image_urls?: Json | null
          solution_text?: string | null
          subject: string
          tags?: string[] | null
          time_seconds?: number | null
          topic?: string | null
          updated_at?: string
          usage_count?: number | null
          visibility?: string
        }
        Update: {
          chapter?: string | null
          correct_answer?: Json
          created_at?: string
          created_by?: string | null
          difficulty?: string | null
          id?: string
          institution_id?: string | null
          is_active?: boolean | null
          library_id?: string
          marks?: number | null
          negative_marks?: number | null
          options?: Json | null
          question_image_url?: string | null
          question_image_urls?: Json | null
          question_text?: string | null
          question_type?: string
          solution_image_url?: string | null
          solution_image_urls?: Json | null
          solution_text?: string | null
          subject?: string
          tags?: string[] | null
          time_seconds?: number | null
          topic?: string | null
          updated_at?: string
          usage_count?: number | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "phynetix_library_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      proctoring_alerts: {
        Row: {
          alert_type: string
          attempt_id: string
          created_at: string
          created_by: string | null
          event_id: string | null
          id: string
          message: string
          payload: Json
          resolved_at: string | null
          resolved_by: string | null
          session_id: string
          severity: Database["public"]["Enums"]["proctoring_alert_severity"]
          status: string
          test_id: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          alert_type: string
          attempt_id: string
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          message: string
          payload?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          session_id: string
          severity?: Database["public"]["Enums"]["proctoring_alert_severity"]
          status?: string
          test_id: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          alert_type?: string
          attempt_id?: string
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          message?: string
          payload?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          session_id?: string
          severity?: Database["public"]["Enums"]["proctoring_alert_severity"]
          status?: string
          test_id?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proctoring_alerts_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "test_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proctoring_alerts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "proctoring_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proctoring_alerts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "proctoring_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proctoring_alerts_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      proctoring_events: {
        Row: {
          attempt_id: string
          created_at: string
          event_type: Database["public"]["Enums"]["proctoring_event_type"]
          id: string
          payload: Json
          question_id: string | null
          session_id: string
          subject_name: string | null
          test_id: string
          user_id: string
        }
        Insert: {
          attempt_id: string
          created_at?: string
          event_type: Database["public"]["Enums"]["proctoring_event_type"]
          id?: string
          payload?: Json
          question_id?: string | null
          session_id: string
          subject_name?: string | null
          test_id: string
          user_id: string
        }
        Update: {
          attempt_id?: string
          created_at?: string
          event_type?: Database["public"]["Enums"]["proctoring_event_type"]
          id?: string
          payload?: Json
          question_id?: string | null
          session_id?: string
          subject_name?: string | null
          test_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proctoring_events_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "test_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proctoring_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "proctoring_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proctoring_events_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      proctoring_recordings: {
        Row: {
          attempt_id: string
          checksum: string | null
          created_at: string
          created_by: string | null
          duration_seconds: number | null
          expires_at: string | null
          id: string
          metadata: Json
          playback_url: string | null
          provider: string
          recorded_at: string | null
          session_id: string
          size_bytes: number | null
          storage_bucket: string | null
          storage_path: string | null
          test_id: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          attempt_id: string
          checksum?: string | null
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          expires_at?: string | null
          id?: string
          metadata?: Json
          playback_url?: string | null
          provider?: string
          recorded_at?: string | null
          session_id: string
          size_bytes?: number | null
          storage_bucket?: string | null
          storage_path?: string | null
          test_id: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          attempt_id?: string
          checksum?: string | null
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          expires_at?: string | null
          id?: string
          metadata?: Json
          playback_url?: string | null
          provider?: string
          recorded_at?: string | null
          session_id?: string
          size_bytes?: number | null
          storage_bucket?: string | null
          storage_path?: string | null
          test_id?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proctoring_recordings_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "test_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proctoring_recordings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "proctoring_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proctoring_recordings_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      proctoring_sessions: {
        Row: {
          attempt_id: string
          camera_enabled: boolean
          camera_track_id: string | null
          consent_accepted_at: string | null
          consent_version: string
          created_at: string
          ended_at: string | null
          failure_reason: string | null
          id: string
          last_heartbeat_at: string | null
          metadata: Json
          microphone_enabled: boolean
          microphone_track_id: string | null
          provider: string
          provider_room_name: string
          recording_enabled: boolean
          screen_enabled: boolean
          screen_track_id: string | null
          started_at: string
          status: Database["public"]["Enums"]["proctoring_session_status"]
          test_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_id: string
          camera_enabled?: boolean
          camera_track_id?: string | null
          consent_accepted_at?: string | null
          consent_version?: string
          created_at?: string
          ended_at?: string | null
          failure_reason?: string | null
          id?: string
          last_heartbeat_at?: string | null
          metadata?: Json
          microphone_enabled?: boolean
          microphone_track_id?: string | null
          provider?: string
          provider_room_name: string
          recording_enabled?: boolean
          screen_enabled?: boolean
          screen_track_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["proctoring_session_status"]
          test_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_id?: string
          camera_enabled?: boolean
          camera_track_id?: string | null
          consent_accepted_at?: string | null
          consent_version?: string
          created_at?: string
          ended_at?: string | null
          failure_reason?: string | null
          id?: string
          last_heartbeat_at?: string | null
          metadata?: Json
          microphone_enabled?: boolean
          microphone_track_id?: string | null
          provider?: string
          provider_room_name?: string
          recording_enabled?: boolean
          screen_enabled?: boolean
          screen_track_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["proctoring_session_status"]
          test_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proctoring_sessions_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: true
            referencedRelation: "test_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proctoring_sessions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      proctoring_test_settings: {
        Row: {
          allow_optional_device_fallback: boolean
          allow_specific_users_only: boolean
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          instructions: string | null
          recording_enabled: boolean
          require_camera: boolean
          require_microphone: boolean
          require_screen: boolean
          retention_days: number
          test_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allow_optional_device_fallback?: boolean
          allow_specific_users_only?: boolean
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          instructions?: string | null
          recording_enabled?: boolean
          require_camera?: boolean
          require_microphone?: boolean
          require_screen?: boolean
          retention_days?: number
          test_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allow_optional_device_fallback?: boolean
          allow_specific_users_only?: boolean
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          instructions?: string | null
          recording_enabled?: boolean
          require_camera?: boolean
          require_microphone?: boolean
          require_screen?: boolean
          retention_days?: number
          test_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proctoring_test_settings_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: true
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      proctoring_user_overrides: {
        Row: {
          allow_optional_device_fallback: boolean | null
          allowed: boolean
          created_at: string
          created_by: string | null
          enabled: boolean | null
          id: string
          notes: string | null
          require_camera: boolean | null
          require_microphone: boolean | null
          require_screen: boolean | null
          test_id: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          allow_optional_device_fallback?: boolean | null
          allowed?: boolean
          created_at?: string
          created_by?: string | null
          enabled?: boolean | null
          id?: string
          notes?: string | null
          require_camera?: boolean | null
          require_microphone?: boolean | null
          require_screen?: boolean | null
          test_id: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          allow_optional_device_fallback?: boolean | null
          allowed?: boolean
          created_at?: string
          created_by?: string | null
          enabled?: boolean | null
          id?: string
          notes?: string | null
          require_camera?: boolean | null
          require_microphone?: boolean | null
          require_screen?: boolean | null
          test_id?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proctoring_user_overrides_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          academic_status: string | null
          address: string | null
          avatar_url: string | null
          banned_reason: string | null
          banned_until: string | null
          city: string | null
          coaching_name: string | null
          coaching_type: string | null
          created_at: string
          date_of_birth: string | null
          full_name: string | null
          gender: string | null
          id: string
          is_banned: boolean | null
          phone: string | null
          preferred_language: string | null
          profile_completed: boolean | null
          roll_number: string | null
          state: string | null
          target_exam: string | null
          telegram_id: string | null
          updated_at: string
        }
        Insert: {
          academic_status?: string | null
          address?: string | null
          avatar_url?: string | null
          banned_reason?: string | null
          banned_until?: string | null
          city?: string | null
          coaching_name?: string | null
          coaching_type?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name?: string | null
          gender?: string | null
          id: string
          is_banned?: boolean | null
          phone?: string | null
          preferred_language?: string | null
          profile_completed?: boolean | null
          roll_number?: string | null
          state?: string | null
          target_exam?: string | null
          telegram_id?: string | null
          updated_at?: string
        }
        Update: {
          academic_status?: string | null
          address?: string | null
          avatar_url?: string | null
          banned_reason?: string | null
          banned_until?: string | null
          city?: string | null
          coaching_name?: string | null
          coaching_type?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          is_banned?: boolean | null
          phone?: string | null
          preferred_language?: string | null
          profile_completed?: boolean | null
          roll_number?: string | null
          state?: string | null
          target_exam?: string | null
          telegram_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      qb_attempts: {
        Row: {
          answer: Json
          attempted_at: string
          id: string
          is_correct: boolean
          marks_obtained: number
          question_id: string
          user_id: string
        }
        Insert: {
          answer: Json
          attempted_at?: string
          id?: string
          is_correct: boolean
          marks_obtained: number
          question_id: string
          user_id: string
        }
        Update: {
          answer?: Json
          attempted_at?: string
          id?: string
          is_correct?: boolean
          marks_obtained?: number
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qb_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "qb_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      qb_bookmarks: {
        Row: {
          created_at: string
          id: string
          question_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          question_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qb_bookmarks_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "qb_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      qb_chapters: {
        Row: {
          course_id: string
          created_at: string
          id: string
          order_index: number
          title: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          order_index?: number
          title: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          order_index?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "qb_chapters_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "qb_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      qb_courses: {
        Row: {
          created_at: string
          description: string | null
          id: string
          slug: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          slug: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          slug?: string
          title?: string
        }
        Relationships: []
      }
      qb_questions: {
        Row: {
          chapter_id: string
          correct: Json
          course_id: string
          created_at: string
          difficulty: string
          id: string
          marks: Json
          options: Json | null
          options_text: Json | null
          pdf_coords: Json | null
          pdf_page: number | null
          qno: number
          question_text: string | null
          text_source: string
          type: string
        }
        Insert: {
          chapter_id: string
          correct: Json
          course_id: string
          created_at?: string
          difficulty: string
          id?: string
          marks?: Json
          options?: Json | null
          options_text?: Json | null
          pdf_coords?: Json | null
          pdf_page?: number | null
          qno: number
          question_text?: string | null
          text_source?: string
          type: string
        }
        Update: {
          chapter_id?: string
          correct?: Json
          course_id?: string
          created_at?: string
          difficulty?: string
          id?: string
          marks?: Json
          options?: Json | null
          options_text?: Json | null
          pdf_coords?: Json | null
          pdf_page?: number | null
          qno?: number
          question_text?: string | null
          text_source?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "qb_questions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "qb_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qb_questions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "qb_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      question_bookmarks: {
        Row: {
          created_at: string
          id: string
          note: string | null
          question_id: string
          test_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          question_id: string
          test_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          question_id?: string
          test_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_bookmarks_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "test_section_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_bookmarks_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      question_paragraphs: {
        Row: {
          created_at: string
          id: string
          order_index: number | null
          paragraph_image_url: string | null
          paragraph_image_urls: Json | null
          paragraph_text: string | null
          section_id: string
          test_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_index?: number | null
          paragraph_image_url?: string | null
          paragraph_image_urls?: Json | null
          paragraph_text?: string | null
          section_id: string
          test_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          order_index?: number | null
          paragraph_image_url?: string | null
          paragraph_image_urls?: Json | null
          paragraph_text?: string | null
          section_id?: string
          test_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_paragraphs_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "test_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_paragraphs_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          chapter_id: string
          correct_answer: string
          created_at: string
          difficulty: string
          explanation: string | null
          id: string
          image_url: string | null
          marks: number | null
          negative_marks: number | null
          options: Json | null
          partial_marking: boolean | null
          pdf_page_number: number | null
          question_number: number | null
          question_text: string
          question_type: string
          updated_at: string
        }
        Insert: {
          chapter_id: string
          correct_answer: string
          created_at?: string
          difficulty?: string
          explanation?: string | null
          id?: string
          image_url?: string | null
          marks?: number | null
          negative_marks?: number | null
          options?: Json | null
          partial_marking?: boolean | null
          pdf_page_number?: number | null
          question_number?: number | null
          question_text: string
          question_type?: string
          updated_at?: string
        }
        Update: {
          chapter_id?: string
          correct_answer?: string
          created_at?: string
          difficulty?: string
          explanation?: string | null
          id?: string
          image_url?: string | null
          marks?: number | null
          negative_marks?: number | null
          options?: Json | null
          partial_marking?: boolean | null
          pdf_page_number?: number | null
          question_number?: number | null
          question_text?: string
          question_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_requests: {
        Row: {
          created_at: string | null
          description: string | null
          entity_id: string | null
          entity_type: string | null
          from_user_id: string
          id: string
          metadata: Json | null
          request_type: string
          status: string | null
          title: string
          to_user_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          from_user_id: string
          id?: string
          metadata?: Json | null
          request_type: string
          status?: string | null
          title: string
          to_user_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          from_user_id?: string
          id?: string
          metadata?: Json | null
          request_type?: string
          status?: string | null
          title?: string
          to_user_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      test_attempts: {
        Row: {
          answers: Json | null
          awaiting_result: boolean | null
          completed_at: string | null
          fullscreen_exit_count: number | null
          id: string
          percentile: number | null
          rank: number | null
          roll_number: string | null
          score: number | null
          started_at: string
          test_id: string
          time_per_question: Json | null
          time_taken_seconds: number | null
          total_marks: number | null
          user_id: string
        }
        Insert: {
          answers?: Json | null
          awaiting_result?: boolean | null
          completed_at?: string | null
          fullscreen_exit_count?: number | null
          id?: string
          percentile?: number | null
          rank?: number | null
          roll_number?: string | null
          score?: number | null
          started_at?: string
          test_id: string
          time_per_question?: Json | null
          time_taken_seconds?: number | null
          total_marks?: number | null
          user_id: string
        }
        Update: {
          answers?: Json | null
          awaiting_result?: boolean | null
          completed_at?: string | null
          fullscreen_exit_count?: number | null
          id?: string
          percentile?: number | null
          rank?: number | null
          roll_number?: string | null
          score?: number | null
          started_at?: string
          test_id?: string
          time_per_question?: Json | null
          time_taken_seconds?: number | null
          total_marks?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_attempts_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      test_questions: {
        Row: {
          id: string
          order_index: number | null
          question_id: string
          test_id: string
        }
        Insert: {
          id?: string
          order_index?: number | null
          question_id: string
          test_id: string
        }
        Update: {
          id?: string
          order_index?: number | null
          question_id?: string
          test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_questions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      test_section_questions: {
        Row: {
          chapter: string | null
          correct_answer: Json
          created_at: string
          difficulty: string | null
          id: string
          image_url: string | null
          image_urls: Json | null
          is_bonus: boolean | null
          library_question_id: string | null
          marks: number | null
          negative_marks: number | null
          options: Json | null
          order_index: number | null
          paragraph_id: string | null
          pdf_page: number | null
          question_number: number
          question_text: string | null
          section_id: string
          solution_image_url: string | null
          solution_image_urls: Json | null
          solution_text: string | null
          test_id: string
          time_seconds: number | null
          topic: string | null
          updated_at: string
        }
        Insert: {
          chapter?: string | null
          correct_answer: Json
          created_at?: string
          difficulty?: string | null
          id?: string
          image_url?: string | null
          image_urls?: Json | null
          is_bonus?: boolean | null
          library_question_id?: string | null
          marks?: number | null
          negative_marks?: number | null
          options?: Json | null
          order_index?: number | null
          paragraph_id?: string | null
          pdf_page?: number | null
          question_number: number
          question_text?: string | null
          section_id: string
          solution_image_url?: string | null
          solution_image_urls?: Json | null
          solution_text?: string | null
          test_id: string
          time_seconds?: number | null
          topic?: string | null
          updated_at?: string
        }
        Update: {
          chapter?: string | null
          correct_answer?: Json
          created_at?: string
          difficulty?: string | null
          id?: string
          image_url?: string | null
          image_urls?: Json | null
          is_bonus?: boolean | null
          library_question_id?: string | null
          marks?: number | null
          negative_marks?: number | null
          options?: Json | null
          order_index?: number | null
          paragraph_id?: string | null
          pdf_page?: number | null
          question_number?: number
          question_text?: string | null
          section_id?: string
          solution_image_url?: string | null
          solution_image_urls?: Json | null
          solution_text?: string | null
          test_id?: string
          time_seconds?: number | null
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_section_questions_library_question_id_fkey"
            columns: ["library_question_id"]
            isOneToOne: false
            referencedRelation: "phynetix_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_section_questions_paragraph_id_fkey"
            columns: ["paragraph_id"]
            isOneToOne: false
            referencedRelation: "question_paragraphs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_section_questions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "test_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_section_questions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      test_sections: {
        Row: {
          created_at: string
          id: string
          name: string | null
          order_index: number | null
          section_type: string
          subject_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
          order_index?: number | null
          section_type?: string
          subject_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          order_index?: number | null
          section_type?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_sections_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "test_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      test_subjects: {
        Row: {
          created_at: string
          id: string
          name: string
          order_index: number | null
          test_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          order_index?: number | null
          test_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          order_index?: number | null
          test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_subjects_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      tests: {
        Row: {
          answer_key_uploaded: boolean | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number
          exam_type: string | null
          fullscreen_enabled: boolean | null
          id: string
          instructions_json: Json | null
          is_published: boolean | null
          name: string
          pdf_url: string | null
          scheduled_at: string | null
          show_solutions: boolean | null
          solution_reopen_mode: boolean | null
          test_type: string
          updated_at: string
        }
        Insert: {
          answer_key_uploaded?: boolean | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          exam_type?: string | null
          fullscreen_enabled?: boolean | null
          id?: string
          instructions_json?: Json | null
          is_published?: boolean | null
          name: string
          pdf_url?: string | null
          scheduled_at?: string | null
          show_solutions?: boolean | null
          solution_reopen_mode?: boolean | null
          test_type?: string
          updated_at?: string
        }
        Update: {
          answer_key_uploaded?: boolean | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          exam_type?: string | null
          fullscreen_enabled?: boolean | null
          id?: string
          instructions_json?: Json | null
          is_published?: boolean | null
          name?: string
          pdf_url?: string | null
          scheduled_at?: string | null
          show_solutions?: boolean | null
          solution_reopen_mode?: boolean | null
          test_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          department_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          department_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          department_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_institution_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_test_access: {
        Args: { _test_id: string; _user_id: string }
        Returns: boolean
      }
      is_enrolled_in_batch: {
        Args: { _batch_id: string; _user_id: string }
        Returns: boolean
      }
      is_institution_admin: {
        Args: { _institution_id: string; _user_id: string }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      join_batch_with_code: { Args: { _code: string }; Returns: Json }
      proctoring_schema_health: { Args: never; Returns: Json }
      prune_proctoring_data: {
        Args: { target_test_id?: string }
        Returns: {
          deleted_alerts: number
          deleted_events: number
          deleted_recordings: number
          deleted_sessions: number
        }[]
      }
      user_completed_test: {
        Args: { _test_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "student"
        | "head"
        | "manager"
        | "teacher"
        | "data_manager"
        | "test_manager"
        | "finance_admin"
        | "academic_admin"
        | "operations_admin"
        | "marketing_admin"
      proctoring_alert_severity: "low" | "medium" | "high" | "critical"
      proctoring_event_type:
        | "consent_accepted"
        | "permission_state"
        | "session_started"
        | "session_stopped"
        | "heartbeat"
        | "question_change"
        | "subject_change"
        | "answer_saved"
        | "fullscreen_exit"
        | "focus_lost"
        | "focus_returned"
        | "visibility_hidden"
        | "visibility_visible"
        | "screen_share_stopped"
        | "camera_stopped"
        | "microphone_muted"
        | "provider_connected"
        | "provider_disconnected"
        | "failure"
      proctoring_session_status:
        | "pending"
        | "active"
        | "ended"
        | "failed"
        | "stale"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "student",
        "head",
        "manager",
        "teacher",
        "data_manager",
        "test_manager",
        "finance_admin",
        "academic_admin",
        "operations_admin",
        "marketing_admin",
      ],
      proctoring_alert_severity: ["low", "medium", "high", "critical"],
      proctoring_event_type: [
        "consent_accepted",
        "permission_state",
        "session_started",
        "session_stopped",
        "heartbeat",
        "question_change",
        "subject_change",
        "answer_saved",
        "fullscreen_exit",
        "focus_lost",
        "focus_returned",
        "visibility_hidden",
        "visibility_visible",
        "screen_share_stopped",
        "camera_stopped",
        "microphone_muted",
        "provider_connected",
        "provider_disconnected",
        "failure",
      ],
      proctoring_session_status: [
        "pending",
        "active",
        "ended",
        "failed",
        "stale",
      ],
    },
  },
} as const

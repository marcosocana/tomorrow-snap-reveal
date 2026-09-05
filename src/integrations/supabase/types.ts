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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audio_likes: {
        Row: {
          audio_id: string
          created_at: string
          device_id: string | null
          id: string
        }
        Insert: {
          audio_id: string
          created_at?: string
          device_id?: string | null
          id?: string
        }
        Update: {
          audio_id?: string
          created_at?: string
          device_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_likes_audio_id_fkey"
            columns: ["audio_id"]
            isOneToOne: false
            referencedRelation: "audios"
            referencedColumns: ["id"]
          },
        ]
      }
      audios: {
        Row: {
          audio_url: string
          captured_at: string
          duration_seconds: number | null
          event_id: string
          id: string
          metadata: Json | null
        }
        Insert: {
          audio_url: string
          captured_at?: string
          duration_seconds?: number | null
          event_id: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          audio_url?: string
          captured_at?: string
          duration_seconds?: number | null
          event_id?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audios_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          content_html: string
          created_at: string | null
          excerpt: string
          id: string
          image_url: string
          lang: string
          slug: string
          tags: Json | null
          title: string
          updated_at: string | null
        }
        Insert: {
          content_html: string
          created_at?: string | null
          excerpt: string
          id?: string
          image_url: string
          lang: string
          slug: string
          tags?: Json | null
          title: string
          updated_at?: string | null
        }
        Update: {
          content_html?: string
          created_at?: string | null
          excerpt?: string
          id?: string
          image_url?: string
          lang?: string
          slug?: string
          tags?: Json | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      captains_challenge_catalog: {
        Row: {
          category: string | null
          created_at: string
          default_points: number
          description: string | null
          difficulty: string | null
          evidence_type: string
          has_time_limit: boolean
          id: string
          is_active: boolean
          question_correct_option: string | null
          question_options: Json | null
          time_limit_seconds: number | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          default_points?: number
          description?: string | null
          difficulty?: string | null
          evidence_type?: string
          has_time_limit?: boolean
          id?: string
          is_active?: boolean
          question_correct_option?: string | null
          question_options?: Json | null
          time_limit_seconds?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          default_points?: number
          description?: string | null
          difficulty?: string | null
          evidence_type?: string
          has_time_limit?: boolean
          id?: string
          is_active?: boolean
          question_correct_option?: string | null
          question_options?: Json | null
          time_limit_seconds?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      captains_creation_codes: {
        Row: {
          account_owner_id: string | null
          code: string
          created_at: string
          created_by: string | null
          event_id: string | null
          expires_at: string
          id: string
          max_tables: number
          redeemed_at: string | null
        }
        Insert: {
          account_owner_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          expires_at?: string
          id?: string
          max_tables: number
          redeemed_at?: string | null
        }
        Update: {
          account_owner_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          expires_at?: string
          id?: string
          max_tables?: number
          redeemed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "captains_creation_codes_account_owner_id_fkey"
            columns: ["account_owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captains_creation_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captains_creation_codes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "captains_events"
            referencedColumns: ["id"]
          },
        ]
      }
      captains_event_challenges: {
        Row: {
          catalog_challenge_id: string | null
          category: string | null
          created_at: string
          description: string | null
          difficulty: string | null
          event_id: string
          evidence_type: string
          has_time_limit: boolean
          id: string
          is_required: boolean
          order_index: number
          points: number
          question_correct_option: string | null
          question_options: Json | null
          time_limit_seconds: number | null
          title: string
          updated_at: string
        }
        Insert: {
          catalog_challenge_id?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          difficulty?: string | null
          event_id: string
          evidence_type?: string
          has_time_limit?: boolean
          id?: string
          is_required?: boolean
          order_index?: number
          points?: number
          question_correct_option?: string | null
          question_options?: Json | null
          time_limit_seconds?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          catalog_challenge_id?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          difficulty?: string | null
          event_id?: string
          evidence_type?: string
          has_time_limit?: boolean
          id?: string
          is_required?: boolean
          order_index?: number
          points?: number
          question_correct_option?: string | null
          question_options?: Json | null
          time_limit_seconds?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "captains_event_challenges_catalog_challenge_id_fkey"
            columns: ["catalog_challenge_id"]
            isOneToOne: false
            referencedRelation: "captains_challenge_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captains_event_challenges_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "captains_events"
            referencedColumns: ["id"]
          },
        ]
      }
      captains_events: {
        Row: {
          admin_event_tab: string | null
          background_image_url: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          deletion_lock_pin: string | null
          description: string | null
          end_time: string | null
          experience_version: string
          id: string
          name: string
          owner_id: string | null
          primary_color: string | null
          public_url: string | null
          qr_url: string | null
          scoring_mode: string
          secondary_color: string | null
          show_live_gallery_after_completion: boolean
          slug: string
          start_time: string | null
          status: string
          theme_style: string
          updated_at: string
        }
        Insert: {
          admin_event_tab?: string | null
          background_image_url?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          deletion_lock_pin?: string | null
          description?: string | null
          end_time?: string | null
          experience_version?: string
          id?: string
          name: string
          owner_id?: string | null
          primary_color?: string | null
          public_url?: string | null
          qr_url?: string | null
          scoring_mode?: string
          secondary_color?: string | null
          show_live_gallery_after_completion?: boolean
          slug: string
          start_time?: string | null
          status?: string
          theme_style?: string
          updated_at?: string
        }
        Update: {
          admin_event_tab?: string | null
          background_image_url?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          deletion_lock_pin?: string | null
          description?: string | null
          end_time?: string | null
          experience_version?: string
          id?: string
          name?: string
          owner_id?: string | null
          primary_color?: string | null
          public_url?: string | null
          qr_url?: string | null
          scoring_mode?: string
          secondary_color?: string | null
          show_live_gallery_after_completion?: boolean
          slug?: string
          start_time?: string | null
          status?: string
          theme_style?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "captains_events_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      captains_evidence: {
        Row: {
          admin_comment: string | null
          captain_name: string | null
          created_at: string
          deleted_at: string | null
          elapsed_seconds: number | null
          event_id: string
          evidence_type: string
          file_url: string
          id: string
          points_awarded: number
          remaining_seconds: number | null
          reviewed_at: string | null
          reviewer_id: string | null
          status: string
          table_challenge_id: string | null
          table_id: string
          updated_at: string
        }
        Insert: {
          admin_comment?: string | null
          captain_name?: string | null
          created_at?: string
          deleted_at?: string | null
          elapsed_seconds?: number | null
          event_id: string
          evidence_type?: string
          file_url: string
          id?: string
          points_awarded?: number
          remaining_seconds?: number | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
          table_challenge_id?: string | null
          table_id: string
          updated_at?: string
        }
        Update: {
          admin_comment?: string | null
          captain_name?: string | null
          created_at?: string
          deleted_at?: string | null
          elapsed_seconds?: number | null
          event_id?: string
          evidence_type?: string
          file_url?: string
          id?: string
          points_awarded?: number
          remaining_seconds?: number | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
          table_challenge_id?: string | null
          table_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "captains_evidence_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "captains_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captains_evidence_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captains_evidence_table_challenge_id_fkey"
            columns: ["table_challenge_id"]
            isOneToOne: false
            referencedRelation: "captains_table_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captains_evidence_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "captains_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      captains_table_accesses: {
        Row: {
          captain_name: string | null
          created_at: string
          device_id: string | null
          device_info: Json | null
          event_id: string | null
          id: string
          selected_at: string | null
          session_token: string | null
          table_id: string
          table_name: string | null
          user_agent: string | null
        }
        Insert: {
          captain_name?: string | null
          created_at?: string
          device_id?: string | null
          device_info?: Json | null
          event_id?: string | null
          id?: string
          selected_at?: string | null
          session_token?: string | null
          table_id: string
          table_name?: string | null
          user_agent?: string | null
        }
        Update: {
          captain_name?: string | null
          created_at?: string
          device_id?: string | null
          device_info?: Json | null
          event_id?: string | null
          id?: string
          selected_at?: string | null
          session_token?: string | null
          table_id?: string
          table_name?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "captains_table_accesses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "captains_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captains_table_accesses_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "captains_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      captains_table_challenges: {
        Row: {
          automatic_score_calculated: boolean
          challenge_id: string
          created_at: string
          elapsed_seconds: number | null
          event_id: string
          id: string
          is_time_expired: boolean
          points_awarded: number
          question_answer: string | null
          randomized_order_index: number
          remaining_seconds: number | null
          reviewed_at: string | null
          started_at: string | null
          status: string
          submitted_at: string | null
          table_id: string
          updated_at: string
        }
        Insert: {
          automatic_score_calculated?: boolean
          challenge_id: string
          created_at?: string
          elapsed_seconds?: number | null
          event_id: string
          id?: string
          is_time_expired?: boolean
          points_awarded?: number
          question_answer?: string | null
          randomized_order_index?: number
          remaining_seconds?: number | null
          reviewed_at?: string | null
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          table_id: string
          updated_at?: string
        }
        Update: {
          automatic_score_calculated?: boolean
          challenge_id?: string
          created_at?: string
          elapsed_seconds?: number | null
          event_id?: string
          id?: string
          is_time_expired?: boolean
          points_awarded?: number
          question_answer?: string | null
          randomized_order_index?: number
          remaining_seconds?: number | null
          reviewed_at?: string | null
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          table_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "captains_table_challenges_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "captains_event_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captains_table_challenges_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "captains_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captains_table_challenges_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "captains_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      captains_tables: {
        Row: {
          active_captain_name: string | null
          captain_name: string | null
          captain_photo_url: string | null
          captain_sprite: string | null
          captain_sprite_config: Json | null
          claim_device_hash: string | null
          claimed_at: string | null
          completed_at: string | null
          completed_challenges: number
          created_at: string
          current_challenge_id: string | null
          event_id: string
          failed_challenges: number
          id: string
          last_activity_at: string | null
          session_token: string | null
          table_name: string
          table_number: number
          total_points: number
          updated_at: string
        }
        Insert: {
          active_captain_name?: string | null
          captain_name?: string | null
          captain_photo_url?: string | null
          captain_sprite?: string | null
          captain_sprite_config?: Json | null
          claim_device_hash?: string | null
          claimed_at?: string | null
          completed_at?: string | null
          completed_challenges?: number
          created_at?: string
          current_challenge_id?: string | null
          event_id: string
          failed_challenges?: number
          id?: string
          last_activity_at?: string | null
          session_token?: string | null
          table_name: string
          table_number: number
          total_points?: number
          updated_at?: string
        }
        Update: {
          active_captain_name?: string | null
          captain_name?: string | null
          captain_photo_url?: string | null
          captain_sprite?: string | null
          captain_sprite_config?: Json | null
          claim_device_hash?: string | null
          claimed_at?: string | null
          completed_at?: string | null
          completed_challenges?: number
          created_at?: string
          current_challenge_id?: string | null
          event_id?: string
          failed_challenges?: number
          id?: string
          last_activity_at?: string | null
          session_token?: string | null
          table_name?: string
          table_number?: number
          total_points?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "captains_tables_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "captains_events"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_lifecycle_email_jobs: {
        Row: {
          attempts: number
          created_at: string
          dedupe_key: string
          due_at: string
          email_type: string
          event_id: string
          id: string
          last_error: string | null
          sent_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          dedupe_key: string
          due_at: string
          email_type: string
          event_id: string
          id?: string
          last_error?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          dedupe_key?: string
          due_at?: string
          email_type?: string
          event_id?: string
          id?: string
          last_error?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_lifecycle_email_jobs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_lifecycle_email_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      event_folders: {
        Row: {
          background_image_url: string | null
          created_at: string
          custom_image_url: string | null
          font_family: string | null
          font_size: string | null
          id: string
          is_demo: boolean
          name: string
        }
        Insert: {
          background_image_url?: string | null
          created_at?: string
          custom_image_url?: string | null
          font_family?: string | null
          font_size?: string | null
          id?: string
          is_demo?: boolean
          name: string
        }
        Update: {
          background_image_url?: string | null
          created_at?: string
          custom_image_url?: string | null
          font_family?: string | null
          font_size?: string | null
          id?: string
          is_demo?: boolean
          name?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          admin_password: string | null
          allow_audio_recording: boolean
          allow_image_attachment: boolean
          allow_photo_deletion: boolean
          allow_photo_sharing: boolean
          allow_video_attachment: boolean
          allow_video_recording: boolean
          background_image_url: string | null
          country_code: string
          created_at: string
          custom_image_url: string | null
          custom_privacy_text: string | null
          custom_terms_text: string | null
          description: string | null
          event_number: number
          expiry_date: string | null
          expiry_redirect_url: string | null
          filter_type: string
          folder_id: string | null
          font_family: string
          font_size: string
          gallery_view_mode: string
          header_style: string
          hide_reveal_date: boolean
          id: string
          is_demo: boolean
          language: string
          legal_text_type: string
          like_counting_enabled: boolean
          limits_json: Json | null
          max_audio_duration: number
          max_audios: number
          max_photos: number | null
          max_video_duration: number
          max_videos: number
          name: string
          owner_id: string | null
          password_hash: string
          plan_id: string | null
          reveal_time: string
          show_legal_text: boolean
          sort_order: number | null
          timezone: string
          type: string | null
          upload_end_time: string | null
          upload_start_time: string | null
        }
        Insert: {
          admin_password?: string | null
          allow_audio_recording?: boolean
          allow_image_attachment?: boolean
          allow_photo_deletion?: boolean
          allow_photo_sharing?: boolean
          allow_video_attachment?: boolean
          allow_video_recording?: boolean
          background_image_url?: string | null
          country_code?: string
          created_at?: string
          custom_image_url?: string | null
          custom_privacy_text?: string | null
          custom_terms_text?: string | null
          description?: string | null
          event_number?: number
          expiry_date?: string | null
          expiry_redirect_url?: string | null
          filter_type?: string
          folder_id?: string | null
          font_family?: string
          font_size?: string
          gallery_view_mode?: string
          header_style?: string
          hide_reveal_date?: boolean
          id?: string
          is_demo?: boolean
          language?: string
          legal_text_type?: string
          like_counting_enabled?: boolean
          limits_json?: Json | null
          max_audio_duration?: number
          max_audios?: number
          max_photos?: number | null
          max_video_duration?: number
          max_videos?: number
          name: string
          owner_id?: string | null
          password_hash: string
          plan_id?: string | null
          reveal_time: string
          show_legal_text?: boolean
          sort_order?: number | null
          timezone?: string
          type?: string | null
          upload_end_time?: string | null
          upload_start_time?: string | null
        }
        Update: {
          admin_password?: string | null
          allow_audio_recording?: boolean
          allow_image_attachment?: boolean
          allow_photo_deletion?: boolean
          allow_photo_sharing?: boolean
          allow_video_attachment?: boolean
          allow_video_recording?: boolean
          background_image_url?: string | null
          country_code?: string
          created_at?: string
          custom_image_url?: string | null
          custom_privacy_text?: string | null
          custom_terms_text?: string | null
          description?: string | null
          event_number?: number
          expiry_date?: string | null
          expiry_redirect_url?: string | null
          filter_type?: string
          folder_id?: string | null
          font_family?: string
          font_size?: string
          gallery_view_mode?: string
          header_style?: string
          hide_reveal_date?: boolean
          id?: string
          is_demo?: boolean
          language?: string
          legal_text_type?: string
          like_counting_enabled?: boolean
          limits_json?: Json | null
          max_audio_duration?: number
          max_audios?: number
          max_photos?: number | null
          max_video_duration?: number
          max_videos?: number
          name?: string
          owner_id?: string | null
          password_hash?: string
          plan_id?: string | null
          reveal_time?: string
          show_legal_text?: boolean
          sort_order?: number | null
          timezone?: string
          type?: string | null
          upload_end_time?: string | null
          upload_start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "event_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      password_resets: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          token_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          token_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          token_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      photo_likes: {
        Row: {
          created_at: string
          device_id: string | null
          id: string
          photo_id: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          id?: string
          photo_id: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          id?: string
          photo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_likes_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          captured_at: string
          event_id: string
          id: string
          image_url: string
          metadata: Json | null
        }
        Insert: {
          captured_at?: string
          event_id: string
          id?: string
          image_url: string
          metadata?: Json | null
        }
        Update: {
          captured_at?: string
          event_id?: string
          id?: string
          image_url?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "photos_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      photostrip_event_configs: {
        Row: {
          countdown_seconds: number
          created_at: string
          enabled: boolean
          event_id: string
          gallery_views: number
          gallery_visibility: string
          logo_path: string | null
          logo_url: string | null
          max_strips: number | null
          photo_count: number
          photo_mode: string
          slug: string
          strip_display_name: string | null
          strip_footer_text: string | null
          strip_template: string
          updated_at: string
        }
        Insert: {
          countdown_seconds?: number
          created_at?: string
          enabled?: boolean
          event_id: string
          gallery_views?: number
          gallery_visibility?: string
          logo_path?: string | null
          logo_url?: string | null
          max_strips?: number | null
          photo_count?: number
          photo_mode?: string
          slug: string
          strip_display_name?: string | null
          strip_footer_text?: string | null
          strip_template?: string
          updated_at?: string
        }
        Update: {
          countdown_seconds?: number
          created_at?: string
          enabled?: boolean
          event_id?: string
          gallery_views?: number
          gallery_visibility?: string
          logo_path?: string | null
          logo_url?: string | null
          max_strips?: number | null
          photo_count?: number
          photo_mode?: string
          slug?: string
          strip_display_name?: string | null
          strip_footer_text?: string | null
          strip_template?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "photostrip_event_configs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      photostrip_participations: {
        Row: {
          access_token_hash: string
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          download_count: number
          event_id: string
          id: string
          is_visible: boolean
          mode: string
          participant_id: string
          status: string
          strip_path: string | null
          thumbnail_path: string | null
          updated_at: string
        }
        Insert: {
          access_token_hash: string
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          download_count?: number
          event_id: string
          id?: string
          is_visible?: boolean
          mode: string
          participant_id: string
          status?: string
          strip_path?: string | null
          thumbnail_path?: string | null
          updated_at?: string
        }
        Update: {
          access_token_hash?: string
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          download_count?: number
          event_id?: string
          id?: string
          is_visible?: boolean
          mode?: string
          participant_id?: string
          status?: string
          strip_path?: string | null
          thumbnail_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "photostrip_participations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      photostrip_photos: {
        Row: {
          created_at: string
          event_id: string
          id: string
          image_path: string
          participation_id: string
          position: number
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          image_path: string
          participation_id: string
          position: number
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          image_path?: string
          participation_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "photostrip_photos_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photostrip_photos_participation_id_fkey"
            columns: ["participation_id"]
            isOneToOne: false
            referencedRelation: "photostrip_participations"
            referencedColumns: ["id"]
          },
        ]
      }
      public_event_configs: {
        Row: {
          allow_audio_recording: boolean
          allow_image_attachment: boolean
          allow_photo_deletion: boolean
          allow_photo_sharing: boolean
          allow_video_attachment: boolean
          allow_video_recording: boolean
          background_image_url: string | null
          country_code: string | null
          custom_image_url: string | null
          custom_privacy_text: string | null
          custom_terms_text: string | null
          description: string | null
          event_id: string
          expiry_date: string | null
          expiry_redirect_url: string | null
          filter_type: string | null
          folder_id: string | null
          font_family: string | null
          font_size: string | null
          gallery_view_mode: string | null
          header_style: string | null
          hide_reveal_date: boolean
          is_demo: boolean
          language: string | null
          legal_text_type: string | null
          like_counting_enabled: boolean
          limits_json: Json | null
          max_audio_duration: number
          max_audios: number
          max_photos: number | null
          max_video_duration: number
          max_videos: number
          name: string
          plan_id: string | null
          qr_password_required_camera: boolean
          qr_password_required_gallery: boolean
          reveal_time: string
          show_legal_text: boolean
          timezone: string | null
          type: string | null
          updated_at: string
          upload_end_time: string | null
          upload_start_time: string | null
        }
        Insert: {
          allow_audio_recording?: boolean
          allow_image_attachment?: boolean
          allow_photo_deletion?: boolean
          allow_photo_sharing?: boolean
          allow_video_attachment?: boolean
          allow_video_recording?: boolean
          background_image_url?: string | null
          country_code?: string | null
          custom_image_url?: string | null
          custom_privacy_text?: string | null
          custom_terms_text?: string | null
          description?: string | null
          event_id: string
          expiry_date?: string | null
          expiry_redirect_url?: string | null
          filter_type?: string | null
          folder_id?: string | null
          font_family?: string | null
          font_size?: string | null
          gallery_view_mode?: string | null
          header_style?: string | null
          hide_reveal_date?: boolean
          is_demo?: boolean
          language?: string | null
          legal_text_type?: string | null
          like_counting_enabled?: boolean
          limits_json?: Json | null
          max_audio_duration?: number
          max_audios?: number
          max_photos?: number | null
          max_video_duration?: number
          max_videos?: number
          name: string
          plan_id?: string | null
          qr_password_required_camera?: boolean
          qr_password_required_gallery?: boolean
          reveal_time: string
          show_legal_text?: boolean
          timezone?: string | null
          type?: string | null
          updated_at?: string
          upload_end_time?: string | null
          upload_start_time?: string | null
        }
        Update: {
          allow_audio_recording?: boolean
          allow_image_attachment?: boolean
          allow_photo_deletion?: boolean
          allow_photo_sharing?: boolean
          allow_video_attachment?: boolean
          allow_video_recording?: boolean
          background_image_url?: string | null
          country_code?: string | null
          custom_image_url?: string | null
          custom_privacy_text?: string | null
          custom_terms_text?: string | null
          description?: string | null
          event_id?: string
          expiry_date?: string | null
          expiry_redirect_url?: string | null
          filter_type?: string | null
          folder_id?: string | null
          font_family?: string | null
          font_size?: string | null
          gallery_view_mode?: string | null
          header_style?: string | null
          hide_reveal_date?: boolean
          is_demo?: boolean
          language?: string | null
          legal_text_type?: string | null
          like_counting_enabled?: boolean
          limits_json?: Json | null
          max_audio_duration?: number
          max_audios?: number
          max_photos?: number | null
          max_video_duration?: number
          max_videos?: number
          name?: string
          plan_id?: string | null
          qr_password_required_camera?: boolean
          qr_password_required_gallery?: boolean
          reveal_time?: string
          show_legal_text?: boolean
          timezone?: string | null
          type?: string | null
          updated_at?: string
          upload_end_time?: string | null
          upload_start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_event_configs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_email_outbox: {
        Row: {
          attempts: number
          created_at: string
          email_type: string
          id: string
          last_error: string | null
          next_attempt_at: string
          payload: Json
          provider_message_id: string | null
          purchase_id: string
          recipient: string
          sent_at: string | null
          status: string
          stripe_event_id: string
          stripe_session_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          email_type: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          payload: Json
          provider_message_id?: string | null
          purchase_id: string
          recipient: string
          sent_at?: string | null
          status?: string
          stripe_event_id: string
          stripe_session_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          email_type?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          payload?: Json
          provider_message_id?: string | null
          purchase_id?: string
          recipient?: string
          sent_at?: string | null
          status?: string
          stripe_event_id?: string
          stripe_session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_email_outbox_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          created_at: string | null
          gift_recipient_name: string | null
          gifted_at: string | null
          id: string
          plan_id: string
          redeem_token: string | null
          redeem_token_expires_at: string | null
          redeemed_at: string | null
          status: string
          stripe_session_id: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          gift_recipient_name?: string | null
          gifted_at?: string | null
          id?: string
          plan_id: string
          redeem_token?: string | null
          redeem_token_expires_at?: string | null
          redeemed_at?: string | null
          status: string
          stripe_session_id?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          gift_recipient_name?: string | null
          gifted_at?: string | null
          id?: string
          plan_id?: string
          redeem_token?: string | null
          redeem_token_expires_at?: string | null
          redeemed_at?: string | null
          status?: string
          stripe_session_id?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: {
          created_at: string
          event_id: string
          event_type: string
          id: string
          last_error: string | null
          status: string
          stripe_session_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          event_type: string
          id?: string
          last_error?: string | null
          status: string
          stripe_session_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: string
          id?: string
          last_error?: string | null
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      time_capsule_unlock_credentials: {
        Row: {
          attempts: number
          created_at: string
          due_at: string
          event_id: string
          last_error: string | null
          password_hash: string
          sent_at: string | null
          status: string
          unlock_password: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          due_at: string
          event_id: string
          last_error?: string | null
          password_hash: string
          sent_at?: string | null
          status?: string
          unlock_password: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          due_at?: string
          event_id?: string
          last_error?: string | null
          password_hash?: string
          sent_at?: string | null
          status?: string
          unlock_password?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_capsule_unlock_credentials_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string
          id: string
          marketing_opt_in: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          marketing_opt_in?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          marketing_opt_in?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      video_likes: {
        Row: {
          created_at: string
          device_id: string | null
          id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          id?: string
          video_id: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_likes_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          captured_at: string
          duration_seconds: number | null
          event_id: string
          id: string
          metadata: Json | null
          thumbnail_url: string | null
          video_url: string
        }
        Insert: {
          captured_at?: string
          duration_seconds?: number | null
          event_id: string
          id?: string
          metadata?: Json | null
          thumbnail_url?: string | null
          video_url: string
        }
        Update: {
          captured_at?: string
          duration_seconds?: number | null
          event_id?: string
          id?: string
          metadata?: Json | null
          thumbnail_url?: string | null
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "videos_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      users: {
        Row: {
          email: string | null
          id: string | null
        }
        Insert: {
          email?: string | null
          id?: string | null
        }
        Update: {
          email?: string | null
          id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_manage_revelao_event: {
        Args: { target_event_id: string }
        Returns: boolean
      }
      captains_event_status: {
        Args: { _end: string; _start: string }
        Returns: string
      }
      claim_captains_table: {
        Args: {
          p_captain_name: string
          p_device_id: string
          p_device_info?: Json
          p_table_id: string
          p_user_agent?: string
        }
        Returns: Json
      }
      claim_demo_lifecycle_email_jobs: {
        Args: { batch_limit?: number; stale_before: string; worker_now: string }
        Returns: {
          attempts: number
          dedupe_key: string
          email_type: string
          event_id: string
          id: string
          user_id: string
        }[]
      }
      claim_photostrip_participation: {
        Args: {
          target_access_token_hash: string
          target_event_id: string
          target_mode: string
          target_participant_id: string
        }
        Returns: {
          access_token_hash: string
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          download_count: number
          event_id: string
          id: string
          is_visible: boolean
          mode: string
          participant_id: string
          status: string
          strip_path: string | null
          thumbnail_path: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "photostrip_participations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_purchase_email_jobs: {
        Args: { batch_limit?: number; stale_before: string; worker_now: string }
        Returns: {
          attempts: number
          created_at: string
          email_type: string
          id: string
          last_error: string | null
          next_attempt_at: string
          payload: Json
          provider_message_id: string | null
          purchase_id: string
          recipient: string
          sent_at: string | null
          status: string
          stripe_event_id: string
          stripe_session_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "purchase_email_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_time_capsule_unlock_jobs: {
        Args: { batch_limit?: number; stale_before: string; worker_now: string }
        Returns: {
          attempts: number
          event_id: string
          unlock_password: string
        }[]
      }
      complete_photostrip_participation: {
        Args: {
          target_event_id: string
          target_participation_id: string
          target_photo_paths: string[]
          target_strip_path: string
          target_thumbnail_path: string
        }
        Returns: {
          access_token_hash: string
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          download_count: number
          event_id: string
          id: string
          is_visible: boolean
          mode: string
          participant_id: string
          status: string
          strip_path: string | null
          thumbnail_path: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "photostrip_participations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_event_media_counts: {
        Args: { target_event_id: string }
        Returns: {
          audio_count: number
          photo_count: number
          video_count: number
        }[]
      }
      get_event_media_counts_batch: {
        Args: { target_event_ids: string[] }
        Returns: {
          audio_count: number
          event_id: string
          photo_count: number
          video_count: number
        }[]
      }
      get_photostrip_admin_metrics: {
        Args: { target_event_id: string }
        Returns: Json
      }
      increment_photostrip_gallery_views: {
        Args: { target_event_id: string }
        Returns: undefined
      }
      resolve_public_event_access: {
        Args: { candidate_password: string }
        Returns: {
          id: string
          language: string
          name: string
          qr_password_required_camera: boolean
          qr_password_required_gallery: boolean
          reveal_time: string
          timezone: string
        }[]
      }
      sanitize_public_event_limits: { Args: { raw: Json }; Returns: Json }
      schedule_demo_lifecycle_email_cron: { Args: never; Returns: undefined }
      schedule_purchase_email_outbox_cron: { Args: never; Returns: undefined }
      schedule_time_capsule_unlock_cron: { Args: never; Returns: undefined }
      verify_event_qr_password: {
        Args: {
          candidate_password: string
          target_event_id: string
          target_scope: string
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

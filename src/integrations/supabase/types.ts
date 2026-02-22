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
          allow_photo_deletion: boolean
          allow_photo_sharing: boolean
          background_image_url: string | null
          country_code: string
          created_at: string
          custom_image_url: string | null
          custom_privacy_text: string | null
          custom_terms_text: string | null
          description: string | null
          expiry_date: string | null
          expiry_redirect_url: string | null
          filter_type: string
          folder_id: string | null
          font_family: string
          font_size: string
          gallery_view_mode: string
          id: string
          is_demo: boolean
          language: string
          legal_text_type: string
          like_counting_enabled: boolean
          limits_json: Json | null
          max_photos: number | null
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
          allow_photo_deletion?: boolean
          allow_photo_sharing?: boolean
          background_image_url?: string | null
          country_code?: string
          created_at?: string
          custom_image_url?: string | null
          custom_privacy_text?: string | null
          custom_terms_text?: string | null
          description?: string | null
          expiry_date?: string | null
          expiry_redirect_url?: string | null
          filter_type?: string
          folder_id?: string | null
          font_family?: string
          font_size?: string
          gallery_view_mode?: string
          id?: string
          is_demo?: boolean
          language?: string
          legal_text_type?: string
          like_counting_enabled?: boolean
          limits_json?: Json | null
          max_photos?: number | null
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
          allow_photo_deletion?: boolean
          allow_photo_sharing?: boolean
          background_image_url?: string | null
          country_code?: string
          created_at?: string
          custom_image_url?: string | null
          custom_privacy_text?: string | null
          custom_terms_text?: string | null
          description?: string | null
          expiry_date?: string | null
          expiry_redirect_url?: string | null
          filter_type?: string
          folder_id?: string | null
          font_family?: string
          font_size?: string
          gallery_view_mode?: string
          id?: string
          is_demo?: boolean
          language?: string
          legal_text_type?: string
          like_counting_enabled?: boolean
          limits_json?: Json | null
          max_photos?: number | null
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
      user_profiles: {
        Row: {
          created_at: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
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
      [_ in never]: never
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
    Enums: {},
  },
} as const

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      app_users: {
        Row: {
          created_at: string;
          display_name: string | null;
          email: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      investor_profiles: {
        Row: {
          cash_buffer_range: string | null;
          created_at: string;
          experience_level: string;
          id: string;
          investment_style: string | null;
          max_loss_percent: number | null;
          max_position_percent: number | null;
          preferred_question_style: string;
          profile_json: Json;
          risk_tolerance: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          cash_buffer_range?: string | null;
          created_at?: string;
          experience_level?: string;
          id?: string;
          investment_style?: string | null;
          max_loss_percent?: number | null;
          max_position_percent?: number | null;
          preferred_question_style?: string;
          profile_json?: Json;
          risk_tolerance?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          cash_buffer_range?: string | null;
          created_at?: string;
          experience_level?: string;
          id?: string;
          investment_style?: string | null;
          max_loss_percent?: number | null;
          max_position_percent?: number | null;
          preferred_question_style?: string;
          profile_json?: Json;
          risk_tolerance?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "investor_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
        ];
      };
      rule_answers: {
        Row: {
          answer_json: Json;
          answer_text: string | null;
          created_at: string;
          id: string;
          question_id: string | null;
          question_key: string;
          session_id: string;
          user_id: string;
        };
        Insert: {
          answer_json?: Json;
          answer_text?: string | null;
          created_at?: string;
          id?: string;
          question_id?: string | null;
          question_key: string;
          session_id: string;
          user_id: string;
        };
        Update: {
          answer_json?: Json;
          answer_text?: string | null;
          created_at?: string;
          id?: string;
          question_id?: string | null;
          question_key?: string;
          session_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rule_answers_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "rule_questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rule_answers_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "rule_design_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rule_answers_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
        ];
      };
      rule_design_sessions: {
        Row: {
          company_name: string | null;
          completion_score: number | null;
          created_at: string;
          currency: string | null;
          finalized_at: string | null;
          id: string;
          last_reviewed_at: string | null;
          market: string | null;
          max_question_count: number;
          quality_gate_status: string | null;
          question_count: number;
          rule_json: Json;
          status: string;
          template_key: string | null;
          ticker: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          company_name?: string | null;
          completion_score?: number | null;
          created_at?: string;
          currency?: string | null;
          finalized_at?: string | null;
          id?: string;
          last_reviewed_at?: string | null;
          market?: string | null;
          max_question_count?: number;
          quality_gate_status?: string | null;
          question_count?: number;
          rule_json?: Json;
          status?: string;
          template_key?: string | null;
          ticker: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          company_name?: string | null;
          completion_score?: number | null;
          created_at?: string;
          currency?: string | null;
          finalized_at?: string | null;
          id?: string;
          last_reviewed_at?: string | null;
          market?: string | null;
          max_question_count?: number;
          quality_gate_status?: string | null;
          question_count?: number;
          rule_json?: Json;
          status?: string;
          template_key?: string | null;
          ticker?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rule_design_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
        ];
      };
      rule_quality_checks: {
        Row: {
          check_key: string;
          created_at: string;
          id: string;
          label: string;
          reason: string;
          review_id: string | null;
          session_id: string;
          severity: string;
          status: string;
          suggested_question: string | null;
          user_id: string;
        };
        Insert: {
          check_key: string;
          created_at?: string;
          id?: string;
          label: string;
          reason: string;
          review_id?: string | null;
          session_id: string;
          severity: string;
          status: string;
          suggested_question?: string | null;
          user_id: string;
        };
        Update: {
          check_key?: string;
          created_at?: string;
          id?: string;
          label?: string;
          reason?: string;
          review_id?: string | null;
          session_id?: string;
          severity?: string;
          status?: string;
          suggested_question?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rule_quality_checks_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: false;
            referencedRelation: "rule_reviews";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rule_quality_checks_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "rule_design_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rule_quality_checks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
        ];
      };
      rule_questions: {
        Row: {
          answered_at: string | null;
          created_at: string;
          display_order: number;
          help_text: string | null;
          id: string;
          is_required: boolean;
          maps_to_rule_field: string | null;
          options: Json | null;
          priority: number;
          question_key: string;
          question_text: string;
          question_type: string;
          session_id: string;
          source: string;
          status: string;
          user_id: string;
        };
        Insert: {
          answered_at?: string | null;
          created_at?: string;
          display_order?: number;
          help_text?: string | null;
          id?: string;
          is_required?: boolean;
          maps_to_rule_field?: string | null;
          options?: Json | null;
          priority?: number;
          question_key: string;
          question_text: string;
          question_type: string;
          session_id: string;
          source?: string;
          status?: string;
          user_id: string;
        };
        Update: {
          answered_at?: string | null;
          created_at?: string;
          display_order?: number;
          help_text?: string | null;
          id?: string;
          is_required?: boolean;
          maps_to_rule_field?: string | null;
          options?: Json | null;
          priority?: number;
          question_key?: string;
          question_text?: string;
          question_type?: string;
          session_id?: string;
          source?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rule_questions_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "rule_design_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rule_questions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
        ];
      };
      rule_reviews: {
        Row: {
          can_finalize: boolean;
          completion_score: number | null;
          created_at: string;
          error_message: string | null;
          estimated_cost_usd: number | null;
          id: string;
          input_tokens: number | null;
          latency_ms: number | null;
          model: string;
          needs_more_info: boolean;
          output_tokens: number | null;
          prompt_version: string;
          provider: string;
          review_json: Json;
          rule_version_id: string | null;
          safety_passed: boolean;
          schema_valid: boolean;
          session_id: string;
          summary: string | null;
          user_id: string;
        };
        Insert: {
          can_finalize?: boolean;
          completion_score?: number | null;
          created_at?: string;
          error_message?: string | null;
          estimated_cost_usd?: number | null;
          id?: string;
          input_tokens?: number | null;
          latency_ms?: number | null;
          model: string;
          needs_more_info?: boolean;
          output_tokens?: number | null;
          prompt_version: string;
          provider: string;
          review_json: Json;
          rule_version_id?: string | null;
          safety_passed?: boolean;
          schema_valid?: boolean;
          session_id: string;
          summary?: string | null;
          user_id: string;
        };
        Update: {
          can_finalize?: boolean;
          completion_score?: number | null;
          created_at?: string;
          error_message?: string | null;
          estimated_cost_usd?: number | null;
          id?: string;
          input_tokens?: number | null;
          latency_ms?: number | null;
          model?: string;
          needs_more_info?: boolean;
          output_tokens?: number | null;
          prompt_version?: string;
          provider?: string;
          review_json?: Json;
          rule_version_id?: string | null;
          safety_passed?: boolean;
          schema_valid?: boolean;
          session_id?: string;
          summary?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rule_reviews_rule_version_id_fkey";
            columns: ["rule_version_id"];
            isOneToOne: false;
            referencedRelation: "rule_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rule_reviews_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "rule_design_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rule_reviews_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
        ];
      };
      rule_versions: {
        Row: {
          change_reason: string | null;
          created_at: string;
          created_by: string;
          id: string;
          rule_json: Json;
          session_id: string;
          user_id: string;
          version_number: number;
        };
        Insert: {
          change_reason?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          rule_json: Json;
          session_id: string;
          user_id: string;
          version_number: number;
        };
        Update: {
          change_reason?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          rule_json?: Json;
          session_id?: string;
          user_id?: string;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "rule_versions_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "rule_design_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rule_versions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;

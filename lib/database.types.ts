// Hand-written to match supabase/schema.sql exactly (no Supabase CLI in this
// environment to auto-generate it). If you add/change a column in
// schema.sql, mirror the change here. Keeping this concrete (rather than
// `any`) is what lets @supabase/supabase-js correctly type `.select()` /
// `.single()` results instead of collapsing them to `never`.

export interface Database {
  public: {
    Tables: {
      children: {
        Row: {
          id: string;
          parent_id: string;
          name: string;
          avatar: string;
          level: 1 | 2;
          pin_hash: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["children"]["Row"]> &
          Pick<Database["public"]["Tables"]["children"]["Row"], "parent_id" | "name" | "level" | "pin_hash">;
        Update: Partial<Database["public"]["Tables"]["children"]["Row"]>;
        Relationships: [];
      };
      questions: {
        Row: {
          id: string;
          level: 1 | 2;
          category: "logic" | "riddle" | "spatial";
          question_text: string;
          options: string[];
          correct_option_index: number;
          explanation: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["questions"]["Row"]> &
          Pick<
            Database["public"]["Tables"]["questions"]["Row"],
            "level" | "category" | "question_text" | "options" | "correct_option_index" | "explanation"
          >;
        Update: Partial<Database["public"]["Tables"]["questions"]["Row"]>;
        Relationships: [];
      };
      rounds: {
        Row: {
          id: string;
          child_id: string;
          level: 1 | 2;
          status: "in_progress" | "completed" | "abandoned";
          correct_count: number;
          points_awarded: number;
          started_at: string;
          completed_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["rounds"]["Row"]> &
          Pick<Database["public"]["Tables"]["rounds"]["Row"], "child_id" | "level">;
        Update: Partial<Database["public"]["Tables"]["rounds"]["Row"]>;
        Relationships: [];
      };
      round_questions: {
        Row: {
          id: string;
          round_id: string;
          position: number;
          source: "bank" | "generated";
          question_id: string | null;
          category: string;
          question_text: string;
          options: string[];
          correct_index: number;
          explanation: string;
          shown_at: string | null;
          answered_at: string | null;
          selected_index: number | null;
          is_correct: boolean | null;
          points_awarded: number;
        };
        Insert: Partial<Database["public"]["Tables"]["round_questions"]["Row"]> &
          Pick<
            Database["public"]["Tables"]["round_questions"]["Row"],
            "round_id" | "position" | "source" | "category" | "question_text" | "options" | "correct_index" | "explanation"
          >;
        Update: Partial<Database["public"]["Tables"]["round_questions"]["Row"]>;
        Relationships: [];
      };
      point_transactions: {
        Row: {
          id: string;
          child_id: string;
          type: "earn" | "redeem" | "refund" | "adjustment";
          amount: number;
          reason: string | null;
          round_id: string | null;
          redemption_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["point_transactions"]["Row"]> &
          Pick<Database["public"]["Tables"]["point_transactions"]["Row"], "child_id" | "type" | "amount">;
        Update: Partial<Database["public"]["Tables"]["point_transactions"]["Row"]>;
        Relationships: [];
      };
      rewards: {
        Row: {
          id: string;
          name: string;
          cost: number;
          emoji: string;
          active: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["rewards"]["Row"]> &
          Pick<Database["public"]["Tables"]["rewards"]["Row"], "name" | "cost">;
        Update: Partial<Database["public"]["Tables"]["rewards"]["Row"]>;
        Relationships: [];
      };
      redemptions: {
        Row: {
          id: string;
          child_id: string;
          reward_id: string | null;
          reward_name: string;
          cost: number;
          status: "pending" | "approved" | "denied" | "fulfilled";
          requested_at: string;
          decided_at: string | null;
          decided_by: string | null;
          note: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["redemptions"]["Row"]> &
          Pick<Database["public"]["Tables"]["redemptions"]["Row"], "child_id" | "reward_name" | "cost">;
        Update: Partial<Database["public"]["Tables"]["redemptions"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

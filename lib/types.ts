// Row shapes matching db/schema.sql. Kept as plain interfaces (rather than a
// Supabase-style generated Database type) since we talk to Postgres directly
// now - update these alongside schema.sql if a column changes.

import type { Level } from "@/lib/config";

export type ParentRole = "admin" | "parent";

export interface ParentRow {
  id: string;
  email: string;
  password_hash: string;
  role: ParentRole;
  created_at: string;
}

export interface ChildRow {
  id: string;
  parent_id: string;
  name: string;
  avatar: string;
  photo_data_url: string | null;
  level: Level;
  pin_hash: string;
  answer_seconds: number | null;
  explain_seconds: number | null;
  created_at: string;
}

export interface ChildLoginRow {
  id: string;
  child_id: string;
  logged_in_at: string;
}

export interface ChildCategoryWeightRow {
  child_id: string;
  category: "math" | "logic" | "riddle" | "spatial";
  weight: number;
}

export interface QuestionRow {
  id: string;
  level: Level;
  category: "logic" | "riddle" | "spatial";
  question_text: string;
  options: string[];
  correct_option_index: number;
  explanation: string;
  concept: string | null;
  skill_key: string | null; // lib/skills.ts
  skill_step: 1 | 2 | 3 | null;
  is_active: boolean;
  in_rotation: boolean; // false = only served through a practice set (lib/practice.ts)
  pen_paper: boolean; // served with the longer pen & paper timer (lib/questionTiming.ts)
  created_at: string;
}

export interface RoundRow {
  id: string;
  child_id: string;
  level: Level;
  kind: "standard" | "review" | "checkup" | "practice";
  status: "in_progress" | "completed" | "abandoned";
  correct_count: number;
  points_awarded: number;
  started_at: string;
  completed_at: string | null;
  practice_set_id: string | null; // kind = 'practice' only - see lib/practice.ts
  practice_round_no: number | null;
}

export interface RoundQuestionRow {
  id: string;
  round_id: string;
  position: number;
  source: "bank" | "generated";
  question_id: string | null;
  template_key: string | null;
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
  paused: boolean;
  pen_paper: boolean;
}

export interface PointTransactionRow {
  id: string;
  child_id: string;
  type: "earn" | "redeem" | "refund" | "adjustment";
  amount: number;
  reason: string | null;
  round_id: string | null;
  redemption_id: string | null;
  created_at: string;
}

export interface RewardRow {
  id: string;
  name: string;
  cost: number;
  emoji: string;
  active: boolean;
  created_at: string;
}

export interface RedemptionRow {
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
}

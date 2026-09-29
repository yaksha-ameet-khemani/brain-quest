import { query } from "@/lib/db";
import type { Skill } from "@/lib/skills";

export async function loadSkills(): Promise<Skill[]> {
  return query<Skill>(`SELECT key, area, name, description FROM skills ORDER BY sort_order`);
}

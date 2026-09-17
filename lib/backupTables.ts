// Every table in db/schema.sql, in FK-safe order (not that order matters for
// a JSON dump, but it reads the same way the schema does). Shared by the
// admin-triggered backup route (lib/backupEncryption.ts +
// app/api/admin/backup/route.ts) - duplicated as a plain array in
// scripts/backup.mjs and scripts/decryptBackup.mjs since those run as
// standalone Node scripts outside Next's build, so they can't import this
// TS file directly. Keep both lists in sync if a table is added.
export const BACKUP_TABLES = [
  "parents",
  "children",
  "child_logins",
  "child_category_weights",
  "questions",
  "rounds",
  "round_questions",
  "point_transactions",
  "rewards",
  "redemptions",
] as const;

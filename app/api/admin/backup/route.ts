import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/requireParent";
import { encryptBackup } from "@/lib/backupEncryption";
import { BACKUP_TABLES } from "@/lib/backupTables";

export const dynamic = "force-dynamic";

// POST: admin-only. Dumps every table, encrypts the dump, and commits it
// straight into THIS (public) repo's backup/ folder via GitHub's Contents
// API - the running app has no local git checkout to `git push` from, so
// this is the only way a serverless request can create a commit. See
// lib/backupEncryption.ts for why this is safe to put in a public repo, and
// docs/SETUP.md for the one-time GITHUB_BACKUP_TOKEN / BACKUP_ENCRYPTION_KEY
// setup this depends on.
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  const token = process.env.GITHUB_BACKUP_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Manual backup isn't set up yet (GITHUB_BACKUP_TOKEN is missing) - see docs/SETUP.md." },
      { status: 500 }
    );
  }

  const tables: Record<string, unknown[]> = {};
  for (const table of BACKUP_TABLES) {
    tables[table] = await query(`SELECT * FROM ${table} ORDER BY 1`);
  }

  const backedUpAt = new Date();
  const rowCounts = Object.fromEntries(BACKUP_TABLES.map((t) => [t, tables[t]!.length]));
  const payload = JSON.stringify(
    { manifest: { backedUpAt: backedUpAt.toISOString(), rowCounts, trigger: "admin-button" }, tables },
    null,
    2
  );

  let encrypted: string;
  try {
    encrypted = encryptBackup(payload);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Encryption failed." }, { status: 500 });
  }

  const dateKey = backedUpAt.toISOString().slice(0, 10); // YYYY-MM-DD
  const timeKey = backedUpAt.toISOString().slice(11, 19).replace(/:/g, ""); // HHMMSS
  const repo = process.env.BACKUP_GITHUB_REPO ?? "yaksha-ameet-khemani/brain-quest";
  const filePath = `backup/${dateKey}/backup-${timeKey}.json.enc`;

  const ghRes = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github+json",
    },
    body: JSON.stringify({
      message: `Manual backup ${backedUpAt.toISOString()}`,
      content: Buffer.from(encrypted, "utf8").toString("base64"),
    }),
  });

  if (!ghRes.ok) {
    const detail = await ghRes.text().catch(() => "");
    return NextResponse.json(
      { error: `GitHub commit failed (${ghRes.status}): ${detail.slice(0, 300)}` },
      { status: 502 }
    );
  }

  const result: { content?: { html_url?: string } } = await ghRes.json();
  return NextResponse.json({ path: filePath, url: result.content?.html_url ?? null, rowCounts });
}

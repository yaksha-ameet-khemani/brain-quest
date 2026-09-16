import Link from "next/link";
import { query } from "@/lib/db";
import type { ChildRow } from "@/lib/types";
import { getPublicActivity } from "@/lib/publicActivity";
import { formatDuration, formatRelativeTime } from "@/lib/format";
import Avatar from "@/components/Avatar";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [children, activity] = await Promise.all([
    query<Pick<ChildRow, "id" | "name" | "avatar" | "photo_data_url" | "level">>(
      "SELECT id, name, avatar, photo_data_url, level FROM children ORDER BY created_at ASC"
    ),
    getPublicActivity(),
  ]);

  return (
    <main className="flex flex-col gap-8 pt-8">
      <header className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-brand-700">🧠 Brain Quest</h1>
        <p className="mt-2 text-slate-600">Who&apos;s playing today?</p>
      </header>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {children.map((child) => (
          <Link
            key={child.id}
            href={`/kid/${child.id}`}
            className="flex flex-col items-center gap-2 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
          >
            <span className="flex h-16 w-16 items-center justify-center text-5xl">
              <Avatar photoDataUrl={child.photo_data_url} avatar={child.avatar} name={child.name} />
            </span>
            <span className="text-lg font-semibold">{child.name}</span>
          </Link>
        ))}

        {children.length === 0 && (
          <p className="col-span-full text-center text-slate-500">
            No kid profiles yet - a parent needs to add one from Parent Mode below.
          </p>
        )}
      </section>

      {activity.length > 0 && (
        <section>
          <h2 className="mb-3 text-center text-sm font-semibold uppercase tracking-wide text-slate-400">
            Family Activity
          </h2>
          <div className="grid gap-3">
            {activity.map((a) => (
              <div key={a.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <p className="flex min-w-0 items-center gap-2 font-semibold">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center text-xl">
                      <Avatar photoDataUrl={a.photoDataUrl} avatar={a.avatar} name={a.name} />
                    </span>
                    <span className="truncate">{a.name}</span>
                  </p>
                  <p className="shrink-0 text-xs text-slate-400">Last login: {formatRelativeTime(a.lastLogin)}</p>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-base font-bold text-slate-700">{a.totalAttempted}</p>
                    <p className="text-slate-500">Attempted</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-2">
                    <p className="text-base font-bold text-emerald-600">{a.correct}</p>
                    <p className="text-slate-500">Correct</p>
                  </div>
                  <div className="rounded-lg bg-rose-50 p-2">
                    <p className="text-base font-bold text-rose-500">{a.wrong}</p>
                    <p className="text-slate-500">Wrong</p>
                  </div>
                  <div className="rounded-lg bg-brand-50 p-2">
                    <p className="text-base font-bold text-brand-600">{formatDuration(a.totalTimeSeconds)}</p>
                    <p className="text-slate-500">Time spent</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="mt-auto flex justify-center pt-10">
        <Link
          href="/login/parent"
          className="rounded-full border border-slate-300 px-6 py-3 text-sm font-medium text-slate-600 hover:bg-white"
        >
          👤 Parent Mode
        </Link>
      </footer>
    </main>
  );
}

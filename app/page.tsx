import Link from "next/link";
import { query } from "@/lib/db";
import type { ChildRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const children = await query<Pick<ChildRow, "id" | "name" | "avatar" | "level">>(
    "SELECT id, name, avatar, level FROM children ORDER BY created_at ASC"
  );

  return (
    <main className="flex flex-col gap-8 pt-8">
      <header className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-brand-700">🧠 Brain Quest</h1>
        <p className="mt-2 text-slate-600">Who&apos;s playing today?</p>
      </header>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {children.map((child) => (
          <Link
            key={child.id}
            href={`/kid/${child.id}`}
            className="flex flex-col items-center gap-2 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
          >
            <span className="text-5xl">{child.avatar}</span>
            <span className="text-lg font-semibold">{child.name}</span>
          </Link>
        ))}

        {children.length === 0 && (
          <p className="col-span-full text-center text-slate-500">
            No kid profiles yet - a parent needs to add one from Parent Mode below.
          </p>
        )}
      </section>

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

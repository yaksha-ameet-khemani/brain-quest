"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import Avatar from "@/components/Avatar";
import { fileToResizedDataUrl, ImageTooLargeError } from "@/lib/imageResize";

interface CategoryStat {
  category: string;
  correct: number;
  total: number;
}
interface ChildOverview {
  child: { id: string; name: string; avatar: string; photoDataUrl: string | null; level: 1 | 2 };
  parentEmail: string | null;
  balance: number;
  roundsPlayed: number;
  categoryStats: CategoryStat[];
}
interface Redemption {
  id: string;
  child_id: string;
  reward_name: string;
  cost: number;
  status: "pending" | "approved" | "denied" | "fulfilled";
  requested_at: string;
  child?: { name: string; avatar: string; photoDataUrl?: string | null } | null;
}
interface ParentAccount {
  id: string;
  email: string;
  role: "admin" | "parent";
  created_at: string;
}

export default function ParentDashboard({
  parentEmail,
  role,
}: {
  parentEmail: string;
  role: "admin" | "parent";
}) {
  const router = useRouter();
  const [overview, setOverview] = useState<ChildOverview[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [parents, setParents] = useState<ParentAccount[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [newChild, setNewChild] = useState<{
    name: string;
    level: string;
    pin: string;
    avatar: string;
    parentId: string;
    photoDataUrl: string | null;
  }>({ name: "", level: "1", pin: "", avatar: "🙂", parentId: "", photoDataUrl: null });
  const [creating, setCreating] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [processingPhoto, setProcessingPhoto] = useState(false);

  async function handlePhotoFile(file: File | undefined) {
    if (!file) return;
    setPhotoError(null);
    setProcessingPhoto(true);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      setNewChild((s) => ({ ...s, photoDataUrl: dataUrl }));
    } catch (err) {
      setPhotoError(err instanceof ImageTooLargeError ? err.message : "Could not process that photo.");
    } finally {
      setProcessingPhoto(false);
    }
  }

  const [newParent, setNewParent] = useState({ email: "", password: "" });
  const [creatingParent, setCreatingParent] = useState(false);
  const [parentMessage, setParentMessage] = useState<string | null>(null);

  async function refresh() {
    const [ov, rd, pa] = await Promise.all([
      fetch("/api/parent/overview"),
      fetch("/api/parent/redemptions"),
      role === "admin" ? fetch("/api/admin/parents") : Promise.resolve(null),
    ]);
    if (ov.ok) setOverview((await ov.json()).overview);
    if (rd.ok) setRedemptions((await rd.json()).redemptions);
    if (pa?.ok) setParents((await pa.json()).parents);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signOut() {
    await fetch("/api/auth/parent-logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  async function decide(id: string, action: "approve" | "deny" | "fulfill") {
    setBusy(id);
    try {
      const res = await fetch("/api/parent/redemptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redemptionId: id, action }),
      });
      if (res.ok) await refresh();
    } finally {
      setBusy(null);
    }
  }

  async function addChild(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (role === "admin" && !newChild.parentId) {
      setMessage("Pick which parent this child belongs to first.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newChild.name,
          level: Number(newChild.level),
          pin: newChild.pin,
          avatar: newChild.avatar,
          photoDataUrl: newChild.photoDataUrl,
          ...(role === "admin" ? { parentId: newChild.parentId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Could not add child.");
        return;
      }
      setNewChild({ name: "", level: "1", pin: "", avatar: "🙂", parentId: "", photoDataUrl: null });
      setMessage(`Added ${data.child.name}!`);
      await refresh();
    } finally {
      setCreating(false);
    }
  }

  async function addParent(e: FormEvent) {
    e.preventDefault();
    setParentMessage(null);
    setCreatingParent(true);
    try {
      const res = await fetch("/api/admin/parents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newParent),
      });
      const data = await res.json();
      if (!res.ok) {
        setParentMessage(data.error ?? "Could not create account.");
        return;
      }
      setNewParent({ email: "", password: "" });
      setParentMessage(`Added ${data.parent.email}!`);
      await refresh();
    } finally {
      setCreatingParent(false);
    }
  }

  async function removeParent(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/parents/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setParentMessage(data.error ?? "Could not remove account.");
        return;
      }
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  const pending = redemptions.filter((r) => r.status === "pending");
  const decided = redemptions.filter((r) => r.status !== "pending").slice(0, 10);

  return (
    <main className="flex flex-col gap-8 pt-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {role === "admin" ? "🛡️ Admin" : "👤 Parent"} Dashboard
          </h1>
          <p className="text-sm text-slate-500">{parentEmail}</p>
        </div>
        <div className="flex items-center gap-4">
          {role === "admin" && (
            <Link href="/parent/questions" className="text-sm font-semibold text-brand-600 underline">
              📚 Question Bank
            </Link>
          )}
          <button onClick={signOut} className="text-sm text-slate-500 underline">
            Sign out
          </button>
        </div>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-bold">Pending reward requests</h2>
        {pending.length === 0 && <p className="text-sm text-slate-500">Nothing waiting on you 🎉</p>}
        <div className="grid gap-3">
          {pending.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
              <div>
                <p className="flex items-center gap-1.5 font-semibold">
                  <span className="flex h-5 w-5 items-center justify-center text-base">
                    <Avatar photoDataUrl={r.child?.photoDataUrl} avatar={r.child?.avatar ?? "🙂"} name={r.child?.name} />
                  </span>
                  {r.child?.name} wants: {r.reward_name}
                </p>
                <p className="text-sm text-slate-500">{r.cost} pts</p>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={busy === r.id}
                  onClick={() => decide(r.id, "approve")}
                  className="rounded-full bg-emerald-500 px-3 py-2 text-sm font-semibold text-white"
                >
                  Approve
                </button>
                <button
                  disabled={busy === r.id}
                  onClick={() => decide(r.id, "deny")}
                  className="rounded-full bg-rose-500 px-3 py-2 text-sm font-semibold text-white"
                >
                  Deny
                </button>
              </div>
            </div>
          ))}
        </div>

        {decided.some((d) => d.status === "approved") && (
          <div className="mt-3 grid gap-3">
            {decided
              .filter((d) => d.status === "approved")
              .map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-2xl bg-amber-50 p-4 text-sm ring-1 ring-amber-200">
                  <span className="flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center text-base">
                      <Avatar photoDataUrl={r.child?.photoDataUrl} avatar={r.child?.avatar ?? "🙂"} name={r.child?.name} />
                    </span>
                    {r.child?.name}: {r.reward_name} (approved, not yet given)
                  </span>
                  <button
                    disabled={busy === r.id}
                    onClick={() => decide(r.id, "fulfill")}
                    className="rounded-full bg-amber-500 px-3 py-1.5 font-semibold text-white"
                  >
                    Mark given
                  </button>
                </div>
              ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Progress</h2>
        <div className="grid gap-4">
          {overview.map((o) => (
            <div key={o.child.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 font-semibold">
                  <span className="flex h-6 w-6 items-center justify-center text-lg">
                    <Avatar photoDataUrl={o.child.photoDataUrl} avatar={o.child.avatar} name={o.child.name} />
                  </span>
                  {o.child.name} · Level {o.child.level}
                </p>
                <p className="font-bold text-brand-600">{o.balance} pts</p>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {o.roundsPlayed} rounds completed
                {role === "admin" && o.parentEmail && <> · parent: {o.parentEmail}</>}
              </p>
              {o.categoryStats.length > 0 && (
                <div className="mt-3 grid gap-1.5">
                  {o.categoryStats.map((c) => (
                    <div key={c.category} className="flex items-center gap-2 text-xs">
                      <span className="w-16 capitalize text-slate-500">{c.category}</span>
                      <div className="h-2 flex-1 rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-brand-400"
                          style={{ width: `${Math.round((c.correct / c.total) * 100)}%` }}
                        />
                      </div>
                      <span className="text-slate-400">
                        {c.correct}/{c.total}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <Link
                href={`/parent/children/${o.child.id}`}
                className="mt-3 inline-block text-xs font-semibold text-brand-600 underline"
              >
                View full question log →
              </Link>
            </div>
          ))}
          {overview.length === 0 && <p className="text-sm text-slate-500">No kid profiles yet - add one below.</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Add a child profile</h2>
        <form onSubmit={addChild} className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <input
            required
            placeholder="Name"
            value={newChild.name}
            onChange={(e) => setNewChild((s) => ({ ...s, name: e.target.value }))}
            className="rounded-xl border border-slate-200 p-3"
          />
          {role === "admin" && (
            <select
              required
              value={newChild.parentId}
              onChange={(e) => setNewChild((s) => ({ ...s, parentId: e.target.value }))}
              className="rounded-xl border border-slate-200 p-3"
            >
              <option value="">Which parent owns this child?</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.email}
                  {p.role === "admin" ? " (you, admin)" : ""}
                </option>
              ))}
            </select>
          )}
          <div className="flex gap-3">
            <input
              placeholder="Avatar emoji"
              value={newChild.avatar}
              onChange={(e) => setNewChild((s) => ({ ...s, avatar: e.target.value }))}
              className="w-24 rounded-xl border border-slate-200 p-3 text-center"
            />
            <select
              value={newChild.level}
              onChange={(e) => setNewChild((s) => ({ ...s, level: e.target.value }))}
              className="flex-1 rounded-xl border border-slate-200 p-3"
            >
              <option value="1">Level 1 (younger)</option>
              <option value="2">Level 2 (older)</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-50 text-3xl ring-1 ring-slate-200">
              <Avatar photoDataUrl={newChild.photoDataUrl} avatar={newChild.avatar || "🙂"} />
            </span>
            <div className="flex-1">
              <label className="inline-block cursor-pointer rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600">
                {processingPhoto ? "Processing…" : newChild.photoDataUrl ? "Change photo" : "Add a photo (optional)"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={processingPhoto}
                  onChange={(e) => handlePhotoFile(e.target.files?.[0])}
                />
              </label>
              {newChild.photoDataUrl && (
                <button
                  type="button"
                  onClick={() => setNewChild((s) => ({ ...s, photoDataUrl: null }))}
                  className="ml-2 text-xs text-rose-500 underline"
                >
                  Remove
                </button>
              )}
              {photoError && <p className="mt-1 text-xs text-rose-600">{photoError}</p>}
            </div>
          </div>
          <input
            required
            placeholder="4-6 digit PIN"
            inputMode="numeric"
            pattern="\d{4,6}"
            value={newChild.pin}
            onChange={(e) => setNewChild((s) => ({ ...s, pin: e.target.value }))}
            className="rounded-xl border border-slate-200 p-3"
          />
          {message && <p className="text-sm text-brand-700">{message}</p>}
          <button
            type="submit"
            disabled={creating}
            className="rounded-xl bg-brand-500 p-3 font-semibold text-white disabled:opacity-50"
          >
            {creating ? "…" : "Add child"}
          </button>
        </form>
      </section>

      {role === "admin" && (
        <section>
          <h2 className="mb-3 text-lg font-bold">🛡️ Manage parent accounts</h2>
          <div className="grid gap-2">
            {parents.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl bg-white p-3 text-sm shadow-sm ring-1 ring-slate-100"
              >
                <span>
                  {p.email}{" "}
                  {p.role === "admin" && (
                    <span className="ml-1 rounded-full bg-slate-800 px-2 py-0.5 text-xs text-white">admin</span>
                  )}
                </span>
                {p.role !== "admin" && (
                  <button
                    disabled={busy === p.id}
                    onClick={() => removeParent(p.id)}
                    className="text-xs font-semibold text-rose-500 underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          <form
            onSubmit={addParent}
            className="mt-3 grid gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100"
          >
            <p className="text-sm font-semibold">Add another parent</p>
            <input
              type="email"
              required
              placeholder="Email"
              value={newParent.email}
              onChange={(e) => setNewParent((s) => ({ ...s, email: e.target.value }))}
              className="rounded-xl border border-slate-200 p-3"
            />
            <input
              type="password"
              required
              minLength={8}
              placeholder="Password (min. 8 characters)"
              value={newParent.password}
              onChange={(e) => setNewParent((s) => ({ ...s, password: e.target.value }))}
              className="rounded-xl border border-slate-200 p-3"
            />
            {parentMessage && <p className="text-sm text-brand-700">{parentMessage}</p>}
            <button
              type="submit"
              disabled={creatingParent}
              className="rounded-xl bg-slate-800 p-3 font-semibold text-white disabled:opacity-50"
            >
              {creatingParent ? "…" : "Add parent"}
            </button>
          </form>
        </section>
      )}
    </main>
  );
}

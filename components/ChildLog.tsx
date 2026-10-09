"use client";

import Link from "next/link";
import type { Level } from "@/lib/config";
import { useEffect, useRef, useState } from "react";
import { formatDuration } from "@/lib/format";
import Avatar from "@/components/Avatar";
import { fileToResizedDataUrl, ImageTooLargeError } from "@/lib/imageResize";
import { useAutoRefresh } from "@/components/AutoRefresh";
import ChildReport from "@/components/ChildReport";
import PointsHistory from "@/components/PointsHistory";
import PeriodReports from "@/components/PeriodReports";
import PracticeSets from "@/components/PracticeSets";
import SkillMap from "@/components/SkillMap";
import TipsHistory from "@/components/TipsHistory";
import SecretInput from "@/components/SecretInput";
import Spinner from "@/components/Spinner";
import { addDays } from "@/lib/timezone";

interface LogEntry {
  roundId: string;
  position: number;
  category: string;
  questionText: string;
  options: string[];
  correctIndex: number;
  selectedIndex: number | null;
  isCorrect: boolean | null;
  shownAt: string | null;
  answeredAt: string | null;
  pointsAwarded: number;
  durationSeconds: number | null;
  kind: string;
  paused: boolean;
  penPaper: boolean;
}

interface LogSummary {
  total: number;
  correct: number;
  wrong: number;
  timeout: number;
  totalSeconds: number;
}

type DatePreset = "all" | "today" | "yesterday" | "7d" | "30d" | "custom";
type ResultFilter = "all" | "correct" | "wrong" | "timeout";

interface LogFilters {
  preset: DatePreset;
  from: string;
  to: string;
  category: string;
  kind: string;
  result: ResultFilter;
  q: string;
}

const NO_FILTERS: LogFilters = { preset: "all", from: "", to: "", category: "", kind: "", result: "all", q: "" };

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "custom", label: "Pick dates" },
];

const KIND_LABEL: Record<string, string> = {
  standard: "Daily round",
  review: "Review",
  checkup: "Checkup",
};

/** The inclusive local-day range a preset covers, given the server's "today". */
function presetRange(preset: DatePreset, today: string): { from: string; to: string } {
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday":
      return { from: addDays(today, -1), to: addDays(today, -1) };
    case "7d":
      return { from: addDays(today, -6), to: today };
    case "30d":
      return { from: addDays(today, -29), to: today };
    default:
      return { from: "", to: "" };
  }
}

function logQueryString(f: LogFilters, today: string): string {
  const range = f.preset === "custom" ? { from: f.from, to: f.to } : presetRange(f.preset, today);
  const sp = new URLSearchParams();
  if (range.from) sp.set("from", range.from);
  if (range.to) sp.set("to", range.to);
  if (f.category) sp.set("category", f.category);
  if (f.kind) sp.set("kind", f.kind);
  if (f.result !== "all") sp.set("result", f.result);
  if (f.q.trim()) sp.set("q", f.q.trim());
  return sp.toString();
}

interface ChildInfo {
  id: string;
  name: string;
  avatar: string;
  photoDataUrl: string | null;
  level: Level;
}

function ChildPhotoEditor({ child, onChanged }: { child: ChildInfo; onChanged: () => void }) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(photoDataUrl: string | null) {
    setError(null);
    setProcessing(true);
    try {
      const res = await fetch(`/api/profiles/${child.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoDataUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not update photo.");
        return;
      }
      onChanged();
    } finally {
      setProcessing(false);
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setProcessing(true);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      await save(dataUrl);
    } catch (err) {
      setError(err instanceof ImageTooLargeError ? err.message : "Could not process that photo.");
      setProcessing(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label className="flex cursor-pointer items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
        {processing && <Spinner className="h-3 w-3" />}
        {processing ? "Uploading…" : child.photoDataUrl ? "Change photo" : "Add photo"}
        <input type="file" accept="image/*" className="hidden" disabled={processing} onChange={(e) => handleFile(e.target.files?.[0])} />
      </label>
      {child.photoDataUrl && (
        <button
          onClick={() => save(null)}
          disabled={processing}
          className="flex items-center gap-1.5 text-xs font-semibold text-rose-500 underline disabled:opacity-50"
        >
          {processing && <Spinner className="h-3 w-3" />}
          Remove
        </button>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

function PinEditor({ childId }: { childId: string }) {
  const [pin, setPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    if (!/^\d{4,6}$/.test(pin)) {
      setMessage({ ok: false, text: "PIN must be 4-6 digits." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/parent/children/${childId}/reset-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? "Could not change PIN." });
        return;
      }
      setPin("");
      setMessage({ ok: true, text: "PIN changed - use the new one next time they log in." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <h2 className="font-bold">🔑 Login PIN</h2>
      <p className="mt-1 text-xs text-slate-500">
        Set a new 4-6 digit PIN for this child. The current PIN can&apos;t be shown - it&apos;s stored scrambled.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <SecretInput
          inputMode="numeric"
          maxLength={6}
          placeholder="New PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          className="w-28 rounded-xl border border-slate-200 p-2 text-center"
        />
        <button
          onClick={save}
          disabled={saving || pin.length < 4}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving && <Spinner className="h-3.5 w-3.5" />}
          {saving ? "Saving…" : "Change PIN"}
        </button>
        {message && <p className={`text-sm ${message.ok ? "text-brand-700" : "text-rose-600"}`}>{message.text}</p>}
      </div>
    </section>
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  math: "🔢 Math",
  logic: "🧩 Logic",
  riddle: "❓ Riddle",
  spatial: "📐 Spatial",
};

function CategoryWeightsEditor({ childId }: { childId: string }) {
  const [weights, setWeights] = useState<Record<string, number> | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/admin/children/${childId}/weights`);
      if (res.ok) setWeights((await res.json()).weights);
    })();
  }, [childId]);

  async function save() {
    if (!weights) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/children/${childId}/weights`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weights }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Could not save.");
        return;
      }
      setWeights(data.weights);
      setMessage("Saved!");
    } finally {
      setSaving(false);
    }
  }

  if (!weights) return null;

  const total = Object.values(weights).reduce((s, w) => s + w, 0);

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <h2 className="font-bold">🎯 Section priorities</h2>
      <p className="mt-1 text-xs text-slate-500">
        Higher weight = shows up more often in this child&apos;s rounds. Set to 0 to skip a category
        entirely. Equal weights (the default) means equal odds for all four.
      </p>
      <div className="mt-3 grid gap-3">
        {Object.entries(weights).map(([category, weight]) => (
          <div key={category} className="flex items-center gap-3">
            <span className="w-24 text-sm font-medium">{CATEGORY_LABEL[category] ?? category}</span>
            <input
              type="range"
              min={0}
              max={10}
              value={weight}
              onChange={(e) => setWeights((w) => ({ ...w!, [category]: Number(e.target.value) }))}
              className="flex-1"
            />
            <span className="w-16 text-right text-sm text-slate-500">
              {weight} ({total > 0 ? Math.round((weight / total) * 100) : 0}%)
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving && <Spinner className="h-3.5 w-3.5" />}
          {saving ? "Saving…" : "Save priorities"}
        </button>
        {message && <p className="text-sm text-brand-700">{message}</p>}
      </div>
    </section>
  );
}

interface TimerData {
  answerSeconds: number | null;
  levelDefaultSeconds: number;
  explainSeconds: number | null;
  explainDefaultSeconds: number;
}

function TimerField({
  childId,
  field,
  label,
  hint,
  min,
  max,
  currentOverride,
  defaultValue,
  onChanged,
}: {
  childId: string;
  field: "answerSeconds" | "explainSeconds";
  label: string;
  hint: string;
  min: number;
  max: number;
  currentOverride: number | null;
  defaultValue: number;
  onChanged: (data: TimerData) => void;
}) {
  const [draft, setDraft] = useState(String(currentOverride ?? defaultValue));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    const value = Number(draft);
    if (!Number.isInteger(value) || value < min || value > max) {
      setMessage(`Enter a whole number of seconds between ${min} and ${max}.`);
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/children/${childId}/timer`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Could not save.");
        return;
      }
      onChanged(data);
      setMessage("Saved!");
    } finally {
      setSaving(false);
    }
  }

  async function clearOverride() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/children/${childId}/timer`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Could not reset.");
        return;
      }
      onChanged(data);
      setDraft(String(defaultValue));
      setMessage("Back to the default.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-0.5 text-xs text-slate-500">
        {hint} Default is {defaultValue}s
        {currentOverride !== null ? ` - currently overridden to ${currentOverride}s.` : " - no override set."}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <input
          type="number"
          min={min}
          max={max}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-24 rounded-xl border border-slate-200 p-2 text-center"
        />
        <span className="text-sm text-slate-500">seconds</span>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving && <Spinner className="h-3.5 w-3.5" />}
          {saving ? "Saving…" : currentOverride !== null ? "Update" : "Add override"}
        </button>
        {currentOverride !== null && (
          <button
            onClick={clearOverride}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-rose-600 ring-1 ring-rose-200 disabled:opacity-50"
          >
            {saving && <Spinner className="h-3.5 w-3.5" />}
            Delete override
          </button>
        )}
        {message && <p className="text-sm text-brand-700">{message}</p>}
      </div>
    </div>
  );
}

function TimerEditor({ childId }: { childId: string }) {
  const [data, setData] = useState<TimerData | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/admin/children/${childId}/timer`);
      if (res.ok) setData(await res.json());
    })();
  }, [childId]);

  if (!data) return null;

  return (
    <section className="grid gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <h2 className="font-bold">⏱ Timers</h2>
      <TimerField
        childId={childId}
        field="answerSeconds"
        label="Per-question answer timer"
        hint="How many seconds this child gets to answer each question."
        min={10}
        max={300}
        currentOverride={data.answerSeconds}
        defaultValue={data.levelDefaultSeconds}
        onChanged={setData}
      />
      <TimerField
        childId={childId}
        field="explainSeconds"
        label="Explanation read timer"
        hint="How many seconds the 'Next question' button stays locked on the explanation screen (0 = no forced wait)."
        min={0}
        max={60}
        currentOverride={data.explainSeconds}
        defaultValue={data.explainDefaultSeconds}
        onChanged={setData}
      />
    </section>
  );
}

function ResetActivityButton({ childId, onDone }: { childId: string; onDone: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function doReset() {
    setResetting(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/children/${childId}/reset-activity`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Could not reset.");
        return;
      }
      setConfirming(false);
      setMessage("Activity reset - profile, name, avatar, and PIN are unchanged.");
      onDone();
    } finally {
      setResetting(false);
    }
  }

  return (
    <section className="rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-200">
      <h2 className="font-bold text-rose-700">⚠️ Reset activity</h2>
      <p className="mt-1 text-xs text-rose-700/80">
        Wipes this child&apos;s rounds, points, redemption requests, and login history - for
        starting a fresh test. The profile itself (name, avatar, level, PIN) is not touched.
        This cannot be undone.
      </p>
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="mt-3 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Reset activity
        </button>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={doReset}
            disabled={resetting}
            className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {resetting && <Spinner className="h-3.5 w-3.5" />}
            {resetting ? "Resetting…" : "Yes, reset everything"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={resetting}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-200"
          >
            Cancel
          </button>
        </div>
      )}
      {message && <p className="mt-2 text-sm text-rose-700">{message}</p>}
    </section>
  );
}

type ChildTab = "report" | "log" | "tips" | "logins" | "history" | "periods" | "skills" | "practice" | "settings";

const CHILD_TABS: { key: ChildTab; label: string; adminOnly: boolean }[] = [
  { key: "report", label: "📊 Report", adminOnly: false },
  { key: "log", label: "📋 Full log", adminOnly: false },
  { key: "tips", label: "💡 Tips", adminOnly: false },
  { key: "logins", label: "🕒 Last logins", adminOnly: true },
  { key: "history", label: "📅 30-day history", adminOnly: true },
  { key: "periods", label: "🗂️ 10-day reports", adminOnly: true },
  { key: "skills", label: "🧩 Skills", adminOnly: true },
  { key: "practice", label: "🎯 Practice", adminOnly: true },
  { key: "settings", label: "⚙️ Settings", adminOnly: false },
];

export default function ChildLog({
  childId,
  isAdmin,
  initialTab,
}: {
  childId: string;
  isAdmin: boolean;
  initialTab: string | undefined;
}) {
  useAutoRefresh();
  const tabs = CHILD_TABS.filter((t) => isAdmin || !t.adminOnly);
  const [child, setChild] = useState<ChildInfo | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [summary, setSummary] = useState<LogSummary | null>(null);
  const [logLimit, setLogLimit] = useState(0);
  const [today, setToday] = useState("");
  const [loading, setLoading] = useState(true);
  const [logLoading, setLogLoading] = useState(false);
  const [filters, setFilters] = useState<LogFilters>(NO_FILTERS);
  const [searchDraft, setSearchDraft] = useState("");
  const latestRequest = useRef(0);
  const [tab, setTab] = useState<ChildTab>(tabs.find((t) => t.key === initialTab)?.key ?? "report");
  const [logins, setLogins] = useState<string[] | null>(null);

  // Same as the dashboard (components/ParentDashboard.tsx): the open tab is
  // kept in the address, so a refresh stays on it.
  function selectTab(next: ChildTab) {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "report") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(window.history.state, "", url);
  }

  useEffect(() => {
    if (tab !== "logins" || logins !== null) return;
    (async () => {
      const res = await fetch(`/api/admin/children/${childId}/logins`);
      if (res.ok) setLogins((await res.json()).logins);
    })();
  }, [tab, logins, childId]);

  // A custom range with only one end filled in is still a valid filter
  // (open-ended); "today" is unknown until the first response, and date
  // presets need it, so the first load is always unfiltered.
  const queryString = today ? logQueryString(filters, today) : "";

  async function refreshLog() {
    const request = ++latestRequest.current;
    setLogLoading(true);
    try {
      const res = await fetch(`/api/parent/children/${childId}/log${queryString ? `?${queryString}` : ""}`);
      if (request !== latestRequest.current) return; // a newer filter change already won
      if (res.ok) {
        const data = await res.json();
        setChild(data.child);
        setLog(data.log);
        setSummary(data.summary);
        setLogLimit(data.limit);
        setToday(data.today);
      }
    } finally {
      if (request === latestRequest.current) {
        setLoading(false);
        setLogLoading(false);
      }
    }
  }

  useEffect(() => {
    refreshLog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId, queryString]);

  // Search waits for a short pause in typing rather than fetching per key.
  useEffect(() => {
    const timer = setTimeout(() => setFilters((f) => (f.q === searchDraft ? f : { ...f, q: searchDraft })), 400);
    return () => clearTimeout(timer);
  }, [searchDraft]);

  function updateFilters(patch: Partial<LogFilters>) {
    setFilters((f) => ({ ...f, ...patch }));
  }

  function clearFilters() {
    setFilters(NO_FILTERS);
    setSearchDraft("");
  }

  const hasFilters = JSON.stringify({ ...filters, q: filters.q.trim() }) !== JSON.stringify(NO_FILTERS);
  const accuracy = summary && summary.correct + summary.wrong > 0
    ? Math.round((summary.correct / (summary.correct + summary.wrong)) * 100)
    : null;

  if (loading) {
    return <p className="pt-10 text-center text-slate-500">Loading…</p>;
  }

  if (!child) {
    return <p className="pt-10 text-center text-slate-500">Child not found.</p>;
  }

  return (
    <main className="flex flex-col gap-6 pt-6">
      <Link href="/parent" className="text-sm text-slate-500">
        ← Back to dashboard
      </Link>

      <header className="flex items-center gap-3">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-slate-50 text-4xl ring-1 ring-slate-200">
          <Avatar photoDataUrl={child.photoDataUrl} avatar={child.avatar} name={child.name} />
        </span>
        <div>
          <h1 className="text-xl font-bold">{child.name}</h1>
          <p className="text-sm text-slate-500">Level {child.level}</p>
          <div className="mt-1">
            <ChildPhotoEditor child={child} onChanged={refreshLog} />
          </div>
        </div>
      </header>

      <nav className="sticky top-0 z-10 -mx-4 flex flex-wrap gap-2 bg-brand-50/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => selectTab(t.key)}
            className={`shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold ${
              tab === t.key ? "bg-brand-500 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "settings" ? (
        <div className="flex flex-col gap-6">
          <PinEditor childId={childId} />
          {isAdmin && <CategoryWeightsEditor childId={childId} />}
          {isAdmin && <TimerEditor childId={childId} />}
          {isAdmin && <ResetActivityButton childId={childId} onDone={refreshLog} />}
        </div>
      ) : tab === "report" ? (
        <ChildReport childId={childId} />
      ) : tab === "tips" ? (
        <TipsHistory childId={childId} />
      ) : tab === "skills" ? (
        <SkillMap childId={childId} />
      ) : tab === "practice" ? (
        <PracticeSets childId={childId} />
      ) : tab === "periods" ? (
        <PeriodReports childId={childId} />
      ) : tab === "history" ? (
        <PointsHistory endpoint={`/api/admin/children/${childId}/history`} />
      ) : tab === "logins" ? (
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <h2 className="font-bold">🕒 Last {logins?.length ?? 10} logins</h2>
          <p className="mt-1 text-xs text-slate-500">Exact date and time of this child&apos;s most recent sign-ins, newest first.</p>
          {logins === null ? (
            <p className="mt-3 text-sm text-slate-500">Loading…</p>
          ) : logins.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No logins yet.</p>
          ) : (
            <ol className="mt-3 grid gap-1.5 text-sm">
              {logins.map((t, i) => (
                <li key={t + i} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                  <span className="text-slate-400">#{i + 1}</span>
                  <span className="font-medium">
                    {new Date(t).toLocaleString(undefined, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : (
        <>
          <section className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <div className="flex flex-wrap gap-2">
              {DATE_PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() =>
                    updateFilters(
                      p.key === "custom" && filters.preset !== "custom"
                        ? { preset: "custom", ...presetRange(filters.preset === "all" ? "7d" : filters.preset, today) }
                        : { preset: p.key }
                    )
                  }
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    filters.preset === p.key ? "bg-brand-500 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {filters.preset === "custom" && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <label className="flex items-center gap-1.5 text-slate-500">
                  From
                  <input
                    type="date"
                    value={filters.from}
                    max={filters.to || today}
                    onChange={(e) => updateFilters({ from: e.target.value })}
                    className="rounded-xl border border-slate-200 p-1.5 text-slate-700"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-slate-500">
                  To
                  <input
                    type="date"
                    value={filters.to}
                    min={filters.from || undefined}
                    max={today}
                    onChange={(e) => updateFilters({ to: e.target.value })}
                    className="rounded-xl border border-slate-200 p-1.5 text-slate-700"
                  />
                </label>
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-3">
              <select
                value={filters.category}
                onChange={(e) => updateFilters({ category: e.target.value })}
                className="rounded-xl border border-slate-200 bg-white p-2 text-sm"
                aria-label="Section"
              >
                <option value="">All sections</option>
                {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={filters.kind}
                onChange={(e) => updateFilters({ kind: e.target.value })}
                className="rounded-xl border border-slate-200 bg-white p-2 text-sm"
                aria-label="Round type"
              >
                <option value="">All round types</option>
                {Object.entries(KIND_LABEL).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                type="search"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder="Search questions…"
                className="rounded-xl border border-slate-200 p-2 text-sm"
              />
            </div>
            {hasFilters && (
              <button onClick={clearFilters} className="justify-self-start text-xs font-semibold text-slate-500 underline">
                Clear all filters
              </button>
            )}
          </section>

          {summary && (
            <section className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
                <p className="text-lg font-bold">{summary.total}</p>
                <p className="text-slate-500">Attempted</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-lg font-bold text-emerald-600">{summary.correct}</p>
                <p className="text-slate-500">Correct{accuracy !== null && ` · ${accuracy}%`}</p>
              </div>
              <div className="rounded-xl bg-rose-50 p-3">
                <p className="text-lg font-bold text-rose-500">{summary.wrong}</p>
                <p className="text-slate-500">Wrong</p>
              </div>
              <div className="rounded-xl bg-brand-50 p-3">
                <p className="text-lg font-bold text-brand-600">{formatDuration(summary.totalSeconds)}</p>
                <p className="text-slate-500">Total time</p>
              </div>
            </section>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["all", "All", summary?.total],
                ["correct", "Correct", summary?.correct],
                ["wrong", "Wrong", summary?.wrong],
                ["timeout", "Timed out", summary?.timeout],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                onClick={() => updateFilters({ result: key })}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  filters.result === key ? "bg-brand-500 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200"
                }`}
              >
                {label}
                {count !== undefined && ` (${count})`}
              </button>
            ))}
            {logLoading && <Spinner className="h-4 w-4 text-slate-400" />}
          </div>

          {logLimit > 0 && log.length >= logLimit && (
            <p className="text-xs text-slate-500">
              Showing the newest {logLimit}. Narrow the dates to see older answers.
            </p>
          )}

          <section className={`grid gap-3 ${logLoading ? "opacity-60" : ""}`}>
            {log.map((l, i) => (
              <div
                key={`${l.roundId}-${l.position}-${i}`}
                className={`rounded-2xl p-4 shadow-sm ring-1 ${
                  l.isCorrect ? "bg-emerald-50 ring-emerald-100" : "bg-rose-50 ring-rose-100"
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span>{CATEGORY_LABEL[l.category] ?? l.category}</span>
                    <span className="rounded-full bg-white/70 px-2 py-0.5 ring-1 ring-slate-200">
                      {KIND_LABEL[l.kind] ?? l.kind}
                    </span>
                    {l.penPaper && <span title="Pen & paper question">✏️</span>}
                    {l.paused && <span title="Kid paused the timer on this one">⏸</span>}
                  </span>
                  <span className="shrink-0 text-right">
                    {l.answeredAt ? new Date(l.answeredAt).toLocaleString() : "—"} ·{" "}
                    {l.durationSeconds !== null ? formatDuration(l.durationSeconds) : "—"}
                  </span>
                </div>
                <p className="mt-1 font-medium">{l.questionText}</p>
                <div className="mt-2 grid gap-1 text-sm">
                  {l.options.map((opt, idx) => (
                    <p
                      key={idx}
                      className={
                        idx === l.correctIndex
                          ? "font-semibold text-emerald-700"
                          : idx === l.selectedIndex
                            ? "font-semibold text-rose-600 line-through"
                            : "text-slate-500"
                      }
                    >
                      {idx === l.correctIndex ? "✓ " : idx === l.selectedIndex ? "✗ " : "• "}
                      {opt}
                    </p>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  {l.isCorrect ? `+${l.pointsAwarded} pts` : l.selectedIndex === -1 ? "Timed out" : "Incorrect"}
                </p>
              </div>
            ))}
            {log.length === 0 && (
              <p className="text-center text-sm text-slate-500">
                {hasFilters ? "No answers match these filters." : "No attempts yet."}
              </p>
            )}
          </section>
        </>
      )}
    </main>
  );
}

"use client";

// Tiny synthesized sound effects via the Web Audio API - deliberately no
// audio files (nothing to host, nothing to keep $0-cost about). A muted
// preference is remembered per-device in localStorage; it's a per-viewer
// convenience, not data that needs to sync anywhere, so localStorage is the
// right tool here (see components/SoundToggle.tsx for the UI).

const MUTE_KEY = "brainquest_sound_muted";

let audioCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx) audioCtx = new AudioContextClass();
  if (audioCtx.state === "suspended") void audioCtx.resume();
  return audioCtx;
}

export function isSoundMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoundMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // localStorage can throw in a private window with storage blocked - a
    // missed mute preference is harmless, so just drop it silently.
  }
}

function tone(ctx: AudioContext, freq: number, startTime: number, durationSeconds: number, gain = 0.15) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gainNode.gain.setValueAtTime(gain, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + durationSeconds);
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + durationSeconds);
}

function play(notes: { freq: number; delay: number; duration: number; gain?: number }[]) {
  if (isSoundMuted()) return;
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const n of notes) {
    tone(ctx, n.freq, now + n.delay, n.duration, n.gain);
  }
}

/** A short, cheerful two-note chime for a correct answer. */
export function playCorrectSound(): void {
  play([
    { freq: 523.25, delay: 0, duration: 0.12 }, // C5
    { freq: 783.99, delay: 0.1, duration: 0.18 }, // G5
  ]);
}

/** A brief, gentle downward tone for a wrong answer - not harsh, this is a kids' app. */
export function playWrongSound(): void {
  play([{ freq: 220, delay: 0, duration: 0.25, gain: 0.1 }]);
}

/** A short rising fanfare for a perfect round. */
export function playPerfectSound(): void {
  play([
    { freq: 523.25, delay: 0, duration: 0.12 }, // C5
    { freq: 659.25, delay: 0.1, duration: 0.12 }, // E5
    { freq: 783.99, delay: 0.2, duration: 0.12 }, // G5
    { freq: 1046.5, delay: 0.3, duration: 0.3 }, // C6
  ]);
}

/** A softer two-note close for a round that finished but wasn't perfect. */
export function playRoundDoneSound(): void {
  play([
    { freq: 587.33, delay: 0, duration: 0.15 }, // D5
    { freq: 698.46, delay: 0.12, duration: 0.2 }, // F5
  ]);
}

/**
 * Timer presentation bits shared by the two practice runners: the session
 * runner (components/practice/runner.tsx) and the training-plan day runner
 * (components/practice/plan-runner.tsx).
 *
 * Extracted in SHAN-471 so the plan runner sounds and reads exactly like the
 * session runner instead of carrying a second copy of the same code.
 */

export function formatMMSS(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

let audioCtx: AudioContext | null = null;

/** Short beep on a work/rest phase change. Silent if audio is unavailable. */
export function playPing() {
  if (typeof window === "undefined") return;
  try {
    audioCtx =
      audioCtx ??
      new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  } catch {
    // autoplay restriction / no audio device — ignore
  }
}

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    return ctx;
  } catch {
    return null;
  }
}

/** Sblocca l'audio: va chiamata dopo un gesto dell'utente (click/tap). */
export function unlockAudio() {
  const c = getCtx();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}

function beep(freq: number, startOffset: number, duration: number, volume = 0.2) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + startOffset;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

/** Suono di fine timer: tre beep acuti + uno grave. */
export function playEndAlert() {
  unlockAudio();
  const c = getCtx();
  if (!c || c.state !== "running") return;
  beep(880, 0, 0.18);
  beep(880, 0.35, 0.18);
  beep(880, 0.7, 0.3);
  beep(660, 1.15, 0.5);
}

/** Breve beep di conferma. */
export function playTestBeep() {
  unlockAudio();
  const c = getCtx();
  if (!c || c.state !== "running") return;
  beep(880, 0, 0.15);
}

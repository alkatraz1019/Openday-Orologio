"use client";

import { formatCountdown } from "@/lib/time";
import type { TimerRow } from "@/lib/types";

type Props = {
  timer: TimerRow;
  /** Istante corrente regolato sull'orologio del server (epoch ms) */
  nowMs: number;
  onStart: (id: string) => void;
  onPause: (id: string) => void;
  onReset: (id: string) => void;
  onAdjust: (id: string, delta: number) => void;
};

export default function TimerCard({ timer, nowMs, onStart, onPause, onReset, onAdjust }: Props) {
  const endsMs = timer.ends_at ? Date.parse(timer.ends_at) : null;
  const isRunning = endsMs !== null;
  const remaining = isRunning
    ? Math.ceil(((endsMs as number) - nowMs) / 1000)
    : timer.remaining_seconds;
  const expired = remaining <= 0;
  const shown = Math.max(0, remaining);
  const progress = Math.min(1, Math.max(0, 1 - shown / Math.max(1, timer.duration_seconds)));
  const runningLow = isRunning && !expired && remaining <= 60;

  let pill = "In attesa";
  let pillCls = "bg-slate-200 text-slate-600";
  let cardCls = "bg-white";
  if (expired) {
    pill = "⏰ Tempo scaduto";
    pillCls = "bg-red-600 text-white";
    cardCls = "bg-red-50 animate-flash";
  } else if (isRunning) {
    pill = "In corso";
    pillCls = runningLow ? "bg-amber-500 text-white" : "bg-emerald-600 text-white";
    cardCls = runningLow ? "bg-amber-50" : "bg-white ring-2 ring-emerald-200";
  } else if (timer.remaining_seconds !== timer.duration_seconds) {
    pill = "In pausa";
    pillCls = "bg-sky-100 text-sky-700";
  }

  const barCls = expired
    ? "bg-red-500"
    : runningLow
      ? "bg-amber-500"
      : isRunning
        ? "bg-emerald-500"
        : "bg-slate-300";
  const digitsCls = expired
    ? "text-red-600 animate-blink"
    : runningLow
      ? "text-amber-600"
      : isRunning
        ? "text-emerald-700"
        : "text-slate-700";

  return (
    <div className={`flex flex-col rounded-2xl p-4 shadow-sm transition-colors sm:p-5 ${cardCls}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-xl font-extrabold tracking-tight sm:text-2xl">{timer.aula}</div>
          <div className="h-5 truncate text-sm text-slate-500">{timer.materia ?? "\u00a0"}</div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${pillCls}`}>{pill}</span>
      </div>

      <div
        className={`mt-3 text-center text-6xl font-black leading-none tabular-nums sm:text-7xl ${digitsCls}`}
      >
        {formatCountdown(shown)}
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200/80">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barCls}`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="mt-4">
        {expired ? (
          <button
            onClick={() => onReset(timer.id)}
            className="w-full rounded-xl bg-red-600 py-3 text-lg font-bold text-white transition hover:bg-red-500 active:scale-[0.98]"
          >
            ↺ Azzera
          </button>
        ) : !isRunning ? (
          <button
            onClick={() => onStart(timer.id)}
            className="w-full rounded-xl bg-emerald-600 py-3 text-lg font-bold text-white transition hover:bg-emerald-500 active:scale-[0.98]"
          >
            ▶ {timer.remaining_seconds !== timer.duration_seconds ? "Riprendi" : "Avvia"}
          </button>
        ) : (
          <button
            onClick={() => onPause(timer.id)}
            className="w-full rounded-xl bg-amber-500 py-3 text-lg font-bold text-white transition hover:bg-amber-400 active:scale-[0.98]"
          >
            ⏸ Pausa
          </button>
        )}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <button
          onClick={() => onAdjust(timer.id, -60)}
          className="rounded-lg bg-slate-100 py-2 text-sm font-semibold hover:bg-slate-200"
        >
          −1 min
        </button>
        <button
          onClick={() => onAdjust(timer.id, 60)}
          className="rounded-lg bg-slate-100 py-2 text-sm font-semibold hover:bg-slate-200"
        >
          +1 min
        </button>
        <button
          onClick={() => onReset(timer.id)}
          className="rounded-lg bg-slate-100 py-2 text-sm font-semibold hover:bg-slate-200"
        >
          ↺ Reset
        </button>
      </div>
    </div>
  );
}

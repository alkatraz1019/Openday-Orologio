"use client";

import { formatCountdown } from "@/lib/time";
import type { TimerRow } from "@/lib/types";

type Props = {
  timer: TimerRow;
  /** Istante corrente regolato sull'orologio del server (epoch ms) */
  nowMs: number;
  /** Numero totale di gruppi impostato da admin (null = non ancora caricato) */
  totalGroups: number | null;
  onStart: (id: string) => void;
  onPause: (id: string) => void;
  onReset: (id: string) => void;
  onComplete: (id: string) => void;
  onAdjust: (id: string, delta: number) => void;
};

export default function TimerCard({
  timer,
  nowMs,
  totalGroups,
  onStart,
  onPause,
  onReset,
  onComplete,
  onAdjust,
}: Props) {
  const endsMs = timer.ends_at ? Date.parse(timer.ends_at) : null;
  const isRunning = endsMs !== null;
  const remaining = isRunning
    ? Math.ceil(((endsMs as number) - nowMs) / 1000)
    : timer.remaining_seconds;
  const expired = remaining <= 0;
  const shown = Math.max(0, remaining);
  const overdueSec = expired ? Math.abs(Math.min(0, remaining)) : 0;
  const progress = Math.min(1, Math.max(0, 1 - shown / Math.max(1, timer.duration_seconds)));
  const runningLow = isRunning && !expired && remaining <= 60;

  const completed = timer.sessions_completed ?? 0;
  const missing =
    totalGroups !== null && totalGroups > 0 ? Math.max(totalGroups - completed, 0) : null;
  const allDone = missing !== null && missing === 0;

  let pill = "In attesa";
  let pillCls = "bg-line text-muted";
  let cardCls = "border-line bg-surface";
  if (expired) {
    pill = "⏰ Tempo scaduto";
    pillCls = "bg-danger text-white";
    cardCls = "animate-flash border-danger/50";
  } else if (isRunning) {
    pill = "In corso";
    pillCls = runningLow ? "bg-warn text-white" : "bg-brand text-white";
    cardCls = runningLow ? "border-warn/50 bg-warn-light" : "border-brand/40 bg-surface";
  } else if (timer.remaining_seconds !== timer.duration_seconds) {
    pill = "In pausa";
    pillCls = "bg-sky-light text-ink";
  }

  const barCls = expired
    ? "bg-danger"
    : runningLow
      ? "bg-warn"
      : isRunning
        ? "bg-brand"
        : timer.remaining_seconds !== timer.duration_seconds
          ? "bg-sky"
          : "bg-line";

  const digitsCls = expired
    ? "text-danger animate-blink"
    : runningLow
      ? "text-warn-dark"
      : isRunning
        ? "text-brand-dark"
        : "text-ink/80";

  return (
    <div className={`flex animate-fadeUp flex-col rounded-2xl border p-4 shadow-card sm:p-5 ${cardCls}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-heading truncate text-2xl font-bold leading-tight">{timer.aula}</div>
          <div className="h-5 truncate text-sm text-muted">{timer.materia ?? "\u00a0"}</div>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${pillCls}`}>{pill}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        <span
          className={`rounded-full px-2 py-0.5 font-semibold ${
            allDone ? "bg-brand-light text-brand-dark" : "bg-line/70 text-muted"
          }`}
        >
          ✓ {completed} {completed === 1 ? "turno" : "turni"}
        </span>
        {missing !== null &&
          (allDone ? (
            <span className="rounded-full bg-brand-light px-2 py-0.5 font-semibold text-brand-dark">
              🎉 tutti i gruppi passati
            </span>
          ) : (
            <span className="rounded-full bg-line/70 px-2 py-0.5 font-semibold text-muted">
              mancano {missing}
            </span>
          ))}
      </div>

      <div
        className={`mt-3 text-center font-heading text-6xl font-bold leading-none tabular-nums sm:text-7xl ${digitsCls}`}
      >
        {formatCountdown(shown)}
      </div>
      {expired && overdueSec > 5 && (
        <p className="mt-1 text-center text-sm font-semibold text-danger">
          in ritardo di +{formatCountdown(overdueSec)}
        </p>
      )}

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barCls}`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="mt-4">
        {expired ? (
          <button onClick={() => onComplete(timer.id)} className="btn btn-primary w-full text-lg">
            ✓ Termina turno
          </button>
        ) : !isRunning ? (
          <button
            onClick={() => onStart(timer.id)}
            className="btn btn-primary w-full text-lg"
          >
            ▶ {timer.remaining_seconds !== timer.duration_seconds ? "Riprendi" : "Avvia"}
          </button>
        ) : (
          <button
            onClick={() => onPause(timer.id)}
            className="btn w-full bg-warn text-lg text-white hover:bg-warn-dark"
          >
            ⏸ Pausa
          </button>
        )}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        {expired ? (
          <button onClick={() => onReset(timer.id)} className="btn btn-ghost col-span-3 text-sm">
            ↺ Annulla (senza contare il turno)
          </button>
        ) : !isRunning && timer.remaining_seconds === timer.duration_seconds ? (
          <>
            <button onClick={() => onAdjust(timer.id, -60)} className="btn btn-ghost text-sm">
              −1 min
            </button>
            <button onClick={() => onAdjust(timer.id, 60)} className="btn btn-ghost text-sm">
              +1 min
            </button>
            <button onClick={() => onReset(timer.id)} className="btn btn-ghost text-sm">
              ↺ Reset
            </button>
          </>
        ) : (
          <>
            <button onClick={() => onComplete(timer.id)} className="btn btn-ghost text-sm">
              ✓ Termina
            </button>
            <button onClick={() => onAdjust(timer.id, -60)} className="btn btn-ghost text-sm">
              −1 min
            </button>
            <button onClick={() => onAdjust(timer.id, 60)} className="btn btn-ghost text-sm">
              +1 min
            </button>
          </>
        )}
      </div>
    </div>
  );
}

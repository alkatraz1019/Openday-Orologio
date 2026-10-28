"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import TimerCard from "@/components/TimerCard";
import { classroomOrder } from "@/lib/classrooms";
import { playTestBeep, unlockAudio } from "@/lib/sound";
import { releaseWakeLock, requestWakeLock } from "@/lib/wakelock";
import { useTimers } from "@/hooks/useTimers";
import { useTimerAlerts } from "@/hooks/useTimerAlerts";

export default function HomePage() {
  const {
    timers,
    totalGroups,
    connected,
    configError,
    actionError,
    offsetRef,
    startTimer,
    pauseTimer,
    resetTimer,
    adjustTimer,
    refresh,
  } = useTimers();

  const [mounted, setMounted] = useState(false);
  const [tick, setTick] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [notify, setNotify] = useState<NotificationPermission | "unsupported">("default");
  const [wakeOn, setWakeOn] = useState(false);

  useEffect(() => {
    setMounted(true);
    setSoundOn(localStorage.getItem("openday_sound") !== "off");
    setNotify("Notification" in window ? Notification.permission : "unsupported");
    const iv = setInterval(() => setTick(Date.now()), 500);
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => {
      clearInterval(iv);
      window.removeEventListener("pointerdown", unlock);
    };
  }, []);

  useTimerAlerts(timers, soundOn, () => offsetRef.current);

  // Se il browser rilascia il wake lock (pagina in background), lo richiede al ritorno.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && wakeOn) requestWakeLock();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [wakeOn]);

  const sorted = useMemo(
    () =>
      [...timers].sort(
        (a, b) =>
          classroomOrder(a.aula) - classroomOrder(b.aula) ||
          a.created_at.localeCompare(b.created_at)
      ),
    [timers]
  );

  const nowMs = (mounted ? tick : 0) + offsetRef.current;
  const wallClock = mounted
    ? new Date(nowMs).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "";

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    localStorage.setItem("openday_sound", next ? "on" : "off");
    if (next) {
      unlockAudio();
      playTestBeep();
    }
  }

  async function toggleWake() {
    if (wakeOn) {
      await releaseWakeLock();
      setWakeOn(false);
      return;
    }
    const ok = await requestWakeLock();
    setWakeOn(ok);
    if (!ok) alert("Questo browser non supporta il mantenimento dello schermo attivo.");
  }

  async function enableNotifications() {
    unlockAudio();
    if (!("Notification" in window)) {
      setNotify("unsupported");
      return;
    }
    try {
      const p = await Notification.requestPermission();
      setNotify(p);
      if (p === "granted") {
        new Notification("Notifiche attive ✅", {
          body: "Riceverai un avviso quando scade un timer.",
        });
      }
    } catch {
      /* ignora */
    }
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
          <div className="mr-auto">
            <h1 className="text-xl font-black tracking-tight sm:text-2xl">⏱️ Open Day — Timer Aule</h1>
            <p className="text-xs text-slate-500">
              {wallClock && <span className="mr-2 tabular-nums">{wallClock}</span>}
              Sincronizzato in tempo reale su tutti i dispositivi
            </p>
          </div>
          <span className="rounded-full bg-indigo-100 px-3 py-1.5 text-sm font-bold text-indigo-700">
            👥 Gruppi: {totalGroups === null ? "…" : totalGroups}
          </span>
          <span
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              connected ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
            }`}
          >
            ● {connected ? "Live" : "Connessione…"}
          </span>
          <button
            onClick={toggleSound}
            className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold hover:bg-slate-200"
          >
            {soundOn ? "🔊 Suono" : "🔇 Muto"}
          </button>
          <button
            onClick={toggleWake}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              wakeOn ? "bg-amber-100 text-amber-700" : "bg-slate-100 hover:bg-slate-200"
            }`}
          >
            {wakeOn ? "☀️ Schermo sempre acceso" : "☀️ Tieni schermo acceso"}
          </button>
          {notify !== "granted" && notify !== "unsupported" && (
            <button
              onClick={enableNotifications}
              className="rounded-full bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              🔔 Attiva notifiche
            </button>
          )}
          <Link
            href="/admin"
            className="rounded-full bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700"
          >
            ⚙️ Admin
          </Link>
        </div>
      </header>

      {configError && (
        <div className="mx-auto max-w-6xl px-4 pt-4">
          <div className="rounded-xl bg-amber-100 p-4 text-sm text-amber-900">
            <b>Configurazione mancante.</b> {configError}
            <div className="mt-1">
              Segui i passaggi nel file <code className="font-mono">README.md</code> (Supabase + variabili d&apos;ambiente).
            </div>
          </div>
        </div>
      )}

      {actionError && (
        <div className="mx-auto max-w-6xl px-4 pt-4">
          <div className="flex items-center gap-3 rounded-xl bg-red-100 p-3 text-sm text-red-800">
            <span>⚠️ {actionError}</span>
            <button onClick={() => refresh()} className="font-semibold underline">
              Riprova
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6">
        {sorted.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <div className="text-4xl">⏱️</div>
            <h2 className="mt-2 text-xl font-bold">Nessun timer ancora</h2>
            <p className="mt-1 text-slate-500">
              Vai nell&apos;area admin per creare i timer delle aule: appariranno qui su tutti i dispositivi.
            </p>
            <Link
              href="/admin"
              className="mt-4 inline-block rounded-xl bg-slate-800 px-4 py-2 font-semibold text-white"
            >
              ⚙️ Apri Admin
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((t) => (
              <TimerCard
                key={t.id}
                timer={t}
                nowMs={nowMs}
                onStart={startTimer}
                onPause={pauseTimer}
                onReset={resetTimer}
                onAdjust={adjustTimer}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-slate-400">
        Suggerimento: tieni questa pagina aperta sui telefoni di ogni aula. Quando un timer scade suona
        l&apos;avviso (suono + vibrazione + notifica, se attivi su quel dispositivo). Nessun dato viene
        azzerato automaticamente: il reset è solo manuale dall&apos;area admin.
      </footer>
    </div>
  );
}

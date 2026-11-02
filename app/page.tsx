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
    completeTimer,
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

  const activeRooms = timers.filter((t) => t.ends_at && Date.parse(t.ends_at) > nowMs).length;
  const completedTurns = timers.reduce((acc, t) => acc + (t.sessions_completed ?? 0), 0);

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
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
          <div className="mr-auto flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-light text-2xl shadow-card">
              ⏱️
            </div>
            <div>
              <h1 className="font-heading text-xl font-bold leading-tight tracking-tight sm:text-2xl">
                Open Day — Timer Aule
              </h1>
              <p className="text-xs text-muted">
                {wallClock && <span className="mr-2 font-semibold tabular-nums">{wallClock}</span>}
                Sincronizzato in tempo reale su tutti i dispositivi
              </p>
            </div>
          </div>
          <span className="rounded-full bg-brand-light px-3 py-1.5 text-sm font-bold text-brand-dark">
            👥 Gruppi: {totalGroups === null ? "…" : totalGroups}
          </span>
          <span
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              connected ? "bg-brand-light text-brand-dark" : "bg-line text-muted"
            }`}
          >
            ● {connected ? "Live" : "Connessione…"}
          </span>
          <button onClick={toggleSound} className="btn btn-ghost px-3 py-1.5 text-sm">
            {soundOn ? "🔊 Suono" : "🔇 Muto"}
          </button>
          <button
            onClick={toggleWake}
            className={`btn px-3 py-1.5 text-sm ${wakeOn ? "bg-warn-light text-warn-dark" : "btn-ghost"}`}
          >
            {wakeOn ? "☀️ Schermo sempre acceso" : "☀️ Tieni schermo acceso"}
          </button>
          {notify !== "granted" && notify !== "unsupported" && (
            <button onClick={enableNotifications} className="btn btn-secondary px-3 py-1.5 text-sm">
              🔔 Attiva notifiche
            </button>
          )}
          <Link href="/admin" className="btn bg-ink px-3 py-1.5 text-sm text-white hover:opacity-90">
            ⚙️ Admin
          </Link>
        </div>
      </header>

      {configError && (
        <div className="mx-auto w-full max-w-6xl px-4 pt-4">
          <div className="rounded-2xl border border-warn/40 bg-warn-light p-4 text-sm text-warn-dark">
            <b>Configurazione mancante.</b> {configError}
            <div className="mt-1">
              Segui i passaggi nel file <code className="font-mono">README.md</code> (Supabase + variabili
              d&apos;ambiente).
            </div>
          </div>
        </div>
      )}

      {actionError && (
        <div className="mx-auto w-full max-w-6xl px-4 pt-4">
          <div className="flex items-center gap-3 rounded-2xl border border-danger/30 bg-danger-light p-3 text-sm text-danger">
            <span>⚠️ {actionError}</span>
            <button onClick={() => refresh()} className="font-semibold underline">
              Riprova
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {/* Riassunto evento */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            <div className="font-heading text-2xl font-bold sm:text-3xl">
              {totalGroups === null ? "…" : totalGroups}
            </div>
            <div className="text-xs text-muted">gruppi totali in visita</div>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            <div
              className={`font-heading text-2xl font-bold sm:text-3xl ${activeRooms > 0 ? "text-brand-dark" : ""}`}
            >
              {activeRooms}
            </div>
            <div className="text-xs text-muted">aule attive adesso</div>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            <div className="font-heading text-2xl font-bold text-brand-dark sm:text-3xl">
              ✓ {completedTurns}
            </div>
            <div className="text-xs text-muted">turni completati</div>
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-10 text-center shadow-card">
            <div className="text-5xl">⏱️</div>
            <h2 className="font-heading mt-3 text-2xl font-bold">Nessun timer ancora</h2>
            <p className="mx-auto mt-2 max-w-md text-muted">
              Crea i timer delle aule dall&apos;area admin: appariranno qui su tutti i dispositivi in tempo
              reale.
            </p>
            <Link href="/admin" className="btn btn-primary mt-5">
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
                totalGroups={totalGroups}
                onStart={startTimer}
                onPause={pauseTimer}
                onReset={resetTimer}
                onComplete={completeTimer}
                onAdjust={adjustTimer}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-10 text-xs text-muted">
        Suggerimento: tieni questa pagina aperta sui telefoni di ogni aula. Quando un timer scade suona
        l&apos;avviso (suono + vibrazione + notifica, se attivi). Quando il turno finisce davvero, premi
        «✓ Termina turno»: il contatore dell&apos;aula si aggiorna per tutti. Nessun dato viene azzerato in
        automatico.
      </footer>
    </div>
  );
}

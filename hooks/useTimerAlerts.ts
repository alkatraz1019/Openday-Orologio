"use client";

import { useEffect, useRef } from "react";
import { playEndAlert } from "@/lib/sound";
import type { TimerRow } from "@/lib/types";

const LS_KEY = "openday_alerted_v1";

function loadAlerted(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(LS_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

/**
 * Quando un timer passa da "in corso" a "scaduto", su questo dispositivo:
 * - riproduce il suono (se attivo)
 * - fa vibrare il telefono (Android)
 * - mostra una notifica (se i permessi sono stati concessi)
 * Ogni scadenza suona una sola volta, anche ricaricando la pagina.
 */
export function useTimerAlerts(timers: TimerRow[], soundOn: boolean, getOffset: () => number) {
  const timersRef = useRef(timers);
  const soundRef = useRef(soundOn);
  const offsetRef = useRef(getOffset);
  timersRef.current = timers;
  soundRef.current = soundOn;
  offsetRef.current = getOffset;

  useEffect(() => {
    const alerted = loadAlerted();
    const persist = () => {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify([...alerted].slice(-100)));
      } catch {
        /* ignora */
      }
    };

    const fire = (t: TimerRow) => {
      const key = `${t.id}:${t.ends_at}`;
      if (alerted.has(key)) return;
      alerted.add(key);
      persist();

      if (soundRef.current) playEndAlert();
      try {
        navigator.vibrate?.([400, 150, 400, 150, 400, 150, 700]);
      } catch {
        /* vibrazione non supportata */
      }
      try {
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(`⏰ Tempo scaduto — ${t.aula}`, {
            body: t.materia ? `Materia: ${t.materia}` : "Il timer è arrivato a zero.",
            tag: key,
          });
        }
      } catch {
        /* notifiche non disponibili */
      }
    };

    const check = () => {
      const now = Date.now() + offsetRef.current();
      for (const t of timersRef.current) {
        if (t.ends_at && Date.parse(t.ends_at) <= now) fire(t);
      }
    };

    const iv = setInterval(check, 500);
    return () => clearInterval(iv);
  }, []);
}

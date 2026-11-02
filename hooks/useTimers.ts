"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabaseClient";
import type { SettingsRow, TimerRow } from "@/lib/types";

/** Fallback di sicurezza se il realtime si disconnette (query leggere, ogni 60s). */
const POLL_MS = 60000;
/** Con la scheda nascosta >90s rilasciamo la connessione realtime (risparmia RAM sul server). */
const HIDE_RELEASE_MS = 90000;

/**
 * Stato condiviso di tutti i timer, sincronizzato in tempo reale con Supabase.
 * - I tempi sono generati dal server Postgres (nessun problema di orologi sfasati).
 * - `offsetRef` contiene la differenza tra orario server e orario locale:
 *   oraServer ≈ Date.now() + offsetRef.current
 *
 * Ottimizzazioni RAM/lato server:
 * - un solo canale realtime per client (i `settings` cambiano raramente: li copre il polling);
 * - scheda nascosta >90s → canale chiuso e riaperto al ritorno;
 * - polling ridotto a 60s.
 */
export function useTimers() {
  const [timers, setTimers] = useState<TimerRow[]>([]);
  const [totalGroups, setTotalGroups] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const refresh = useCallback(async () => {
    try {
      const supabase = getSupabase();
      const [tRes, sRes] = await Promise.all([
        supabase.from("timers").select("*"),
        supabase.from("settings").select("*").eq("id", 1).maybeSingle(),
      ]);
      if (tRes.error || sRes.error) {
        setActionError("Errore nel caricamento dei dati dal database");
        return;
      }
      setTimers((tRes.data as TimerRow[] | null) ?? []);
      setTotalGroups((sRes.data as SettingsRow | null)?.total_groups ?? 0);
      setConfigError(null);
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : "Configurazione mancante");
    }
  }, []);

  const syncOffset = useCallback(async () => {
    try {
      const supabase = getSupabase();
      const t0 = Date.now();
      const { data, error } = await supabase.rpc("server_time");
      if (error || !data) return;
      const t1 = Date.now();
      // compensa metà tempo di andata/ritorno
      const serverEpoch = new Date(data as string).getTime() + Math.round((t1 - t0) / 2);
      offsetRef.current = serverEpoch - t1;
    } catch {
      /* offset invariato */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    async function ensureChannel() {
      if (cancelled || channelRef.current) return;
      try {
        const supabase = getSupabase();
        const ch = supabase
          .channel("openday-timers")
          .on("postgres_changes", { event: "*", schema: "public", table: "timers" }, (payload) => {
            if (payload.eventType === "DELETE") {
              const id = (payload.old as { id?: string }).id;
              if (id) setTimers((prev) => prev.filter((t) => t.id !== id));
            } else if (payload.new) {
              const row = payload.new as TimerRow;
              setTimers((prev) => {
                const idx = prev.findIndex((t) => t.id === row.id);
                if (idx === -1) return [...prev, row];
                const next = [...prev];
                next[idx] = row;
                return next;
              });
            }
          });
        // Nota: nessun realtime su `settings` (cambia raramente) — lo copre il polling.
        channelRef.current = ch;
        ch.subscribe((status: string) => setConnected(status === "SUBSCRIBED"));
      } catch (err) {
        setConfigError(err instanceof Error ? err.message : "Configurazione mancante");
      }
    }

    async function dropChannel() {
      const ch = channelRef.current;
      channelRef.current = null;
      setConnected(false);
      if (ch) {
        try {
          await getSupabase().removeChannel(ch);
        } catch {
          try {
            await ch.unsubscribe();
          } catch {
            /* ignora */
          }
        }
      }
    }

    function onVisibility() {
      if (hideTimer) clearTimeout(hideTimer);
      if (document.visibilityState === "visible") {
        void ensureChannel();
        void refresh();
      } else {
        // scheda nascosta: dopo 90s chiude il canale realtime
        hideTimer = setTimeout(() => {
          void dropChannel();
        }, HIDE_RELEASE_MS);
      }
    }

    const polling = setInterval(() => {
      void refresh();
      void syncOffset();
    }, POLL_MS);

    document.addEventListener("visibilitychange", onVisibility);

    (async () => {
      await refresh();
      if (cancelled) return;
      await syncOffset();
      await ensureChannel();
    })();

    return () => {
      cancelled = true;
      clearInterval(polling);
      if (hideTimer) clearTimeout(hideTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      const ch = channelRef.current;
      channelRef.current = null;
      if (ch) {
        try {
          void getSupabase()
            .removeChannel(ch)
            .catch(() => {});
        } catch {
          /* ignora */
        }
      }
    };
  }, [refresh, syncOffset]);

  const runAction = useCallback(
    async (
      fn: (supabase: ReturnType<typeof getSupabase>) => PromiseLike<{ error: { message: string } | null }>
    ) => {
      try {
        const { error } = await fn(getSupabase());
        if (error) setActionError(error.message);
        else setActionError(null);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Errore di connessione");
      }
    },
    []
  );

  const startTimer = useCallback(
    (id: string) => runAction((s) => s.rpc("start_timer", { p_timer_id: id })),
    [runAction]
  );
  const pauseTimer = useCallback(
    (id: string) => runAction((s) => s.rpc("pause_timer", { p_timer_id: id })),
    [runAction]
  );
  const resetTimer = useCallback(
    (id: string) => runAction((s) => s.rpc("reset_timer", { p_timer_id: id })),
    [runAction]
  );
  /** Termina il turno: incrementa il contatore e riporta il timer a nuovo. */
  const completeTimer = useCallback(
    (id: string) => runAction((s) => s.rpc("complete_timer", { p_timer_id: id })),
    [runAction]
  );
  const adjustTimer = useCallback(
    (id: string, delta: number) =>
      runAction((s) => s.rpc("adjust_timer", { p_timer_id: id, p_delta_seconds: delta })),
    [runAction]
  );

  return {
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
  };
}

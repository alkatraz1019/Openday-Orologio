"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CLASSROOMS, classroomOrder } from "@/lib/classrooms";
import { formatCountdown, formatDuration } from "@/lib/time";
import { useTimers } from "@/hooks/useTimers";

const PRESETS = [5, 10, 15, 20, 30];

function partsOf(totalSeconds: number) {
  return { m: Math.floor(totalSeconds / 60), s: totalSeconds % 60 };
}

export default function AdminPage() {
  const { timers, totalGroups, configError, actionError, offsetRef, resetTimer, refresh } =
    useTimers();

  const [authed, setAuthed] = useState(false);
  const [pwd, setPwd] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  // form di creazione
  const [aula, setAula] = useState<string>(CLASSROOMS[0]);
  const [materia, setMateria] = useState("");
  const [newMin, setNewMin] = useState("10");
  const [newSec, setNewSec] = useState("0");

  // impostazioni
  const [groups, setGroups] = useState("0");

  // editing inline
  const [editId, setEditId] = useState<string | null>(null);
  const [editAula, setEditAula] = useState("");
  const [editMateria, setEditMateria] = useState("");
  const [editMin, setEditMin] = useState("0");
  const [editSec, setEditSec] = useState("0");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (totalGroups !== null) setGroups(String(totalGroups));
  }, [totalGroups]);

  useEffect(() => {
    if (!msg) return;
    const to = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(to);
  }, [msg]);

  useEffect(() => {
    const saved = sessionStorage.getItem("od_admin_pwd");
    if (saved) login(saved).then(setAuthed);
  }, []);

  async function login(p: string): Promise<boolean> {
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "x-admin-password": p },
      });
      if (res.ok) {
        sessionStorage.setItem("od_admin_pwd", p);
        return true;
      }
      sessionStorage.removeItem("od_admin_pwd");
      return false;
    } catch {
      return false;
    }
  }

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    const ok = await login(pwd);
    if (ok) {
      setAuthed(true);
      setPwd("");
    } else {
      setAuthError("Password errata (oppure ADMIN_PASSWORD non è configurata sul server)");
    }
  }

  function api(path: string, method: string, body?: unknown) {
    const p = sessionStorage.getItem("od_admin_pwd") ?? "";
    return fetch(path, {
      method,
      headers: { "Content-Type": "application/json", "x-admin-password": p },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  function toSeconds(minStr: string, secStr: string): number | null {
    const m = parseInt(minStr, 10);
    const s = parseInt(secStr, 10);
    if (!Number.isFinite(m) || !Number.isFinite(s) || m < 0 || s < 0 || s > 59) return null;
    const total = m * 60 + s;
    return total < 1 ? null : total;
  }

  async function createTimer(e: React.FormEvent) {
    e.preventDefault();
    const total = toSeconds(newMin, newSec);
    if (total === null) {
      setMsg({ type: "err", text: "Durata non valida (minuti ≥ 0, secondi 0–59, totale almeno 1 secondo)" });
      return;
    }
    setBusy(true);
    try {
      const res = await api("/api/admin/timers", "POST", { aula, materia, duration_seconds: total });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ type: "err", text: json.error ?? "Errore durante la creazione" });
      else {
        setMateria("");
        setMsg({ type: "ok", text: `Timer creato per ${aula}` });
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  function startEdit(id: string, tAula: string, tMateria: string | null, tDur: number) {
    const { m, s } = partsOf(tDur);
    setEditId(id);
    setEditAula(tAula);
    setEditMateria(tMateria ?? "");
    setEditMin(String(m));
    setEditSec(String(s));
  }

  async function saveEdit() {
    if (!editId) return;
    const total = toSeconds(editMin, editSec);
    if (total === null) {
      setMsg({ type: "err", text: "Durata non valida" });
      return;
    }
    setBusy(true);
    try {
      const current = timers.find((t) => t.id === editId);
      const body: Record<string, unknown> = { id: editId, aula: editAula, materia: editMateria };
      // Invia la durata solo se cambiata: così la modifica della materia non ferma il timer in corso.
      if (!current || current.duration_seconds !== total) body.duration_seconds = total;
      const res = await api("/api/admin/timers", "PUT", body);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ type: "err", text: json.error ?? "Errore durante il salvataggio" });
      else {
        setEditId(null);
        setMsg({ type: "ok", text: "Timer aggiornato" });
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function removeTimer(id: string, aulaLabel: string) {
    if (!confirm(`Eliminare il timer di ${aulaLabel}?`)) return;
    setBusy(true);
    try {
      const res = await api(`/api/admin/timers?id=${encodeURIComponent(id)}`, "DELETE");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ type: "err", text: json.error ?? "Errore durante l'eliminazione" });
      else {
        setMsg({ type: "ok", text: "Timer eliminato" });
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveGroups(e: React.FormEvent) {
    e.preventDefault();
    const n = parseInt(groups, 10);
    if (!Number.isFinite(n) || n < 0 || n > 999) {
      setMsg({ type: "err", text: "Numero di gruppi non valido (0–999)" });
      return;
    }
    setBusy(true);
    try {
      const res = await api("/api/admin/settings", "POST", { total_groups: n });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ type: "err", text: json.error ?? "Errore durante il salvataggio" });
      else setMsg({ type: "ok", text: "Numero di gruppi aggiornato" });
    } finally {
      setBusy(false);
    }
  }

  async function resetAll() {
    if (
      !confirm(
        "Azzerare TUTTI i timer? Ogni timer tornerà alla durata completa, si fermerà e il conteggio dei turni tornerà a zero."
      )
    )
      return;
    setBusy(true);
    try {
      const res = await api("/api/admin/reset-all", "POST");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ type: "err", text: json.error ?? "Errore" });
      else {
        setMsg({ type: "ok", text: "Tutti i timer sono stati azzerati" });
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    sessionStorage.removeItem("od_admin_pwd");
    setAuthed(false);
  }

  if (configError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-2xl border border-warn/40 bg-warn-light p-6 text-sm text-warn-dark">
          <b className="text-base">Configurazione mancante.</b>
          <p className="mt-2">{configError}</p>
          <p className="mt-2">
            Segui i passaggi nel file <code className="font-mono">README.md</code>.
          </p>
          <Link href="/" className="mt-4 inline-block font-semibold underline">
            ← Torna ai timer
          </Link>
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <form
          onSubmit={submitLogin}
          className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-pop"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-light text-2xl">
            ⚙️
          </div>
          <h1 className="font-heading mt-3 text-xl font-bold">Area Admin</h1>
          <p className="mt-1 text-sm text-muted">
            Inserisci la password condivisa per gestire i timer.
          </p>
          <input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="Password"
            className="input mt-4 w-full"
            autoFocus
          />
          {authError && <p className="mt-2 text-sm font-semibold text-danger">{authError}</p>}
          <button type="submit" className="btn btn-primary mt-4 w-full">
            Entra
          </button>
          <Link href="/" className="mt-3 block text-center text-sm text-muted hover:underline">
            ← Torna ai timer
          </Link>
        </form>
      </div>
    );
  }

  const sortedTimers = [...timers].sort(
    (a, b) =>
      classroomOrder(a.aula) - classroomOrder(b.aula) || a.created_at.localeCompare(b.created_at)
  );

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-light text-lg">
            ⚙️
          </div>
          <h1 className="font-heading mr-auto text-lg font-bold">Admin — Open Day Timer</h1>
          <Link href="/" className="btn btn-ghost px-3 py-1.5 text-sm">
            ← Timer
          </Link>
          <button onClick={logout} className="btn btn-ghost px-3 py-1.5 text-sm">
            Esci
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        {msg && (
          <div
            className={`rounded-2xl p-3 text-sm font-semibold ${
              msg.type === "ok"
                ? "border border-brand/30 bg-brand-light text-brand-dark"
                : "border border-danger/30 bg-danger-light text-danger"
            }`}
          >
            {msg.text}
          </div>
        )}

        {actionError && (
          <div className="flex items-center gap-3 rounded-2xl border border-danger/30 bg-danger-light p-3 text-sm text-danger">
            <span>⚠️ {actionError}</span>
            <button onClick={() => refresh()} className="font-semibold underline">
              Riprova
            </button>
          </div>
        )}

        {/* IMPOSTAZIONI */}
        <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <h2 className="font-heading text-lg font-bold">Impostazioni evento</h2>
          <form onSubmit={saveGroups} className="mt-3 flex flex-wrap items-end gap-3">
            <label className="block min-w-[220px] flex-1">
              <span className="text-xs font-semibold text-muted">
                Numero totale di gruppi in visita — usato per il badge e per calcolare quanti turni
                mancano a ogni aula
              </span>
              <input
                type="number"
                min={0}
                max={999}
                value={groups}
                onChange={(e) => setGroups(e.target.value)}
                className="input mt-1 w-full"
              />
            </label>
            <button type="submit" disabled={busy} className="btn btn-primary">
              Salva
            </button>
          </form>

          <div className="mt-4 border-t border-line pt-4">
            <button onClick={resetAll} disabled={busy} className="btn btn-danger text-sm">
              ↺ Azzera tutti i timer
            </button>
            <p className="mt-1 text-xs text-muted">
              Riporta ogni timer alla durata completa, lo ferma e azzera i contatori dei turni. Nessun
              timer viene eliminato. Nessun azzeramento avviene mai in automatico.
            </p>
          </div>
        </section>

        {/* CREAZIONE */}
        <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <h2 className="font-heading text-lg font-bold">Aggiungi timer</h2>
          <form onSubmit={createTimer} className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-muted">Aula</span>
              <select value={aula} onChange={(e) => setAula(e.target.value)} className="select mt-1 w-full">
                {CLASSROOMS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-muted">Materia in corso (facoltativa)</span>
              <input
                type="text"
                value={materia}
                onChange={(e) => setMateria(e.target.value)}
                maxLength={120}
                placeholder="es. Robotica base"
                className="input mt-1 w-full"
              />
            </label>

            <div className="sm:col-span-2">
              <span className="text-xs font-semibold text-muted">Durate rapide</span>
              <div className="mt-1 flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setNewMin(String(p));
                      setNewSec("0");
                    }}
                    className="btn btn-ghost px-3 py-2 text-sm"
                  >
                    {p} min
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="text-xs font-semibold text-muted">Minuti</span>
              <input
                type="number"
                min={0}
                max={1439}
                value={newMin}
                onChange={(e) => setNewMin(e.target.value)}
                className="input mt-1 w-full"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-muted">Secondi</span>
              <input
                type="number"
                min={0}
                max={59}
                value={newSec}
                onChange={(e) => setNewSec(e.target.value)}
                className="input mt-1 w-full"
              />
            </label>

            <div className="sm:col-span-2">
              <button type="submit" disabled={busy} className="btn btn-primary">
                ＋ Crea timer
              </button>
              <p className="mt-1 text-xs text-muted">
                Un solo timer per aula: i timer appaiono subito sulla schermata principale.
              </p>
            </div>
          </form>
        </section>

        {/* ELENCO */}
        <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <h2 className="font-heading text-lg font-bold">Timer esistenti ({timers.length})</h2>
          {timers.length === 0 && (
            <p className="mt-2 text-sm text-muted">Nessun timer. Creane uno qui sopra.</p>
          )}
          <ul className="mt-3 divide-y divide-line">
            {sortedTimers.map((t) => {
              const endsMs = t.ends_at ? Date.parse(t.ends_at) : null;
              const rem =
                endsMs !== null
                  ? Math.ceil((endsMs - (tick + offsetRef.current)) / 1000)
                  : t.remaining_seconds;
              const status =
                endsMs !== null
                  ? rem <= 0
                    ? "⏰ Scaduto"
                    : "▶ In corso"
                  : t.remaining_seconds === 0
                    ? "Finito"
                    : t.remaining_seconds !== t.duration_seconds
                      ? "⏸ In pausa"
                      : "In attesa";

              return (
                <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-[140px]">
                    <div className="font-heading font-bold">{t.aula}</div>
                    <div className="text-xs text-muted">{t.materia ?? "—"}</div>
                  </div>
                  <div className="w-16 text-sm font-bold tabular-nums">
                    {formatCountdown(Math.max(0, rem))}
                  </div>
                  <span className="text-xs font-semibold text-muted">{status}</span>
                  <span className="rounded-full bg-brand-light px-2 py-0.5 text-xs font-semibold text-brand-dark">
                    ✓ {t.sessions_completed ?? 0} turni
                  </span>
                  <span className="text-xs text-muted">durata {formatDuration(t.duration_seconds)}</span>
                  <div className="ml-auto flex gap-2">
                    {editId === t.id ? (
                      <button onClick={() => setEditId(null)} className="btn btn-ghost px-3 py-2 text-sm">
                        Chiudi
                      </button>
                    ) : (
                      <button
                        onClick={() => startEdit(t.id, t.aula, t.materia, t.duration_seconds)}
                        className="btn btn-ghost px-3 py-2 text-sm"
                      >
                        Modifica
                      </button>
                    )}
                    <button onClick={() => resetTimer(t.id)} className="btn btn-ghost px-3 py-2 text-sm">
                      Azzera
                    </button>
                    <button
                      onClick={() => removeTimer(t.id, t.aula)}
                      className="btn border border-danger/30 bg-danger-light px-3 py-2 text-sm text-danger hover:bg-danger hover:text-white"
                    >
                      Elimina
                    </button>
                  </div>

                  {editId === t.id && (
                    <div className="grid w-full gap-3 rounded-2xl bg-canvas p-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-xs font-semibold text-muted">Aula</span>
                        <select
                          value={editAula}
                          onChange={(e) => setEditAula(e.target.value)}
                          className="select mt-1 w-full"
                        >
                          {CLASSROOMS.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold text-muted">Materia</span>
                        <input
                          type="text"
                          value={editMateria}
                          onChange={(e) => setEditMateria(e.target.value)}
                          maxLength={120}
                          className="input mt-1 w-full"
                        />
                      </label>
                      <div className="sm:col-span-2">
                        <span className="text-xs font-semibold text-muted">Durate rapide</span>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {PRESETS.map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => {
                                setEditMin(String(p));
                                setEditSec("0");
                              }}
                              className="btn btn-ghost px-3 py-2 text-sm"
                            >
                              {p} min
                            </button>
                          ))}
                        </div>
                      </div>
                      <label className="block">
                        <span className="text-xs font-semibold text-muted">Minuti</span>
                        <input
                          type="number"
                          min={0}
                          max={1439}
                          value={editMin}
                          onChange={(e) => setEditMin(e.target.value)}
                          className="input mt-1 w-full"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold text-muted">Secondi</span>
                        <input
                          type="number"
                          min={0}
                          max={59}
                          value={editSec}
                          onChange={(e) => setEditSec(e.target.value)}
                          className="input mt-1 w-full"
                        />
                      </label>
                      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                        <button
                          onClick={saveEdit}
                          disabled={busy}
                          className="btn btn-primary text-sm"
                        >
                          Salva
                        </button>
                        <button onClick={() => setEditId(null)} className="btn btn-ghost text-sm">
                          Annulla
                        </button>
                        <p className="text-xs text-muted">
                          Se cambi la durata, il timer si ferma e riparte dalla nuova durata.
                        </p>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}

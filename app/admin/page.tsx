"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CLASSROOMS, classroomOrder } from "@/lib/classrooms";
import { formatCountdown, formatDuration } from "@/lib/time";
import { useTimers } from "@/hooks/useTimers";

const PRESETS = [5, 10, 15, 20, 30];

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400";
const btnSmall =
  "rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold hover:bg-slate-200 disabled:opacity-50";

function partsOf(totalSeconds: number) {
  return { m: Math.floor(totalSeconds / 60), s: totalSeconds % 60 };
}

export default function AdminPage() {
  const { timers, totalGroups, configError, offsetRef, resetTimer, refresh } = useTimers();

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
    if (!confirm("Azzerare TUTTI i timer? Ogni timer tornerà alla durata completa e si fermerà.")) return;
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
        <div className="rounded-xl bg-amber-100 p-6 text-sm text-amber-900">
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
          className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h1 className="text-xl font-black">⚙️ Area Admin</h1>
          <p className="mt-1 text-sm text-slate-500">
            Inserisci la password condivisa per gestire i timer.
          </p>
          <input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="Password"
            className={`${inputCls} mt-4`}
            autoFocus
          />
          {authError && <p className="mt-2 text-sm font-semibold text-red-600">{authError}</p>}
          <button
            type="submit"
            className="mt-4 w-full rounded-xl bg-slate-900 py-2.5 font-bold text-white hover:bg-slate-800"
          >
            Entra
          </button>
          <Link href="/" className="mt-3 block text-center text-sm text-slate-500 hover:underline">
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
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <h1 className="mr-auto text-lg font-black">⚙️ Admin — Open Day Timer</h1>
          <Link href="/" className="text-sm font-semibold text-slate-600 hover:underline">
            ← Timer
          </Link>
          <button onClick={logout} className="text-sm font-semibold text-slate-600 hover:underline">
            Esci
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        {msg && (
          <div
            className={`rounded-xl p-3 text-sm font-semibold ${
              msg.type === "ok" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
            }`}
          >
            {msg.text}
          </div>
        )}

        {/* IMPOSTAZIONI */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold">Impostazioni evento</h2>
          <form onSubmit={saveGroups} className="mt-3 flex flex-wrap items-end gap-3">
            <label className="block min-w-[220px] flex-1">
              <span className="text-xs font-semibold text-slate-500">
                Numero totale di gruppi in visita (mostrato sulla schermata principale)
              </span>
              <input
                type="number"
                min={0}
                max={999}
                value={groups}
                onChange={(e) => setGroups(e.target.value)}
                className={`${inputCls} mt-1`}
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              Salva
            </button>
          </form>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <button
              onClick={resetAll}
              disabled={busy}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-50"
            >
              ↺ Azzera tutti i timer
            </button>
            <p className="mt-1 text-xs text-slate-400">
              Riporta ogni timer alla durata completa e lo ferma. Nessun timer viene eliminato. Nessun
              azzeramento avviene mai in automatico.
            </p>
          </div>
        </section>

        {/* CREAZIONE */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold">Aggiungi timer</h2>
          <form onSubmit={createTimer} className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Aula</span>
              <select value={aula} onChange={(e) => setAula(e.target.value)} className={`${inputCls} mt-1`}>
                {CLASSROOMS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Materia in corso (facoltativa)</span>
              <input
                type="text"
                value={materia}
                onChange={(e) => setMateria(e.target.value)}
                maxLength={120}
                placeholder="es. Robotica base"
                className={`${inputCls} mt-1`}
              />
            </label>

            <div className="sm:col-span-2">
              <span className="text-xs font-semibold text-slate-500">Durate rapide</span>
              <div className="mt-1 flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setNewMin(String(p));
                      setNewSec("0");
                    }}
                    className={btnSmall}
                  >
                    {p} min
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Minuti</span>
              <input
                type="number"
                min={0}
                max={1439}
                value={newMin}
                onChange={(e) => setNewMin(e.target.value)}
                className={`${inputCls} mt-1`}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Secondi</span>
              <input
                type="number"
                min={0}
                max={59}
                value={newSec}
                onChange={(e) => setNewSec(e.target.value)}
                className={`${inputCls} mt-1`}
              />
            </label>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-emerald-600 px-4 py-2.5 font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                ＋ Crea timer
              </button>
              <p className="mt-1 text-xs text-slate-400">Un solo timer per aula: i timer appaiono subito sulla schermata principale.</p>
            </div>
          </form>
        </section>

        {/* ELENCO */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold">Timer esistenti ({timers.length})</h2>
          {timers.length === 0 && (
            <p className="mt-2 text-sm text-slate-400">Nessun timer. Creane uno qui sopra.</p>
          )}
          <ul className="mt-3 divide-y divide-slate-100">
            {sortedTimers.map((t) => {
              const endsMs = t.ends_at ? Date.parse(t.ends_at) : null;
              const rem =
                endsMs !== null ? Math.ceil((endsMs - (tick + offsetRef.current)) / 1000) : t.remaining_seconds;
              const status = endsMs !== null ? (rem <= 0 ? "⏰ Scaduto" : "▶ In corso") : t.remaining_seconds === 0 ? "Finito" : t.remaining_seconds !== t.duration_seconds ? "⏸ In pausa" : "In attesa";

              return (
                <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-[140px]">
                    <div className="font-bold">{t.aula}</div>
                    <div className="text-xs text-slate-500">{t.materia ?? "—"}</div>
                  </div>
                  <div className="w-16 text-sm font-bold tabular-nums">{formatCountdown(Math.max(0, rem))}</div>
                  <span className="text-xs font-semibold text-slate-500">{status}</span>
                  <span className="text-xs text-slate-400">durata {formatDuration(t.duration_seconds)}</span>
                  <div className="ml-auto flex gap-2">
                    {editId === t.id ? (
                      <button onClick={() => setEditId(null)} className={btnSmall}>
                        Chiudi
                      </button>
                    ) : (
                      <button onClick={() => startEdit(t.id, t.aula, t.materia, t.duration_seconds)} className={btnSmall}>
                        Modifica
                      </button>
                    )}
                    <button onClick={() => resetTimer(t.id)} className={btnSmall}>
                      Azzera
                    </button>
                    <button
                      onClick={() => removeTimer(t.id, t.aula)}
                      className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
                    >
                      Elimina
                    </button>
                  </div>

                  {editId === t.id && (
                    <div className="grid w-full gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-xs font-semibold text-slate-500">Aula</span>
                        <select value={editAula} onChange={(e) => setEditAula(e.target.value)} className={`${inputCls} mt-1`}>
                          {CLASSROOMS.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold text-slate-500">Materia</span>
                        <input
                          type="text"
                          value={editMateria}
                          onChange={(e) => setEditMateria(e.target.value)}
                          maxLength={120}
                          className={`${inputCls} mt-1`}
                        />
                      </label>
                      <div className="sm:col-span-2">
                        <span className="text-xs font-semibold text-slate-500">Durate rapide</span>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {PRESETS.map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => {
                                setEditMin(String(p));
                                setEditSec("0");
                              }}
                              className={btnSmall}
                            >
                              {p} min
                            </button>
                          ))}
                        </div>
                      </div>
                      <label className="block">
                        <span className="text-xs font-semibold text-slate-500">Minuti</span>
                        <input
                          type="number"
                          min={0}
                          max={1439}
                          value={editMin}
                          onChange={(e) => setEditMin(e.target.value)}
                          className={`${inputCls} mt-1`}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold text-slate-500">Secondi</span>
                        <input
                          type="number"
                          min={0}
                          max={59}
                          value={editSec}
                          onChange={(e) => setEditSec(e.target.value)}
                          className={`${inputCls} mt-1`}
                        />
                      </label>
                      <div className="flex gap-2 sm:col-span-2">
                        <button
                          onClick={saveEdit}
                          disabled={busy}
                          className="rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          Salva
                        </button>
                        <button onClick={() => setEditId(null)} className={btnSmall}>
                          Annulla
                        </button>
                        <p className="text-xs text-slate-400">
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

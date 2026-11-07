import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/** Azzera manualmente TUTTI i timer: tornano alla durata completa e si fermano. */
export async function POST(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  // Percorso principale: la funzione SQL fa tutto in un colpo solo.
  const { error } = await admin.rpc("reset_all_timers");
  if (!error) return NextResponse.json({ ok: true });

  // Fallback: sulle versioni vecchie della funzione l'UPDATE senza WHERE viene
  // bloccato da pg-safeupdate ("UPDATE requires a WHERE clause"). Se fallisce,
  // rifacciamo il reset via PostgREST: l'RPC reset_timer (che ha una WHERE) per
  // ogni timer + un update "match-all" per azzerare i contatori dei turni.
  const { data: rows, error: selErr } = await admin.from("timers").select("id");
  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 });

  for (const row of rows ?? []) {
    const { error: rpcErr } = await admin.rpc("reset_timer", { p_timer_id: row.id });
    if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 });
  }

  // `id` è chiave primaria NOT NULL: "id is not null" è sempre vero e supera pg-safeupdate.
  const { error: updErr, count } = await admin
    .from("timers")
    .update({ sessions_completed: 0 }, { count: "exact" })
    .not("id", "is", null);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, count: count ?? rows?.length ?? 0 });
}

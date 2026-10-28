import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function cleanMateria(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, 120);
  return t.length > 0 ? t : null;
}

function cleanAula(v: unknown): string {
  return typeof v === "string" ? v.trim().slice(0, 40) : "";
}

function validDuration(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1 || n > 86400) return null;
  return Math.round(n);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Crea un timer (uno solo per aula). */
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

  const body = (await req.json().catch(() => null)) as {
    aula?: unknown;
    materia?: unknown;
    duration_seconds?: unknown;
  } | null;

  const aula = cleanAula(body?.aula);
  const materia = cleanMateria(body?.materia);
  const duration = validDuration(body?.duration_seconds);
  if (!aula) return NextResponse.json({ error: "Aula mancante o non valida" }, { status: 400 });
  if (duration === null) return NextResponse.json({ error: "Durata non valida (1–86400 secondi)" }, { status: 400 });

  const { data: existing } = await admin.from("timers").select("id").eq("aula", aula).maybeSingle();
  if (existing) {
    return NextResponse.json({ error: `Esiste già un timer per ${aula}: eliminalo o modificalo` }, { status: 409 });
  }

  const { data, error } = await admin
    .from("timers")
    .insert({ aula, materia, duration_seconds: duration, remaining_seconds: duration })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ timer: data });
}

/** Modifica un timer esistente. Se cambia la durata, il timer si ferma e riparte dalla nuova durata. */
export async function PUT(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const body = (await req.json().catch(() => null)) as {
    id?: unknown;
    aula?: unknown;
    materia?: unknown;
    duration_seconds?: unknown;
  } | null;

  const id = typeof body?.id === "string" ? body.id : "";
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "ID non valido" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body?.aula !== undefined) {
    const aula = cleanAula(body.aula);
    if (!aula) return NextResponse.json({ error: "Aula non valida" }, { status: 400 });
    patch.aula = aula;
  }
  if (body?.materia !== undefined) patch.materia = cleanMateria(body.materia);
  if (body?.duration_seconds !== undefined) {
    const duration = validDuration(body.duration_seconds);
    if (duration === null) return NextResponse.json({ error: "Durata non valida (1–86400 secondi)" }, { status: 400 });
    patch.duration_seconds = duration;
    patch.remaining_seconds = duration;
    patch.ends_at = null; // ferma il timer: riparte dalla nuova durata quando riavviato
  }

  if (patch.aula !== undefined) {
    const { data: dup } = await admin
      .from("timers")
      .select("id")
      .eq("aula", patch.aula as string)
      .neq("id", id)
      .maybeSingle();
    if (dup) {
      return NextResponse.json({ error: `Esiste già un timer per ${patch.aula}` }, { status: 409 });
    }
  }

  const { data, error } = await admin.from("timers").update(patch).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ timer: data });
}

/** Elimina un timer. */
export async function DELETE(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "ID non valido" }, { status: 400 });

  const { error } = await admin.from("timers").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

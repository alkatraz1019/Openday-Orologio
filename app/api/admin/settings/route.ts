import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/** Imposta il numero totale di gruppi in visita. */
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

  const body = (await req.json().catch(() => null)) as { total_groups?: unknown } | null;
  const n = Number(body?.total_groups);
  if (!Number.isInteger(n) || n < 0 || n > 999) {
    return NextResponse.json({ error: "Numero di gruppi non valido (0–999)" }, { status: 400 });
  }

  const { error } = await admin.from("settings").upsert({
    id: 1,
    total_groups: n,
    updated_at: new Date().toISOString(),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

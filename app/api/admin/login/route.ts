import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json(
      { error: "Password errata o ADMIN_PASSWORD non configurata" },
      { status: 401 }
    );
  }
  return NextResponse.json({ ok: true });
}

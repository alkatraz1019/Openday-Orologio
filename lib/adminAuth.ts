import { timingSafeEqual } from "crypto";

/** Verifica la password condivisa inviata nell'header x-admin-password. */
export function isAdminRequest(req: Request): boolean {
  const provided = req.headers.get("x-admin-password") ?? "";
  const secret = process.env.ADMIN_PASSWORD ?? "";
  if (!secret) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(secret, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare global {
  // Su Vercel (serverless) ogni funzione può essere invocata molte volte:
  // riusare il client evita di aprire nuove connessioni HTTP/PostgREST a ogni richiesta.
  var __supabaseAdminClient: SupabaseClient | undefined;
}

/** Client lato server (API routes) con service role: bypassa RLS. Mai importare dal browser. */
export function getSupabaseAdmin(): SupabaseClient {
  if (globalThis.__supabaseAdminClient) return globalThis.__supabaseAdminClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Variabili d'ambiente mancanti sul server: imposta NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  globalThis.__supabaseAdminClient = client;
  return client;
}

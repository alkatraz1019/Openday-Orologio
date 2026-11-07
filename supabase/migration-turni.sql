-- ============================================================
-- MIGRAZIONE: contatore dei turni (per database già esistenti)
-- Se il tuo database Supabase è già stato creato con la versione
-- precedente di schema.sql, esegui QUESTO file nel SQL Editor.
-- (Se invece il database è nuovo, schema.sql contiene già tutto.)
-- ============================================================

-- 1) Nuova colonna: turni completati per aula
alter table public.timers
  add column if not exists sessions_completed integer not null default 0;

-- 2) Nuova funzione: termina il turno (incrementa il contatore e riporta il timer a nuovo)
create or replace function public.complete_timer(p_timer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.timers;
begin
  select * into r from public.timers where id = p_timer_id for update;
  if not found then raise exception 'Timer non trovato'; end if;
  update public.timers
    set sessions_completed = sessions_completed + 1,
        remaining_seconds = duration_seconds,
        ends_at = null,
        updated_at = now()
  where id = p_timer_id;
end $$;

-- 3) La funzione di reset globale azzera anche i contatori dei turni
create or replace function public.reset_all_timers()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  -- "where true" è richiesto: Supabase ha pg-safeupdate attivo e blocca gli
  -- UPDATE senza WHERE, anche dentro le funzioni security definer.
  update public.timers
    set remaining_seconds = duration_seconds,
        sessions_completed = 0,
        ends_at = null,
        updated_at = now()
    where true;
  get diagnostics n = row_count;
  return n;
end $$;

-- 4) Permessi: chiunque può terminare un turno (come avviare/fermare);
--    il reset globale resta riservato all'admin (service role).
grant execute on function public.complete_timer(uuid) to anon, authenticated;

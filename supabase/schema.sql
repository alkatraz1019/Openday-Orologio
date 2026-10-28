-- ============================================================
-- Open Day Timer — schema Supabase
-- Incolla TUTTO questo file nel SQL Editor di Supabase e premi Run.
-- ============================================================

-- ---------- Tabelle ----------
create table if not exists public.timers (
  id uuid primary key default gen_random_uuid(),
  aula text not null,
  materia text,
  duration_seconds integer not null default 600 check (duration_seconds between 1 and 86400),
  remaining_seconds integer not null default 600 check (remaining_seconds between 0 and 86400),
  ends_at timestamptz, -- impostato quando il timer è in corso; null = fermo
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.settings (
  id integer primary key check (id = 1),
  total_groups integer not null default 0 check (total_groups between 0 and 999),
  updated_at timestamptz not null default now()
);

insert into public.settings (id, total_groups) values (1, 0) on conflict (id) do nothing;

-- ---------- RLS: lettura pubblica, scrittura solo tramite RPC / service role ----------
alter table public.timers enable row level security;
alter table public.settings enable row level security;

drop policy if exists "tutti possono leggere i timer" on public.timers;
create policy "tutti possono leggere i timer" on public.timers for select using (true);

drop policy if exists "tutti possono leggere le impostazioni" on public.settings;
create policy "tutti possono leggere le impostazioni" on public.settings for select using (true);

-- NB: nessuna policy di INSERT/UPDATE/DELETE per il pubblico.
-- Il pubblico può solo avviare/pausare/azzerare/regolare i timer tramite le RPC qui sotto
-- (che usano SEMPRE l'orologio del server Postgres, così tutti i dispositivi sono sincronizzati).

-- ---------- Funzioni temporali ----------
create or replace function public.server_time()
returns timestamptz
language sql
stable
as $$ select now() $$;

create or replace function public.start_timer(p_timer_id uuid)
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
  if r.ends_at is not null then return; end if; -- già in corso: idempotente
  update public.timers
    set ends_at = now() + make_interval(secs => greatest(coalesce(r.remaining_seconds, r.duration_seconds), 1)),
        updated_at = now()
  where id = p_timer_id;
end $$;

create or replace function public.pause_timer(p_timer_id uuid)
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
  if r.ends_at is null then return; end if; -- già fermo
  update public.timers
    set remaining_seconds = greatest(ceil(extract(epoch from (r.ends_at - now())))::int, 0),
        ends_at = null,
        updated_at = now()
  where id = p_timer_id;
end $$;

create or replace function public.reset_timer(p_timer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.timers
    set remaining_seconds = duration_seconds,
        ends_at = null,
        updated_at = now()
  where id = p_timer_id;
end $$;

create or replace function public.adjust_timer(p_timer_id uuid, p_delta_seconds int)
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
  if r.ends_at is not null then
    -- in corso: sposta la scadenza (mai nel passato)
    update public.timers
      set ends_at = greatest(r.ends_at + make_interval(secs => p_delta_seconds), now() + interval '1 second'),
          updated_at = now()
    where id = p_timer_id;
  else
    -- fermo: cambia il tempo rimanente
    update public.timers
      set remaining_seconds = greatest(r.remaining_seconds + p_delta_seconds, 0),
          updated_at = now()
    where id = p_timer_id;
  end if;
end $$;

-- Usata SOLO dalle API admin (service role): azzera tutti i timer in una volta.
create or replace function public.reset_all_timers()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.timers set remaining_seconds = duration_seconds, ends_at = null, updated_at = now();
  get diagnostics n = row_count;
  return n;
end $$;

-- Il pubblico può usare le funzioni di avvio/pausa/reset/regolazione...
grant execute on function public.server_time() to anon, authenticated;
grant execute on function public.start_timer(uuid) to anon, authenticated;
grant execute on function public.pause_timer(uuid) to anon, authenticated;
grant execute on function public.reset_timer(uuid) to anon, authenticated;
grant execute on function public.adjust_timer(uuid, int) to anon, authenticated;

-- ...ma NON il reset globale (riservato all'admin via service role).
revoke execute on function public.reset_all_timers() from public;
revoke execute on function public.reset_all_timers() from anon;
revoke execute on function public.reset_all_timers() from authenticated;
grant execute on function public.reset_all_timers() to service_role;

-- ---------- Realtime: invia le modifiche a tutti i client connessi ----------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'timers'
  ) then
    alter publication supabase_realtime add table public.timers;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'settings'
  ) then
    alter publication supabase_realtime add table public.settings;
  end if;
end $$;

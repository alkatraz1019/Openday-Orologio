-- ============================================================
-- Diagnostica memoria Supabase — esegui nel SQL Editor e mandami l'output
-- (ogni blocco è indipendente: puoi eseguirli uno per volta)
-- ============================================================

-- 1) Dimensione REALE dei dati (verità inconfutabile: sono pochi KB)
select pg_size_pretty(pg_database_size(current_database())) as dimensione_database;

-- 2) Dimensione per tabella
select relname as tabella,
       n_live_tup as righe,
       pg_size_pretty(pg_total_relation_size(relid)) as dimensione_totale
from pg_stat_user_tables
order by pg_total_relation_size(relid) desc
limit 10;

-- 3) Connessioni aperte per stato — connessioni idle accumulate mangiano RAM
select state, count(*) as connessioni,
       min(state_change) as piu_vecchia_dal, max(state_change) as piu_recente_dal
from pg_stat_activity
group by 1
order by connessioni desc;

-- 4) Dettaglio connessioni (chi le tiene aperte e da quanto tempo)
select pid, usename, application_name, state,
       to_char(state_change, 'HH24:MI:SS') as cambiata_alle,
       now() - state_change as ferma_da
from pg_stat_activity
where pid <> pg_backend_pid()
order by state_change
limit 20;

-- 5) Slot di replica realtime — uno slot NON attivo con WAL accumulato è un problema
select slot_name, active, wal_status,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn)) as wal_non_confermato
from pg_replication_slots;

-- 6) Impostazioni memoria di Postgres (per riferimento)
show shared_buffers;
show work_mem;
show max_connections;

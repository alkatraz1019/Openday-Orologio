# ⏱️ Open Day Timer

Timer **condivisi in tempo reale** per coordinare gli open day scolastici: un timer per aula, chiunque può avviarlo/fermarlo e **tutti vedono lo stesso countdown**.

## Cosa fa

- **Schermata principale** (`/`) con tutti i timer ordinati per aula: A1, A2, A3, STEAM, ARTE, MATEMATICA, ROBOTICA, LABORATORIO
- Ogni timer mostra l'**aula**, la **materia in corso** (testo libero) e il **countdown grande**
- **Avvia / Pausa / Riprendi / Reset / ±1 min** da qualsiasi dispositivo → visibile subito da tutti
- **Avvisi a fine timer**: 🔊 suono + 📳 vibrazione (Android) + 🔔 notifica di sistema (se permessi concessi)
- Badge **"👥 Gruppi"** con il numero totale di gruppi in visita
- **Area admin** (`/admin`) protetta da password: crea, modifica, elimina timer, imposta i gruppi totali, azzera tutto
- **Nessun reset automatico**: i dati restano nel database finché l'admin non li azzera manualmente
- Orologio del **server Postgres** come riferimento: tutti i dispositivi sono sincronizzati al secondo, anche con orologi sbagliati

## Setup (10 minuti)

### 1. Crea il database su Supabase (gratis)

1. Vai su [supabase.com](https://supabase.com) → **New project** (scegli una regione vicina, es. Frankfurt)
2. Apri **SQL Editor** → **New query** → incolla tutto il contenuto di [`supabase/schema.sql`](supabase/schema.sql) → **Run**
3. Vai su **Settings → API** e copia:
   - **Project URL**
   - **anon public** key
   - **service_role** key (⚠️ solo lato server, non condividerla)

### 2. Configura le variabili d'ambiente

```bash
cp .env.local.example .env.local
```

Compila le 4 variabili. Per `ADMIN_PASSWORD` scegli la password dell'area admin.

### 3. Sviluppo locale

```bash
npm install
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000) (schermata principale) e [http://localhost:3000/admin](http://localhost:3000/admin).

### 4. Deploy su Vercel

1. Carica il progetto su GitHub:
   ```bash
   git init && git add . && git commit -m "Open Day Timer"
   git remote add origin https://github.com/TUO-UTENTE/openday-timers.git
   git push -u origin main
   ```
2. Su [vercel.com](https://vercel.com) → **Add New... → Project** → importa la repository
3. In **Settings → Environment Variables** aggiungi le 4 variabili del file `.env.local.example`
4. **Deploy** → il sito sarà su `https://tuo-progetto.vercel.app`

## Come si usa durante l'evento

1. **Prima dell'evento** (da /admin): imposta il numero di gruppi, crea i timer per ogni aula con la durata giusta
2. **Proietta** la schermata principale (o aprila sui telefoni di ogni aula)
3. Su ogni dispositivo: tocca **🔊 Suono** per attivare l'audio e **🔔 Attiva notifiche** (i browser richiedono un gesto dell'utente prima di riprodurre suoni)
4. All'inizio di ogni attività, chi è in aula preme **▶ Avvia** sul proprio timer: tutti vedono il countdown partire
5. A fine timer: suono + vibrazione + notifica su tutti i dispositivi con la pagina aperta, la card lampeggia in rosso
6. Se un'attività va oltre: **+1 min**; se finisce in anticipo: **Pausa** o **Reset**
7. A fine giornata: /admin → **Azzera tutti i timer** (o elimina i timer per ricrearli da zero l'anno dopo)

## Note e limiti

- **Vibrazione**: funziona solo su Android (Chrome). iOS non supporta la vibrazione web — lì funzionano suono e notifica.
- **Notifiche**: su iOS vanno installate solo per app "aggiunta a schermata Home"; su desktop e Android funzionano subito dopo il permesso.
- **Suono**: richiede un tap/click sulla pagina (limite dei browser). Il bottone 🔊 sblocca l'audio.
- **Un timer per aula**: il sistema impedisce di creare due timer per la stessa aula.
- **Modifica durata**: se l'admin cambia la durata di un timer in corso, il timer si ferma e riparte dalla nuova durata.
- **Sicurezza**: la chiave `service_role` e la password admin vivono solo lato server (API routes + env di Vercel). Il pubblico può solo avviare/fermare/azzerare i singoli timer tramite funzioni RPC limitate.

## Struttura del progetto

```
app/
  page.tsx              # schermata principale (grid dei timer)
  admin/page.tsx        # area admin protetta da password
  api/admin/...         # API protette: login, timers, settings, reset-all
components/TimerCard.tsx
hooks/useTimers.ts      # realtime Supabase + fallback polling + offset orologio server
hooks/useTimerAlerts.ts # suono/vibrazione/notifica a scadenza (una volta per scadenza)
lib/                    # client Supabase, auth admin, suoni, utilità
supabase/schema.sql     # tabelle, RLS, RPC, realtime
```

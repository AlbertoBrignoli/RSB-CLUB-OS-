# STEP 7 — MVP Roadmap

## V1 — consegnata ora (utilizzabile dal team)

Copre tutte le 16 priorità assolute della specifica:

1. ✅ Authentication (Supabase Auth email+password, primo utente → Super Admin)
2. ✅ User roles (RBAC data-driven, 6 ruoli seed, gestione da /users)
3. ✅ Dashboard (Next Match, Content week, Tasks, Graphic pipeline, Media, Activity)
4. ✅ Squad (/team per ruoli con stati infortunio/squalifica)
5. ✅ Player profiles (mini media center: 7 tab + 5 widget)
6. ✅ Media (libreria globale, upload drag&drop, tag, collegamenti M2M)
7. ✅ Matches (database partite, 3 viste)
8. ✅ Match Center (6 tab, risultato+eventi+formazione, Generate Match Content)
9. ✅ Editorial Calendar (Month/Week/List, filtri, drag&drop)
10. ✅ Content Management (10 stati, workflow completo)
11. ✅ Graphics Workflow (kanban 6 colonne, versioni V1→FINAL, approvazioni)
12. ✅ Task Management (My/All/Board/By User, collaboratori)
13. ✅ Comments (@menzioni su content/graphic/task/match/player)
14. ✅ Notifications (campanella: mention, assegnazioni, review, approvazioni, partite)
15. ✅ Activity Log (feed + storico per club)
16. ✅ Reports / Player Coverage (KPI produzione + ⚠ Low Coverage)

## V1.1 — rifinitura operativa (1ª settimana di uso reale)

- Deploy su Vercel + dominio; onboarding del team (creazione account, assegnazione ruoli).
- Realtime su notifiche e kanban (Supabase Realtime, ora polling 60s).
- Dashboard per ruolo (widget ordinati in base al ruolo: SMM→calendar, Designer→queue, PM→approvals).
- Thumbnail generate per i video; anteprime PDF.
- Reminder scadenze (cron: notifica "deadline domani" su task/grafiche).

## V2 — profondità

- Template contenuti oltre il match pack (Birthday auto da birth_date, Training ricorrente, Sponsor).
- Approvazioni con richieste di modifica strutturate (changelog per versione).
- Export report PDF mensile per il club; storico stagioni a confronto.
- Web Push (pattern già collaudato su AUVI.BUSINESS/VGA).
- Ricerca full-text (pg_trgm) e filtri salvati.

## V3 — AUVI CLUB OS (multi-club)

- Selettore club (le membership multiple sono già supportate dallo schema).
- Onboarding wizard nuovo club: palette, logo, stagione, ruoli, template → minuti, non settimane.
- Cross-club dashboard AUVI (produzione aggregata per l'agenzia).
- AUVI AI Assistant: query naturali su coverage, grafiche da approvare, task in ritardo,
  generazione caption — lo schema attuale è già interrogabile senza modifiche.

## Integrazioni future (architettura predisposta)

Meta/Instagram API (pubblicazione da scheduled→published), Google Drive/Dropbox (import media),
Canva/Adobe (apertura grafica in editor), WhatsApp (digest), Google Calendar (sync partite),
football data API (risultati automatici — pattern Radar VGA riusabile).

# STEP 1 — Product Architecture

## Visione

**Real San Basilio — Club OS** (powered by AUVI) è un Club Content & Operations OS: un unico
ambiente dove il team AUVI coordina rosa, contenuti, grafiche, media, partite, task e persone.
È il primo esemplare di **AUVI CLUB OS**: nulla è hardcoded su Real San Basilio.

## Gerarchia multi-tenant

```
AUVI (organization)
└── CLUB (Real San Basilio — domani Club A, B, C…)
    ├── SEASONS (2026/27 corrente)
    ├── USERS (memberships: utente × club × ruolo)
    ├── PLAYERS
    ├── MATCHES (→ Match Workspace)
    ├── CONTENT (calendario editoriale)
    ├── GRAPHICS (production queue)
    ├── MEDIA (libreria globale)
    └── TASKS
```

Ogni tabella di dominio porta `club_id`: aggiungere un club = aggiungere una riga, non rifare il software.

## Il principio "Match Workspace"

La partita è il **centro operativo** da cui nasce tutto, non una sezione tra le altre:

```
MATCH (creata)
  └─ Generate Match Content ──────────────┐
       ├─ CONTENT (8 item da template)    │  ogni item nasce già collegato
       ├─ GRAPHICS (1 richiesta per item) │  a partita + contenuto + task
       └─ TASKS (1 per item, con deadline)│
MATCH (risultato inserito)
  └─ proposta contenuti post-match: Final Score, Post Match, MOTM, Gallery, Highlights
```

Le altre entità si collegano alla partita (media della partita, task della partita, grafiche
della partita) e il Match Center le mostra tutte in tab dedicate. Questo evita l'app "a sezioni
scollegate".

## Mappa delle relazioni

```
players ──< content_players >── content ──── graphics ──< graphic_versions
   │                               │             │              │
   ├──< media_players >── media ───┤             │            media (kind=graphic)
   │                        │      │             │
   ├──< match_lineup        │      │             │
   ├──< match_events        └── matches ─────────┘
   │                               │
tasks ── (player|match|content|graphic)
comments / notifications / activity_log ── (polimorfici su ogni entità)
```

Many-to-many reali: un contenuto riguarda N giocatori, una foto contiene N giocatori,
una grafica collega match + player + content.

## Sezioni (sidebar)

HOME · TEAM · MATCHES · EDITORIAL · CONTENT · GRAPHICS · MEDIA · TASKS · REPORTS ·
USERS (solo users.manage) · SETTINGS (solo settings.manage).
Trasversali: ⌘K search globale, campanella notifiche, + Create, feed Team Activity.

## Principio di prodotto

Ogni funzione risponde a: *"rende più semplice coordinare squadra, contenuti, media e persone?"*
La piattaforma sostituisce WhatsApp + Excel + cartelle sparse per la gestione quotidiana.

## AI-ready

Lo schema è interrogabile direttamente per il futuro AUVI AI Assistant: coverage per giocatore,
grafiche da approvare, task in ritardo e foto di un giocatore sono tutte singole query SQL
(vedi 02-database-schema). Nessuna modifica strutturale necessaria per aggiungere l'AI layer.

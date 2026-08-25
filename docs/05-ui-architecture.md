# STEP 5 — UI Architecture

## Navigazione

- **Sidebar** fissa (desktop, 224px): Home, Team, Matches, Editorial, Content, Graphics, Media,
  Tasks, Reports*, Users*, Settings* (*visibili solo col permesso). Logo club in alto,
  "Powered by AUVI" in basso.
- **Topbar** sticky: search (⌘K), **+ Create** (menu: New Content / New Graphic Request / New Task /
  Upload Media / Add Match / Add Player — filtrato sui permessi), campanella notifiche, avatar utente.
- **Mobile**: bottom-bar con le 5 sezioni principali; tutte le pagine responsive (consultare
  calendario, approvare, commentare, caricare foto, gestire task funziona da telefono).

## Pagine e pattern

| Route | Pattern | Dettaglio |
|---|---|---|
| /dashboard | dashboard a card | Next Match hero, Content this week, Open tasks, Graphic production, Recent media, Upcoming content, Team activity |
| /team | griglia card per ruolo | 4 sezioni (POR/DIF/CEN/ATT), Add Player in Dialog |
| /players/[id] | pagina profilo, header hero + widget + tab | Overview / Media / Content / Matches / Stats / Notes / Documents |
| /matches | lista + viste (List/Calendar/Season) | Add Match in Dialog |
| /matches/[id] | **Match Center**: hero + tab | Overview / Content / Graphics / Media / Tasks / Result |
| /editorial | calendario (Month/Week/List) + filtri | card contenuto per giorno, drag&drop cambio data |
| /content | tabella database + filtri + ricerca | dettaglio in Drawer (ContentEditor condiviso) |
| /graphics | **kanban** 6 colonne | drawer con brief, versioni V1→FINAL, commenti |
| /media | griglia + tab categorie + filtri | upload multi-file drag&drop, drawer dettaglio |
| /tasks | viste My/All/Board/By User | drawer dettaglio, kanban per stato |
| /reports | KPI + tabella Player Coverage | barre orizzontali, ⚠ Low Coverage |
| /users | tabella membri + matrice ruoli | add by email, cambio ruolo |
| /settings | card di configurazione | club/colori/logo, stagioni, competizioni, tipi, canali, template |
| /login | auth | email+password, primo utente = Super Admin |

## Componenti di superficie

- **Dialog** (centrato): creazione entità (player, match, task, richiesta grafica, upload).
- **Drawer** (laterale destro, 576px): dettaglio/modifica di content, graphic, task, media —
  si apre anche via deep-link `?open=<id>` (usato da notifiche, ricerca, feed e cross-link).
- **Command palette** (⌘K): ricerca live su players, matches, content, graphics, tasks, media.
- **Tabs** sottolineate stile Linear; **Badge** di stato con colori semantici da un'unica mappa;
  **EmptyState** con icona+azione; **Skeleton** in ogni caricamento; card con hover.
- **CommentsSection** riusabile su content/graphic/task/match/player con @menzioni → notifica.
- **ActivityFeed** riusabile (dashboard e, in futuro, per-entità).

## Stato & dati

Client components + Supabase JS diretto (pattern già in uso negli altri progetti AUVI), sessione
via cookie (@supabase/ssr) con middleware che protegge tutte le route. `ClubProvider` carica una
volta: profilo, club, stagione, ruolo, permessi (`can()`), team, tipi e canali. Deep-link
`?new=1` / `?open=id` su ogni lista.

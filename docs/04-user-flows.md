# STEP 4 — User Flows

Ogni passaggio scrive su `activity_log` (feed + audit) e, dove indicato 🔔, genera una notifica.

## 1. Create Match (PM)
/matches → Add Match → form (avversario*, data/ora*, stadio, casa/trasferta, competizione, giornata)
→ insert `matches` (stagione corrente) → 🔔 upcoming_match a tutto il team → si apre il Match Center.

## 2. Generate Match Content (PM/SMM)
Match Center → tab Content → **Generate Match Content** → RPC `generate_match_pack`:
per ognuno degli 8 template (Announcement −3g, Pre Match −1g, Match Day, Starting XI, Half Time,
Final Score, Post Match +1g, Photo Gallery +1g) crea content (data = kickoff ± offset) +
graphic request (se needs_graphic) + task con deadline. Idempotente: rigenerarlo non duplica.

## 3. Create Content (SMM)
+ Create → New Content → form completo (titolo*, tipo, canale, data/ora, caption, hashtag,
giocatori M2M, partita, owner, reviewer, priorità, stato) → insert `content` (+`content_players`).
Nasce come Idea/Planned e compare subito nel calendario editoriale.

## 4. Request Graphic (SMM)
Dal ContentEditor → "Richiedi grafica" → insert `graphics` (title, content_id, match, player,
deadline = data pubblicazione, brief) → content.status = graphic_requested →
🔔 graphic_assigned ai designer (o al designer scelto). La card appare nella colonna REQUESTED del kanban.

## 5. Graphic Production & Approval (Designer → PM)
Designer: kanban → si assegna / trascina in IN PROGRESS → carica **V1** (upload su Storage +
riga `media` kind=graphic + riga `graphic_versions`) → stato REVIEW automatico → 🔔 graphic_ready
al richiedente. PM/Super Advisor: apre il drawer → se servono modifiche commenta e riporta in
IN PROGRESS (🔔 al designer) → designer carica **V2** → PM trascina in APPROVED (🔔 designer+richiedente)
→ content.status = approved. Tutte le versioni restano nello storico.

## 6. Upload Player Media (chiunque con media.upload)
/media (o Player Page → tab Media, o Match Center → tab Media) → Upload Media → drag&drop multi-file
→ Storage `club-media/{club_id}/…` → insert `media` con categoria/tag → collega giocatori
(`media_players`) e/o partita → i file compaiono nella libreria globale, nella pagina giocatore
e nel match, contemporaneamente.

## 7. Add Result (PM)
Match Center → tab Result → punteggio + Starting XI (`match_lineup`) + eventi (marcatori, assist,
cartellini, sostituzioni in `match_events`) → status = finished → il sistema propone il pacchetto
post-match: **Final Score · Post Match · Man of the Match · Photo Gallery · Highlights**, ognuno
creabile con un click come content collegato alla partita.

## 8. Player Content Review (PM/Advisor)
/reports → sezione Player Coverage: per ogni giocatore POSTS / STORIES / REELS / TOTAL / LAST CONTENT,
calcolati da `content_players` × canale. Chi è sotto il 50% della media squadra è marcato
**⚠ Low Coverage** → dal profilo giocatore si crea direttamente un Player Focus. Nessun giocatore
viene dimenticato.

## Workflow contenuto end-to-end (sintesi)

SMM crea Match Day → richiede grafica → Designer riceve 🔔 e carica V1 → PM revisiona →
(eventuale V2) → PM approva → SMM programma (scheduled) → pubblicato (published).
Ogni transizione è registrata in activity_log con autore e ora.

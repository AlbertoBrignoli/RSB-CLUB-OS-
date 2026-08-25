# STEP 3 — Permission Matrix (Role × Action × Resource)

I permessi vivono nel DB (`permissions`, `role_permissions`): la matrice sotto è lo **stato seed**,
modificabile da /users senza toccare il codice. Il "Second Graphic Designer" è lo stesso ruolo
`graphic_designer` assegnato a un secondo utente.

Legenda: ✅ = permesso attivo · — = non concesso. La **lettura** di rosa, partite, contenuti,
grafiche, media, task, calendario e attività è garantita a *tutti i membri* del club (is_member).

| Permesso | Super Admin | Project Manager | SMM | Graphic Designer | Advisor | Super Advisor |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| players.manage (rosa e giocatori) | ✅ | ✅ | — | — | — | — |
| matches.manage (partite, risultati, eventi) | ✅ | ✅ | — | — | — | — |
| content.create | ✅ | ✅ | ✅ | — | — | — |
| content.edit (caption, calendario, programmazione, stati) | ✅ | ✅ | ✅ | — | — | — |
| content.approve | ✅ | ✅ | — | — | ✅ | ✅ |
| content.delete | ✅ | ✅ | — | — | — | — |
| graphics.request | ✅ | ✅ | ✅ | — | — | — |
| graphics.produce (versioni, stati lavorazione, assegnarsi) | ✅ | ✅ | — | ✅ | — | — |
| graphics.approve | ✅ | ✅ | — | — | — | ✅ |
| media.upload | ✅ | ✅ | ✅ | ✅ | — | — |
| media.manage (eliminazione) | ✅ | ✅ | — | — | — | — |
| tasks.create | ✅ | ✅ | ✅ | ✅ | — | — |
| tasks.manage (assegnare, eliminare, gestire tutti) | ✅ | ✅ | — | — | — | — |
| comments.create | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| reports.view (KPI, coverage, report) | ✅ | ✅ | ✅ | — | ✅ | ✅ |
| users.manage (utenti, ruoli, permessi) | ✅ | — | — | — | — | — |
| settings.manage (club, stagioni, tipi, template) | ✅ | — | — | — | — | — |

Regole aggiuntive (RLS, indipendenti dal ruolo):
- Un task è modificabile anche dal suo **owner** e dagli **assegnatari** senza tasks.manage.
- Le notifiche sono visibili/gestibili solo dal destinatario.
- I commenti sono cancellabili solo dall'autore.
- L'activity log è in sola lettura per tutti (insert solo a proprio nome).

Enforcement su due livelli: **UI** (bottoni/sezioni nascoste con `can(perm)`) e **database**
(policy RLS) — un utente non può aggirare l'interfaccia via API.

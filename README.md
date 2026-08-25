# Real San Basilio — Club OS

**Club Content & Operations OS** · powered by **AUVI**

Un unico ambiente per coordinare rosa, giocatori, contenuti social, calendario editoriale,
grafiche, media, partite, risultati, task, approvazioni e attività del team.
Primo esemplare di **AUVI CLUB OS**: architettura multi-club, nulla è hardcoded.

## Stack

- **Next.js 16** (App Router) · TypeScript · Tailwind v4
- **Supabase**: Postgres 17 + Auth + Storage + RLS — progetto `RSB CLUB OS` (gjxsjqdtfsudabrvhuob, eu-west-1)
- RBAC data-driven (roles/permissions/role_permissions/memberships)

## Avvio

```bash
npm install
npm run dev
```

`.env.local` è già configurato (URL + publishable key del progetto Supabase).

**Primo accesso**: registrati da /login — il primo account creato diventa automaticamente
**Super Admin AUVI**. Gli altri membri si registrano e vengono aggiunti da /users → "Add member"
con il ruolo giusto.

## Documentazione

- [01 — Product Architecture](docs/01-product-architecture.md)
- [02 — Database Schema](docs/02-database-schema.md) (migrations in `supabase/migrations/`)
- [03 — Permission Matrix](docs/03-permission-matrix.md)
- [04 — User Flows](docs/04-user-flows.md)
- [05 — UI Architecture](docs/05-ui-architecture.md)
- [06 — Design System](docs/06-design-system.md)
- [07 — MVP Roadmap](docs/07-mvp-roadmap.md)
- [CONVENTIONS.md](CONVENTIONS.md) — convenzioni di sviluppo

## Deploy (quando pronto)

Vercel: importare il repo, impostare le due env `NEXT_PUBLIC_SUPABASE_URL` e
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. Ricordare la commit email `albertobrignoli43@gmail.com`.

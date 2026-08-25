# RSB CLUB OS — Convenzioni di sviluppo

Stack: Next.js 16 (App Router) + TypeScript + Tailwind v4 + Supabase (client-side).
Lingua UI: italiano con termini inglesi di prodotto (Match Day, Review, ecc.).

## Regole fondamentali

1. **Tutte le pagine sono client components** (`"use client"`), dentro `src/app/(app)/…`.
2. Dati e sessione arrivano da `useClub()` (`src/lib/club-context.tsx`):
   `club`, `season`, `userId`, `profile`, `role`, `can(perm)`, `team` (membri con profilo+ruolo),
   `contentTypes`, `channels`.
3. Query Supabase con `supabase()` da `src/lib/supabase/client.ts`, sempre filtrate per `club_id`.
4. **Permessi**: ogni azione di scrittura è dietro `can("…")`. Chiavi: players.manage, matches.manage,
   content.create, content.edit, content.approve, content.delete, graphics.request, graphics.produce,
   graphics.approve, media.upload, media.manage, tasks.create, tasks.manage, comments.create,
   reports.view, users.manage, settings.manage. Nascondere i bottoni se il permesso manca.
5. **Ogni scrittura rilevante registra attività** con `logActivity()` e, dove sensato, notifica con
   `notify()` (entrambi in `src/lib/activity.ts`). Esempi di summary: "Marco ha caricato Match Day v2",
   "Alessio ha approvato il contenuto X".
6. Tipi in `src/lib/types.ts`. Etichette/colori stato SOLO da `src/lib/utils.ts`
   (CONTENT_STATUS, GRAPHIC_STATUS, TASK_STATUS, PRIORITY, PLAYER_STATUS, MATCH_STATUS,
   POSITION_LABEL, MATCH_EVENT_LABEL, fmtDate, fmtTime, playerName, matchLabel, cn).
7. UI kit in `src/components/ui/`: Button, Card/CardHeader/CardBody, Badge, Input/Textarea/Select/Field,
   Dialog, Drawer, e in `misc.tsx`: Avatar, Skeleton, PageSkeleton, EmptyState, ProgressBar, Kbd,
   PageHeader, Tabs. Componenti condivisi: `shared/comments-section.tsx` (CommentsSection con
   entityType/entityId/entityLabel), `shared/activity-feed.tsx`.
8. **Query param**: le pagine liste supportano `?new=1` (apre il form di creazione) e `?open=<id>`
   (apre il dettaglio in Drawer). `useSearchParams()` va usato dentro un componente avvolto in
   `<Suspense>` (requisito Next):
   ```tsx
   export default function Page() {
     return <Suspense fallback={<PageSkeleton />}><PageInner /></Suspense>;
   }
   ```
9. **Join con profiles**: dove una tabella ha più FK verso profiles servono gli hint espliciti:
   - tasks: `owner:profiles!tasks_owner_id_fkey(*)`
   - content: `owner:profiles!content_owner_id_fkey(*), reviewer:profiles!content_reviewer_id_fkey(*)`
   - graphics: `designer:profiles!graphics_designer_id_fkey(*), requester:profiles!graphics_requested_by_fkey(*)`
10. Upload file: `uploadFile(clubId, area, file)` da `src/lib/storage.ts` (bucket club-media,
    path `{club_id}/{area}/…`), poi insert nella tabella `media`.
11. Stile: molto spazio bianco, card pulite, niente UI sovraccarica. Guardare
    `src/app/(app)/dashboard/page.tsx` come riferimento di stile e struttura.
    Colori solo tramite token: brand, brand-soft, accent, ok/warn/danger/info (+ -soft), muted, line,
    surface, background. Hover states e transizioni brevi. EmptyState eleganti sempre.
12. Select di persone: opzioni da `team` (`m.user_id` / `m.profile?.full_name`); select di giocatori:
    query `players` per club ordinata per cognome.
13. Date: formato italiano via fmtDate/fmtDateTime/fmtTime. Input date/time nativi (`<input type="date">`).
14. Niente librerie nuove senza necessità. Niente `any` se evitabile; il build deve passare
    `npm run build` senza errori TypeScript/ESLint. Non usare `<img>`: usare `next/image` con `unoptimized`.
15. Schema DB completo in `supabase/migrations/` — consultarlo per i nomi esatti di campi ed enum.

## Workflow contenuto ↔ grafica (da rispettare nelle UI)

SMM crea content → richiede grafica (graphics.request, status content → graphic_requested) →
designer si assegna/riceve (graphics.produce, status todo → in_progress) → carica versione V1/V2/FINAL
(graphic_versions + media) → status review → PM/Super Advisor approva (graphics.approve, → approved;
content → approved) → SMM programma (content → scheduled) → published.
Ogni passaggio: logActivity + notify al diretto interessato (designer assegnato, richiedente, owner).

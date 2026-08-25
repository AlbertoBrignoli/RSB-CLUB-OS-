# STEP 6 — Design System

Riferimenti: Linear, Notion, Apple, dashboard SaaS sportive premium. Sensazione: prodotto SaaS
pulito, molto spazio bianco, gerarchia forte, zero sovraccarico.

## Colori (CSS variables in `globals.css`, palette club configurabile da Settings)

| Token | Valore seed | Uso |
|---|---|---|
| --brand | #8B1E2D (bordeaux RSB) | azioni primarie, stati attivi, hero |
| --brand-strong | #6F1522 | hover primario, gradienti |
| --brand-soft | #F8ECEE | selezioni, badge brand |
| --accent | #D4A94E (oro) | accenti, momenti "premium" |
| --background | #FAFAFA | fondo app |
| --surface | #FFFFFF | card, sidebar, topbar |
| --foreground | #18181B | testo |
| --muted | #71717A | testo secondario |
| --line | #E4E4E7 | bordi 1px |
| ok/warn/danger/info (+ -soft) | verde/ambra/rosso/blu | stati semantici |

I colori di stato passano SEMPRE dalle mappe in `src/lib/utils.ts` (CONTENT_STATUS, GRAPHIC_STATUS,
TASK_STATUS, PRIORITY, PLAYER_STATUS, MATCH_STATUS): un solo posto per cambiarli.
La palette del club è in `clubs.colors` (jsonb): un altro club = altri colori, stesso sistema.

## Tipografia

Geist Sans (variabile), base **14px**. Scala: 24/semibold (titolo pagina) · 20 (hero) ·
14 (corpo) · 13 (secondario) · 11-12 (meta) · 10-11/uppercase/tracking-wide (label sezione).
Numeri importanti (KPI, punteggi): 24-28/semibold.

## Spacing & forme

Griglia 4px. Card `rounded-[0.875rem]`, bordo `--line`, ombra minima (0 1px 2px 4%).
Dialog/Drawer `rounded-2xl` + ombra profonda. Pill per i badge. Pochi bordi: la struttura
nasce da spazio e tipografia, non da linee.

## Componenti (src/components/ui)

Button (primary/secondary/ghost/danger, loading), Card/CardHeader/CardBody, Badge,
Input/Textarea/Select/Field, Dialog, Drawer, Tabs, Avatar (iniziali fallback), Skeleton,
PageSkeleton, EmptyState, ProgressBar, Kbd, PageHeader.

## Principi di interazione

- Hover states ovunque (bordo brand/30 sulle card cliccabili, bg su righe).
- Microinterazioni: fade-up 200ms su pagine e overlay, transizioni colore 150ms.
- Skeleton loading, mai spinner a pagina intera.
- Empty state sempre con spiegazione + azione ("Aggiungi partita", "Crea contenuto").
- Focus ring brand per accessibilità tastiera; ⌘K, ⌘Enter (invio commento), Esc.
- Un'azione primaria per vista; il resto è secondary/ghost.

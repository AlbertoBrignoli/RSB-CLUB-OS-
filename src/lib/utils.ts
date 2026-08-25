import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, differenceInCalendarDays } from "date-fns";
import { it } from "date-fns/locale";
import type {
  ContentStatus, GraphicStatus, TaskStatus, PriorityLevel,
  PlayerPosition, PlayerStatus, MatchStatus, MatchEventType,
} from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------- date ----------

export function fmtDate(d: string | Date | null | undefined, pattern = "d MMM yyyy") {
  if (!d) return "—";
  return format(new Date(d), pattern, { locale: it });
}

// Orari sempre in ora italiana (il club è a Roma), qualunque sia il fuso del dispositivo.
export function fmtDateTime(d: string | Date | null | undefined) {
  if (!d) return "—";
  const date = new Date(d);
  const day = new Intl.DateTimeFormat("it-IT", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Rome",
  }).format(date);
  const time = new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome",
  }).format(date);
  return `${day} · ${time}`;
}

export function fmtTime(t: string | null | undefined) {
  if (!t) return "";
  return t.slice(0, 5);
}

export function timeAgo(d: string | Date) {
  return formatDistanceToNow(new Date(d), { locale: it, addSuffix: true });
}

export function daysUntil(d: string | Date) {
  return differenceInCalendarDays(new Date(d), new Date());
}

export function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

// ---------- label + colori di stato (unica fonte di verità UI) ----------

type Chip = { label: string; className: string };

export const CONTENT_STATUS: Record<ContentStatus, Chip> = {
  idea:              { label: "Idea",              className: "bg-background text-muted border border-line" },
  planned:           { label: "Planned",           className: "bg-info-soft text-info" },
  copy:              { label: "Copy",              className: "bg-info-soft text-info" },
  graphic_requested: { label: "Graphic Requested", className: "bg-accent-soft text-warn" },
  in_production:     { label: "In Production",     className: "bg-warn-soft text-warn" },
  review:            { label: "Review",            className: "bg-brand-soft text-brand" },
  approved:          { label: "Approved",          className: "bg-ok-soft text-ok" },
  scheduled:         { label: "Scheduled",         className: "bg-info-soft text-info" },
  published:         { label: "Published",         className: "bg-ok-soft text-ok" },
  cancelled:         { label: "Cancelled",         className: "bg-background text-muted border border-line line-through" },
};

export const GRAPHIC_STATUS: Record<GraphicStatus, Chip> = {
  requested:   { label: "Requested",   className: "bg-background text-muted border border-line" },
  todo:        { label: "Da iniziare", className: "bg-info-soft text-info" },
  in_progress: { label: "In lavorazione", className: "bg-warn-soft text-warn" },
  review:      { label: "Da revisionare", className: "bg-brand-soft text-brand" },
  approved:    { label: "Approvato",   className: "bg-ok-soft text-ok" },
  published:   { label: "Pubblicato",  className: "bg-ok-soft text-ok" },
};

export const TASK_STATUS: Record<TaskStatus, Chip> = {
  todo:        { label: "To Do",       className: "bg-background text-muted border border-line" },
  in_progress: { label: "In Progress", className: "bg-warn-soft text-warn" },
  review:      { label: "Review",      className: "bg-brand-soft text-brand" },
  done:        { label: "Done",        className: "bg-ok-soft text-ok" },
  blocked:     { label: "Blocked",     className: "bg-danger-soft text-danger" },
};

export const PRIORITY: Record<PriorityLevel, Chip> = {
  low:    { label: "Low",    className: "bg-background text-muted border border-line" },
  medium: { label: "Medium", className: "bg-info-soft text-info" },
  high:   { label: "High",   className: "bg-warn-soft text-warn" },
  urgent: { label: "Urgent", className: "bg-danger-soft text-danger" },
};

export const PLAYER_STATUS: Record<PlayerStatus, Chip> = {
  available:   { label: "Available",   className: "bg-ok-soft text-ok" },
  injured:     { label: "Injured",     className: "bg-danger-soft text-danger" },
  suspended:   { label: "Suspended",   className: "bg-warn-soft text-warn" },
  unavailable: { label: "Unavailable", className: "bg-background text-muted border border-line" },
};

export const MATCH_STATUS: Record<MatchStatus, Chip> = {
  upcoming:  { label: "Upcoming",  className: "bg-info-soft text-info" },
  live:      { label: "Live",      className: "bg-danger-soft text-danger" },
  finished:  { label: "Finished",  className: "bg-ok-soft text-ok" },
  postponed: { label: "Postponed", className: "bg-warn-soft text-warn" },
  cancelled: { label: "Cancelled", className: "bg-background text-muted border border-line" },
};

export const POSITION_LABEL: Record<PlayerPosition, { short: string; full: string; plural: string }> = {
  GK: { short: "POR", full: "Portiere",       plural: "Portieri" },
  DF: { short: "DIF", full: "Difensore",      plural: "Difensori" },
  MF: { short: "CEN", full: "Centrocampista", plural: "Centrocampisti" },
  FW: { short: "ATT", full: "Attaccante",     plural: "Attaccanti" },
};

export const POSITIONS: PlayerPosition[] = ["GK", "DF", "MF", "FW"];

export const MATCH_EVENT_LABEL: Record<MatchEventType, string> = {
  goal: "Gol",
  own_goal: "Autogol",
  assist: "Assist",
  yellow_card: "Ammonizione",
  red_card: "Espulsione",
  sub_in: "Entra",
  sub_out: "Esce",
  penalty_scored: "Rigore segnato",
  penalty_missed: "Rigore sbagliato",
};

export const NOTIFICATION_TYPE_LABEL: Record<
  import("./types").NotificationType,
  { label: string; desc: string }
> = {
  mention:          { label: "Menzioni",              desc: "Quando qualcuno ti menziona con @" },
  task_assigned:    { label: "Task assegnati",        desc: "Quando ti viene assegnato un task" },
  graphic_assigned: { label: "Richieste grafiche",    desc: "Quando ti viene assegnata una grafica da produrre" },
  graphic_ready:    { label: "Grafiche pronte",       desc: "Quando una grafica richiesta va in review" },
  content_review:   { label: "Contenuti in review",   desc: "Quando un contenuto aspetta la tua approvazione" },
  content_approved: { label: "Contenuti approvati",   desc: "Quando un tuo contenuto viene approvato" },
  deadline:         { label: "Scadenze",              desc: "Promemoria sulle scadenze imminenti" },
  upcoming_match:   { label: "Partite",               desc: "Nuove partite e aggiornamenti del calendario" },
  media_uploaded:   { label: "Nuovi media",           desc: "Quando vengono caricati nuovi media" },
  status_change:    { label: "Cambi di stato",        desc: "Aggiornamenti di stato su grafiche e contenuti" },
};

export const MEDIA_CATEGORIES = [
  "portrait", "training", "match", "celebration", "action", "social", "sponsor", "media-day", "logo",
] as const;

export function playerName(p: { first_name: string; last_name: string } | null | undefined) {
  if (!p) return "—";
  return `${p.first_name} ${p.last_name}`.trim();
}

export function matchLabel(m: { opponent: string; is_home: boolean } | null | undefined, clubShort = "RSB") {
  if (!m) return "—";
  return m.is_home ? `${clubShort} vs ${m.opponent}` : `${m.opponent} vs ${clubShort}`;
}

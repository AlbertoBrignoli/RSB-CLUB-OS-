"use client";

import { useClub } from "@/lib/club-context";
import type { ContentItem, ContentStatus, Match, Player } from "@/lib/types";
import { CONTENT_STATUS, PRIORITY, cn, matchLabel, playerName } from "@/lib/utils";
import { Select } from "@/components/ui/input";

// Colore "pallino" per stato (token di tema, coerente con CONTENT_STATUS).
export const STATUS_DOT: Record<ContentStatus, string> = {
  idea: "bg-muted/50",
  planned: "bg-info",
  copy: "bg-info",
  graphic_requested: "bg-accent",
  in_production: "bg-warn",
  review: "bg-brand",
  approved: "bg-ok",
  scheduled: "bg-info",
  published: "bg-ok",
  cancelled: "bg-muted/50",
};

export interface ContentFilterState {
  channel: string;
  type: string;
  player: string;
  match: string;
  owner: string;
  status: string;
  priority: string;
}

export const EMPTY_FILTERS: ContentFilterState = {
  channel: "",
  type: "",
  player: "",
  match: "",
  owner: "",
  status: "",
  priority: "",
};

export function matchesFilters(c: ContentItem, f: ContentFilterState): boolean {
  if (f.channel && c.channel_id !== f.channel) return false;
  if (f.type && c.content_type_id !== f.type) return false;
  if (f.player && !c.content_players?.some((p) => p.player_id === f.player)) return false;
  if (f.match && c.match_id !== f.match) return false;
  if (f.owner && c.owner_id !== f.owner) return false;
  if (f.status && c.status !== f.status) return false;
  if (f.priority && c.priority !== f.priority) return false;
  return true;
}

// Riga di filtri compatti condivisa da /editorial e /content.
export function ContentFiltersRow({
  filters,
  onChange,
  players,
  matches,
  className,
}: {
  filters: ContentFilterState;
  onChange: (f: ContentFilterState) => void;
  players: Player[];
  matches: Match[];
  className?: string;
}) {
  const { club, team, contentTypes, channels } = useClub();
  const clubShort = club?.short_name ?? "RSB";
  const set = (key: keyof ContentFilterState) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    onChange({ ...filters, [key]: e.target.value });
  const compact = "h-8 w-auto min-w-28 max-w-44 text-xs";

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Select className={compact} value={filters.channel} onChange={set("channel")} aria-label="Canale">
        <option value="">Canale: tutti</option>
        {channels.map((ch) => (
          <option key={ch.id} value={ch.id}>{ch.name}</option>
        ))}
      </Select>
      <Select className={compact} value={filters.type} onChange={set("type")} aria-label="Tipo">
        <option value="">Tipo: tutti</option>
        {contentTypes.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </Select>
      <Select className={compact} value={filters.player} onChange={set("player")} aria-label="Giocatore">
        <option value="">Player: tutti</option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>{playerName(p)}</option>
        ))}
      </Select>
      <Select className={compact} value={filters.match} onChange={set("match")} aria-label="Partita">
        <option value="">Match: tutti</option>
        {matches.map((m) => (
          <option key={m.id} value={m.id}>{matchLabel(m, clubShort)}</option>
        ))}
      </Select>
      <Select className={compact} value={filters.owner} onChange={set("owner")} aria-label="Owner">
        <option value="">Owner: tutti</option>
        {team.map((m) => (
          <option key={m.user_id} value={m.user_id}>{m.profile?.full_name ?? "—"}</option>
        ))}
      </Select>
      <Select className={compact} value={filters.status} onChange={set("status")} aria-label="Stato">
        <option value="">Stato: tutti</option>
        {(Object.keys(CONTENT_STATUS) as ContentStatus[]).map((s) => (
          <option key={s} value={s}>{CONTENT_STATUS[s].label}</option>
        ))}
      </Select>
      <Select className={compact} value={filters.priority} onChange={set("priority")} aria-label="Priorità">
        <option value="">Priorità: tutte</option>
        {(Object.keys(PRIORITY) as (keyof typeof PRIORITY)[]).map((p) => (
          <option key={p} value={p}>{PRIORITY[p].label}</option>
        ))}
      </Select>
    </div>
  );
}

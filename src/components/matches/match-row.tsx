"use client";

import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import type { Match } from "@/lib/types";
import { MATCH_STATUS, cn, fmtDateTime, matchLabel } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// Colore del risultato: our_score è SEMPRE il punteggio RSB, a prescindere da is_home.
export function scoreTone(m: Match) {
  if (m.our_score == null || m.opponent_score == null) return "text-foreground";
  if (m.our_score > m.opponent_score) return "text-ok";
  if (m.our_score < m.opponent_score) return "text-danger";
  return "text-muted";
}

// Risultato nell'ordine di lettura del label (casa a sinistra).
export function scoreText(m: Match) {
  if (m.our_score == null || m.opponent_score == null) return "—";
  return m.is_home
    ? `${m.our_score} - ${m.opponent_score}`
    : `${m.opponent_score} - ${m.our_score}`;
}

export function MatchRow({ match, clubShort }: { match: Match; clubShort: string }) {
  const status = MATCH_STATUS[match.status];
  return (
    <Link
      href={`/matches/${match.id}`}
      className="flex items-center gap-4 rounded-xl border border-line/70 bg-surface px-4 py-3 transition-colors hover:border-brand/30"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-[13.5px] font-semibold">{matchLabel(match, clubShort)}</p>
          <Badge className={status.className}>{status.label}</Badge>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-muted">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3 w-3" /> {fmtDateTime(match.kickoff_at)}
          </span>
          {match.venue && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {match.venue}
            </span>
          )}
          <span>{match.is_home ? "Casa" : "Trasferta"}</span>
          {match.competition?.name && <span>{match.competition.name}</span>}
          {match.matchday && <span>Giornata {match.matchday}</span>}
        </div>
      </div>
      {match.status === "finished" && (
        <span className={cn("shrink-0 text-lg font-semibold tabular-nums", scoreTone(match))}>
          {scoreText(match)}
        </span>
      )}
    </Link>
  );
}

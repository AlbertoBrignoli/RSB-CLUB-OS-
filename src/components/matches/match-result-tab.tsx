"use client";

import { useEffect, useMemo, useState } from "react";
import { Goal, ListPlus, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useClub } from "@/lib/club-context";
import { logActivity } from "@/lib/activity";
import type {
  ContentItem, Match, MatchEvent, MatchEventType, MatchLineupEntry, Player,
} from "@/lib/types";
import { MATCH_EVENT_LABEL, cn, playerName } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { FormationBoard } from "./formation-board";
import { scoreTone } from "./match-row";

const EVENT_TYPES = Object.keys(MATCH_EVENT_LABEL) as MatchEventType[];

// Contenuti suggeriti dopo il risultato: slug → etichetta + giorno di pubblicazione.
const POST_MATCH_SUGGESTIONS: { slug: string; label: string; offsetDays: 0 | 1 }[] = [
  { slug: "final_score", label: "Final Score", offsetDays: 0 },
  { slug: "post_match", label: "Post Match", offsetDays: 1 },
  { slug: "motm", label: "Man of the Match", offsetDays: 1 },
  { slug: "photo_gallery", label: "Photo Gallery", offsetDays: 1 },
  { slug: "highlights", label: "Highlights", offsetDays: 1 },
];

export function MatchResultTab({
  match,
  players,
  lineup,
  events,
  content,
  onReload,
}: {
  match: Match;
  players: Player[];
  lineup: MatchLineupEntry[];
  events: MatchEvent[];
  content: ContentItem[];
  onReload: () => void;
}) {
  const { club, userId, profile, can, contentTypes } = useClub();
  const canManage = can("matches.manage");

  // ---------- risultato ----------
  const [ourScore, setOurScore] = useState<string>(match.our_score?.toString() ?? "");
  const [oppScore, setOppScore] = useState<string>(match.opponent_score?.toString() ?? "");
  const [savingScore, setSavingScore] = useState(false);

  useEffect(() => {
    setOurScore(match.our_score?.toString() ?? "");
    setOppScore(match.opponent_score?.toString() ?? "");
  }, [match.our_score, match.opponent_score]);

  async function saveScore() {
    if (!club || !userId || ourScore === "" || oppScore === "") return;
    setSavingScore(true);
    const our = parseInt(ourScore, 10);
    const opp = parseInt(oppScore, 10);
    const { error } = await supabase()
      .from("matches")
      .update({ our_score: our, opponent_score: opp, status: "finished" })
      .eq("id", match.id);
    if (!error) {
      await logActivity({
        clubId: club.id,
        actorId: userId,
        action: "status_changed",
        entityType: "match",
        entityId: match.id,
        summary: `${club.name} ${our} - ${opp} ${match.opponent} · risultato inserito`,
      });
      onReload();
    }
    setSavingScore(false);
  }

  // ---------- eventi ----------
  const [evType, setEvType] = useState<MatchEventType>("goal");
  const [evPlayer, setEvPlayer] = useState("");
  const [evMinute, setEvMinute] = useState("");
  const [evNote, setEvNote] = useState("");
  const [addingEvent, setAddingEvent] = useState(false);

  async function addEvent() {
    if (!club || !userId) return;
    setAddingEvent(true);
    const { error } = await supabase().from("match_events").insert({
      match_id: match.id,
      club_id: club.id,
      type: evType,
      player_id: evPlayer || null,
      minute: evMinute ? parseInt(evMinute, 10) : null,
      note: evNote.trim() || null,
    });
    if (!error) {
      setEvPlayer("");
      setEvMinute("");
      setEvNote("");
      onReload();
    }
    setAddingEvent(false);
  }

  async function removeEvent(id: string) {
    await supabase().from("match_events").delete().eq("id", id);
    onReload();
  }

  const scorers = useMemo(
    () => events.filter((e) => ["goal", "penalty_scored"].includes(e.type)),
    [events]
  );

  // ---------- post match content ----------
  const [creatingSlug, setCreatingSlug] = useState<string | null>(null);

  const existingTypeIds = useMemo(
    () => new Set(content.map((c) => c.content_type_id).filter(Boolean)),
    [content]
  );

  function suggestionExists(slug: string) {
    const type = contentTypes.find((t) => t.slug === slug);
    return !!type && existingTypeIds.has(type.id);
  }

  async function createSuggested(slug: string, label: string, offsetDays: number) {
    if (!club || !userId) return;
    const type = contentTypes.find((t) => t.slug === slug);
    setCreatingSlug(slug);
    const publishDate = new Date();
    publishDate.setDate(publishDate.getDate() + offsetDays);
    const title = `${type?.name ?? label} — vs ${match.opponent}`;
    const { data, error } = await supabase()
      .from("content")
      .insert({
        club_id: club.id,
        title,
        content_type_id: type?.id ?? null,
        match_id: match.id,
        status: "planned",
        publish_date: publishDate.toISOString().slice(0, 10),
        priority: "high",
        created_by: userId,
      })
      .select("id")
      .single();
    if (!error && data) {
      await logActivity({
        clubId: club.id,
        actorId: userId,
        action: "created",
        entityType: "content",
        entityId: data.id,
        summary: `${profile?.full_name ?? "Qualcuno"} ha creato "${title}"`,
      });
      onReload();
    }
    setCreatingSlug(null);
  }

  return (
    <div className="space-y-4">
      {/* RISULTATO */}
      <section className="rounded-xl border border-line/70 bg-surface p-4">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">Risultato</h3>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Field label={club?.short_name ?? "RSB"} className="w-24">
            <Input
              type="number"
              min={0}
              value={ourScore}
              onChange={(e) => setOurScore(e.target.value)}
              disabled={!canManage}
              className="text-center text-lg font-semibold"
            />
          </Field>
          <span className="pb-2 text-lg font-semibold text-muted">-</span>
          <Field label={match.opponent} className="w-24">
            <Input
              type="number"
              min={0}
              value={oppScore}
              onChange={(e) => setOppScore(e.target.value)}
              disabled={!canManage}
              className="text-center text-lg font-semibold"
            />
          </Field>
          {canManage && (
            <Button
              variant="primary"
              onClick={saveScore}
              loading={savingScore}
              disabled={ourScore === "" || oppScore === ""}
            >
              Salva risultato
            </Button>
          )}
        </div>
        {match.status === "finished" && match.our_score != null && (
          <p className={cn("mt-2 text-[12.5px] font-medium", scoreTone(match))}>
            {match.our_score > (match.opponent_score ?? 0)
              ? "Vittoria"
              : match.our_score < (match.opponent_score ?? 0)
              ? "Sconfitta"
              : "Pareggio"}{" "}
            · al salvataggio la partita passa in Finished.
          </p>
        )}
        {canManage && match.status !== "finished" && (
          <p className="mt-2 text-[11.5px] text-muted">
            Al salvataggio lo stato della partita passa automaticamente a Finished.
          </p>
        )}
      </section>

      {/* FORMAZIONE — lavagnetta tattica */}
      <FormationBoard match={match} players={players} lineup={lineup} onReload={onReload} />

      {/* EVENTI */}
      <section className="rounded-xl border border-line/70 bg-surface p-4">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wide text-muted">
          <Goal className="h-3.5 w-3.5" /> Eventi partita
        </h3>
        <p className="mt-1 text-[11.5px] text-muted">
          Marcatori, assist e cartellini derivano da questa lista.
        </p>

        {events.length === 0 ? (
          <EmptyState className="py-6" title="Nessun evento registrato" />
        ) : (
          <ul className="mt-3 divide-y divide-line/70">
            {events.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2">
                <span className="w-10 shrink-0 text-right text-[12px] font-semibold tabular-nums text-muted">
                  {e.minute != null ? `${e.minute}'` : "—"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px]">
                    <span className="font-medium">{MATCH_EVENT_LABEL[e.type]}</span>
                    {e.player && <span> · {playerName(e.player)}</span>}
                  </p>
                  {e.note && <p className="text-[11px] text-muted">{e.note}</p>}
                </div>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeEvent(e.id)}
                    aria-label="Rimuovi evento"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {scorers.length > 0 && (
          <p className="mt-2 text-[11.5px] text-muted">
            Marcatori:{" "}
            {scorers
              .map((e) => `${e.player ? playerName(e.player) : "?"}${e.minute != null ? ` ${e.minute}'` : ""}`)
              .join(", ")}
          </p>
        )}

        {canManage && (
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_5rem_1fr_auto]">
            <Select value={evType} onChange={(e) => setEvType(e.target.value as MatchEventType)}>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>{MATCH_EVENT_LABEL[t]}</option>
              ))}
            </Select>
            <Select value={evPlayer} onChange={(e) => setEvPlayer(e.target.value)}>
              <option value="">Giocatore…</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>{playerName(p)}</option>
              ))}
            </Select>
            <Input
              type="number"
              min={0}
              max={130}
              placeholder="Min"
              value={evMinute}
              onChange={(e) => setEvMinute(e.target.value)}
            />
            <Input
              placeholder="Nota (opzionale)"
              value={evNote}
              onChange={(e) => setEvNote(e.target.value)}
            />
            <Button variant="primary" onClick={addEvent} loading={addingEvent}>
              <ListPlus className="h-3.5 w-3.5" /> Aggiungi
            </Button>
          </div>
        )}
      </section>

      {/* POST MATCH CONTENT */}
      {match.status === "finished" && can("content.create") && (
        <section className="rounded-xl border border-line/70 bg-surface p-4">
          <h3 className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wide text-muted">
            <Sparkles className="h-3.5 w-3.5" /> Post Match Content
          </h3>
          <p className="mt-1 text-[11.5px] text-muted">
            Crea al volo i contenuti suggeriti del dopo partita (se non già presenti).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {POST_MATCH_SUGGESTIONS.map((s) => {
              const exists = suggestionExists(s.slug);
              return (
                <Button
                  key={s.slug}
                  variant={exists ? "secondary" : "accent"}
                  disabled={exists}
                  loading={creatingSlug === s.slug}
                  onClick={() => createSuggested(s.slug, s.label, s.offsetDays)}
                >
                  {s.label}
                  {exists && <span className="text-[10px] opacity-70">✓ creato</span>}
                </Button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AtSign, FileText, Film, ImageIcon, Music2, Palette, Pencil, Plus, Trash2, Trophy, UploadCloud,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useClub } from "@/lib/club-context";
import { logActivity } from "@/lib/activity";
import type {
  ContentItem, Match, MatchEvent, MatchEventType, MediaItem, MediaKind, Player,
} from "@/lib/types";
import {
  CONTENT_STATUS, MATCH_EVENT_LABEL, MEDIA_CATEGORIES, PLAYER_STATUS, POSITION_LABEL,
  cn, fmtDate, fmtDateTime, initials, matchLabel, playerName,
} from "@/lib/utils";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { EmptyState, PageSkeleton, Tabs } from "@/components/ui/misc";
import { CommentsSection } from "@/components/shared/comments-section";
import { PlayerFormDialog } from "@/components/players/player-form-dialog";
import { MediaUploadDialog } from "@/components/players/media-upload-dialog";

type LineupRow = { is_starting: boolean; match: Match | null };
type EventRow = MatchEvent & { match?: Match | null };
type CoverageRow = { player_id: string };

const EVENT_BADGE: Partial<Record<MatchEventType, string>> = {
  goal: "bg-ok-soft text-ok",
  penalty_scored: "bg-ok-soft text-ok",
  assist: "bg-info-soft text-info",
  yellow_card: "bg-warn-soft text-warn",
  red_card: "bg-danger-soft text-danger",
};

function ageOf(birth: string | null): number | null {
  if (!birth) return null;
  const b = new Date(birth);
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a;
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-[13.5px]">{value ?? "—"}</dd>
    </div>
  );
}

function WidgetCard({
  label, value, sub, extra,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <Card>
      <CardBody className="pt-4">
        <p className="text-[10.5px] font-semibold uppercase tracking-widest text-muted">{label}</p>
        <p className="mt-1.5 truncate text-xl font-semibold leading-tight">{value}</p>
        {sub && <p className="mt-0.5 truncate text-[11.5px] text-muted">{sub}</p>}
        {extra && <div className="mt-1.5">{extra}</div>}
      </CardBody>
    </Card>
  );
}

export default function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { club, userId, profile, can, loading: ctxLoading } = useClub();

  const [player, setPlayer] = useState<Player | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [lineup, setLineup] = useState<LineupRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [nextMatch, setNextMatch] = useState<Match | null>(null);
  const [avgContent, setAvgContent] = useState(0);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [docsUploadOpen, setDocsUploadOpen] = useState(false);

  // Media filtri
  const [kindFilter, setKindFilter] = useState<"" | MediaKind>("");
  const [categoryFilter, setCategoryFilter] = useState("");

  // Custom fields + note
  const [fields, setFields] = useState<{ key: string; value: string }[]>([]);
  const [savingFields, setSavingFields] = useState(false);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const load = useCallback(async () => {
    if (!club) return;
    const sb = supabase();
    const [playerRes, mediaRes, contentRes, lineupRes, eventsRes, nextRes, squadRes, coverageRes] =
      await Promise.all([
        sb.from("players").select("*").eq("id", id).eq("club_id", club.id).maybeSingle(),
        sb.from("media_players").select("media:media(*)").eq("player_id", id),
        sb.from("content_players")
          .select("content:content(*, content_type:content_types(*), channel:social_channels(*))")
          .eq("player_id", id),
        sb.from("match_lineup")
          .select("is_starting, match:matches(*, competition:competitions(*))")
          .eq("player_id", id),
        sb.from("match_events")
          .select("*, match:matches(*)")
          .eq("player_id", id)
          .eq("club_id", club.id),
        sb.from("matches")
          .select("*, competition:competitions(*)")
          .eq("club_id", club.id)
          .eq("status", "upcoming")
          .order("kickoff_at")
          .limit(1)
          .maybeSingle(),
        sb.from("players").select("id").eq("club_id", club.id).eq("is_active", true),
        sb.from("content_players").select("player_id, content!inner(club_id)").eq("content.club_id", club.id),
      ]);

    const p = (playerRes.data as Player | null) ?? null;
    setPlayer(p);
    setNotes(p?.notes ?? "");
    setFields(Object.entries(p?.custom_fields ?? {}).map(([key, value]) => ({ key, value: String(value) })));

    const mediaRows = (mediaRes.data as unknown as { media: MediaItem | null }[]) ?? [];
    setMedia(
      mediaRows
        .map((r) => r.media)
        .filter((m): m is MediaItem => m != null)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
    );

    const contentRows = (contentRes.data as unknown as { content: ContentItem | null }[]) ?? [];
    setContents(
      contentRows
        .map((r) => r.content)
        .filter((c): c is ContentItem => c != null)
        .sort((a, b) => (b.publish_date ?? "").localeCompare(a.publish_date ?? ""))
    );

    setLineup((lineupRes.data as unknown as LineupRow[]) ?? []);
    setEvents((eventsRes.data as unknown as EventRow[]) ?? []);
    setNextMatch((nextRes.data as Match | null) ?? null);

    const squadSize = (squadRes.data ?? []).length;
    const totalLinks = ((coverageRes.data as unknown as CoverageRow[]) ?? []).length;
    setAvgContent(squadSize > 0 ? totalLinks / squadSize : 0);

    setLoading(false);
  }, [club, id]);

  useEffect(() => {
    load();
  }, [load]);

  // Partite del giocatore: unione lineup + eventi, ordinate per data.
  const playerMatches = useMemo(() => {
    const map = new Map<string, { match: Match; inLineup: boolean; isStarting: boolean; events: EventRow[] }>();
    for (const row of lineup) {
      if (!row.match) continue;
      map.set(row.match.id, { match: row.match, inLineup: true, isStarting: row.is_starting, events: [] });
    }
    for (const ev of events) {
      if (!ev.match) continue;
      const existing = map.get(ev.match.id);
      if (existing) existing.events.push(ev);
      else map.set(ev.match.id, { match: ev.match, inLineup: false, isStarting: false, events: [ev] });
    }
    return [...map.values()].sort((a, b) => b.match.kickoff_at.localeCompare(a.match.kickoff_at));
  }, [lineup, events]);

  const lastAppearance = useMemo(
    () => playerMatches.find((m) => m.match.status === "finished") ?? null,
    [playerMatches]
  );

  const stats = useMemo(
    () => ({
      apps: lineup.length,
      goals: events.filter((e) => e.type === "goal" || e.type === "penalty_scored").length,
      assists: events.filter((e) => e.type === "assist").length,
      yellows: events.filter((e) => e.type === "yellow_card").length,
      reds: events.filter((e) => e.type === "red_card").length,
    }),
    [lineup, events]
  );

  const documents = useMemo(() => media.filter((m) => m.kind === "document"), [media]);
  const galleryMedia = useMemo(() => media.filter((m) => m.kind !== "document"), [media]);
  const filteredMedia = useMemo(
    () =>
      galleryMedia.filter(
        (m) =>
          (!kindFilter || m.kind === kindFilter) &&
          (!categoryFilter || m.category === categoryFilter)
      ),
    [galleryMedia, kindFilter, categoryFilter]
  );

  const lowCoverage = avgContent > 0 && contents.length < avgContent * 0.5;
  const coveragePct = avgContent > 0 ? Math.round((contents.length / avgContent) * 100) : 100;

  async function saveCustomFields() {
    if (!club || !userId || !player) return;
    setSavingFields(true);
    const cf: Record<string, string> = {};
    for (const f of fields) {
      if (f.key.trim()) cf[f.key.trim()] = f.value;
    }
    const { error } = await supabase().from("players").update({ custom_fields: cf }).eq("id", player.id);
    if (!error) {
      await logActivity({
        clubId: club.id,
        actorId: userId,
        action: "updated",
        entityType: "player",
        entityId: player.id,
        summary: `${profile?.full_name ?? "Qualcuno"} ha aggiornato la scheda di ${playerName(player)}`,
      });
      await load();
    }
    setSavingFields(false);
  }

  async function saveNotes() {
    if (!club || !userId || !player) return;
    setSavingNotes(true);
    const { error } = await supabase()
      .from("players")
      .update({ notes: notes.trim() === "" ? null : notes })
      .eq("id", player.id);
    if (!error) {
      await logActivity({
        clubId: club.id,
        actorId: userId,
        action: "updated",
        entityType: "player",
        entityId: player.id,
        summary: `${profile?.full_name ?? "Qualcuno"} ha aggiornato le note di ${playerName(player)}`,
      });
      await load();
    }
    setSavingNotes(false);
  }

  if (ctxLoading || loading) return <PageSkeleton />;

  if (!player) {
    return (
      <EmptyState
        icon={<Trophy />}
        title="Giocatore non trovato"
        description="Il giocatore non esiste o non appartiene a questo club."
        action={
          <Link href="/team">
            <Button>Torna alla rosa</Button>
          </Link>
        }
      />
    );
  }

  const status = PLAYER_STATUS[player.status];
  const age = ageOf(player.birth_date);
  const canManage = can("players.manage");
  const shortName = club?.short_name ?? "RSB";

  return (
    <div className="animate-fade-up space-y-4">
      {/* HEADER */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
          <div className="relative h-40 w-40 shrink-0 overflow-hidden rounded-2xl bg-background sm:h-48 sm:w-48">
            {player.photo_url ? (
              <Image src={player.photo_url} alt={playerName(player)} fill unoptimized className="object-cover" />
            ) : (
              <span className="flex h-full items-center justify-center text-5xl font-semibold text-brand/50">
                {initials(playerName(player))}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-[12px] font-medium uppercase tracking-widest text-muted">
              <span>{POSITION_LABEL[player.position].full}</span>
              {player.role_detail && <span>· {player.role_detail}</span>}
              <span>· {club?.name}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{playerName(player)}</h1>
              {player.shirt_number != null && (
                <span className="text-3xl font-bold text-brand sm:text-4xl">#{player.shirt_number}</span>
              )}
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Badge className={status.className}>{status.label}</Badge>
              {player.status_note && <span className="text-[12px] text-muted">{player.status_note}</span>}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {player.instagram && (
                <a
                  href={`https://instagram.com/${player.instagram.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[12.5px] font-medium transition-colors hover:bg-background"
                >
                  <AtSign className="h-3.5 w-3.5" /> @{player.instagram.replace(/^@/, "")}
                </a>
              )}
              {player.tiktok && (
                <a
                  href={`https://tiktok.com/@${player.tiktok.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[12.5px] font-medium transition-colors hover:bg-background"
                >
                  <Music2 className="h-3.5 w-3.5" /> @{player.tiktok.replace(/^@/, "")}
                </a>
              )}
              {canManage && (
                <Button onClick={() => setEditOpen(true)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* WIDGET ROW */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <WidgetCard label="Content this season" value={contents.length} sub="contenuti collegati" />
        <WidgetCard label="Media assets" value={media.length} sub="file nella libreria" />
        <WidgetCard
          label="Last appearance"
          value={lastAppearance ? `vs ${lastAppearance.match.opponent}` : "—"}
          sub={lastAppearance ? fmtDate(lastAppearance.match.kickoff_at) : "nessuna presenza"}
        />
        <WidgetCard
          label="Next match"
          value={nextMatch ? matchLabel(nextMatch, shortName) : "—"}
          sub={nextMatch ? fmtDateTime(nextMatch.kickoff_at) : "nessuna in programma"}
        />
        <WidgetCard
          label="Content coverage"
          value={`${coveragePct}%`}
          sub="vs media squadra"
          extra={
            lowCoverage ? (
              <Badge className="bg-warn-soft text-warn">⚠ Low Coverage</Badge>
            ) : (
              <Badge className="bg-ok-soft text-ok">In linea</Badge>
            )
          }
        />
      </div>

      {/* TABS */}
      <Card>
        <Tabs
          className="px-4 pt-1"
          active={tab}
          onChange={setTab}
          tabs={[
            { key: "overview", label: "Overview" },
            { key: "media", label: "Media", count: galleryMedia.length },
            { key: "content", label: "Content", count: contents.length },
            { key: "matches", label: "Matches", count: playerMatches.length },
            { key: "stats", label: "Stats" },
            { key: "notes", label: "Notes" },
            { key: "documents", label: "Documents", count: documents.length },
          ]}
        />
        <CardBody className="pt-5">
          {/* OVERVIEW */}
          {tab === "overview" && (
            <div className="space-y-8">
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoItem
                  label="Data di nascita"
                  value={player.birth_date ? `${fmtDate(player.birth_date)}${age != null ? ` · ${age} anni` : ""}` : "—"}
                />
                <InfoItem label="Luogo di nascita" value={player.birth_place ?? "—"} />
                <InfoItem label="Nazionalità" value={player.nationality ?? "—"} />
                <InfoItem
                  label="Piede"
                  value={
                    player.foot === "left" ? "Sinistro" : player.foot === "right" ? "Destro" : player.foot === "both" ? "Ambidestro" : "—"
                  }
                />
                <InfoItem label="Altezza" value={player.height_cm != null ? `${player.height_cm} cm` : "—"} />
                <InfoItem label="Peso" value={player.weight_kg != null ? `${player.weight_kg} kg` : "—"} />
                <InfoItem
                  label="Telefono"
                  value={player.phone ? <a href={`tel:${player.phone}`} className="hover:text-brand">{player.phone}</a> : "—"}
                />
                <InfoItem
                  label="Email"
                  value={player.email ? <a href={`mailto:${player.email}`} className="hover:text-brand">{player.email}</a> : "—"}
                />
                <InfoItem
                  label="Ruolo dettaglio"
                  value={player.role_detail ?? POSITION_LABEL[player.position].full}
                />
              </dl>

              <div>
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Campi custom</h4>
                {fields.length === 0 && !canManage && (
                  <p className="text-[13px] text-muted">Nessun campo custom.</p>
                )}
                <div className="space-y-2">
                  {fields.map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      {canManage ? (
                        <>
                          <Input
                            value={f.key}
                            onChange={(e) =>
                              setFields((prev) => prev.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)))
                            }
                            placeholder="Chiave (es. Procuratore)"
                            className="max-w-56"
                          />
                          <Input
                            value={f.value}
                            onChange={(e) =>
                              setFields((prev) => prev.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))
                            }
                            placeholder="Valore"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Rimuovi campo"
                            onClick={() => setFields((prev) => prev.filter((_, j) => j !== i))}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <div className="flex-1">
                          <InfoItem label={f.key} value={f.value || "—"} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {canManage && (
                  <div className="mt-3 flex items-center gap-2">
                    <Button size="sm" onClick={() => setFields((prev) => [...prev, { key: "", value: "" }])}>
                      <Plus className="h-3.5 w-3.5" /> Aggiungi campo
                    </Button>
                    <Button size="sm" variant="primary" onClick={saveCustomFields} loading={savingFields}>
                      Salva campi
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MEDIA */}
          {tab === "media" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as "" | MediaKind)} className="w-40">
                  <option value="">Tutti i tipi</option>
                  <option value="photo">Foto</option>
                  <option value="video">Video</option>
                  <option value="graphic">Grafiche</option>
                </Select>
                <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-44">
                  <option value="">Tutte le categorie</option>
                  {MEDIA_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
                {can("media.upload") && (
                  <Button variant="primary" className="ml-auto" onClick={() => setUploadOpen(true)}>
                    <UploadCloud className="h-3.5 w-3.5" /> Upload Media
                  </Button>
                )}
              </div>

              {filteredMedia.length === 0 ? (
                <EmptyState
                  icon={<ImageIcon />}
                  title="Nessun media collegato"
                  description="Carica foto, video e grafiche del giocatore: diventano il suo media center."
                  action={
                    can("media.upload") && (
                      <Button variant="primary" onClick={() => setUploadOpen(true)}>
                        <UploadCloud className="h-3.5 w-3.5" /> Upload Media
                      </Button>
                    )
                  }
                />
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  {filteredMedia.map((m) => (
                    <Link
                      key={m.id}
                      href={`/media?open=${m.id}`}
                      className="group relative aspect-square overflow-hidden rounded-xl bg-background"
                    >
                      {m.url && (m.kind === "photo" || m.kind === "graphic") ? (
                        <Image
                          src={m.thumb_url ?? m.url}
                          alt={m.title}
                          fill
                          unoptimized
                          className="object-cover transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-muted/40">
                          {m.kind === "video" ? <Film className="h-6 w-6" /> : <ImageIcon className="h-6 w-6" />}
                        </span>
                      )}
                      <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-2 pb-1.5 pt-5 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                        {m.title}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CONTENT */}
          {tab === "content" && (
            contents.length === 0 ? (
              <EmptyState
                icon={<Palette />}
                title="Nessun contenuto collegato"
                description="I contenuti taggati con questo giocatore compariranno qui."
              />
            ) : (
              <ul className="divide-y divide-line/70">
                {contents.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/content?open=${c.id}`}
                      className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-background"
                    >
                      <div className="w-14 shrink-0 text-center">
                        <p className="text-[11px] font-semibold uppercase text-brand">
                          {fmtDate(c.publish_date, "d MMM")}
                        </p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{c.title}</p>
                        <p className="text-[11px] text-muted">
                          {c.content_type?.name ?? "—"} · {c.channel?.name ?? "—"}
                        </p>
                      </div>
                      <Badge className={CONTENT_STATUS[c.status].className}>
                        {CONTENT_STATUS[c.status].label}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )
          )}

          {/* MATCHES */}
          {tab === "matches" && (
            playerMatches.length === 0 ? (
              <EmptyState
                icon={<Trophy />}
                title="Nessuna partita"
                description="Le partite in cui il giocatore è in distinta o ha eventi registrati compariranno qui."
              />
            ) : (
              <ul className="divide-y divide-line/70">
                {playerMatches.map(({ match, inLineup, isStarting, events: evs }) => {
                  const finished = match.status === "finished";
                  const hasScore = finished && match.our_score != null && match.opponent_score != null;
                  const result =
                    hasScore && match.our_score! > match.opponent_score!
                      ? "text-ok"
                      : hasScore && match.our_score! < match.opponent_score!
                      ? "text-danger"
                      : "text-muted";
                  return (
                    <li key={match.id}>
                      <Link
                        href={`/matches/${match.id}`}
                        className="-mx-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg px-2 py-3 transition-colors hover:bg-background"
                      >
                        <div className="w-16 shrink-0">
                          <p className="text-[11px] font-semibold uppercase text-brand">
                            {fmtDate(match.kickoff_at, "d MMM yy")}
                          </p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium">{matchLabel(match, shortName)}</p>
                          <p className="text-[11px] text-muted">
                            {match.competition?.name ?? "—"}
                            {inLineup ? (isStarting ? " · Titolare" : " · Dalla panchina") : " · Solo eventi"}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          {evs.map((e) => (
                            <Badge
                              key={e.id}
                              className={EVENT_BADGE[e.type] ?? "border border-line bg-background text-muted"}
                            >
                              {MATCH_EVENT_LABEL[e.type]}
                              {e.minute != null ? ` ${e.minute}'` : ""}
                            </Badge>
                          ))}
                        </div>
                        {hasScore ? (
                          <span className={cn("w-12 text-right text-[14px] font-semibold tabular-nums", result)}>
                            {match.our_score}–{match.opponent_score}
                          </span>
                        ) : (
                          <span className="w-12 text-right text-[11px] text-muted">
                            {match.status === "upcoming" ? "In prog." : "—"}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )
          )}

          {/* STATS */}
          {tab === "stats" && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {(
                [
                  ["Presenze", stats.apps, "text-foreground"],
                  ["Gol", stats.goals, "text-ok"],
                  ["Assist", stats.assists, "text-info"],
                  ["Ammonizioni", stats.yellows, "text-warn"],
                  ["Espulsioni", stats.reds, "text-danger"],
                ] as const
              ).map(([label, value, color]) => (
                <div key={label} className="rounded-xl border border-line/70 bg-background/50 px-4 py-5 text-center">
                  <p className={cn("text-3xl font-semibold tabular-nums", color)}>{value}</p>
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* NOTES */}
          {tab === "notes" && (
            <div className="space-y-3">
              {canManage ? (
                <>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Note interne sul giocatore: contratto, disponibilità, indicazioni contenuti…"
                    className="min-h-40"
                  />
                  <div className="flex justify-end">
                    <Button variant="primary" onClick={saveNotes} loading={savingNotes}>
                      Salva note
                    </Button>
                  </div>
                </>
              ) : notes ? (
                <p className="whitespace-pre-wrap text-[13.5px]">{notes}</p>
              ) : (
                <EmptyState icon={<FileText />} title="Nessuna nota" />
              )}
            </div>
          )}

          {/* DOCUMENTS */}
          {tab === "documents" && (
            <div className="space-y-4">
              {can("media.upload") && (
                <div className="flex justify-end">
                  <Button variant="primary" onClick={() => setDocsUploadOpen(true)}>
                    <UploadCloud className="h-3.5 w-3.5" /> Carica documento
                  </Button>
                </div>
              )}
              {documents.length === 0 ? (
                <EmptyState
                  icon={<FileText />}
                  title="Nessun documento"
                  description="Contratti, tesseramenti e certificati collegati al giocatore compariranno qui."
                />
              ) : (
                <ul className="divide-y divide-line/70">
                  {documents.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 py-2.5">
                      <FileText className="h-4 w-4 shrink-0 text-muted" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{d.title}</p>
                        <p className="text-[11px] text-muted">
                          {fmtDate(d.created_at)}
                          {d.category ? ` · ${d.category}` : ""}
                        </p>
                      </div>
                      {d.url && (
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[12px] font-medium text-brand hover:underline"
                        >
                          Apri
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* COMMENTS */}
      <Card>
        <CardBody className="pt-5">
          <CommentsSection entityType="player" entityId={player.id} entityLabel={playerName(player)} />
        </CardBody>
      </Card>

      <PlayerFormDialog open={editOpen} onClose={() => setEditOpen(false)} player={player} onSaved={load} />
      <MediaUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        playerId={player.id}
        playerLabel={playerName(player)}
        onUploaded={load}
      />
      <MediaUploadDialog
        open={docsUploadOpen}
        onClose={() => setDocsUploadOpen(false)}
        playerId={player.id}
        playerLabel={playerName(player)}
        onUploaded={load}
        documentsOnly
      />
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, CalendarDays, CheckSquare, Image as ImageIcon, MapPin,
  Palette, Pencil, Trophy,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useClub } from "@/lib/club-context";
import { logActivity } from "@/lib/activity";
import type {
  ContentItem, Graphic, Match, MatchEvent, MatchLineupEntry, MatchStatus,
  MediaItem, Player, Task,
} from "@/lib/types";
import {
  GRAPHIC_STATUS, MATCH_STATUS, PRIORITY, TASK_STATUS,
  cn, daysUntil, fmtDate, fmtDateTime,
} from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar, EmptyState, PageSkeleton, Tabs } from "@/components/ui/misc";
import { CommentsSection } from "@/components/shared/comments-section";
import { MatchFormDialog } from "@/components/matches/match-form-dialog";
import { MatchContentTab } from "@/components/matches/match-content-tab";
import { MatchMediaTab } from "@/components/matches/match-media-tab";
import { MatchResultTab } from "@/components/matches/match-result-tab";
import { scoreText, scoreTone } from "@/components/matches/match-row";

type MatchWithSeason = Match & { season?: { name: string } | null };

const MATCH_STATUSES = Object.keys(MATCH_STATUS) as MatchStatus[];

export default function MatchCenterPage() {
  const params = useParams<{ id: string }>();
  const matchId = params.id;
  const { club, userId, profile, can, loading: ctxLoading } = useClub();

  const [match, setMatch] = useState<MatchWithSeason | null>(null);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [graphics, setGraphics] = useState<Graphic[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [lineup, setLineup] = useState<MatchLineupEntry[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState("overview");
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    if (!club || !matchId) return;
    const sb = supabase();
    const [matchRes, contentRes, graphicsRes, tasksRes, mediaRes, playersRes, lineupRes, eventsRes] =
      await Promise.all([
        sb.from("matches")
          .select("*, competition:competitions(*), season:seasons(name)")
          .eq("club_id", club.id)
          .eq("id", matchId)
          .maybeSingle(),
        sb.from("content")
          .select("*, content_type:content_types(*), channel:social_channels(*)")
          .eq("club_id", club.id)
          .eq("match_id", matchId)
          .order("publish_date")
          .order("publish_time"),
        sb.from("graphics")
          .select("*, designer:profiles!graphics_designer_id_fkey(*), requester:profiles!graphics_requested_by_fkey(*)")
          .eq("club_id", club.id)
          .eq("match_id", matchId)
          .order("deadline", { ascending: true, nullsFirst: false }),
        sb.from("tasks")
          .select("*, owner:profiles!tasks_owner_id_fkey(*)")
          .eq("club_id", club.id)
          .eq("match_id", matchId)
          .order("deadline", { ascending: true, nullsFirst: false }),
        sb.from("media")
          .select("*")
          .eq("club_id", club.id)
          .eq("match_id", matchId)
          .order("created_at", { ascending: false }),
        sb.from("players")
          .select("*")
          .eq("club_id", club.id)
          .eq("is_active", true)
          .order("last_name"),
        sb.from("match_lineup")
          .select("*, player:players(*)")
          .eq("match_id", matchId),
        sb.from("match_events")
          .select("*, player:players(*)")
          .eq("match_id", matchId)
          .order("minute", { ascending: true, nullsFirst: false }),
      ]);

    if (!matchRes.data) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setMatch(matchRes.data as MatchWithSeason);
    setContent((contentRes.data as ContentItem[]) ?? []);
    setGraphics((graphicsRes.data as Graphic[]) ?? []);
    setTasks((tasksRes.data as Task[]) ?? []);
    setMedia((mediaRes.data as MediaItem[]) ?? []);
    setPlayers((playersRes.data as Player[]) ?? []);
    setLineup((lineupRes.data as MatchLineupEntry[]) ?? []);
    setEvents((eventsRes.data as MatchEvent[]) ?? []);
    setLoading(false);
  }, [club, matchId]);

  useEffect(() => {
    load();
  }, [load]);

  async function changeStatus(status: MatchStatus) {
    if (!club || !userId || !match) return;
    const { error } = await supabase().from("matches").update({ status }).eq("id", match.id);
    if (!error) {
      await logActivity({
        clubId: club.id,
        actorId: userId,
        action: "status_changed",
        entityType: "match",
        entityId: match.id,
        summary: `${profile?.full_name ?? "Qualcuno"} ha cambiato lo stato di vs ${match.opponent} in ${MATCH_STATUS[status].label}`,
      });
      load();
    }
  }

  if (ctxLoading || loading) return <PageSkeleton />;

  if (notFound || !match) {
    return (
      <EmptyState
        icon={<Trophy />}
        title="Partita non trovata"
        description="La partita potrebbe essere stata rimossa."
        action={
          <Link href="/matches">
            <Button>Torna alle partite</Button>
          </Link>
        }
      />
    );
  }

  const clubName = (club?.name ?? "Real San Basilio").toUpperCase();
  const opponentName = match.opponent.toUpperCase();
  const heroTitle = match.is_home
    ? `${clubName} vs ${opponentName}`
    : `${opponentName} vs ${clubName}`;
  const days = daysUntil(match.kickoff_at);
  const status = MATCH_STATUS[match.status];
  const esito =
    match.our_score != null && match.opponent_score != null
      ? match.our_score > match.opponent_score
        ? "Vittoria"
        : match.our_score < match.opponent_score
        ? "Sconfitta"
        : "Pareggio"
      : null;

  return (
    <div className="animate-fade-up">
      <Link
        href="/matches"
        className="mb-3 inline-flex items-center gap-1 text-[12px] font-medium text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Tutte le partite
      </Link>

      {/* HERO */}
      <Card className="overflow-hidden">
        <div className="relative bg-gradient-to-br from-brand to-brand-strong p-6 text-white">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-medium uppercase tracking-widest text-white/70">
            <span>Match Center · {match.competition?.name ?? "—"}{match.matchday ? ` · Giornata ${match.matchday}` : ""}</span>
            <span className="flex items-center gap-2">
              {match.status === "upcoming" && days >= 0 && (
                <span>
                  {days === 0 ? "Oggi" : days === 1 ? "Domani" : `${days} giorni alla partita`}
                </span>
              )}
              <Badge className="bg-white/15 text-white">{status.label}</Badge>
            </span>
          </div>

          <p className="mt-4 text-2xl font-semibold leading-tight">{heroTitle}</p>

          {match.status === "finished" && match.our_score != null && (
            <p className="mt-2 text-4xl font-bold tabular-nums">
              {scoreText(match)}
              {esito && (
                <span className="ml-3 align-middle text-[13px] font-semibold uppercase tracking-widest text-white/70">
                  {esito}
                </span>
              )}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-white/80">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" /> {fmtDateTime(match.kickoff_at)}
            </span>
            {match.venue && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> {match.venue}
              </span>
            )}
            <span>{match.is_home ? "Casa" : "Trasferta"}</span>
          </div>

          {can("matches.manage") && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button
                className="border-0 bg-white/15 text-white hover:bg-white/25"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              <Select
                value={match.status}
                onChange={(e) => changeStatus(e.target.value as MatchStatus)}
                className="h-8.5 w-auto border-0 bg-white/15 text-white [&>option]:text-foreground"
              >
                {MATCH_STATUSES.map((s) => (
                  <option key={s} value={s}>{MATCH_STATUS[s].label}</option>
                ))}
              </Select>
            </div>
          )}
        </div>
      </Card>

      <Tabs
        className="mt-5 mb-4"
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "overview", label: "Overview" },
          { key: "content", label: "Content", count: content.length },
          { key: "graphics", label: "Graphics", count: graphics.length },
          { key: "media", label: "Media", count: media.length },
          { key: "tasks", label: "Tasks", count: tasks.length },
          { key: "result", label: "Result" },
        ]}
      />

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader title="Dettagli partita" />
              <CardBody>
                <dl className="grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2">
                  {(
                    [
                      ["Data e ora", fmtDateTime(match.kickoff_at)],
                      ["Stadio", match.venue ?? "—"],
                      ["Casa / Trasferta", match.is_home ? "Casa" : "Trasferta"],
                      ["Competizione", match.competition?.name ?? "—"],
                      ["Giornata", match.matchday ?? "—"],
                      ["Stagione", match.season?.name ?? "—"],
                      ["Stato", status.label],
                      ["Risultato", match.status === "finished" ? scoreText(match) : "—"],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</dt>
                      <dd
                        className={cn(
                          "mt-0.5 font-medium",
                          label === "Risultato" && match.status === "finished" && scoreTone(match)
                        )}
                      >
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
                {match.notes && (
                  <div className="mt-4 border-t border-line/70 pt-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Note</p>
                    <p className="mt-1 whitespace-pre-wrap text-[13px]">{match.notes}</p>
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardBody className="pt-5">
                <CommentsSection entityType="match" entityId={match.id} entityLabel={heroTitle} />
              </CardBody>
            </Card>
          </div>

          <Card className="self-start">
            <CardHeader title="Riepilogo rapido" />
            <CardBody className="space-y-1.5">
              {(
                [
                  ["content", "Contenuti collegati", content.length, <Palette key="c" className="h-4 w-4" />],
                  ["graphics", "Grafiche", graphics.length, <ImageIcon key="g" className="h-4 w-4" />],
                  ["tasks", "Task", tasks.length, <CheckSquare key="t" className="h-4 w-4" />],
                  ["media", "Media", media.length, <ImageIcon key="m" className="h-4 w-4" />],
                ] as const
              ).map(([key, label, count, icon]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className="flex w-full items-center gap-3 rounded-xl border border-line/70 px-3 py-2.5 text-left transition-colors hover:border-brand/30 cursor-pointer"
                >
                  <span className="text-muted/60">{icon}</span>
                  <span className="flex-1 text-[13px] font-medium">{label}</span>
                  <span className="text-[15px] font-semibold tabular-nums">{count}</span>
                </button>
              ))}
            </CardBody>
          </Card>
        </div>
      )}

      {tab === "content" && (
        <MatchContentTab matchId={match.id} content={content} onReload={load} />
      )}

      {tab === "graphics" && (
        graphics.length === 0 ? (
          <EmptyState
            icon={<ImageIcon />}
            title="Nessuna grafica per questa partita"
            description="Le grafiche richieste per i contenuti di questa partita appariranno qui."
          />
        ) : (
          <div className="space-y-2">
            {graphics.map((g) => (
              <Link
                key={g.id}
                href={`/graphics?open=${g.id}`}
                className="flex items-center gap-3 rounded-xl border border-line/70 bg-surface px-4 py-2.5 transition-colors hover:border-brand/30"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{g.title}</p>
                  <p className="text-[11px] text-muted">Deadline: {fmtDate(g.deadline)}</p>
                </div>
                <Avatar name={g.designer?.full_name} src={g.designer?.avatar_url} size={22} />
                <Badge className={GRAPHIC_STATUS[g.status].className}>
                  {GRAPHIC_STATUS[g.status].label}
                </Badge>
              </Link>
            ))}
          </div>
        )
      )}

      {tab === "media" && (
        <MatchMediaTab match={match} media={media} players={players} onReload={load} />
      )}

      {tab === "tasks" && (
        tasks.length === 0 ? (
          <EmptyState
            icon={<CheckSquare />}
            title="Nessun task per questa partita"
            description="I task operativi collegati alla partita appariranno qui."
          />
        ) : (
          <div className="space-y-2">
            {tasks.map((t) => (
              <Link
                key={t.id}
                href={`/tasks?open=${t.id}`}
                className="flex items-center gap-3 rounded-xl border border-line/70 bg-surface px-4 py-2.5 transition-colors hover:border-brand/30"
              >
                <Avatar name={t.owner?.full_name} src={t.owner?.avatar_url} size={22} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{t.title}</p>
                  <p className="text-[11px] text-muted">
                    {t.owner?.full_name ?? "Non assegnato"} · {fmtDate(t.deadline)}
                  </p>
                </div>
                <Badge className={PRIORITY[t.priority].className}>{PRIORITY[t.priority].label}</Badge>
                <Badge className={TASK_STATUS[t.status].className}>{TASK_STATUS[t.status].label}</Badge>
              </Link>
            ))}
          </div>
        )
      )}

      {tab === "result" && (
        <MatchResultTab
          match={match}
          players={players}
          lineup={lineup}
          events={events}
          content={content}
          onReload={load}
        />
      )}

      <MatchFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        match={match}
        onSaved={() => load()}
      />
    </div>
  );
}

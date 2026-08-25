"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight, CalendarDays, CheckSquare, Image as ImageIcon, MapPin, Palette, Trophy,
} from "lucide-react";
import { startOfWeek, endOfWeek, format } from "date-fns";
import { supabase } from "@/lib/supabase/client";
import { useClub } from "@/lib/club-context";
import type { ActivityEntry, ContentItem, Graphic, Match, MediaItem, Task } from "@/lib/types";
import {
  CONTENT_STATUS, GRAPHIC_STATUS, PRIORITY, TASK_STATUS,
  cn, daysUntil, fmtDate, fmtDateTime, fmtTime, playerName,
} from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, EmptyState, PageSkeleton, ProgressBar } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { ActivityFeed } from "@/components/shared/activity-feed";

export default function DashboardPage() {
  const { club, profile, loading: ctxLoading } = useClub();
  const [nextMatch, setNextMatch] = useState<Match | null>(null);
  const [weekContent, setWeekContent] = useState<ContentItem[]>([]);
  const [upcomingContent, setUpcomingContent] = useState<ContentItem[]>([]);
  const [openTasks, setOpenTasks] = useState<Task[]>([]);
  const [graphics, setGraphics] = useState<Graphic[]>([]);
  const [recentMedia, setRecentMedia] = useState<MediaItem[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!club) return;
    (async () => {
      const sb = supabase();
      const today = format(new Date(), "yyyy-MM-dd");
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
      const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

      const [matchRes, weekRes, upcomingRes, tasksRes, graphicsRes, mediaRes, activityRes] =
        await Promise.all([
          sb.from("matches")
            .select("*, competition:competitions(*)")
            .eq("club_id", club.id)
            .in("status", ["upcoming", "live"])
            .gte("kickoff_at", new Date(Date.now() - 12 * 3600_000).toISOString())
            .order("kickoff_at")
            .limit(1)
            .maybeSingle(),
          sb.from("content").select("*").eq("club_id", club.id)
            .gte("publish_date", weekStart).lte("publish_date", weekEnd),
          sb.from("content")
            .select("*, channel:social_channels(*), content_type:content_types(*)")
            .eq("club_id", club.id)
            .gte("publish_date", today)
            .not("status", "in", "(published,cancelled)")
            .order("publish_date").order("publish_time")
            .limit(6),
          sb.from("tasks")
            .select("*, owner:profiles!tasks_owner_id_fkey(*)")
            .eq("club_id", club.id)
            .not("status", "in", "(done)")
            .order("deadline", { ascending: true, nullsFirst: false })
            .limit(6),
          sb.from("graphics").select("*").eq("club_id", club.id).neq("status", "published"),
          sb.from("media").select("*").eq("club_id", club.id)
            .order("created_at", { ascending: false }).limit(6),
          sb.from("activity_log")
            .select("*, actor:profiles(*)")
            .eq("club_id", club.id)
            .order("created_at", { ascending: false })
            .limit(10),
        ]);

      setNextMatch(matchRes.data as Match | null);
      setWeekContent((weekRes.data as ContentItem[]) ?? []);
      setUpcomingContent((upcomingRes.data as ContentItem[]) ?? []);
      setOpenTasks((tasksRes.data as Task[]) ?? []);
      setGraphics((graphicsRes.data as Graphic[]) ?? []);
      setRecentMedia((mediaRes.data as MediaItem[]) ?? []);
      setActivity((activityRes.data as ActivityEntry[]) ?? []);
      setLoading(false);
    })();
  }, [club]);

  if (ctxLoading || loading) return <PageSkeleton />;

  const published = weekContent.filter((c) => c.status === "published").length;
  const inProduction = weekContent.filter((c) =>
    ["copy", "graphic_requested", "in_production", "scheduled"].includes(c.status)
  ).length;
  const toApprove = weekContent.filter((c) => c.status === "review").length;

  const graphicCounts = {
    todo: graphics.filter((g) => ["requested", "todo"].includes(g.status)).length,
    in_progress: graphics.filter((g) => g.status === "in_progress").length,
    review: graphics.filter((g) => g.status === "review").length,
    approved: graphics.filter((g) => g.status === "approved").length,
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buongiorno" : hour < 18 ? "Buon pomeriggio" : "Buonasera";
  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  return (
    <div className="animate-fade-up">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting}, {firstName}
        </h1>
        <p className="mt-0.5 text-[13px] text-muted">
          {club?.name} — Content &amp; Club Operations
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* NEXT MATCH */}
        <Card className="lg:col-span-2 overflow-hidden">
          {nextMatch ? (
            (() => {
              const home = nextMatch.is_home
                ? { name: club?.name ?? "RSB", logo: club?.logo_url ?? null }
                : { name: nextMatch.opponent, logo: nextMatch.opponent_logo_url };
              const away = nextMatch.is_home
                ? { name: nextMatch.opponent, logo: nextMatch.opponent_logo_url }
                : { name: club?.name ?? "RSB", logo: club?.logo_url ?? null };
              const TeamSide = ({ team }: { team: { name: string; logo: string | null } }) => (
                <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/95 p-1.5 shadow-lg sm:h-20 sm:w-20">
                    {team.logo ? (
                      <Image
                        src={team.logo}
                        alt={team.name}
                        width={72}
                        height={72}
                        unoptimized
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <Trophy className="h-7 w-7 text-brand/50" />
                    )}
                  </span>
                  <p className="w-full truncate text-[13px] font-semibold leading-tight sm:text-[15px]">
                    {team.name}
                  </p>
                </div>
              );
              return (
                <div className="relative bg-gradient-to-br from-brand to-brand-strong p-6 text-white">
                  <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-widest text-white/70">
                    <span>Next Match · {nextMatch.competition?.name ?? "—"}</span>
                    <span className="font-semibold text-accent">
                      {daysUntil(nextMatch.kickoff_at) === 0
                        ? "Oggi"
                        : daysUntil(nextMatch.kickoff_at) === 1
                        ? "Domani"
                        : `${daysUntil(nextMatch.kickoff_at)} giorni alla partita`}
                    </span>
                  </div>

                  <div className="mt-5 flex items-center justify-center gap-3 sm:gap-6">
                    <TeamSide team={home} />
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xl font-bold text-white/60 sm:text-2xl">VS</span>
                      {nextMatch.matchday && (
                        <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                          {nextMatch.matchday} giornata
                        </span>
                      )}
                    </div>
                    <TeamSide team={away} />
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[13.5px] font-medium text-white/95">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4 text-accent" /> {fmtDateTime(nextMatch.kickoff_at)}
                    </span>
                    {nextMatch.venue && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-accent" /> {nextMatch.venue}
                      </span>
                    )}
                  </div>

                  <div className="mt-5 flex justify-center">
                    <Link href={`/matches/${nextMatch.id}`}>
                      <Button className="border-0 bg-white/15 text-white hover:bg-white/25">
                        Apri Match Center <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })()
          ) : (
            <EmptyState
              icon={<Trophy />}
              title="Nessuna partita in programma"
              description="Aggiungi la prossima partita per attivare il Match Center e il pacchetto contenuti."
              action={
                <Link href="/matches?new=1">
                  <Button variant="primary">Aggiungi partita</Button>
                </Link>
              }
            />
          )}
        </Card>

        {/* CONTENT THIS WEEK */}
        <Card>
          <CardHeader
            title="Content this week"
            action={
              <Link href="/editorial" className="text-[11px] font-medium text-brand hover:underline">
                Calendario
              </Link>
            }
          />
          <CardBody>
            <p className="text-2xl font-semibold">{weekContent.length}</p>
            <p className="text-[12px] text-muted">contenuti programmati</p>
            <ProgressBar value={published} max={weekContent.length || 1} className="mt-3" color="bg-ok" />
            <div className="mt-3 space-y-1.5 text-[12.5px]">
              <div className="flex justify-between"><span className="text-muted">Pubblicati</span><span className="font-medium">{published}</span></div>
              <div className="flex justify-between"><span className="text-muted">In lavorazione</span><span className="font-medium">{inProduction}</span></div>
              <div className="flex justify-between"><span className="text-muted">Da approvare</span><span className="font-medium">{toApprove}</span></div>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* OPEN TASKS */}
        <Card>
          <CardHeader
            title="Open tasks"
            action={
              <Link href="/tasks" className="text-[11px] font-medium text-brand hover:underline">
                Tutti
              </Link>
            }
          />
          <CardBody className="space-y-2.5">
            {openTasks.length === 0 && (
              <EmptyState className="py-6" icon={<CheckSquare />} title="Nessun task aperto" />
            )}
            {openTasks.map((t) => (
              <Link
                key={t.id}
                href={`/tasks?open=${t.id}`}
                className="block rounded-xl border border-line/70 px-3 py-2.5 transition-colors hover:border-brand/30"
              >
                <p className="truncate text-[13px] font-medium">{t.title}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <Avatar name={t.owner?.full_name} src={t.owner?.avatar_url} size={18} />
                  <span className="text-[11px] text-muted">{fmtDate(t.deadline)}</span>
                  <span className="ml-auto flex gap-1">
                    <Badge className={PRIORITY[t.priority].className}>{PRIORITY[t.priority].label}</Badge>
                    <Badge className={TASK_STATUS[t.status].className}>{TASK_STATUS[t.status].label}</Badge>
                  </span>
                </div>
              </Link>
            ))}
          </CardBody>
        </Card>

        {/* GRAPHIC PRODUCTION */}
        <Card>
          <CardHeader
            title="Graphic production"
            action={
              <Link href="/graphics" className="text-[11px] font-medium text-brand hover:underline">
                Pipeline
              </Link>
            }
          />
          <CardBody>
            <p className="text-2xl font-semibold">{graphics.length}</p>
            <p className="text-[12px] text-muted">richieste attive</p>
            <div className="mt-3 space-y-2">
              {(
                [
                  ["Da iniziare", graphicCounts.todo, "bg-info"],
                  ["In lavorazione", graphicCounts.in_progress, "bg-warn"],
                  ["Da revisionare", graphicCounts.review, "bg-brand"],
                  ["Approvate", graphicCounts.approved, "bg-ok"],
                ] as const
              ).map(([label, count, color]) => (
                <div key={label} className="flex items-center gap-2.5">
                  <span className={cn("h-2 w-2 rounded-full", color)} />
                  <span className="flex-1 text-[12.5px] text-muted">{label}</span>
                  <span className="text-[13px] font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* RECENT MEDIA */}
        <Card>
          <CardHeader
            title="Recent media"
            action={
              <Link href="/media" className="text-[11px] font-medium text-brand hover:underline">
                Libreria
              </Link>
            }
          />
          <CardBody>
            {recentMedia.length === 0 ? (
              <EmptyState className="py-6" icon={<ImageIcon />} title="Nessun media caricato" />
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {recentMedia.map((m) => (
                  <Link
                    key={m.id}
                    href={`/media?open=${m.id}`}
                    className="group relative aspect-square overflow-hidden rounded-lg bg-background"
                  >
                    {m.url && m.kind === "photo" ? (
                      <Image
                        src={m.thumb_url ?? m.url}
                        alt={m.title}
                        fill
                        unoptimized
                        className="object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-muted/40">
                        {m.kind === "video" ? "▶" : <ImageIcon className="h-5 w-5" />}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* UPCOMING CONTENT */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Upcoming content"
            action={
              <Link href="/content" className="text-[11px] font-medium text-brand hover:underline">
                Tutti i contenuti
              </Link>
            }
          />
          <CardBody>
            {upcomingContent.length === 0 ? (
              <EmptyState
                className="py-6"
                icon={<Palette />}
                title="Nessun contenuto in arrivo"
                description="Crea un contenuto o genera il pacchetto della prossima partita."
              />
            ) : (
              <ul className="divide-y divide-line/70">
                {upcomingContent.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/content?open=${c.id}`}
                      className="flex items-center gap-3 py-2.5 transition-colors hover:bg-background -mx-2 px-2 rounded-lg"
                    >
                      <div className="w-14 shrink-0 text-center">
                        <p className="text-[11px] font-semibold uppercase text-brand">
                          {fmtDate(c.publish_date, "d MMM")}
                        </p>
                        <p className="text-[10px] text-muted">{fmtTime(c.publish_time)}</p>
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
            )}
          </CardBody>
        </Card>

        {/* TEAM ACTIVITY */}
        <Card>
          <CardHeader title="Team activity" />
          <CardBody>
            <ActivityFeed entries={activity} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, subMonths } from "date-fns";
import { it } from "date-fns/locale";
import { AlertTriangle, BarChart3, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useClub } from "@/lib/club-context";
import type { ContentItem, Player } from "@/lib/types";
import { CONTENT_STATUS, cn, fmtDate, playerName } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { Avatar, EmptyState, PageHeader, PageSkeleton } from "@/components/ui/misc";

interface GraphicRow {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface TaskRow {
  id: string;
  status: string;
  deadline: string | null;
  updated_at: string;
}

interface CoverageRow {
  player_id: string;
  content: {
    id: string;
    club_id: string;
    publish_date: string | null;
    created_at: string;
    channel: { slug: string } | null;
  } | null;
}

interface PlayerCoverage {
  player: Player;
  posts: number;
  stories: number;
  reels: number;
  total: number;
  lastContent: string | null;
}

function Bar({ label, value, max, color = "bg-brand" }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 shrink-0 truncate text-[12.5px] text-muted">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${value > 0 ? pct : 0}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right text-[13px] font-semibold">{value}</span>
    </div>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardBody className="pt-4">
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-[12px] text-muted">{label}</p>
        {sub && <p className="mt-0.5 text-[11px] text-muted/80">{sub}</p>}
      </CardBody>
    </Card>
  );
}

export default function ReportsPage() {
  const { club, can, loading: ctxLoading } = useClub();
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [content, setContent] = useState<ContentItem[]>([]);
  const [graphics, setGraphics] = useState<GraphicRow[]>([]);
  const [versionCounts, setVersionCounts] = useState<Map<string, number>>(new Map());
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [coverage, setCoverage] = useState<PlayerCoverage[]>([]);
  const [loading, setLoading] = useState(true);

  const monthOptions = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const d = subMonths(new Date(), i);
      return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy", { locale: it }) };
    });
  }, []);

  const load = useCallback(async () => {
    if (!club || !can("reports.view")) return;
    setLoading(true);
    const sb = supabase();
    const monthStart = `${month}-01`;
    const lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
    const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;

    const [contentRes, graphicsRes, versionsRes, tasksRes, playersRes, coverageRes] =
      await Promise.all([
        sb.from("content")
          .select("*, content_type:content_types(*), channel:social_channels(*)")
          .eq("club_id", club.id)
          .gte("publish_date", monthStart)
          .lte("publish_date", monthEnd),
        sb.from("graphics").select("id, status, created_at, updated_at").eq("club_id", club.id),
        sb.from("graphic_versions")
          .select("graphic_id, graphic:graphics!inner(club_id)")
          .eq("graphic.club_id", club.id),
        sb.from("tasks").select("id, status, deadline, updated_at").eq("club_id", club.id),
        sb.from("players").select("*").eq("club_id", club.id).eq("is_active", true).order("last_name"),
        sb.from("content_players")
          .select("player_id, content:content!inner(id, club_id, publish_date, created_at, channel:social_channels(slug))")
          .eq("content.club_id", club.id),
      ]);

    setContent((contentRes.data as ContentItem[]) ?? []);
    setGraphics((graphicsRes.data as GraphicRow[]) ?? []);
    setTasks((tasksRes.data as TaskRow[]) ?? []);

    const counts = new Map<string, number>();
    for (const v of (versionsRes.data as { graphic_id: string }[] | null) ?? []) {
      counts.set(v.graphic_id, (counts.get(v.graphic_id) ?? 0) + 1);
    }
    setVersionCounts(counts);

    // Coverage per giocatore attivo su tutti i contenuti collegati.
    const players = (playersRes.data as Player[]) ?? [];
    const rows = (coverageRes.data as unknown as CoverageRow[]) ?? [];
    const byPlayer = new Map<string, PlayerCoverage>();
    for (const p of players) {
      byPlayer.set(p.id, { player: p, posts: 0, stories: 0, reels: 0, total: 0, lastContent: null });
    }
    for (const r of rows) {
      const entry = byPlayer.get(r.player_id);
      if (!entry || !r.content) continue;
      const slug = r.content.channel?.slug ?? "";
      if (slug === "ig_feed" || slug === "facebook") entry.posts += 1;
      else if (slug === "ig_story") entry.stories += 1;
      else if (slug === "ig_reel" || slug === "tiktok") entry.reels += 1;
      entry.total += 1;
      const d = r.content.publish_date ?? r.content.created_at.slice(0, 10);
      if (!entry.lastContent || d > entry.lastContent) entry.lastContent = d;
    }
    setCoverage([...byPlayer.values()].sort((a, b) => b.total - a.total));
    setLoading(false);
  }, [club, can, month]);

  useEffect(() => {
    load();
  }, [load]);

  if (ctxLoading) return <PageSkeleton />;

  if (!can("reports.view")) {
    return (
      <EmptyState
        icon={<Lock />}
        title="Report non disponibili"
        description="Non hai il permesso per vedere report e KPI. Chiedi al Super Admin AUVI se pensi sia un errore."
      />
    );
  }

  if (loading) return <PageSkeleton />;

  // ---------- CONTENUTI ----------
  const published = content.filter((c) => c.status === "published").length;
  const countBy = (getKey: (c: ContentItem) => string) => {
    const m = new Map<string, number>();
    for (const c of content) {
      const k = getKey(c);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const byType = countBy((c) => c.content_type?.name ?? "Senza tipo");
  const byChannel = countBy((c) => c.channel?.name ?? "Senza canale");
  const byStatus = countBy((c) => CONTENT_STATUS[c.status].label);
  const maxType = Math.max(1, ...byType.map(([, n]) => n));
  const maxChannel = Math.max(1, ...byChannel.map(([, n]) => n));
  const maxStatus = Math.max(1, ...byStatus.map(([, n]) => n));

  // ---------- PRODUCTION ----------
  const inMonth = (iso: string) => iso.slice(0, 7) === month;
  const produced = graphics.filter(
    (g) => ["approved", "published"].includes(g.status) && inMonth(g.updated_at)
  );
  const approvedAll = graphics.filter((g) => ["approved", "published"].includes(g.status));
  const avgDays =
    approvedAll.length > 0
      ? (
          approvedAll.reduce(
            (sum, g) =>
              sum + (new Date(g.updated_at).getTime() - new Date(g.created_at).getTime()) / 86_400_000,
            0
          ) / approvedAll.length
        ).toFixed(1)
      : "—";
  const withVersions = [...versionCounts.values()];
  const avgVersions =
    withVersions.length > 0
      ? (withVersions.reduce((a, b) => a + b, 0) / withVersions.length).toFixed(1)
      : "—";
  const tasksDone = tasks.filter((t) => t.status === "done" && inMonth(t.updated_at)).length;
  const today = format(new Date(), "yyyy-MM-dd");
  const tasksLate = tasks.filter((t) => t.deadline && t.deadline < today && t.status !== "done").length;

  // ---------- COVERAGE ----------
  const avgTotal = coverage.length > 0 ? coverage.reduce((s, c) => s + c.total, 0) / coverage.length : 0;
  const maxTotal = Math.max(1, ...coverage.map((c) => c.total));
  const isLowCoverage = (c: PlayerCoverage) => avgTotal > 0 && c.total < avgTotal * 0.5;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Reports"
        subtitle="KPI di contenuti, produzione e copertura giocatori."
        action={
          <Select value={month} onChange={(e) => setMonth(e.target.value)} className="h-8 w-auto text-[13px]">
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        }
      />

      {/* CONTENUTI */}
      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted">Contenuti</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Contenuti nel mese" value={content.length} />
        <StatTile label="Pubblicati" value={published} sub={content.length > 0 ? `${Math.round((published / content.length) * 100)}% del totale` : undefined} />
        <StatTile label="Tipi diversi" value={byType.length} />
        <StatTile label="Canali usati" value={byChannel.length} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Per tipo" />
          <CardBody className="space-y-2">
            {byType.length === 0 && <p className="text-[12.5px] text-muted">Nessun contenuto nel mese.</p>}
            {byType.map(([label, n]) => (
              <Bar key={label} label={label} value={n} max={maxType} />
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Per canale" />
          <CardBody className="space-y-2">
            {byChannel.length === 0 && <p className="text-[12.5px] text-muted">Nessun contenuto nel mese.</p>}
            {byChannel.map(([label, n]) => (
              <Bar key={label} label={label} value={n} max={maxChannel} color="bg-info" />
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Per stato" />
          <CardBody className="space-y-2">
            {byStatus.length === 0 && <p className="text-[12.5px] text-muted">Nessun contenuto nel mese.</p>}
            {byStatus.map(([label, n]) => (
              <Bar key={label} label={label} value={n} max={maxStatus} color="bg-ok" />
            ))}
          </CardBody>
        </Card>
      </div>

      {/* PRODUCTION */}
      <h2 className="mt-8 mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted">Production</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Grafiche prodotte" value={produced.length} sub="Approvate o pubblicate nel mese" />
        <StatTile label="Tempo medio produzione" value={avgDays === "—" ? "—" : `${avgDays} gg`} sub="Dalla richiesta all'approvazione" />
        <StatTile label="Revisioni medie" value={avgVersions} sub="Versioni per grafica" />
        <StatTile label="Task completati" value={tasksDone} sub="Nel mese selezionato" />
        <StatTile label="Task in ritardo" value={tasksLate} sub="Deadline superata, non conclusi" />
      </div>

      {/* PLAYER COVERAGE */}
      <h2 className="mt-8 mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted">Player coverage</h2>

      <Card className="mb-4">
        <CardHeader title="Squad content coverage" />
        <CardBody className="space-y-2">
          {coverage.length === 0 && (
            <EmptyState className="py-6" icon={<BarChart3 />} title="Nessun giocatore attivo" />
          )}
          {coverage.map((c) => (
            <Bar
              key={c.player.id}
              label={playerName(c.player)}
              value={c.total}
              max={maxTotal}
              color={isLowCoverage(c) ? "bg-warn" : "bg-brand"}
            />
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Dettaglio per giocatore" />
        <CardBody>
          {coverage.length === 0 ? (
            <EmptyState className="py-6" icon={<BarChart3 />} title="Nessun giocatore attivo" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
                    <th className="py-2 pr-3 font-semibold">Player</th>
                    <th className="py-2 px-3 text-right font-semibold">Posts</th>
                    <th className="py-2 px-3 text-right font-semibold">Stories</th>
                    <th className="py-2 px-3 text-right font-semibold">Reels</th>
                    <th className="py-2 px-3 text-right font-semibold">Total</th>
                    <th className="py-2 pl-3 font-semibold">Last content</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {coverage.map((c) => (
                    <tr key={c.player.id} className="transition-colors hover:bg-background">
                      <td className="py-2.5 pr-3">
                        <span className="flex items-center gap-2.5">
                          <Avatar name={playerName(c.player)} src={c.player.photo_url} size={26} />
                          <span className="font-medium">{playerName(c.player)}</span>
                          {isLowCoverage(c) && (
                            <Badge className="bg-warn-soft text-warn">
                              <AlertTriangle className="h-3 w-3" /> Low Coverage
                            </Badge>
                          )}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">{c.posts}</td>
                      <td className="py-2.5 px-3 text-right">{c.stories}</td>
                      <td className="py-2.5 px-3 text-right">{c.reels}</td>
                      <td className="py-2.5 px-3 text-right font-semibold">{c.total}</td>
                      <td className="py-2.5 pl-3 text-muted">{fmtDate(c.lastContent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { FileText, Image as ImageIcon, Play, Search, Upload } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useClub } from "@/lib/club-context";
import type { Match, MediaItem, MediaKind, Player } from "@/lib/types";
import { cn, fmtDate, matchLabel, playerName } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { EmptyState, PageHeader, PageSkeleton, Tabs } from "@/components/ui/misc";
import { UploadMediaDialog } from "@/components/media/upload-media-dialog";
import { MediaDrawer } from "@/components/media/media-drawer";

const TABS = [
  { key: "all", label: "All" },
  { key: "players", label: "Players" },
  { key: "matches", label: "Matches" },
  { key: "training", label: "Training" },
  { key: "events", label: "Events" },
  { key: "graphics", label: "Graphics" },
  { key: "logos", label: "Loghi" },
  { key: "videos", label: "Videos" },
  { key: "sponsors", label: "Sponsors" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const KINDS: { value: MediaKind; label: string }[] = [
  { value: "photo", label: "Foto" },
  { value: "video", label: "Video" },
  { value: "graphic", label: "Grafiche" },
  { value: "document", label: "Documenti" },
];

function inTab(m: MediaItem, tab: TabKey): boolean {
  switch (tab) {
    case "players": return (m.media_players?.length ?? 0) > 0;
    case "matches": return !!m.match_id || m.category === "match";
    case "training": return m.category === "training";
    case "events": return m.category === "media-day" || m.category === "celebration";
    case "graphics": return m.kind === "graphic";
    case "logos": return m.category === "logo";
    case "videos": return m.kind === "video";
    case "sponsors": return m.category === "sponsor";
    default: return true;
  }
}

export default function MediaPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MediaInner />
    </Suspense>
  );
}

function MediaInner() {
  const { club, can, loading: ctxLoading } = useClub();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<TabKey>("all");
  const [query, setQuery] = useState("");
  const [playerFilter, setPlayerFilter] = useState("");
  const [matchFilter, setMatchFilter] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");

  const openId = params.get("open");
  const showNew = params.get("new") === "1";

  const load = useCallback(async () => {
    if (!club) return;
    const sb = supabase();
    const [mediaRes, playersRes, matchesRes] = await Promise.all([
      sb.from("media")
        .select("*, author:profiles(*), match:matches(*), media_players(player_id)")
        .eq("club_id", club.id)
        .order("created_at", { ascending: false }),
      sb.from("players")
        .select("*")
        .eq("club_id", club.id)
        .eq("is_active", true)
        .order("last_name"),
      sb.from("matches")
        .select("*")
        .eq("club_id", club.id)
        .order("kickoff_at", { ascending: false }),
    ]);
    setMedia((mediaRes.data as MediaItem[]) ?? []);
    setPlayers((playersRes.data as Player[]) ?? []);
    setMatches((matchesRes.data as Match[]) ?? []);
    setLoading(false);
  }, [club]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const tag = tagFilter.trim().toLowerCase();
    return media.filter((m) => {
      if (!inTab(m, tab)) return false;
      if (q && !m.title.toLowerCase().includes(q)) return false;
      if (playerFilter && !m.media_players?.some((p) => p.player_id === playerFilter)) return false;
      if (matchFilter && m.match_id !== matchFilter) return false;
      if (kindFilter && m.kind !== kindFilter) return false;
      if (tag && !m.tags.some((t) => t.toLowerCase().includes(tag))) return false;
      if (monthFilter && !(m.taken_at ?? m.created_at).startsWith(monthFilter)) return false;
      return true;
    });
  }, [media, tab, query, playerFilter, matchFilter, kindFilter, tagFilter, monthFilter]);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of TABS) counts[t.key] = media.filter((m) => inTab(m, t.key)).length;
    return counts;
  }, [media]);

  const openMedia = openId ? media.find((m) => m.id === openId) ?? null : null;

  const closeOverlay = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

  if (ctxLoading || loading) return <PageSkeleton />;

  const hasFilters = !!(query || playerFilter || matchFilter || kindFilter || tagFilter || monthFilter);

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Media Library"
        subtitle="Tutte le foto, i video, le grafiche e i documenti del club."
        action={
          can("media.upload") && (
            <Button
              variant="primary"
              onClick={() => router.replace(`${pathname}?new=1`, { scroll: false })}
            >
              <Upload className="h-3.5 w-3.5" /> Upload Media
            </Button>
          )
        }
      />

      <Tabs
        className="mb-4"
        tabs={TABS.map((t) => ({ key: t.key, label: t.label, count: tabCounts[t.key] }))}
        active={tab}
        onChange={(k) => setTab(k as TabKey)}
      />

      {/* Filtri */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca per titolo…"
            className="w-48 pl-8"
          />
        </div>
        <Select value={playerFilter} onChange={(e) => setPlayerFilter(e.target.value)} className="w-44">
          <option value="">Tutti i giocatori</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {playerName(p)}
            </option>
          ))}
        </Select>
        <Select value={matchFilter} onChange={(e) => setMatchFilter(e.target.value)} className="w-48">
          <option value="">Tutte le partite</option>
          {matches.map((m) => (
            <option key={m.id} value={m.id}>
              {matchLabel(m, club?.short_name ?? "RSB")}
            </option>
          ))}
        </Select>
        <Select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} className="w-36">
          <option value="">Ogni tipo</option>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </Select>
        <Input
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          placeholder="Tag…"
          className="w-32"
        />
        <Input
          type="month"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="w-40"
        />
      </div>

      {media.length === 0 ? (
        <EmptyState
          icon={<ImageIcon />}
          title="La libreria è vuota"
          description="Carica le prime foto o i primi video: saranno subito disponibili per contenuti e grafiche."
          action={
            can("media.upload") && (
              <Button
                variant="primary"
                onClick={() => router.replace(`${pathname}?new=1`, { scroll: false })}
              >
                <Upload className="h-3.5 w-3.5" /> Upload Media
              </Button>
            )
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Search />}
          title="Nessun media trovato"
          description={
            hasFilters
              ? "Prova ad allargare i filtri o a cambiare tab."
              : "Non ci sono media in questa sezione."
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((m) => (
            <button
              key={m.id}
              onClick={() => router.replace(`${pathname}?open=${m.id}`, { scroll: false })}
              className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl bg-background text-left"
            >
              {m.url && (m.kind === "photo" || m.kind === "graphic") ? (
                <Image
                  src={m.thumb_url ?? m.url}
                  alt={m.title}
                  fill
                  unoptimized
                  className="object-cover transition-transform duration-200 group-hover:scale-105"
                />
              ) : m.kind === "video" ? (
                <span className="flex h-full w-full items-center justify-center bg-black/80">
                  <Play className="h-7 w-7 text-white/80" />
                </span>
              ) : (
                <span className="flex h-full w-full items-center justify-center text-muted/40">
                  <FileText className="h-7 w-7" />
                </span>
              )}
              {/* Overlay hover con titolo + data */}
              <span
                className={cn(
                  "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-2 pt-6",
                  "opacity-0 transition-opacity group-hover:opacity-100"
                )}
              >
                <span className="block truncate text-[11.5px] font-medium text-white">
                  {m.title}
                </span>
                <span className="block text-[10px] text-white/70">
                  {fmtDate(m.taken_at ?? m.created_at)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {can("media.upload") && (
        <UploadMediaDialog
          open={showNew}
          onClose={closeOverlay}
          onUploaded={load}
          matches={matches}
          players={players}
        />
      )}

      {openMedia && (
        <MediaDrawer
          media={openMedia}
          onClose={closeOverlay}
          reload={load}
          matches={matches}
          players={players}
        />
      )}
    </div>
  );
}

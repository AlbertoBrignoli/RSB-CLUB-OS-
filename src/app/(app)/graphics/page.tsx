"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Palette, Plus, Search } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useClub } from "@/lib/club-context";
import { logActivity, notify } from "@/lib/activity";
import type {
  Graphic, GraphicStatus, Match, Player, PriorityLevel,
} from "@/lib/types";
import { GRAPHIC_STATUS, PRIORITY, cn, matchLabel } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/ui/misc";
import { GraphicCard } from "@/components/graphics/graphic-card";
import { NewGraphicDialog } from "@/components/graphics/new-graphic-dialog";
import { GraphicDrawer } from "@/components/graphics/graphic-drawer";

const COLUMNS: GraphicStatus[] = [
  "requested", "todo", "in_progress", "review", "approved", "published",
];
// Stati "di produzione": spostarcisi richiede graphics.produce; approved/published → graphics.approve.
const PRODUCE_STATUSES: GraphicStatus[] = ["requested", "todo", "in_progress", "review"];

export default function GraphicsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <GraphicsInner />
    </Suspense>
  );
}

function GraphicsInner() {
  const { club, userId, profile, team, can, loading: ctxLoading } = useClub();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [graphics, setGraphics] = useState<Graphic[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [contents, setContents] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtri rapidi
  const [query, setQuery] = useState("");
  const [designerFilter, setDesignerFilter] = useState("");
  const [matchFilter, setMatchFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [dragOverCol, setDragOverCol] = useState<GraphicStatus | null>(null);

  const openId = params.get("open");
  const showNew = params.get("new") === "1";

  const load = useCallback(async () => {
    if (!club) return;
    const sb = supabase();
    const [graphicsRes, playersRes, matchesRes, contentsRes] = await Promise.all([
      sb.from("graphics")
        .select(
          `*,
          designer:profiles!graphics_designer_id_fkey(*),
          requester:profiles!graphics_requested_by_fkey(*),
          content:content(*),
          match:matches(*),
          player:players(*),
          versions:graphic_versions(*, uploader:profiles(*))`
        )
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
      sb.from("content")
        .select("id, title")
        .eq("club_id", club.id)
        .not("status", "in", "(published,cancelled)")
        .order("created_at", { ascending: false }),
    ]);
    setGraphics((graphicsRes.data as Graphic[]) ?? []);
    setPlayers((playersRes.data as Player[]) ?? []);
    setMatches((matchesRes.data as Match[]) ?? []);
    setContents((contentsRes.data as { id: string; title: string }[]) ?? []);
    setLoading(false);
  }, [club]);

  useEffect(() => {
    load();
  }, [load]);

  const canMoveTo = useCallback(
    (status: GraphicStatus) =>
      PRODUCE_STATUSES.includes(status) ? can("graphics.produce") : can("graphics.approve"),
    [can]
  );
  const canDrag = can("graphics.produce") || can("graphics.approve");

  const changeStatus = useCallback(
    async (g: Graphic, status: GraphicStatus) => {
      if (!club || !userId || g.status === status || !canMoveTo(status)) return;
      // update ottimistico
      setGraphics((list) => list.map((x) => (x.id === g.id ? { ...x, status } : x)));
      const { error } = await supabase().from("graphics").update({ status }).eq("id", g.id);
      if (error) {
        setGraphics((list) => list.map((x) => (x.id === g.id ? { ...x, status: g.status } : x)));
        return;
      }
      await logActivity({
        clubId: club.id,
        actorId: userId,
        action: "status_changed",
        entityType: "graphic",
        entityId: g.id,
        summary: `${profile?.full_name ?? "Qualcuno"} ha spostato «${g.title}» in ${GRAPHIC_STATUS[status].label}`,
      });
      if (status === "review" && g.requested_by) {
        await notify({
          clubId: club.id,
          userIds: [g.requested_by],
          excludeUserId: userId,
          type: "graphic_ready",
          title: `Grafica in review: ${g.title}`,
          entityType: "graphic",
          entityId: g.id,
        });
      }
      if (status === "approved") {
        await notify({
          clubId: club.id,
          userIds: [g.designer_id, g.requested_by].filter((id): id is string => !!id),
          excludeUserId: userId,
          type: "status_change",
          title: `Grafica approvata: ${g.title}`,
          entityType: "graphic",
          entityId: g.id,
        });
      }
    },
    [club, userId, profile, canMoveTo]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return graphics.filter((g) => {
      if (q && !g.title.toLowerCase().includes(q)) return false;
      if (designerFilter && g.designer_id !== designerFilter) return false;
      if (matchFilter && g.match_id !== matchFilter) return false;
      if (priorityFilter && g.priority !== priorityFilter) return false;
      return true;
    });
  }, [graphics, query, designerFilter, matchFilter, priorityFilter]);

  const byStatus = useMemo(() => {
    const map = new Map<GraphicStatus, Graphic[]>(COLUMNS.map((s) => [s, []]));
    for (const g of filtered) map.get(g.status)?.push(g);
    return map;
  }, [filtered]);

  const openGraphic = openId ? graphics.find((g) => g.id === openId) ?? null : null;

  const closeOverlay = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

  if (ctxLoading || loading) return <PageSkeleton />;

  const hasFilters = !!(query || designerFilter || matchFilter || priorityFilter);

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Graphic Production"
        subtitle="Pipeline di produzione grafica: dalla richiesta alla pubblicazione."
        action={
          can("graphics.request") && (
            <Button variant="primary" onClick={() => router.replace(`${pathname}?new=1`, { scroll: false })}>
              <Plus className="h-3.5 w-3.5" /> New Request
            </Button>
          )
        }
      />

      {/* Filtri rapidi */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca per titolo…"
            className="w-52 pl-8"
          />
        </div>
        <Select
          value={designerFilter}
          onChange={(e) => setDesignerFilter(e.target.value)}
          className="w-44"
        >
          <option value="">Tutti i designer</option>
          {team.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.profile?.full_name ?? "—"}
            </option>
          ))}
        </Select>
        <Select
          value={matchFilter}
          onChange={(e) => setMatchFilter(e.target.value)}
          className="w-48"
        >
          <option value="">Tutte le partite</option>
          {matches.map((m) => (
            <option key={m.id} value={m.id}>
              {matchLabel(m, club?.short_name ?? "RSB")}
            </option>
          ))}
        </Select>
        <Select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="w-36"
        >
          <option value="">Ogni priorità</option>
          {(Object.keys(PRIORITY) as PriorityLevel[]).map((p) => (
            <option key={p} value={p}>
              {PRIORITY[p].label}
            </option>
          ))}
        </Select>
      </div>

      {graphics.length === 0 ? (
        <EmptyState
          icon={<Palette />}
          title="Nessuna richiesta grafica"
          description="Crea la prima richiesta: il designer la riceverà nella sua coda di produzione."
          action={
            can("graphics.request") && (
              <Button variant="primary" onClick={() => router.replace(`${pathname}?new=1`, { scroll: false })}>
                <Plus className="h-3.5 w-3.5" /> New Request
              </Button>
            )
          }
        />
      ) : (
        /* Board Kanban orizzontale */
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-4">
          {COLUMNS.map((status) => {
            const items = byStatus.get(status) ?? [];
            return (
              <div
                key={status}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = canMoveTo(status) ? "move" : "none";
                }}
                onDragEnter={() => setDragOverCol(status)}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverCol(null);
                  const id = e.dataTransfer.getData("text/plain");
                  const g = graphics.find((x) => x.id === id);
                  if (g) changeStatus(g, status);
                }}
                className={cn(
                  "flex w-[272px] shrink-0 flex-col rounded-2xl border border-line/60 bg-background/70 p-2.5 transition-colors",
                  dragOverCol === status && canMoveTo(status) && "border-brand/50 bg-brand-soft/40"
                )}
              >
                <div className="mb-2.5 flex items-center justify-between px-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    {GRAPHIC_STATUS[status].label}
                  </span>
                  <span className="rounded-full bg-black/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-muted">
                    {items.length}
                  </span>
                </div>
                <div className="flex-1 space-y-2">
                  {items.length === 0 && (
                    <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-[11px] text-muted/70">
                      {hasFilters ? "Nessun risultato" : "Nessuna grafica"}
                    </p>
                  )}
                  {items.map((g) => (
                    <GraphicCard
                      key={g.id}
                      graphic={g}
                      clubShort={club?.short_name ?? "RSB"}
                      draggable={canDrag}
                      onOpen={() => router.replace(`${pathname}?open=${g.id}`, { scroll: false })}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {can("graphics.request") && (
        <NewGraphicDialog
          open={showNew}
          onClose={closeOverlay}
          onCreated={load}
          contents={contents}
          matches={matches}
          players={players}
        />
      )}

      {openGraphic && (
        <GraphicDrawer
          graphic={openGraphic}
          onClose={closeOverlay}
          canMoveTo={canMoveTo}
          onChangeStatus={changeStatus}
          reload={load}
        />
      )}
    </div>
  );
}

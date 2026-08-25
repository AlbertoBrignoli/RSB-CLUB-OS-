"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, Users } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useClub } from "@/lib/club-context";
import type { Player, PlayerStatus } from "@/lib/types";
import { PLAYER_STATUS, POSITIONS, POSITION_LABEL, cn, fmtDate, initials, playerName } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/ui/misc";
import { PlayerFormDialog } from "@/components/players/player-form-dialog";

export default function TeamPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TeamInner />
    </Suspense>
  );
}

function PlayerCard({ player }: { player: Player }) {
  const status = PLAYER_STATUS[player.status];
  return (
    <Link
      href={`/players/${player.id}`}
      className="group block overflow-hidden rounded-card border border-line/80 bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:border-brand/30 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] bg-background">
        {player.photo_url ? (
          <Image
            src={player.photo_url}
            alt={playerName(player)}
            fill
            unoptimized
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-3xl font-semibold text-brand/60">
            {initials(playerName(player))}
          </span>
        )}
        {player.shirt_number != null && (
          <span className="absolute right-3 top-2 text-4xl font-bold leading-none text-brand/90 drop-shadow-[0_1px_2px_rgba(255,255,255,0.7)]">
            {player.shirt_number}
          </span>
        )}
        <span className="absolute bottom-2 left-2">
          <Badge className={cn(status.className, "shadow-sm")}>{status.label}</Badge>
        </span>
      </div>
      <div className="px-4 py-3">
        <p className="truncate text-[14px] font-semibold group-hover:text-brand transition-colors">
          {playerName(player)}
        </p>
        <p className="mt-0.5 text-[12px] text-muted">
          {POSITION_LABEL[player.position].full}
          {player.role_detail ? ` · ${player.role_detail}` : ""}
        </p>
        <p className="mt-1 text-[11px] text-muted/80">{fmtDate(player.birth_date)}</p>
      </div>
    </Link>
  );
}

function TeamInner() {
  const { club, can, loading: ctxLoading } = useClub();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | PlayerStatus>("");

  const load = useCallback(async () => {
    if (!club) return;
    const { data } = await supabase()
      .from("players")
      .select("*")
      .eq("club_id", club.id)
      .eq("is_active", true)
      .order("last_name")
      .order("first_name");
    setPlayers((data as Player[]) ?? []);
    setLoading(false);
  }, [club]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get("new") === "1" && can("players.manage")) setFormOpen(true);
  }, [searchParams, can]);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    if (searchParams.get("new")) router.replace("/team");
  }, [router, searchParams]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        playerName(p).toLowerCase().includes(q) ||
        (p.shirt_number != null && String(p.shirt_number) === q)
      );
    });
  }, [players, query, statusFilter]);

  if (ctxLoading || loading) return <PageSkeleton />;

  const filtering = query.trim() !== "" || statusFilter !== "";

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Squad Overview"
        subtitle={`${players.length} ${players.length === 1 ? "giocatore" : "giocatori"} in rosa — ${club?.name ?? ""}`}
        action={
          can("players.manage") && (
            <Button variant="primary" onClick={() => setFormOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Player
            </Button>
          )
        }
      />

      {players.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted/70" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca per nome o numero…"
              className="pl-8"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | PlayerStatus)}
            className="w-44"
          >
            <option value="">Tutti gli stati</option>
            {(Object.keys(PLAYER_STATUS) as PlayerStatus[]).map((s) => (
              <option key={s} value={s}>{PLAYER_STATUS[s].label}</option>
            ))}
          </Select>
        </div>
      )}

      {players.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="La rosa è ancora vuota"
          description="Aggiungi il primo giocatore per attivare schede, media center e statistiche individuali."
          action={
            can("players.manage") && (
              <Button variant="primary" onClick={() => setFormOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Add Player
              </Button>
            )
          }
        />
      ) : filtered.length === 0 && filtering ? (
        <EmptyState
          icon={<Search />}
          title="Nessun giocatore trovato"
          description="Prova a cambiare la ricerca o il filtro stato."
        />
      ) : (
        <div className="space-y-8">
          {POSITIONS.map((pos) => {
            const group = filtered.filter((p) => p.position === pos);
            if (group.length === 0) return null;
            return (
              <section key={pos}>
                <div className="mb-3 flex items-baseline gap-2">
                  <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
                    {POSITION_LABEL[pos].plural}
                  </h2>
                  <span className="text-[11px] text-muted/70">{group.length}</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {group.map((p) => (
                    <PlayerCard key={p.id} player={p} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <PlayerFormDialog open={formOpen} onClose={closeForm} onSaved={load} />
    </div>
  );
}

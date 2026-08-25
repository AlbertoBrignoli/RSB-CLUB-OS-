"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trophy } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { supabase } from "@/lib/supabase/client";
import { useClub } from "@/lib/club-context";
import type { Match, Season } from "@/lib/types";
import { PageSkeleton, PageHeader, Tabs, EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Select, Field } from "@/components/ui/input";
import { MatchRow } from "@/components/matches/match-row";
import { MatchFormDialog } from "@/components/matches/match-form-dialog";

export default function MatchesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MatchesInner />
    </Suspense>
  );
}

function MatchesInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { club, season, can, loading: ctxLoading } = useClub();
  const clubShort = club?.short_name ?? "RSB";

  const [matches, setMatches] = useState<Match[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list");
  const [seasonFilter, setSeasonFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  // ?new=1 apre il form di creazione.
  useEffect(() => {
    if (searchParams.get("new") === "1" && can("matches.manage")) {
      setFormOpen(true);
      router.replace("/matches");
    }
  }, [searchParams, can, router]);

  // Default della tab Season: stagione corrente, altrimenti la più recente.
  useEffect(() => {
    if (seasonFilter) return;
    if (season) setSeasonFilter(season.id);
    else if (seasons.length > 0) setSeasonFilter(seasons[0].id);
  }, [season, seasons, seasonFilter]);

  const load = useCallback(async () => {
    if (!club) return;
    const sb = supabase();
    const [matchesRes, seasonsRes] = await Promise.all([
      sb.from("matches")
        .select("*, competition:competitions(*)")
        .eq("club_id", club.id)
        .order("kickoff_at", { ascending: false }),
      sb.from("seasons")
        .select("*")
        .eq("club_id", club.id)
        .order("start_date", { ascending: false }),
    ]);
    setMatches((matchesRes.data as Match[]) ?? []);
    setSeasons((seasonsRes.data as Season[]) ?? []);
    setLoading(false);
  }, [club]);

  useEffect(() => {
    load();
  }, [load]);

  // Calendar: raggruppa per mese (intestazioni in italiano).
  const byMonth = useMemo(() => {
    const groups = new Map<string, { label: string; items: Match[] }>();
    for (const m of matches) {
      const key = format(new Date(m.kickoff_at), "yyyy-MM");
      if (!groups.has(key)) {
        const label = format(new Date(m.kickoff_at), "MMMM yyyy", { locale: it });
        groups.set(key, { label: label.charAt(0).toUpperCase() + label.slice(1), items: [] });
      }
      groups.get(key)!.items.push(m);
    }
    return [...groups.values()];
  }, [matches]);

  // Season: filtro stagione + raggruppamento per competizione.
  const byCompetition = useMemo(() => {
    const filtered = matches.filter((m) => m.season_id === seasonFilter);
    const groups = new Map<string, { label: string; items: Match[] }>();
    for (const m of filtered) {
      const key = m.competition_id ?? "none";
      if (!groups.has(key)) {
        groups.set(key, { label: m.competition?.name ?? "Senza competizione", items: [] });
      }
      groups.get(key)!.items.push(m);
    }
    return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [matches, seasonFilter]);

  if (ctxLoading || loading) return <PageSkeleton />;

  const empty = (
    <EmptyState
      icon={<Trophy />}
      title="Nessuna partita nel database"
      description="Aggiungi la prossima partita per attivare il Match Center: contenuti, grafiche, media e task collegati."
      action={
        can("matches.manage") ? (
          <Button variant="primary" onClick={() => setFormOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add Match
          </Button>
        ) : undefined
      }
    />
  );

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Matches"
        subtitle="Il database partite del club: ogni partita è un centro operativo."
        action={
          can("matches.manage") ? (
            <Button variant="primary" onClick={() => setFormOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Match
            </Button>
          ) : undefined
        }
      />

      <Tabs
        className="mb-4"
        active={view}
        onChange={setView}
        tabs={[
          { key: "list", label: "List", count: matches.length },
          { key: "calendar", label: "Calendar" },
          { key: "season", label: "Season" },
        ]}
      />

      {matches.length === 0 && empty}

      {matches.length > 0 && view === "list" && (
        <div className="space-y-2">
          {matches.map((m) => (
            <MatchRow key={m.id} match={m} clubShort={clubShort} />
          ))}
        </div>
      )}

      {matches.length > 0 && view === "calendar" && (
        <div className="space-y-6">
          {byMonth.map((g) => (
            <section key={g.label}>
              <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted">
                {g.label}
              </h2>
              <div className="space-y-2">
                {g.items.map((m) => (
                  <MatchRow key={m.id} match={m} clubShort={clubShort} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {matches.length > 0 && view === "season" && (
        <div>
          <div className="mb-4 max-w-60">
            <Field label="Stagione">
              <Select value={seasonFilter} onChange={(e) => setSeasonFilter(e.target.value)}>
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.is_current ? " (corrente)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {byCompetition.length === 0 ? (
            <EmptyState
              icon={<Trophy />}
              title="Nessuna partita in questa stagione"
              description="Le partite collegate alla stagione selezionata appariranno qui, raggruppate per competizione."
            />
          ) : (
            <div className="space-y-6">
              {byCompetition.map((g) => (
                <section key={g.label}>
                  <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted">
                    {g.label}
                  </h2>
                  <div className="space-y-2">
                    {g.items.map((m) => (
                      <MatchRow key={m.id} match={m} clubShort={clubShort} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}

      <MatchFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={(id) => {
          load();
          router.push(`/matches/${id}`);
        }}
      />
    </div>
  );
}

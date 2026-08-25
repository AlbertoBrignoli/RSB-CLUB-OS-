"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { CheckCircle2, Users } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useClub } from "@/lib/club-context";
import { logActivity, notify } from "@/lib/activity";
import type { Match, MatchLineupEntry, Player, PlayerPosition } from "@/lib/types";
import { POSITION_LABEL, cn, initials, playerName } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/misc";

// Righe dal basso (portiere) verso l'alto (attacco). Somma sempre 11.
const FORMATIONS: Record<string, number[]> = {
  "4-4-2":   [1, 4, 4, 2],
  "4-3-3":   [1, 4, 3, 3],
  "3-4-3":   [1, 3, 4, 3],
  "3-5-2":   [1, 3, 5, 2],
  "4-5-1":   [1, 4, 5, 1],
  "4-2-3-1": [1, 4, 2, 3, 1],
  "3-4-2-1": [1, 3, 4, 2, 1],
  "4-4-1-1": [1, 4, 4, 1, 1],
  "5-3-2":   [1, 5, 3, 2],
  "4-3-1-2": [1, 4, 3, 1, 2],
};
const FORMATION_KEYS = Object.keys(FORMATIONS);
const DEFAULT_FORMATION = "4-4-2";

const POSITION_ORDER: Record<PlayerPosition, number> = { GK: 0, DF: 1, MF: 2, FW: 3 };

// Coordinate (in %) degli 11 slot: slot 0 = portiere in basso, poi riga per riga verso l'alto.
function slotCoords(formation: string): { x: number; y: number }[] {
  const rows = FORMATIONS[formation] ?? FORMATIONS[DEFAULT_FORMATION];
  const coords: { x: number; y: number }[] = [];
  rows.forEach((count, r) => {
    const y = 88 - (r * 76) / (rows.length - 1); // GK ~88%, attacco ~12%
    for (let i = 0; i < count; i++) {
      coords.push({ x: ((i + 1) / (count + 1)) * 100, y });
    }
  });
  return coords;
}

function PlayerFace({ player, size = "md" }: { player: Player; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "h-8 w-8" : "h-9 w-9 sm:h-11 sm:w-11";
  if (player.photo_url) {
    return (
      <Image
        src={player.photo_url}
        alt={playerName(player)}
        width={44}
        height={44}
        unoptimized
        className={cn(cls, "rounded-full border-2 border-white bg-white object-cover shadow-md")}
      />
    );
  }
  return (
    <span
      className={cn(
        cls,
        "inline-flex items-center justify-center rounded-full border-2 border-white bg-brand text-[11px] font-bold text-white shadow-md"
      )}
    >
      {initials(playerName(player))}
    </span>
  );
}

export function FormationBoard({
  match,
  players,
  lineup,
  onReload,
}: {
  match: Match;
  players: Player[];
  lineup: MatchLineupEntry[];
  onReload: () => void;
}) {
  const { club, userId, profile, can, team } = useClub();
  const canManage = can("matches.manage");

  const [formation, setFormation] = useState<string>(
    match.formation && FORMATIONS[match.formation] ? match.formation : DEFAULT_FORMATION
  );
  const [slots, setSlots] = useState<(string | null)[]>(Array(11).fill(null));
  const [bench, setBench] = useState<string[]>([]);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Ripopola la lavagnetta dalla formazione salvata.
  useEffect(() => {
    const next: (string | null)[] = Array(11).fill(null);
    const overflow: string[] = [];
    for (const l of lineup.filter((l) => l.is_starting)) {
      if (l.slot != null && l.slot >= 0 && l.slot < 11 && next[l.slot] == null) {
        next[l.slot] = l.player_id;
      } else {
        overflow.push(l.player_id);
      }
    }
    for (const id of overflow) {
      const free = next.indexOf(null);
      if (free >= 0) next[free] = id;
    }
    setSlots(next);
    setBench(lineup.filter((l) => !l.is_starting).map((l) => l.player_id));
    if (match.formation && FORMATIONS[match.formation]) setFormation(match.formation);
  }, [lineup, match.formation]);

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const placed = useMemo(() => new Set(slots.filter(Boolean) as string[]), [slots]);
  const xiCount = placed.size;

  const roster = useMemo(
    () =>
      [...players].sort(
        (a, b) =>
          POSITION_ORDER[a.position] - POSITION_ORDER[b.position] ||
          (a.shirt_number ?? 99) - (b.shirt_number ?? 99) ||
          a.last_name.localeCompare(b.last_name)
      ),
    [players]
  );

  const coords = slotCoords(formation);

  function placePlayer(slotIdx: number, playerId: string) {
    if (!canManage) return;
    setSlots((prev) => {
      const next = prev.map((id) => (id === playerId ? null : id));
      next[slotIdx] = playerId;
      return next;
    });
    setBench((prev) => prev.filter((id) => id !== playerId));
    setSaved(false);
  }

  function clearSlot(slotIdx: number) {
    if (!canManage) return;
    setSlots((prev) => {
      const next = [...prev];
      next[slotIdx] = null;
      return next;
    });
    setSaved(false);
  }

  // Cambio modulo: gli slot sono sempre 11, quindi i giocatori piazzati si
  // ricollocano in ordine sugli slot del nuovo modulo senza perdere le scelte.
  function changeFormation(next: string) {
    setFormation(next);
    setSaved(false);
  }

  function toggleBench(playerId: string) {
    if (!canManage) return;
    setBench((prev) =>
      prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId]
    );
    setSaved(false);
  }

  async function confirmLineup() {
    if (!club || !userId || !canManage) return;
    setSaving(true);
    const sb = supabase();
    const starters = slots
      .map((playerId, slot) => ({ playerId, slot }))
      .filter((s): s is { playerId: string; slot: number } => s.playerId != null);
    const rows = [
      ...starters.map((s) => ({
        match_id: match.id,
        player_id: s.playerId,
        club_id: club.id,
        is_starting: true,
        slot: s.slot,
      })),
      ...bench
        .filter((id) => !placed.has(id))
        .map((id) => ({
          match_id: match.id,
          player_id: id,
          club_id: club.id,
          is_starting: false,
          slot: null,
        })),
    ];

    const { error: delErr } = await sb.from("match_lineup").delete().eq("match_id", match.id);
    const { error: insErr } = rows.length
      ? await sb.from("match_lineup").insert(rows)
      : { error: null };
    const { error: matchErr } = await sb
      .from("matches")
      .update({ formation })
      .eq("id", match.id);

    if (!delErr && !insErr && !matchErr) {
      const xiText = starters
        .map((s) => {
          const p = byId.get(s.playerId);
          if (!p) return null;
          return p.shirt_number != null ? `${p.last_name} (${p.shirt_number})` : p.last_name;
        })
        .filter(Boolean)
        .join(", ");
      const body = xiText.length > 180 ? `${xiText.slice(0, 179)}…` : xiText;
      await Promise.all([
        logActivity({
          clubId: club.id,
          actorId: userId,
          action: "updated",
          entityType: "match",
          entityId: match.id,
          summary: `${profile?.full_name ?? "Qualcuno"} ha confermato la formazione (${formation}) vs ${match.opponent}`,
        }),
        notify({
          clubId: club.id,
          userIds: team.map((m) => m.user_id),
          excludeUserId: userId,
          type: "status_change",
          title: `Formazione confermata (${formation}) — vs ${match.opponent}`,
          body,
          entityType: "match",
          entityId: match.id,
        }),
      ]);
      setSaved(true);
      onReload();
    }
    setSaving(false);
  }

  if (players.length === 0) {
    return (
      <section className="rounded-xl border border-line/70 bg-surface p-4">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wide text-muted">
          <Users className="h-3.5 w-3.5" /> Formazione
        </h3>
        <EmptyState
          className="py-6"
          title="Nessun giocatore in rosa"
          description="Aggiungi i giocatori alla rosa per comporre la formazione."
        />
      </section>
    );
  }

  const availableForPicker = roster.filter((p) => !placed.has(p.id));

  return (
    <section className="rounded-xl border border-line/70 bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wide text-muted">
          <Users className="h-3.5 w-3.5" /> Formazione
        </h3>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-[11.5px] font-medium tabular-nums",
              xiCount === 11 ? "text-ok" : "text-muted"
            )}
          >
            {xiCount}/11 titolari · {bench.filter((id) => !placed.has(id)).length} in panchina
          </span>
          <Select
            value={formation}
            onChange={(e) => changeFormation(e.target.value)}
            disabled={!canManage}
            className="h-8 w-auto text-[13px]"
            aria-label="Modulo"
          >
            {FORMATION_KEYS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </Select>
        </div>
      </div>

      {canManage && (
        <p className="mt-2 text-[11.5px] text-muted">
          Trascina un giocatore sul campo oppure tocca uno slot per sceglierlo dalla lista.
          Tocca uno slot pieno per liberarlo.
        </p>
      )}

      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        {/* CAMPO */}
        <div className="relative mx-auto w-full max-w-105 select-none overflow-hidden rounded-2xl border border-line/70 bg-gradient-to-b from-green-600 to-green-700 aspect-[2/3]">
          {/* linee campo */}
          <div className="pointer-events-none absolute inset-2 rounded-lg border-2 border-white/40" />
          <div className="pointer-events-none absolute inset-x-2 top-1/2 h-0.5 -translate-y-1/2 bg-white/40" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[22%] w-auto aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/40" />
          <div className="pointer-events-none absolute bottom-2 left-1/2 h-[13%] w-[46%] -translate-x-1/2 border-2 border-b-0 border-white/40" />
          <div className="pointer-events-none absolute top-2 left-1/2 h-[13%] w-[46%] -translate-x-1/2 border-2 border-t-0 border-white/40" />

          {coords.map((c, idx) => {
            const player = slots[idx] ? byId.get(slots[idx]!) : undefined;
            return (
              <div
                key={idx}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${c.x}%`, top: `${c.y}%` }}
                onDragOver={
                  canManage
                    ? (e) => {
                        e.preventDefault();
                        setDragOverSlot(idx);
                      }
                    : undefined
                }
                onDragLeave={canManage ? () => setDragOverSlot(null) : undefined}
                onDrop={
                  canManage
                    ? (e) => {
                        e.preventDefault();
                        setDragOverSlot(null);
                        const id = e.dataTransfer.getData("text/plain");
                        if (id && byId.has(id)) placePlayer(idx, id);
                      }
                    : undefined
                }
              >
                {player ? (
                  <button
                    type="button"
                    onClick={() => clearSlot(idx)}
                    disabled={!canManage}
                    title={canManage ? `${playerName(player)} — tocca per rimuovere` : playerName(player)}
                    className={cn(
                      "flex w-16 flex-col items-center gap-0.5 sm:w-20",
                      canManage ? "cursor-pointer" : "cursor-default"
                    )}
                  >
                    <span className="relative">
                      <PlayerFace player={player} />
                      {player.shirt_number != null && (
                        <span className="absolute -bottom-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-white px-0.5 text-[9px] font-bold text-brand shadow">
                          {player.shirt_number}
                        </span>
                      )}
                    </span>
                    <span className="max-w-full truncate text-[10px] font-semibold text-white sm:text-[11px] [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
                      {player.last_name}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={canManage ? () => setPickerSlot(idx) : undefined}
                    disabled={!canManage}
                    aria-label="Slot vuoto"
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full border-2 border-dashed text-lg font-medium transition-colors sm:h-11 sm:w-11",
                      dragOverSlot === idx
                        ? "border-white bg-white/25 text-white"
                        : "border-white/40 text-white/60",
                      canManage ? "cursor-pointer hover:border-white/80 hover:text-white" : "cursor-default"
                    )}
                  >
                    +
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* ROSA DISPONIBILE */}
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Rosa disponibile
          </p>
          <ul className="mt-2 max-h-105 space-y-1 overflow-y-auto pr-1">
            {roster.map((p) => {
              const isPlaced = placed.has(p.id);
              return (
                <li
                  key={p.id}
                  draggable={canManage && !isPlaced}
                  onDragStart={
                    canManage && !isPlaced
                      ? (e) => e.dataTransfer.setData("text/plain", p.id)
                      : undefined
                  }
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg border border-line/70 bg-background px-2.5 py-1.5 transition-opacity",
                    isPlaced
                      ? "opacity-40"
                      : canManage
                      ? "cursor-grab active:cursor-grabbing hover:border-brand/30"
                      : ""
                  )}
                >
                  <PlayerFace player={p} size="sm" />
                  <span className="w-6 shrink-0 text-right text-[12px] font-semibold tabular-nums text-muted">
                    {p.shirt_number ?? "—"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                    {p.last_name}
                  </span>
                  <Badge className="bg-background text-muted border border-line">
                    {POSITION_LABEL[p.position].short}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* PANCHINA */}
      <div className="mt-4 border-t border-line/70 pt-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Panchina</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {roster.filter((p) => !placed.has(p.id)).length === 0 ? (
            <p className="text-[11.5px] text-muted">Tutta la rosa è in campo.</p>
          ) : (
            roster
              .filter((p) => !placed.has(p.id))
              .map((p) => {
                const inBench = bench.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleBench(p.id)}
                    disabled={!canManage}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                      canManage ? "cursor-pointer" : "cursor-default",
                      inBench
                        ? "border-info/40 bg-info-soft text-info"
                        : "border-line text-muted hover:text-foreground"
                    )}
                  >
                    {p.shirt_number != null && <span className="mr-1 opacity-60">{p.shirt_number}</span>}
                    {p.last_name}
                    {inBench && <span className="ml-1">· SUB</span>}
                  </button>
                );
              })
          )}
        </div>
      </div>

      {canManage && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            size="lg"
            onClick={confirmLineup}
            loading={saving}
            disabled={xiCount === 0}
          >
            ✅ Conferma formazione
          </Button>
          {saved && (
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-ok">
              <CheckCircle2 className="h-3.5 w-3.5" /> Formazione salvata: il team ha ricevuto la notifica.
            </span>
          )}
          {xiCount > 0 && xiCount < 11 && (
            <span className="text-[11.5px] text-muted">
              Mancano {11 - xiCount} titolari all&apos;XI completo.
            </span>
          )}
        </div>
      )}

      {/* SCELTA RAPIDA (mobile / senza drag) */}
      <Dialog
        open={pickerSlot != null}
        onClose={() => setPickerSlot(null)}
        title="Scegli il giocatore per lo slot"
      >
        {availableForPicker.length === 0 ? (
          <EmptyState className="py-6" title="Tutti i giocatori sono già in campo" />
        ) : (
          <ul className="space-y-1">
            {availableForPicker.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (pickerSlot != null) placePlayer(pickerSlot, p.id);
                    setPickerSlot(null);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg border border-line/70 px-2.5 py-2 text-left transition-colors hover:border-brand/30 cursor-pointer"
                >
                  <PlayerFace player={p} size="sm" />
                  <span className="w-6 shrink-0 text-right text-[12px] font-semibold tabular-nums text-muted">
                    {p.shirt_number ?? "—"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                    {playerName(p)}
                  </span>
                  <Badge className="bg-background text-muted border border-line">
                    {POSITION_LABEL[p.position].short}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Dialog>
    </section>
  );
}

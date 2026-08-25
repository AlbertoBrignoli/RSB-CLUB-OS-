"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Play, Radio, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useClub } from "@/lib/club-context";
import { logActivity, notify } from "@/lib/activity";
import type { Match, MatchEvent, Player } from "@/lib/types";
import { MATCH_EVENT_LABEL, MATCH_STATUS, cn, playerName } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";

// Azioni rapide della diretta: ognuna apre un mini-form inline prima di scrivere.
type QuickAction =
  | "goal"
  | "opp_goal"
  | "yellow_card"
  | "red_card"
  | "penalty_scored"
  | "penalty_missed"
  | "penalty_saved";

const QUICK_ACTIONS: {
  key: QuickAction;
  label: string;
  className: string;
  playerLabel: string | null; // null = nessun giocatore richiesto
  hasAssist?: boolean;
}[] = [
  { key: "goal",           label: "⚽ Gol RSB",        className: "bg-ok text-white hover:bg-ok/90 border-0", playerLabel: "Marcatore (opzionale)", hasAssist: true },
  { key: "opp_goal",       label: "Gol avversario",    className: "bg-danger-soft text-danger hover:bg-danger/20 border-0", playerLabel: null },
  { key: "yellow_card",    label: "🟨 Ammonizione",    className: "bg-warn-soft text-warn hover:bg-warn/20 border-0", playerLabel: "Giocatore" },
  { key: "red_card",       label: "🟥 Espulsione",     className: "bg-danger-soft text-danger hover:bg-danger/20 border-0", playerLabel: "Giocatore" },
  { key: "penalty_scored", label: "Rigore segnato",    className: "bg-ok-soft text-ok hover:bg-ok/20 border-0", playerLabel: "Rigorista (opzionale)" },
  { key: "penalty_missed", label: "Rigore sbagliato",  className: "bg-background text-muted hover:text-foreground border border-line", playerLabel: "Rigorista (opzionale)" },
  { key: "penalty_saved",  label: "🧤 Rigore parato",  className: "bg-info-soft text-info hover:bg-info/20 border-0", playerLabel: "Portiere" },
];

function LogoChip({ src, alt }: { src: string | null; alt: string }) {
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white p-2 shadow-sm sm:h-20 sm:w-20">
      {src ? (
        <Image
          src={src}
          alt={alt}
          width={64}
          height={64}
          unoptimized
          className="h-full w-full object-contain"
        />
      ) : (
        <span className="text-lg font-bold text-brand">
          {alt.slice(0, 3).toUpperCase()}
        </span>
      )}
    </div>
  );
}

export function LivePanel({
  match,
  players,
  events,
  onReload,
}: {
  match: Match;
  players: Player[];
  events: MatchEvent[];
  onReload: () => void;
}) {
  const { club, userId, profile, can, team } = useClub();
  const canManage = can("matches.manage");
  const isLive = match.status === "live";

  const short = club?.short_name ?? "RSB";
  const ourScore = match.our_score ?? 0;
  const oppScore = match.opponent_score ?? 0;

  // Auto-refresh del tabellone durante la diretta (anche in sola lettura).
  useEffect(() => {
    if (!isLive) return;
    const t = setInterval(onReload, 15000);
    return () => clearInterval(t);
  }, [isLive, onReload]);

  // ---------- mini-form inline ----------
  const [pending, setPending] = useState<QuickAction | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [assistId, setAssistId] = useState("");
  const [minute, setMinute] = useState("");
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [closing, setClosing] = useState<"ht" | "ft" | null>(null);

  function openAction(key: QuickAction) {
    setPending(key);
    setPlayerId("");
    setAssistId("");
    setMinute("");
  }

  async function notifyTeam(title: string, body?: string) {
    if (!club || !userId) return;
    await notify({
      clubId: club.id,
      userIds: team.map((m) => m.user_id),
      excludeUserId: userId,
      type: "status_change",
      title,
      body,
      entityType: "match",
      entityId: match.id,
    });
  }

  async function startLive() {
    if (!club || !userId || !canManage) return;
    setStarting(true);
    const { error } = await supabase()
      .from("matches")
      .update({
        status: "live",
        our_score: match.our_score ?? 0,
        opponent_score: match.opponent_score ?? 0,
      })
      .eq("id", match.id);
    if (!error) {
      await Promise.all([
        logActivity({
          clubId: club.id,
          actorId: userId,
          action: "status_changed",
          entityType: "match",
          entityId: match.id,
          summary: `${profile?.full_name ?? "Qualcuno"} ha avviato la diretta di ${short} vs ${match.opponent}`,
        }),
        notifyTeam(`🔴 LIVE — ${short} vs ${match.opponent} è iniziata`),
      ]);
      onReload();
    }
    setStarting(false);
  }

  async function confirmAction() {
    if (!club || !userId || !canManage || !pending) return;
    setSaving(true);
    const sb = supabase();
    const min = minute ? parseInt(minute, 10) : null;
    const player = players.find((p) => p.id === playerId) ?? null;
    const who = player ? player.last_name : null;
    const at = min != null ? ` ${min}'` : "";
    let ok = true;

    if (pending === "goal" || pending === "penalty_scored") {
      const newOur = ourScore + 1;
      const [scoreRes, eventRes] = await Promise.all([
        sb.from("matches").update({ our_score: newOur }).eq("id", match.id),
        sb.from("match_events").insert({
          match_id: match.id,
          club_id: club.id,
          type: pending === "goal" ? "goal" : "penalty_scored",
          player_id: playerId || null,
          minute: min,
        }),
      ]);
      ok = !scoreRes.error && !eventRes.error;
      if (ok && pending === "goal" && assistId) {
        await sb.from("match_events").insert({
          match_id: match.id,
          club_id: club.id,
          type: "assist",
          player_id: assistId,
          minute: min,
        });
      }
      if (ok) {
        const prefix = pending === "goal" ? "⚽ GOL!" : "⚽ Rigore segnato!";
        const title = `${prefix} ${short} ${newOur}-${oppScore} ${match.opponent}${who ? ` — ${who}${at}` : ""}`;
        await Promise.all([
          logActivity({
            clubId: club.id,
            actorId: userId,
            action: "updated",
            entityType: "match",
            entityId: match.id,
            summary: title,
          }),
          notifyTeam(title),
        ]);
      }
    } else if (pending === "opp_goal") {
      const newOpp = oppScore + 1;
      const { error } = await sb
        .from("matches")
        .update({ opponent_score: newOpp })
        .eq("id", match.id);
      ok = !error;
      if (ok) {
        const title = `Gol ${match.opponent}: ${short} ${ourScore}-${newOpp}`;
        await Promise.all([
          logActivity({
            clubId: club.id,
            actorId: userId,
            action: "updated",
            entityType: "match",
            entityId: match.id,
            summary: title,
          }),
          notifyTeam(title),
        ]);
      }
    } else {
      // yellow_card | red_card | penalty_missed | penalty_saved
      const { error } = await sb.from("match_events").insert({
        match_id: match.id,
        club_id: club.id,
        type: pending,
        player_id: playerId || null,
        minute: min,
      });
      ok = !error;
      if (ok) {
        const titles: Record<string, string> = {
          yellow_card: `🟨 Ammonizione ${short}${who ? ` — ${who}${at}` : at}`,
          red_card: `🟥 Espulsione ${short}${who ? ` — ${who}${at}` : at}`,
          penalty_missed: `Rigore sbagliato ${short}${who ? ` — ${who}${at}` : at} · ${short} ${ourScore}-${oppScore} ${match.opponent}`,
          penalty_saved: `🧤 Rigore parato${who ? ` da ${who}` : ""}${at} · ${short} ${ourScore}-${oppScore} ${match.opponent}`,
        };
        const title = titles[pending];
        await Promise.all([
          logActivity({
            clubId: club.id,
            actorId: userId,
            action: "updated",
            entityType: "match",
            entityId: match.id,
            summary: title,
          }),
          notifyTeam(title),
        ]);
      }
    }

    if (ok) {
      setPending(null);
      onReload();
    }
    setSaving(false);
  }

  async function endFirstHalf() {
    if (!club || !userId || !canManage) return;
    setClosing("ht");
    const { error } = await supabase()
      .from("matches")
      .update({ ht_our_score: ourScore, ht_opponent_score: oppScore })
      .eq("id", match.id);
    if (!error) {
      const title = `Fine primo tempo: ${short} ${ourScore}-${oppScore} ${match.opponent}`;
      await Promise.all([
        logActivity({
          clubId: club.id,
          actorId: userId,
          action: "updated",
          entityType: "match",
          entityId: match.id,
          summary: title,
        }),
        notifyTeam(title),
      ]);
      onReload();
    }
    setClosing(null);
  }

  async function endMatch() {
    if (!club || !userId || !canManage) return;
    setClosing("ft");
    const { error } = await supabase()
      .from("matches")
      .update({ status: "finished" })
      .eq("id", match.id);
    if (!error) {
      const title = `Finale: ${short} ${ourScore}-${oppScore} ${match.opponent}`;
      await Promise.all([
        logActivity({
          clubId: club.id,
          actorId: userId,
          action: "status_changed",
          entityType: "match",
          entityId: match.id,
          summary: title,
        }),
        notifyTeam(title),
      ]);
      onReload();
    }
    setClosing(null);
  }

  async function removeEvent(e: MatchEvent) {
    if (!club || !canManage) return;
    const sb = supabase();
    const { error } = await sb.from("match_events").delete().eq("id", e.id);
    if (!error && (e.type === "goal" || e.type === "penalty_scored")) {
      // Il gol eliminato era nostro: il punteggio torna indietro di 1.
      await sb
        .from("matches")
        .update({ our_score: Math.max(0, ourScore - 1) })
        .eq("id", match.id);
    }
    onReload();
  }

  // ---------- stato non live ----------
  if (!isLive) {
    return (
      <div className="rounded-card border border-line/80 bg-surface">
        <EmptyState
          icon={<Radio />}
          title={
            match.status === "finished"
              ? `Partita terminata · ${short} ${ourScore}-${oppScore} ${match.opponent}`
              : "La diretta non è ancora iniziata"
          }
          description={
            canManage
              ? "Avvia la diretta per aggiornare il punteggio dal campo: tutto il team riceve una notifica a ogni evento."
              : `Stato attuale: ${MATCH_STATUS[match.status].label}. Quando la partita è live il tabellone si aggiorna qui in automatico.`
          }
          action={
            canManage ? (
              <Button variant="primary" size="lg" onClick={startLive} loading={starting}>
                <Play className="h-4 w-4" /> Inizia diretta
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  const pendingDef = pending ? QUICK_ACTIONS.find((a) => a.key === pending) : null;
  const gks = players.filter((p) => p.position === "GK");
  // Per il rigore parato proponiamo solo i portieri (tutta la rosa se non ce ne sono).
  const pickable = pending === "penalty_saved" && gks.length > 0 ? gks : players;

  return (
    <div className="space-y-4">
      {/* TABELLONE */}
      <div className="overflow-hidden rounded-card border border-line/80 bg-gradient-to-br from-brand to-brand-strong p-6 text-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-white/80">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
          </span>
          Live
          {!canManage && <span className="font-medium normal-case tracking-normal text-white/60">· sola lettura, si aggiorna da solo</span>}
        </div>

        <div className="mt-5 flex items-center justify-center gap-4 sm:gap-8">
          <div className="flex w-24 flex-col items-center gap-2 sm:w-32">
            <LogoChip src={club?.logo_url ?? null} alt={short} />
            <p className="text-center text-[12px] font-semibold leading-tight">{short}</p>
          </div>
          <p className="text-6xl font-bold tabular-nums sm:text-7xl">
            {ourScore}
            <span className="mx-2 text-white/50 sm:mx-3">-</span>
            {oppScore}
          </p>
          <div className="flex w-24 flex-col items-center gap-2 sm:w-32">
            <LogoChip src={match.opponent_logo_url} alt={match.opponent} />
            <p className="text-center text-[12px] font-semibold leading-tight">{match.opponent}</p>
          </div>
        </div>

        {match.ht_our_score != null && match.ht_opponent_score != null && (
          <p className="mt-4 text-center text-[12px] font-medium text-white/70">
            1° tempo: {match.ht_our_score}-{match.ht_opponent_score}
          </p>
        )}
      </div>

      {/* AZIONI RAPIDE */}
      {canManage && (
        <section className="rounded-card border border-line/80 bg-surface p-4">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
            Azioni rapide
          </h3>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {QUICK_ACTIONS.map((a) => (
              <Button
                key={a.key}
                className={cn("h-14 rounded-xl text-[14px] font-semibold shadow-sm", a.className)}
                onClick={() => openAction(a.key)}
              >
                {a.label}
              </Button>
            ))}
          </div>

          {pendingDef && (
            <div className="mt-3 rounded-xl border border-brand/30 bg-brand-soft/40 p-3">
              <p className="text-[13px] font-semibold">{pendingDef.label}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_6rem_auto_auto]">
                {pendingDef.playerLabel ? (
                  <Field label={pendingDef.playerLabel}>
                    <Select value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
                      <option value="">—</option>
                      {pickable.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.shirt_number != null ? `${p.shirt_number} · ` : ""}{playerName(p)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : (
                  <div className="hidden sm:block" />
                )}
                {pendingDef.hasAssist ? (
                  <Field label="Assist (opzionale)">
                    <Select value={assistId} onChange={(e) => setAssistId(e.target.value)}>
                      <option value="">—</option>
                      {players
                        .filter((p) => p.id !== playerId)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.shirt_number != null ? `${p.shirt_number} · ` : ""}{playerName(p)}
                          </option>
                        ))}
                    </Select>
                  </Field>
                ) : (
                  <div className="hidden sm:block" />
                )}
                <Field label="Minuto">
                  <Input
                    type="number"
                    min={0}
                    max={130}
                    inputMode="numeric"
                    placeholder="—"
                    value={minute}
                    onChange={(e) => setMinute(e.target.value)}
                  />
                </Field>
                <Button
                  variant="primary"
                  className="h-9 self-end"
                  onClick={confirmAction}
                  loading={saving}
                >
                  Conferma
                </Button>
                <Button className="h-9 self-end" onClick={() => setPending(null)}>
                  Annulla
                </Button>
              </div>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line/70 pt-4">
            <Button
              className="h-12 rounded-xl text-[14px] font-semibold"
              onClick={endFirstHalf}
              loading={closing === "ht"}
              disabled={closing != null}
            >
              ⏸ Fine 1° tempo
            </Button>
            <Button
              className="h-12 rounded-xl border-0 bg-foreground text-background text-[14px] font-semibold hover:bg-foreground/85"
              onClick={endMatch}
              loading={closing === "ft"}
              disabled={closing != null}
            >
              🏁 Fine partita
            </Button>
          </div>
        </section>
      )}

      {/* CRONOLOGIA */}
      <section className="rounded-card border border-line/80 bg-surface p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
            Cronologia live
          </h3>
          <Badge className="bg-danger-soft text-danger">{events.length} eventi</Badge>
        </div>
        {events.length === 0 ? (
          <EmptyState
            className="py-6"
            title="Nessun evento registrato"
            description="Gli eventi della diretta compaiono qui in tempo reale."
          />
        ) : (
          <ul className="mt-2 divide-y divide-line/70">
            {events.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2">
                <span className="w-10 shrink-0 text-right text-[12.5px] font-semibold tabular-nums text-muted">
                  {e.minute != null ? `${e.minute}'` : "—"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px]">
                    <span className="font-medium">{MATCH_EVENT_LABEL[e.type]}</span>
                    {e.player && <span> · {playerName(e.player)}</span>}
                  </p>
                  {e.note && <p className="text-[11px] text-muted">{e.note}</p>}
                </div>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeEvent(e)}
                    aria-label="Elimina evento"
                    title="Elimina (corregge anche il punteggio se è un gol)"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

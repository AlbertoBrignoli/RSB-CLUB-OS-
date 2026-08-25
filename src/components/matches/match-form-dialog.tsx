"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase/client";
import { useClub } from "@/lib/club-context";
import { logActivity, notify } from "@/lib/activity";
import type { Competition, Match, Season } from "@/lib/types";
import { fmtDateTime } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";

// Form unico per creazione e modifica partita.
// In creazione: insert + logActivity + notifica "upcoming_match" a tutto il team.
export function MatchFormDialog({
  open,
  onClose,
  match,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  match?: Match | null; // presente = modifica
  onSaved: (id: string) => void;
}) {
  const { club, season, userId, profile, team } = useClub();
  const editing = !!match;

  const [opponent, setOpponent] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("15:00");
  const [venue, setVenue] = useState("");
  const [isHome, setIsHome] = useState(true);
  const [competitionId, setCompetitionId] = useState("");
  const [matchday, setMatchday] = useState("");
  const [seasonId, setSeasonId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);

  // Lookup di club: competizioni + stagioni.
  useEffect(() => {
    if (!open || !club) return;
    (async () => {
      const sb = supabase();
      const [compRes, seasRes] = await Promise.all([
        sb.from("competitions").select("*").eq("club_id", club.id).order("name"),
        sb.from("seasons").select("*").eq("club_id", club.id).order("start_date", { ascending: false }),
      ]);
      setCompetitions((compRes.data as Competition[]) ?? []);
      setSeasons((seasRes.data as Season[]) ?? []);
    })();
  }, [open, club]);

  // Prefill (modifica) / reset (creazione) a ogni apertura.
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (match) {
      const d = new Date(match.kickoff_at);
      setOpponent(match.opponent);
      setDate(format(d, "yyyy-MM-dd"));
      setTime(format(d, "HH:mm"));
      setVenue(match.venue ?? "");
      setIsHome(match.is_home);
      setCompetitionId(match.competition_id ?? "");
      setMatchday(match.matchday ?? "");
      setSeasonId(match.season_id ?? "");
      setNotes(match.notes ?? "");
    } else {
      setOpponent("");
      setDate("");
      setTime("15:00");
      setVenue("");
      setIsHome(true);
      setCompetitionId("");
      setMatchday("");
      setSeasonId(season?.id ?? "");
      setNotes("");
    }
  }, [open, match, season]);

  async function save() {
    if (!club || !userId) return;
    if (!opponent.trim() || !date || !time) {
      setError("Avversario, data e ora sono obbligatori.");
      return;
    }
    setSaving(true);
    setError(null);
    const sb = supabase();
    const kickoffAt = new Date(`${date}T${time}`).toISOString();
    const payload = {
      opponent: opponent.trim(),
      kickoff_at: kickoffAt,
      venue: venue.trim() || null,
      is_home: isHome,
      competition_id: competitionId || null,
      matchday: matchday.trim() || null,
      season_id: seasonId || null,
      notes: notes.trim() || null,
    };

    if (editing && match) {
      const { error: err } = await sb.from("matches").update(payload).eq("id", match.id);
      if (err) {
        setError(err.message);
        setSaving(false);
        return;
      }
      await logActivity({
        clubId: club.id,
        actorId: userId,
        action: "updated",
        entityType: "match",
        entityId: match.id,
        summary: `${profile?.full_name ?? "Qualcuno"} ha aggiornato la partita vs ${payload.opponent}`,
      });
      setSaving(false);
      onSaved(match.id);
      onClose();
      return;
    }

    const { data, error: err } = await sb
      .from("matches")
      .insert({ club_id: club.id, ...payload })
      .select("id")
      .single();
    if (err || !data) {
      setError(err?.message ?? "Errore nel salvataggio.");
      setSaving(false);
      return;
    }
    await Promise.all([
      logActivity({
        clubId: club.id,
        actorId: userId,
        action: "created",
        entityType: "match",
        entityId: data.id,
        summary: `${profile?.full_name ?? "Qualcuno"} ha aggiunto la partita vs ${payload.opponent} (${fmtDateTime(kickoffAt)})`,
      }),
      notify({
        clubId: club.id,
        userIds: team.map((m) => m.user_id),
        excludeUserId: userId,
        type: "upcoming_match",
        title: `Nuova partita: vs ${payload.opponent} il ${fmtDateTime(kickoffAt)}`,
        entityType: "match",
        entityId: data.id,
      }),
    ]);
    setSaving(false);
    onSaved(data.id);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? "Modifica partita" : "Aggiungi partita"}
      footer={
        <>
          <Button onClick={onClose}>Annulla</Button>
          <Button variant="primary" onClick={save} loading={saving}>
            {editing ? "Salva modifiche" : "Aggiungi partita"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Avversario" required>
          <Input
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            placeholder="Es. Tivoli Calcio"
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Data" required>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Ora" required>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Casa / Trasferta">
            <Select value={isHome ? "home" : "away"} onChange={(e) => setIsHome(e.target.value === "home")}>
              <option value="home">Casa</option>
              <option value="away">Trasferta</option>
            </Select>
          </Field>
          <Field label="Stadio">
            <Input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Es. Campo Comunale" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Competizione">
            <Select value={competitionId} onChange={(e) => setCompetitionId(e.target.value)}>
              <option value="">—</option>
              {competitions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Giornata">
            <Input value={matchday} onChange={(e) => setMatchday(e.target.value)} placeholder="Es. 12ª" />
          </Field>
        </div>

        <Field label="Stagione">
          <Select value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
            <option value="">—</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.is_current ? " (corrente)" : ""}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Note">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Note interne sulla partita…" />
        </Field>

        {error && <p className="text-[12.5px] text-danger">{error}</p>}
      </div>
    </Dialog>
  );
}

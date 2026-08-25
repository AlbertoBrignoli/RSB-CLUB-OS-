"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useClub } from "@/lib/club-context";
import { logActivity, notify } from "@/lib/activity";
import type { Match, Player, PriorityLevel } from "@/lib/types";
import { matchLabel, playerName, cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/misc";

export interface ContentOption {
  id: string;
  title: string;
}

export function TaskForm({
  open,
  onClose,
  onSaved,
  players,
  matches,
  contents,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  players: Player[];
  matches: Match[];
  contents: ContentOption[];
}) {
  const { club, userId, profile, team } = useClub();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState<PriorityLevel>("medium");
  const [playerId, setPlayerId] = useState("");
  const [matchId, setMatchId] = useState("");
  const [contentId, setContentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleAssignee(id: string) {
    setAssignees((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
  }

  function reset() {
    setTitle("");
    setDescription("");
    setOwnerId("");
    setAssignees([]);
    setDeadline("");
    setPriority("medium");
    setPlayerId("");
    setMatchId("");
    setContentId("");
    setError(null);
  }

  async function save() {
    if (!title.trim() || !club || !userId) return;
    setSaving(true);
    setError(null);
    const sb = supabase();

    const { data: task, error: insErr } = await sb
      .from("tasks")
      .insert({
        club_id: club.id,
        title: title.trim(),
        description: description.trim() || null,
        owner_id: ownerId || null,
        deadline: deadline || null,
        priority,
        status: "todo",
        player_id: playerId || null,
        match_id: matchId || null,
        content_id: contentId || null,
        created_by: userId,
      })
      .select("id")
      .single();

    if (insErr || !task) {
      setError(insErr?.message ?? "Errore durante la creazione del task.");
      setSaving(false);
      return;
    }

    const collaborators = assignees.filter((a) => a !== ownerId);
    if (collaborators.length > 0) {
      await sb
        .from("task_assignees")
        .insert(collaborators.map((user_id) => ({ task_id: task.id, user_id })));
    }

    await Promise.all([
      logActivity({
        clubId: club.id,
        actorId: userId,
        action: "created",
        entityType: "task",
        entityId: task.id,
        summary: `${profile?.full_name ?? "Qualcuno"} ha creato il task "${title.trim()}"`,
      }),
      notify({
        clubId: club.id,
        userIds: [ownerId, ...collaborators].filter(Boolean),
        excludeUserId: userId,
        type: "task_assigned",
        title: `Ti è stato assegnato: ${title.trim()}`,
        body: deadline ? `Scadenza: ${deadline}` : undefined,
        entityType: "task",
        entityId: task.id,
      }),
    ]);

    setSaving(false);
    reset();
    onSaved();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nuovo task"
      footer={
        <>
          <Button onClick={onClose}>Annulla</Button>
          <Button variant="primary" loading={saving} disabled={!title.trim()} onClick={save}>
            Crea task
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Titolo" required>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Es. Preparare caption Match Day"
            autoFocus
          />
        </Field>

        <Field label="Descrizione">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Dettagli, riferimenti, note…"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Owner">
            <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">— Nessuno —</option>
              {team.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.profile?.full_name ?? "—"}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priorità">
            <Select value={priority} onChange={(e) => setPriority(e.target.value as PriorityLevel)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
          </Field>
        </div>

        <Field label="Collaboratori" hint="Riceveranno una notifica di assegnazione.">
          <div className="flex flex-wrap gap-1.5">
            {team.map((m) => {
              const active = assignees.includes(m.user_id);
              return (
                <button
                  key={m.user_id}
                  type="button"
                  onClick={() => toggleAssignee(m.user_id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[12px] font-medium transition-colors cursor-pointer",
                    active
                      ? "border-brand/40 bg-brand-soft text-brand"
                      : "border-line text-muted hover:text-foreground"
                  )}
                >
                  <Avatar name={m.profile?.full_name} src={m.profile?.avatar_url} size={16} />
                  {m.profile?.full_name ?? "—"}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Deadline">
          <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Giocatore">
            <Select value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
              <option value="">—</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {playerName(p)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Partita">
            <Select value={matchId} onChange={(e) => setMatchId(e.target.value)}>
              <option value="">—</option>
              {matches.map((m) => (
                <option key={m.id} value={m.id}>
                  {matchLabel(m, club?.short_name ?? "RSB")}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Contenuto">
            <Select value={contentId} onChange={(e) => setContentId(e.target.value)}>
              <option value="">—</option>
              {contents.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {error && <p className="text-[12px] text-danger">{error}</p>}
      </div>
    </Dialog>
  );
}

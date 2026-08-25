"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useClub } from "@/lib/club-context";
import { logActivity, notify } from "@/lib/activity";
import type { Match, Player, PriorityLevel, Task, TaskStatus } from "@/lib/types";
import { TASK_STATUS, cn, matchLabel, playerName, timeAgo } from "@/lib/utils";
import { Drawer } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/misc";
import { CommentsSection } from "@/components/shared/comments-section";
import type { ContentOption } from "./task-form";

const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "review", "done", "blocked"];

export function TaskDrawer({
  task,
  onClose,
  onChanged,
  players,
  matches,
  contents,
}: {
  task: Task | null;
  onClose: () => void;
  onChanged: () => void;
  players: Player[];
  matches: Match[];
  contents: ContentOption[];
}) {
  const { club, userId, profile, team, can } = useClub();
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

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setOwnerId(task.owner_id ?? "");
    setAssignees((task.task_assignees ?? []).map((a) => a.user_id));
    setDeadline(task.deadline ?? "");
    setPriority(task.priority);
    setPlayerId(task.player_id ?? "");
    setMatchId(task.match_id ?? "");
    setContentId(task.content_id ?? "");
  }, [task]);

  const canEdit = useMemo(() => {
    if (!task || !userId) return false;
    return (
      can("tasks.manage") ||
      task.owner_id === userId ||
      (task.task_assignees ?? []).some((a) => a.user_id === userId)
    );
  }, [task, userId, can]);

  if (!task) return null;

  async function setStatus(status: TaskStatus) {
    if (!task || !club || !userId || status === task.status) return;
    const { error } = await supabase().from("tasks").update({ status }).eq("id", task.id);
    if (!error) {
      await logActivity({
        clubId: club.id,
        actorId: userId,
        action: "status_changed",
        entityType: "task",
        entityId: task.id,
        summary: `${profile?.full_name ?? "Qualcuno"} ha spostato "${task.title}" in ${TASK_STATUS[status].label}`,
      });
      onChanged();
    }
  }

  async function save() {
    if (!task || !club || !userId) return;
    setSaving(true);
    const sb = supabase();

    const { error } = await sb
      .from("tasks")
      .update({
        title: title.trim() || task.title,
        description: description.trim() || null,
        owner_id: ownerId || null,
        deadline: deadline || null,
        priority,
        player_id: playerId || null,
        match_id: matchId || null,
        content_id: contentId || null,
      })
      .eq("id", task.id);

    if (error) {
      setSaving(false);
      return;
    }

    // Sincronizza i collaboratori (task_assignees).
    const before = new Set((task.task_assignees ?? []).map((a) => a.user_id));
    const after = new Set(assignees);
    const added = [...after].filter((id) => !before.has(id));
    const removed = [...before].filter((id) => !after.has(id));
    if (removed.length > 0) {
      await sb.from("task_assignees").delete().eq("task_id", task.id).in("user_id", removed);
    }
    if (added.length > 0) {
      await sb
        .from("task_assignees")
        .insert(added.map((user_id) => ({ task_id: task.id, user_id })));
    }

    const newlyAssigned = [...added];
    if (ownerId && ownerId !== (task.owner_id ?? "")) newlyAssigned.push(ownerId);

    await Promise.all([
      logActivity({
        clubId: club.id,
        actorId: userId,
        action: "updated",
        entityType: "task",
        entityId: task.id,
        summary: `${profile?.full_name ?? "Qualcuno"} ha aggiornato il task "${title.trim() || task.title}"`,
      }),
      newlyAssigned.length > 0
        ? notify({
            clubId: club.id,
            userIds: newlyAssigned,
            excludeUserId: userId,
            type: "task_assigned",
            title: `Ti è stato assegnato: ${title.trim() || task.title}`,
            entityType: "task",
            entityId: task.id,
          })
        : Promise.resolve(),
    ]);

    setSaving(false);
    onChanged();
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={task.title}
      footer={
        canEdit ? (
          <Button variant="primary" loading={saving} onClick={save}>
            Salva modifiche
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-5">
        {/* Cambio stato rapido */}
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Stato</p>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                disabled={!canEdit}
                onClick={() => setStatus(s)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors cursor-pointer disabled:cursor-default disabled:opacity-60",
                  task.status === s
                    ? TASK_STATUS[s].className + " ring-1 ring-current"
                    : "border border-line text-muted hover:text-foreground"
                )}
              >
                {TASK_STATUS[s].label}
              </button>
            ))}
          </div>
        </div>

        {canEdit ? (
          <div className="space-y-4">
            <Field label="Titolo" required>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="Descrizione">
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
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
                <Select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </Select>
              </Field>
            </div>
            <Field label="Collaboratori" hint="I nuovi collaboratori ricevono una notifica.">
              <div className="flex flex-wrap gap-1.5">
                {team.map((m) => {
                  const active = assignees.includes(m.user_id);
                  return (
                    <button
                      key={m.user_id}
                      type="button"
                      onClick={() =>
                        setAssignees((prev) =>
                          prev.includes(m.user_id)
                            ? prev.filter((a) => a !== m.user_id)
                            : [...prev, m.user_id]
                        )
                      }
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
          </div>
        ) : (
          <div className="space-y-3 text-[13px]">
            {task.description && <p className="whitespace-pre-wrap">{task.description}</p>}
            <div className="flex items-center gap-2">
              <Avatar name={task.owner?.full_name} src={task.owner?.avatar_url} size={22} />
              <span>{task.owner?.full_name ?? "Senza owner"}</span>
            </div>
            {(task.task_assignees ?? []).length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-muted">Collaboratori:</span>
                {(task.task_assignees ?? []).map((a) => (
                  <span key={a.user_id} className="inline-flex items-center gap-1">
                    <Avatar name={a.profile?.full_name} src={a.profile?.avatar_url} size={18} />
                    {a.profile?.full_name ?? "—"}
                  </span>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted">Creato {timeAgo(task.created_at)}</p>
          </div>
        )}

        <div className="border-t border-line pt-4">
          <CommentsSection entityType="task" entityId={task.id} entityLabel={`"${task.title}"`} />
        </div>
      </div>
    </Drawer>
  );
}

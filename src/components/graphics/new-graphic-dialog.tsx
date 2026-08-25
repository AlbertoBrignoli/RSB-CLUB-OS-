"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useClub } from "@/lib/club-context";
import { logActivity, notify } from "@/lib/activity";
import type { Match, Player, PriorityLevel } from "@/lib/types";
import { PRIORITY, matchLabel, playerName } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";

const EMPTY = {
  title: "",
  brief: "",
  content_id: "",
  match_id: "",
  player_id: "",
  designer_id: "",
  deadline: "",
  priority: "medium" as PriorityLevel,
  reference_url: "",
};

// Dialog "+ New Request": crea una richiesta grafica (status requested, o todo se già assegnata).
export function NewGraphicDialog({
  open,
  onClose,
  onCreated,
  contents,
  matches,
  players,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
  contents: { id: string; title: string }[];
  matches: Match[];
  players: Player[];
}) {
  const { club, userId, profile, team } = useClub();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    if (!form.title.trim() || !club || !userId) return;
    setSaving(true);
    const status = form.designer_id ? "todo" : "requested";
    const { data, error } = await supabase()
      .from("graphics")
      .insert({
        club_id: club.id,
        title: form.title.trim(),
        brief: form.brief.trim() || null,
        content_id: form.content_id || null,
        match_id: form.match_id || null,
        player_id: form.player_id || null,
        designer_id: form.designer_id || null,
        deadline: form.deadline || null,
        priority: form.priority,
        reference_url: form.reference_url.trim() || null,
        requested_by: userId,
        status,
      })
      .select()
      .single();

    if (!error && data) {
      await logActivity({
        clubId: club.id,
        actorId: userId,
        action: "created",
        entityType: "graphic",
        entityId: data.id as string,
        summary: `${profile?.full_name ?? "Qualcuno"} ha richiesto la grafica «${form.title.trim()}»`,
      });
      if (form.designer_id) {
        await notify({
          clubId: club.id,
          userIds: [form.designer_id],
          excludeUserId: userId,
          type: "graphic_assigned",
          title: `Nuova grafica assegnata: ${form.title.trim()}`,
          body: form.brief.trim() || undefined,
          entityType: "graphic",
          entityId: data.id as string,
        });
      }
      setForm(EMPTY);
      await onCreated();
      onClose();
    }
    setSaving(false);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nuova richiesta grafica"
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button variant="primary" onClick={save} loading={saving} disabled={!form.title.trim()}>
            Crea richiesta
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Titolo" required>
          <Input
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Es. Match Day vs Atletico 2000"
            autoFocus
          />
        </Field>

        <Field label="Brief" hint="Cosa serve, formato, testi da inserire, indicazioni per il designer.">
          <Textarea
            value={form.brief}
            onChange={(e) => set("brief", e.target.value)}
            placeholder="Descrivi la grafica richiesta…"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contenuto collegato">
            <Select value={form.content_id} onChange={(e) => set("content_id", e.target.value)}>
              <option value="">Nessuno</option>
              {contents.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Partita">
            <Select value={form.match_id} onChange={(e) => set("match_id", e.target.value)}>
              <option value="">Nessuna</option>
              {matches.map((m) => (
                <option key={m.id} value={m.id}>
                  {matchLabel(m)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Giocatore">
            <Select value={form.player_id} onChange={(e) => set("player_id", e.target.value)}>
              <option value="">Nessuno</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {playerName(p)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Assegna a">
            <Select value={form.designer_id} onChange={(e) => set("designer_id", e.target.value)}>
              <option value="">Non assegnata</option>
              {team.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.profile?.full_name ?? "—"}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Deadline">
            <Input
              type="date"
              value={form.deadline}
              onChange={(e) => set("deadline", e.target.value)}
            />
          </Field>
          <Field label="Priorità">
            <Select
              value={form.priority}
              onChange={(e) => set("priority", e.target.value as PriorityLevel)}
            >
              {(Object.keys(PRIORITY) as PriorityLevel[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY[p].label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Reference URL" hint="Link a un esempio o a un moodboard.">
          <Input
            type="url"
            value={form.reference_url}
            onChange={(e) => set("reference_url", e.target.value)}
            placeholder="https://…"
          />
        </Field>
      </div>
    </Dialog>
  );
}

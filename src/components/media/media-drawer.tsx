"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ExternalLink, FileText, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useClub } from "@/lib/club-context";
import { logActivity } from "@/lib/activity";
import type { Match, MediaItem, Player } from "@/lib/types";
import { MEDIA_CATEGORIES, fmtDate, fmtDateTime, matchLabel, playerName } from "@/lib/utils";
import { Drawer } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/misc";

// Drawer dettaglio media: anteprima grande, meta editabile, giocatori collegati, elimina.
export function MediaDrawer({
  media,
  onClose,
  reload,
  matches,
  players,
}: {
  media: MediaItem;
  onClose: () => void;
  reload: () => Promise<void>;
  matches: Match[];
  players: Player[];
}) {
  const { club, userId, profile, can } = useClub();
  const canEdit = can("media.upload");
  const canDelete = can("media.manage");

  const [title, setTitle] = useState(media.title);
  const [category, setCategory] = useState(media.category ?? "");
  const [tags, setTags] = useState(media.tags.join(", "));
  const [notes, setNotes] = useState(media.notes ?? "");
  const [matchId, setMatchId] = useState(media.match_id ?? "");
  const [takenAt, setTakenAt] = useState(media.taken_at ?? "");
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setTitle(media.title);
    setCategory(media.category ?? "");
    setTags(media.tags.join(", "));
    setNotes(media.notes ?? "");
    setMatchId(media.match_id ?? "");
    setTakenAt(media.taken_at ?? "");
    setSelectedPlayers(new Set(media.media_players?.map((p) => p.player_id) ?? []));
  }, [media]);

  function togglePlayer(id: string) {
    setSelectedPlayers((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    if (!club || !userId || !canEdit) return;
    setSaving(true);
    const sb = supabase();
    const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
    const { error } = await sb
      .from("media")
      .update({
        title: title.trim() || media.title,
        category: category || null,
        tags: tagList,
        notes: notes.trim() || null,
        match_id: matchId || null,
        taken_at: takenAt || null,
      })
      .eq("id", media.id);

    if (!error) {
      // Sincronizza i giocatori collegati (aggiunte + rimozioni)
      const before = new Set(media.media_players?.map((p) => p.player_id) ?? []);
      const toAdd = [...selectedPlayers].filter((id) => !before.has(id));
      const toRemove = [...before].filter((id) => !selectedPlayers.has(id));
      if (toRemove.length > 0) {
        await sb.from("media_players").delete().eq("media_id", media.id).in("player_id", toRemove);
      }
      if (toAdd.length > 0) {
        await sb
          .from("media_players")
          .insert(toAdd.map((playerId) => ({ media_id: media.id, player_id: playerId })));
      }
      await logActivity({
        clubId: club.id,
        actorId: userId,
        action: "updated",
        entityType: "media",
        entityId: media.id,
        summary: `${profile?.full_name ?? "Qualcuno"} ha aggiornato il media «${title.trim() || media.title}»`,
      });
      await reload();
    }
    setSaving(false);
  }

  async function remove() {
    if (!club || !userId || !canDelete) return;
    if (!window.confirm(`Eliminare definitivamente «${media.title}»?`)) return;
    setDeleting(true);
    const sb = supabase();
    if (media.storage_path) {
      await sb.storage.from("club-media").remove([media.storage_path]);
    }
    const { error } = await sb.from("media").delete().eq("id", media.id);
    if (!error) {
      await logActivity({
        clubId: club.id,
        actorId: userId,
        action: "deleted",
        entityType: "media",
        summary: `${profile?.full_name ?? "Qualcuno"} ha eliminato il media «${media.title}»`,
      });
      await reload();
      onClose();
    }
    setDeleting(false);
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={media.title}
      footer={
        <>
          {canDelete && (
            <Button variant="danger" onClick={remove} loading={deleting} className="mr-auto">
              {!deleting && <Trash2 className="h-3.5 w-3.5" />} Elimina
            </Button>
          )}
          {canEdit && (
            <Button variant="primary" onClick={save} loading={saving}>
              Salva modifiche
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        {/* Anteprima grande */}
        {media.url && (media.kind === "photo" || media.kind === "graphic") && (
          <div className="relative aspect-video overflow-hidden rounded-xl bg-background">
            <Image
              src={media.url}
              alt={media.title}
              fill
              unoptimized
              className="object-contain"
            />
          </div>
        )}
        {media.url && media.kind === "video" && (
          <video src={media.url} controls className="w-full rounded-xl bg-black" />
        )}
        {(media.kind === "document" || !media.url) && (
          <div className="flex flex-col items-center justify-center rounded-xl bg-background py-10 text-muted/60">
            <FileText className="mb-2 h-8 w-8" />
            <p className="text-[12px]">{media.kind === "document" ? "Documento" : "Anteprima non disponibile"}</p>
          </div>
        )}

        {/* Autore + date + link */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Avatar name={media.author?.full_name} src={media.author?.avatar_url} size={20} />
            {media.author?.full_name ?? "—"}
          </span>
          <span>Caricato {fmtDateTime(media.created_at)}</span>
          {media.taken_at && <span>Scattato {fmtDate(media.taken_at)}</span>}
          {media.url && (
            <a
              href={media.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Apri file
            </a>
          )}
        </div>

        {/* Meta editabile */}
        <div className="space-y-4">
          <Field label="Titolo">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Categoria">
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={!canEdit}
              >
                <option value="">Nessuna</option>
                {MEDIA_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Partita">
              <Select
                value={matchId}
                onChange={(e) => setMatchId(e.target.value)}
                disabled={!canEdit}
              >
                <option value="">Nessuna</option>
                {matches.map((m) => (
                  <option key={m.id} value={m.id}>
                    {matchLabel(m)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tags" hint="Separati da virgola">
              <Input value={tags} onChange={(e) => setTags(e.target.value)} disabled={!canEdit} />
            </Field>
            <Field label="Data scatto">
              <Input
                type="date"
                value={takenAt}
                onChange={(e) => setTakenAt(e.target.value)}
                disabled={!canEdit}
              />
            </Field>
          </div>
          <Field label="Note">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canEdit} />
          </Field>

          <Field label="Giocatori collegati">
            <div className="grid max-h-44 grid-cols-2 gap-1 overflow-y-auto rounded-lg border border-line/70 p-2 sm:grid-cols-3">
              {players.length === 0 && (
                <p className="col-span-full py-2 text-center text-[11px] text-muted">
                  Nessun giocatore in rosa
                </p>
              )}
              {players.map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-[12px] hover:bg-background"
                >
                  <input
                    type="checkbox"
                    checked={selectedPlayers.has(p.id)}
                    onChange={() => togglePlayer(p.id)}
                    disabled={!canEdit}
                    className="accent-brand"
                  />
                  <span className="truncate">{playerName(p)}</span>
                </label>
              ))}
            </div>
          </Field>
        </div>
      </div>
    </Drawer>
  );
}

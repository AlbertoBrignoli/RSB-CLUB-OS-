"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileText, Film, ImageIcon, UploadCloud, X, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useClub } from "@/lib/club-context";
import { logActivity } from "@/lib/activity";
import { kindFromFile, uploadFile } from "@/lib/storage";
import type { Match, Player } from "@/lib/types";
import { MEDIA_CATEGORIES, cn, matchLabel, playerName } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/misc";

type QueueItem = {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
};

function fileIcon(file: File) {
  const kind = kindFromFile(file);
  if (kind === "photo") return <ImageIcon className="h-4 w-4 text-muted" />;
  if (kind === "video") return <Film className="h-4 w-4 text-muted" />;
  return <FileText className="h-4 w-4 text-muted" />;
}

// Dialog "Upload Media": drag&drop multi-file con coda + metadati comuni.
export function UploadMediaDialog({
  open,
  onClose,
  onUploaded,
  matches,
  players,
}: {
  open: boolean;
  onClose: () => void;
  onUploaded: () => Promise<void>;
  matches: Match[];
  players: Player[];
}) {
  const { club, userId, profile } = useClub();
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Metadati comuni a tutti i file della coda
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [matchId, setMatchId] = useState("");
  const [takenAt, setTakenAt] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());

  function addFiles(files: FileList | null) {
    if (!files) return;
    setQueue((q) => [
      ...q,
      ...Array.from(files).map((file) => ({ file, status: "pending" as const })),
    ]);
  }

  function togglePlayer(id: string) {
    setSelectedPlayers((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function reset() {
    setQueue([]);
    setCategory("");
    setTags("");
    setMatchId("");
    setTakenAt("");
    setSelectedPlayers(new Set());
  }

  function close() {
    if (uploading) return;
    reset();
    onClose();
  }

  async function startUpload() {
    if (!club || !userId || queue.length === 0) return;
    setUploading(true);
    const sb = supabase();
    const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
    let okCount = 0;

    for (let i = 0; i < queue.length; i++) {
      if (queue[i].status === "done") continue;
      setQueue((q) => q.map((item, j) => (j === i ? { ...item, status: "uploading" } : item)));
      try {
        const file = queue[i].file;
        const { path, url } = await uploadFile(club.id, "library", file);
        const { data: mediaRow, error } = await sb
          .from("media")
          .insert({
            club_id: club.id,
            title: file.name.replace(/\.[^.]+$/, ""),
            kind: kindFromFile(file),
            category: category || null,
            tags: tagList,
            storage_path: path,
            url,
            match_id: matchId || null,
            author_id: userId,
            taken_at: takenAt || null,
          })
          .select()
          .single();
        if (error || !mediaRow) throw error ?? new Error("insert failed");
        if (selectedPlayers.size > 0) {
          await sb.from("media_players").insert(
            [...selectedPlayers].map((playerId) => ({
              media_id: mediaRow.id as string,
              player_id: playerId,
            }))
          );
        }
        okCount++;
        setQueue((q) => q.map((item, j) => (j === i ? { ...item, status: "done" } : item)));
      } catch {
        setQueue((q) => q.map((item, j) => (j === i ? { ...item, status: "error" } : item)));
      }
    }

    if (okCount > 0) {
      await logActivity({
        clubId: club.id,
        actorId: userId,
        action: "uploaded",
        entityType: "media",
        summary: `${profile?.full_name ?? "Qualcuno"} ha caricato ${okCount} media nella libreria`,
      });
      await onUploaded();
    }
    setUploading(false);
  }

  const allDone = queue.length > 0 && queue.every((q) => q.status === "done");
  const donePct = queue.filter((q) => q.status === "done").length;

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Upload Media"
      wide
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={uploading}>
            {allDone ? "Chiudi" : "Annulla"}
          </Button>
          {allDone ? (
            <Button variant="primary" onClick={close}>
              Fatto
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={startUpload}
              loading={uploading}
              disabled={queue.length === 0}
            >
              Carica {queue.length > 0 && `(${queue.length})`}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            addFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors",
            dragOver ? "border-brand bg-brand-soft/40" : "border-line hover:border-brand/40"
          )}
        >
          <UploadCloud className="mb-2 h-7 w-7 text-muted/60" />
          <p className="text-[13px] font-medium">Trascina qui i file o clicca per selezionarli</p>
          <p className="mt-0.5 text-[11px] text-muted">Foto, video e documenti. Più file insieme.</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {/* Coda */}
        {queue.length > 0 && (
          <div className="space-y-1.5">
            {uploading && <ProgressBar value={donePct} max={queue.length} />}
            {queue.map((item, i) => (
              <div
                key={`${item.file.name}-${i}`}
                className="flex items-center gap-2.5 rounded-lg border border-line/70 px-3 py-2"
              >
                {fileIcon(item.file)}
                <span className="min-w-0 flex-1 truncate text-[12.5px]">{item.file.name}</span>
                <span className="text-[11px] text-muted">
                  {(item.file.size / 1024 / 1024).toFixed(1)} MB
                </span>
                {item.status === "done" && <CheckCircle2 className="h-4 w-4 text-ok" />}
                {item.status === "error" && <XCircle className="h-4 w-4 text-danger" />}
                {item.status === "uploading" && (
                  <span className="text-[11px] font-medium text-brand">Caricamento…</span>
                )}
                {item.status === "pending" && !uploading && (
                  <button
                    onClick={() => setQueue((q) => q.filter((_, j) => j !== i))}
                    className="cursor-pointer text-muted hover:text-danger"
                    aria-label="Rimuovi"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Metadati comuni */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categoria">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Nessuna</option>
              {MEDIA_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tags" hint="Separati da virgola, es. gol, esultanza">
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tag1, tag2" />
          </Field>
          <Field label="Partita">
            <Select value={matchId} onChange={(e) => setMatchId(e.target.value)}>
              <option value="">Nessuna</option>
              {matches.map((m) => (
                <option key={m.id} value={m.id}>
                  {matchLabel(m)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Data scatto">
            <Input type="date" value={takenAt} onChange={(e) => setTakenAt(e.target.value)} />
          </Field>
        </div>

        {/* Giocatori */}
        <Field label="Giocatori nei media">
          <div className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto rounded-lg border border-line/70 p-2 sm:grid-cols-3">
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
                  className="accent-brand"
                />
                <span className="truncate">{playerName(p)}</span>
              </label>
            ))}
          </div>
        </Field>
      </div>
    </Dialog>
  );
}

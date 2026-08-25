"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Film, ImageIcon, UploadCloud, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useClub } from "@/lib/club-context";
import { logActivity } from "@/lib/activity";
import { kindFromFile, uploadFile } from "@/lib/storage";
import { MEDIA_CATEGORIES, cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";

function fileIcon(file: File) {
  const kind = kindFromFile(file);
  if (kind === "photo") return <ImageIcon className="h-4 w-4" />;
  if (kind === "video") return <Film className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

function fmtSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Upload multi-file drag&drop collegato a un giocatore (media_players).
export function MediaUploadDialog({
  open,
  onClose,
  playerId,
  playerLabel,
  onUploaded,
  documentsOnly,
}: {
  open: boolean;
  onClose: () => void;
  playerId: string;
  playerLabel: string;
  onUploaded: () => void;
  documentsOnly?: boolean;
}) {
  const { club, userId, profile } = useClub();
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState<string>("");
  const [tags, setTags] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setFiles([]);
      setCategory("");
      setTags("");
      setError(null);
      setDragging(false);
    }
  }, [open]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  }

  async function upload() {
    if (!club || !userId || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const sb = supabase();
      const tagList = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      for (const file of files) {
        const { path, url } = await uploadFile(club.id, `players/${playerId}`, file);
        const kind = documentsOnly ? "document" : kindFromFile(file);
        const { data, error: err } = await sb
          .from("media")
          .insert({
            club_id: club.id,
            title: file.name.replace(/\.[^.]+$/, ""),
            kind,
            category: category || null,
            tags: tagList,
            storage_path: path,
            url,
            author_id: userId,
          })
          .select("id")
          .single();
        if (err) throw err;
        const { error: linkErr } = await sb
          .from("media_players")
          .insert({ media_id: (data as { id: string }).id, player_id: playerId });
        if (linkErr) throw linkErr;
      }
      await logActivity({
        clubId: club.id,
        actorId: userId,
        action: "uploaded",
        entityType: "player",
        entityId: playerId,
        summary: `${profile?.full_name ?? "Qualcuno"} ha caricato ${
          files.length === 1 ? "1 file" : `${files.length} file`
        } per ${playerLabel}`,
      });
      onUploaded();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore durante l'upload");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={documentsOnly ? `Carica documenti — ${playerLabel}` : `Carica media — ${playerLabel}`}
      footer={
        <>
          <Button onClick={onClose}>Annulla</Button>
          <Button variant="primary" onClick={upload} loading={uploading} disabled={files.length === 0}>
            Carica {files.length > 0 ? `(${files.length})` : ""}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition-colors",
            dragging ? "border-brand bg-brand-soft" : "border-line hover:border-brand/40"
          )}
        >
          <UploadCloud className="h-7 w-7 text-muted/60" />
          <p className="text-[13px] font-medium">Trascina i file qui o clicca per selezionarli</p>
          <p className="text-[11px] text-muted">
            {documentsOnly ? "PDF, documenti e contratti" : "Foto, video e documenti — anche più file insieme"}
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={documentsOnly ? ".pdf,.doc,.docx,.xls,.xlsx,.txt" : undefined}
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {files.length > 0 && (
          <ul className="space-y-1.5">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex items-center gap-2.5 rounded-lg border border-line/70 px-3 py-2"
              >
                <span className="text-muted">{fileIcon(f)}</span>
                <span className="min-w-0 flex-1 truncate text-[13px]">{f.name}</span>
                <span className="text-[11px] text-muted">{fmtSize(f.size)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  aria-label="Rimuovi"
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Categoria">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">—</option>
              {MEDIA_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Tag" hint="Separati da virgola">
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="derby, esultanza" />
          </Field>
        </div>

        {error && <p className="text-[13px] text-danger">{error}</p>}
      </div>
    </Dialog>
  );
}

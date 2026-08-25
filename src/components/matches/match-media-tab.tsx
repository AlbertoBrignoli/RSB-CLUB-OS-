"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Image as ImageIcon, Upload, Video } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useClub } from "@/lib/club-context";
import { logActivity } from "@/lib/activity";
import { uploadFile, kindFromFile } from "@/lib/storage";
import type { Match, MediaItem, Player } from "@/lib/types";
import { cn, playerName } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export function MatchMediaTab({
  match,
  media,
  players,
  onReload,
}: {
  match: Match;
  media: MediaItem[];
  players: Player[];
  onReload: () => void;
}) {
  const { club, userId, profile, can } = useClub();
  const fileInput = useRef<HTMLInputElement>(null);
  const [taggedPlayers, setTaggedPlayers] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function togglePlayer(id: string) {
    setTaggedPlayers((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || !club || !userId) return;
    setUploading(true);
    setError(null);
    const sb = supabase();
    let uploaded = 0;
    try {
      for (const file of Array.from(files)) {
        const { path, url } = await uploadFile(club.id, `matches/${match.id}`, file);
        const { data, error: err } = await sb
          .from("media")
          .insert({
            club_id: club.id,
            title: file.name,
            kind: kindFromFile(file),
            category: "match",
            storage_path: path,
            url,
            match_id: match.id,
            author_id: userId,
          })
          .select("id")
          .single();
        if (err || !data) throw err ?? new Error("Insert media fallito");
        if (taggedPlayers.length > 0) {
          await sb.from("media_players").insert(
            taggedPlayers.map((playerId) => ({ media_id: data.id, player_id: playerId }))
          );
        }
        uploaded++;
      }
      await logActivity({
        clubId: club.id,
        actorId: userId,
        action: "uploaded",
        entityType: "match",
        entityId: match.id,
        summary: `${profile?.full_name ?? "Qualcuno"} ha caricato ${uploaded} file media per vs ${match.opponent}`,
      });
      onReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore durante l'upload.");
    }
    if (fileInput.current) fileInput.current.value = "";
    setUploading(false);
  }

  return (
    <div className="space-y-4">
      {can("media.upload") && (
        <div className="rounded-xl border border-line/70 bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold">Carica media della partita</p>
              <p className="mt-0.5 text-[11.5px] text-muted">
                Foto e video finiscono nella libreria, già collegati alla partita.
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() => fileInput.current?.click()}
              loading={uploading}
            >
              <Upload className="h-3.5 w-3.5" /> Upload
            </Button>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          {players.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-[11px] font-medium text-muted">
                Tagga giocatori (applicato ai file caricati)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {players.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePlayer(p.id)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors cursor-pointer",
                      taggedPlayers.includes(p.id)
                        ? "border-brand/40 bg-brand-soft text-brand"
                        : "border-line text-muted hover:text-foreground"
                    )}
                  >
                    {p.shirt_number != null && <span className="mr-1 opacity-60">{p.shirt_number}</span>}
                    {playerName(p)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
        </div>
      )}

      {media.length === 0 ? (
        <EmptyState
          icon={<ImageIcon />}
          title="Nessun media per questa partita"
          description="Le foto e i video caricati qui restano collegati alla partita e disponibili in libreria."
        />
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {media.map((m) => (
            <Link
              key={m.id}
              href={`/media?open=${m.id}`}
              className="group relative aspect-square overflow-hidden rounded-lg bg-background"
              title={m.title}
            >
              {m.url && m.kind === "photo" ? (
                <Image
                  src={m.thumb_url ?? m.url}
                  alt={m.title}
                  fill
                  unoptimized
                  className="object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <span className="flex h-full items-center justify-center text-muted/40">
                  {m.kind === "video" ? <Video className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

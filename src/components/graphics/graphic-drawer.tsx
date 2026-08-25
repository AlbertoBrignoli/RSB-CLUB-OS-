"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  CalendarDays, ExternalLink, FileText, Star, Trophy, Upload, User,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useClub } from "@/lib/club-context";
import { logActivity, notify } from "@/lib/activity";
import { uploadFile } from "@/lib/storage";
import type { Graphic, GraphicStatus } from "@/lib/types";
import {
  GRAPHIC_STATUS, PRIORITY, cn, daysUntil, fmtDate, fmtDateTime, matchLabel, playerName,
} from "@/lib/utils";
import { Drawer } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { CommentsSection } from "@/components/shared/comments-section";

const STATUS_ORDER: GraphicStatus[] = [
  "requested", "todo", "in_progress", "review", "approved", "published",
];

// Drawer dettaglio grafica: meta, assegnazione, stato, versioni V1/V2/FINAL, commenti.
export function GraphicDrawer({
  graphic,
  onClose,
  canMoveTo,
  onChangeStatus,
  reload,
}: {
  graphic: Graphic;
  onClose: () => void;
  canMoveTo: (status: GraphicStatus) => boolean;
  onChangeStatus: (graphic: Graphic, status: GraphicStatus) => Promise<void>;
  reload: () => Promise<void>;
}) {
  const { club, userId, profile, team, can } = useClub();
  const [uploading, setUploading] = useState(false);
  const [versionNote, setVersionNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const canProduce = can("graphics.produce");
  const canAssign = canProduce || can("graphics.request");
  const canChangeStatus = canProduce || can("graphics.approve");

  const versions = useMemo(
    () =>
      [...(graphic.versions ?? [])].sort((a, b) =>
        a.created_at.localeCompare(b.created_at)
      ),
    [graphic.versions]
  );
  const lastVersion = versions[versions.length - 1];

  const overdue =
    !!graphic.deadline &&
    daysUntil(graphic.deadline) < 0 &&
    !["approved", "published"].includes(graphic.status);

  async function changeDesigner(designerId: string) {
    if (!club || !userId) return;
    const updates: Record<string, string | null> = { designer_id: designerId || null };
    // Coerente col workflow: la richiesta assegnata passa da requested a todo.
    if (designerId && graphic.status === "requested") updates.status = "todo";
    const { error } = await supabase().from("graphics").update(updates).eq("id", graphic.id);
    if (error) return;
    const designerName =
      team.find((m) => m.user_id === designerId)?.profile?.full_name ?? "nessuno";
    await logActivity({
      clubId: club.id,
      actorId: userId,
      action: "updated",
      entityType: "graphic",
      entityId: graphic.id,
      summary: `${profile?.full_name ?? "Qualcuno"} ha assegnato «${graphic.title}» a ${designerName}`,
    });
    if (designerId) {
      await notify({
        clubId: club.id,
        userIds: [designerId],
        excludeUserId: userId,
        type: "graphic_assigned",
        title: `Ti è stata assegnata: ${graphic.title}`,
        entityType: "graphic",
        entityId: graphic.id,
      });
    }
    await reload();
  }

  async function uploadVersion(file: File) {
    if (!club || !userId) return;
    setUploading(true);
    try {
      const { path, url } = await uploadFile(club.id, `graphics/${graphic.id}`, file);
      const label = `V${versions.length + 1}`;
      const { data: mediaRow } = await supabase()
        .from("media")
        .insert({
          club_id: club.id,
          kind: "graphic",
          title: `${graphic.title} ${label}`,
          content_id: graphic.content_id,
          match_id: graphic.match_id,
          category: "social",
          storage_path: path,
          url,
          author_id: userId,
        })
        .select()
        .single();
      await supabase().from("graphic_versions").insert({
        graphic_id: graphic.id,
        label,
        media_id: (mediaRow?.id as string | undefined) ?? null,
        file_url: url,
        uploaded_by: userId,
        note: versionNote.trim() || null,
      });
      // Nuova versione = automaticamente in review.
      if (graphic.status !== "review") {
        await supabase().from("graphics").update({ status: "review" }).eq("id", graphic.id);
      }
      await logActivity({
        clubId: club.id,
        actorId: userId,
        action: "uploaded",
        entityType: "graphic",
        entityId: graphic.id,
        summary: `${profile?.full_name ?? "Qualcuno"} ha caricato «${graphic.title}» ${label}`,
      });
      if (graphic.requested_by) {
        await notify({
          clubId: club.id,
          userIds: [graphic.requested_by],
          excludeUserId: userId,
          type: "graphic_ready",
          title: `Grafica in review: ${graphic.title}`,
          body: `${label} caricata da ${profile?.full_name ?? "—"}`,
          entityType: "graphic",
          entityId: graphic.id,
        });
      }
      setVersionNote("");
      await reload();
    } finally {
      setUploading(false);
    }
  }

  async function markFinal() {
    if (!club || !userId || !lastVersion) return;
    await supabase()
      .from("graphic_versions")
      .update({ label: "FINAL" })
      .eq("id", lastVersion.id);
    await logActivity({
      clubId: club.id,
      actorId: userId,
      action: "updated",
      entityType: "graphic",
      entityId: graphic.id,
      summary: `${profile?.full_name ?? "Qualcuno"} ha segnato la versione finale di «${graphic.title}»`,
    });
    await reload();
  }

  return (
    <Drawer open onClose={onClose} title={graphic.title}>
      <div className="space-y-6">
        {/* Stato + priorità */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={GRAPHIC_STATUS[graphic.status].className}>
            {GRAPHIC_STATUS[graphic.status].label}
          </Badge>
          <Badge className={PRIORITY[graphic.priority].className}>
            {PRIORITY[graphic.priority].label}
          </Badge>
          {graphic.deadline && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[12px]",
                overdue ? "font-semibold text-danger" : "text-muted"
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Deadline {fmtDate(graphic.deadline)}
            </span>
          )}
        </div>

        {/* Brief */}
        {graphic.brief && (
          <div>
            <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              Brief
            </h4>
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{graphic.brief}</p>
          </div>
        )}

        {/* Meta + collegamenti */}
        <div className="space-y-2 text-[13px]">
          <div className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-[12px] text-muted">Richiesta da</span>
            <Avatar
              name={graphic.requester?.full_name}
              src={graphic.requester?.avatar_url}
              size={20}
            />
            <span>{graphic.requester?.full_name ?? "—"}</span>
            <span className="text-[11px] text-muted">· {fmtDate(graphic.created_at)}</span>
          </div>
          {graphic.content && (
            <div className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-[12px] text-muted">Contenuto</span>
              <Link
                href={`/content?open=${graphic.content.id}`}
                className="inline-flex items-center gap-1 text-brand hover:underline"
              >
                <FileText className="h-3.5 w-3.5" /> {graphic.content.title}
              </Link>
            </div>
          )}
          {graphic.match && (
            <div className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-[12px] text-muted">Partita</span>
              <Link
                href={`/matches/${graphic.match.id}`}
                className="inline-flex items-center gap-1 text-brand hover:underline"
              >
                <Trophy className="h-3.5 w-3.5" />
                {matchLabel(graphic.match, club?.short_name ?? "RSB")}
              </Link>
            </div>
          )}
          {graphic.player && (
            <div className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-[12px] text-muted">Giocatore</span>
              <Link
                href={`/players/${graphic.player.id}`}
                className="inline-flex items-center gap-1 text-brand hover:underline"
              >
                <User className="h-3.5 w-3.5" /> {playerName(graphic.player)}
              </Link>
            </div>
          )}
          {graphic.reference_url && (
            <div className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-[12px] text-muted">Reference</span>
              <a
                href={graphic.reference_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-brand hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Apri link
              </a>
            </div>
          )}
        </div>

        {/* Assegnazione + stato */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Assegnata a">
            <Select
              value={graphic.designer_id ?? ""}
              disabled={!canAssign}
              onChange={(e) => changeDesigner(e.target.value)}
            >
              <option value="">Non assegnata</option>
              {team.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.profile?.full_name ?? "—"}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Stato">
            <Select
              value={graphic.status}
              disabled={!canChangeStatus}
              onChange={(e) => {
                const s = e.target.value as GraphicStatus;
                if (s !== graphic.status && canMoveTo(s)) onChangeStatus(graphic, s);
              }}
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s} disabled={!canMoveTo(s)}>
                  {GRAPHIC_STATUS[s].label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {/* Versioni */}
        <div>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Versions {versions.length > 0 && `(${versions.length})`}
          </h4>

          {versions.length === 0 && (
            <EmptyState
              className="py-6"
              title="Nessuna versione caricata"
              description={
                canProduce
                  ? "Carica la prima versione: la grafica passerà automaticamente in review."
                  : "Il designer non ha ancora caricato una versione."
              }
            />
          )}

          <div className="space-y-3">
            {versions.map((v, i) => (
              <div key={v.id} className="rounded-xl border border-line/80 p-3">
                <div className="flex items-center gap-2">
                  <Badge
                    className={
                      v.label === "FINAL"
                        ? "bg-ok-soft text-ok"
                        : "bg-brand-soft text-brand"
                    }
                  >
                    {v.label}
                  </Badge>
                  <span className="text-[12px] text-muted">
                    {v.uploader?.full_name ?? "—"} · {fmtDateTime(v.created_at)}
                  </span>
                  {canProduce && i === versions.length - 1 && v.label !== "FINAL" && (
                    <Button size="sm" variant="ghost" className="ml-auto" onClick={markFinal}>
                      <Star className="h-3.5 w-3.5" /> Segna FINAL
                    </Button>
                  )}
                </div>
                {v.file_url && (
                  <a href={v.file_url} target="_blank" rel="noreferrer" className="mt-2 block">
                    <div className="relative aspect-video overflow-hidden rounded-lg bg-background">
                      <Image
                        src={v.file_url}
                        alt={`${graphic.title} ${v.label}`}
                        fill
                        unoptimized
                        className="object-contain"
                      />
                    </div>
                  </a>
                )}
                {v.note && <p className="mt-2 text-[12.5px] text-muted">{v.note}</p>}
              </div>
            ))}
          </div>

          {canProduce && (
            <div className="mt-3 flex items-end gap-2">
              <Field label="Nota versione" className="flex-1">
                <Input
                  value={versionNote}
                  onChange={(e) => setVersionNote(e.target.value)}
                  placeholder="Es. sistemato il logo sponsor"
                />
              </Field>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadVersion(f);
                  e.target.value = "";
                }}
              />
              <Button
                variant="primary"
                loading={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {!uploading && <Upload className="h-3.5 w-3.5" />}
                Carica versione
              </Button>
            </div>
          )}
        </div>

        {/* Commenti */}
        <div className="border-t border-line pt-4">
          <CommentsSection
            entityType="graphic"
            entityId={graphic.id}
            entityLabel={`la grafica «${graphic.title}»`}
          />
        </div>
      </div>
    </Drawer>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Camera } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useClub } from "@/lib/club-context";
import { logActivity } from "@/lib/activity";
import { uploadFile } from "@/lib/storage";
import type { Player, PlayerPosition, PlayerStatus } from "@/lib/types";
import { PLAYER_STATUS, POSITIONS, POSITION_LABEL, initials, playerName } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";

interface FormState {
  first_name: string;
  last_name: string;
  shirt_number: string;
  position: PlayerPosition;
  role_detail: string;
  birth_date: string;
  birth_place: string;
  nationality: string;
  foot: "" | "left" | "right" | "both";
  height_cm: string;
  weight_kg: string;
  phone: string;
  email: string;
  instagram: string;
  tiktok: string;
  status: PlayerStatus;
  status_note: string;
}

const emptyForm: FormState = {
  first_name: "",
  last_name: "",
  shirt_number: "",
  position: "MF",
  role_detail: "",
  birth_date: "",
  birth_place: "",
  nationality: "",
  foot: "",
  height_cm: "",
  weight_kg: "",
  phone: "",
  email: "",
  instagram: "",
  tiktok: "",
  status: "available",
  status_note: "",
};

function fromPlayer(p: Player): FormState {
  return {
    first_name: p.first_name,
    last_name: p.last_name,
    shirt_number: p.shirt_number != null ? String(p.shirt_number) : "",
    position: p.position,
    role_detail: p.role_detail ?? "",
    birth_date: p.birth_date ?? "",
    birth_place: p.birth_place ?? "",
    nationality: p.nationality ?? "",
    foot: p.foot ?? "",
    height_cm: p.height_cm != null ? String(p.height_cm) : "",
    weight_kg: p.weight_kg != null ? String(p.weight_kg) : "",
    phone: p.phone ?? "",
    email: p.email ?? "",
    instagram: p.instagram ?? "",
    tiktok: p.tiktok ?? "",
    status: p.status,
    status_note: p.status_note ?? "",
  };
}

const toInt = (v: string) => (v.trim() === "" ? null : Number.parseInt(v, 10) || null);
const toNull = (v: string) => (v.trim() === "" ? null : v.trim());

// Dialog unico per creare / modificare un giocatore.
export function PlayerFormDialog({
  open,
  onClose,
  player,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  player?: Player | null;
  onSaved: () => void;
}) {
  const { club, userId, profile } = useClub();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setForm(player ? fromPlayer(player) : emptyForm);
      setPhotoFile(null);
      setError(null);
    }
  }, [open, player]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const valid = form.first_name.trim() !== "" && form.last_name.trim() !== "";

  async function submit() {
    if (!club || !userId || !valid) return;
    setSaving(true);
    setError(null);
    try {
      const sb = supabase();
      let photo_url = player?.photo_url ?? null;
      if (photoFile) {
        photo_url = (await uploadFile(club.id, "players", photoFile)).url;
      }
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        shirt_number: toInt(form.shirt_number),
        position: form.position,
        role_detail: toNull(form.role_detail),
        birth_date: toNull(form.birth_date),
        birth_place: toNull(form.birth_place),
        nationality: toNull(form.nationality),
        foot: form.foot === "" ? null : form.foot,
        height_cm: toInt(form.height_cm),
        weight_kg: toInt(form.weight_kg),
        phone: toNull(form.phone),
        email: toNull(form.email),
        instagram: toNull(form.instagram),
        tiktok: toNull(form.tiktok),
        photo_url,
        status: form.status,
        status_note: toNull(form.status_note),
      };

      if (player) {
        const { error: err } = await sb.from("players").update(payload).eq("id", player.id);
        if (err) throw err;
        await logActivity({
          clubId: club.id,
          actorId: userId,
          action: "updated",
          entityType: "player",
          entityId: player.id,
          summary: `${profile?.full_name ?? "Qualcuno"} ha aggiornato la scheda di ${playerName(payload)}`,
        });
      } else {
        const { data, error: err } = await sb
          .from("players")
          .insert({ ...payload, club_id: club.id })
          .select("id")
          .single();
        if (err) throw err;
        await logActivity({
          clubId: club.id,
          actorId: userId,
          action: "created",
          entityType: "player",
          entityId: (data as { id: string }).id,
          summary: `${profile?.full_name ?? "Qualcuno"} ha aggiunto ${playerName(payload)} alla rosa`,
        });
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore durante il salvataggio");
    } finally {
      setSaving(false);
    }
  }

  const currentPhoto = photoPreview ?? player?.photo_url ?? null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={player ? `Modifica ${playerName(player)}` : "Aggiungi giocatore"}
      wide
      footer={
        <>
          <Button onClick={onClose}>Annulla</Button>
          <Button variant="primary" onClick={submit} loading={saving} disabled={!valid}>
            {player ? "Salva modifiche" : "Aggiungi alla rosa"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Foto */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-line bg-background transition-colors hover:border-brand/40 cursor-pointer"
            aria-label="Carica foto"
          >
            {currentPhoto ? (
              <Image src={currentPhoto} alt="" fill unoptimized className="object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-lg font-semibold text-brand">
                {initials(`${form.first_name} ${form.last_name}`.trim() || null)}
              </span>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <Camera className="h-5 w-5 text-white" />
            </span>
          </button>
          <div>
            <p className="text-[13px] font-medium">Foto giocatore</p>
            <p className="text-[11px] text-muted">
              Clicca per caricare — usata su schede, grafiche e media center.
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome" required>
            <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} placeholder="Mario" />
          </Field>
          <Field label="Cognome" required>
            <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} placeholder="Rossi" />
          </Field>
          <Field label="Numero maglia">
            <Input type="number" min={1} max={99} value={form.shirt_number} onChange={(e) => set("shirt_number", e.target.value)} placeholder="10" />
          </Field>
          <Field label="Ruolo">
            <Select value={form.position} onChange={(e) => set("position", e.target.value as PlayerPosition)}>
              {POSITIONS.map((p) => (
                <option key={p} value={p}>{POSITION_LABEL[p].full}</option>
              ))}
            </Select>
          </Field>
          <Field label="Dettaglio ruolo" hint="Es. Terzino sinistro, Mezzala…">
            <Input value={form.role_detail} onChange={(e) => set("role_detail", e.target.value)} />
          </Field>
          <Field label="Piede">
            <Select value={form.foot} onChange={(e) => set("foot", e.target.value as FormState["foot"])}>
              <option value="">—</option>
              <option value="right">Destro</option>
              <option value="left">Sinistro</option>
              <option value="both">Ambidestro</option>
            </Select>
          </Field>
          <Field label="Data di nascita">
            <Input type="date" value={form.birth_date} onChange={(e) => set("birth_date", e.target.value)} />
          </Field>
          <Field label="Luogo di nascita">
            <Input value={form.birth_place} onChange={(e) => set("birth_place", e.target.value)} />
          </Field>
          <Field label="Nazionalità">
            <Input value={form.nationality} onChange={(e) => set("nationality", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Altezza (cm)">
              <Input type="number" value={form.height_cm} onChange={(e) => set("height_cm", e.target.value)} />
            </Field>
            <Field label="Peso (kg)">
              <Input type="number" value={form.weight_kg} onChange={(e) => set("weight_kg", e.target.value)} />
            </Field>
          </div>
          <Field label="Telefono">
            <Input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Instagram" hint="Solo l'handle, senza @">
            <Input value={form.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="mariorossi10" />
          </Field>
          <Field label="TikTok" hint="Solo l'handle, senza @">
            <Input value={form.tiktok} onChange={(e) => set("tiktok", e.target.value)} placeholder="mariorossi10" />
          </Field>
          <Field label="Stato">
            <Select value={form.status} onChange={(e) => set("status", e.target.value as PlayerStatus)}>
              {(Object.keys(PLAYER_STATUS) as PlayerStatus[]).map((s) => (
                <option key={s} value={s}>{PLAYER_STATUS[s].label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Nota stato" hint="Es. Lesione al flessore — out 3 settimane">
            <Input value={form.status_note} onChange={(e) => set("status_note", e.target.value)} />
          </Field>
        </div>

        {error && <p className="text-[13px] text-danger">{error}</p>}
      </div>
    </Dialog>
  );
}

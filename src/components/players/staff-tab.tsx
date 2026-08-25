"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Briefcase, Camera, Mail, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useClub } from "@/lib/club-context";
import { logActivity } from "@/lib/activity";
import { uploadFile } from "@/lib/storage";
import type { StaffMember } from "@/lib/types";
import { initials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";

const COMMON_ROLES = [
  "Allenatore", "Vice Allenatore", "Presidente", "Vice Presidente", "Direttore Sportivo",
  "Collaboratore Tecnico", "Preparatore Portieri", "Preparatore Atletico", "Team Manager",
  "Fisioterapista", "Medico Sociale", "Addetto all'Arbitro", "Dirigente", "Segretario",
  "Magazziniere", "Webmaster", "Social Media Manager",
];

interface FormState {
  first_name: string;
  last_name: string;
  role_title: string;
  phone: string;
  email: string;
  notes: string;
}

const emptyForm: FormState = {
  first_name: "", last_name: "", role_title: "", phone: "", email: "", notes: "",
};

export function StaffTab() {
  const { club, userId, profile, can } = useClub();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canManage = can("players.manage");

  const load = useCallback(async () => {
    if (!club) return;
    const { data } = await supabase()
      .from("staff_members")
      .select("*")
      .eq("club_id", club.id)
      .eq("is_active", true)
      .order("sort")
      .order("last_name");
    setStaff((data as StaffMember[]) ?? []);
    setLoading(false);
  }, [club]);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setPhotoFile(null);
    setPhotoPreview(null);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(m: StaffMember) {
    setEditing(m);
    setForm({
      first_name: m.first_name,
      last_name: m.last_name,
      role_title: m.role_title,
      phone: m.phone ?? "",
      email: m.email ?? "",
      notes: m.notes ?? "",
    });
    setPhotoFile(null);
    setPhotoPreview(null);
    setError(null);
    setDialogOpen(true);
  }

  async function save() {
    if (!club || !userId) return;
    if (!form.first_name.trim() || !form.last_name.trim() || !form.role_title.trim()) {
      setError("Nome, cognome e ruolo sono obbligatori.");
      return;
    }
    setSaving(true);
    setError(null);
    const sb = supabase();
    const fullName = `${form.first_name.trim()} ${form.last_name.trim()}`;

    let photo_url: string | undefined;
    if (photoFile) {
      try {
        const up = await uploadFile(club.id, "staff", photoFile);
        photo_url = up.url;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore nel caricamento della foto");
        setSaving(false);
        return;
      }
    }

    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      role_title: form.role_title.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      notes: form.notes.trim() || null,
      ...(photo_url ? { photo_url } : {}),
    };

    if (editing) {
      const { error: err } = await sb.from("staff_members").update(payload).eq("id", editing.id);
      if (err) {
        setError(err.message);
        setSaving(false);
        return;
      }
      await logActivity({
        clubId: club.id,
        actorId: userId,
        action: "updated",
        summary: `${profile?.full_name ?? "Qualcuno"} ha aggiornato ${fullName} (${payload.role_title}) nello staff`,
      });
    } else {
      const maxSort = staff.reduce((m, s) => Math.max(m, s.sort), 0);
      const { error: err } = await sb
        .from("staff_members")
        .insert({ club_id: club.id, sort: maxSort + 1, ...payload });
      if (err) {
        setError(err.message);
        setSaving(false);
        return;
      }
      await logActivity({
        clubId: club.id,
        actorId: userId,
        action: "created",
        summary: `${profile?.full_name ?? "Qualcuno"} ha aggiunto ${fullName} (${payload.role_title}) allo staff`,
      });
    }
    setSaving(false);
    setDialogOpen(false);
    load();
  }

  async function remove() {
    if (!editing || !club || !userId) return;
    if (!confirm(`Rimuovere ${editing.first_name} ${editing.last_name} dallo staff?`)) return;
    setSaving(true);
    const { error: err } = await supabase().from("staff_members").delete().eq("id", editing.id);
    if (!err) {
      await logActivity({
        clubId: club.id,
        actorId: userId,
        action: "deleted",
        summary: `${profile?.full_name ?? "Qualcuno"} ha rimosso ${editing.first_name} ${editing.last_name} dallo staff`,
      });
      setDialogOpen(false);
      load();
    } else {
      setError(err.message);
    }
    setSaving(false);
  }

  const currentPhoto = photoPreview ?? editing?.photo_url ?? null;

  return (
    <div className="animate-fade-up">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[13px] text-muted">
          {staff.length} {staff.length === 1 ? "membro" : "membri"} dello staff
        </p>
        {canManage && (
          <Button variant="primary" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" /> Add Staff
          </Button>
        )}
      </div>

      {!loading && staff.length === 0 && (
        <EmptyState
          icon={<Briefcase />}
          title="Nessun membro dello staff"
          description="Aggiungi allenatore, dirigenti e collaboratori del club."
          action={canManage ? <Button variant="primary" onClick={openNew}>Add Staff</Button> : undefined}
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {staff.map((m) => (
          <div
            key={m.id}
            className="group flex items-start gap-3.5 rounded-card border border-line/80 bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:border-brand/30"
          >
            {m.photo_url ? (
              <Image
                src={m.photo_url}
                alt=""
                width={52}
                height={52}
                unoptimized
                className="h-13 w-13 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <span className="flex h-13 w-13 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-base font-semibold text-brand">
                {initials(`${m.first_name} ${m.last_name}`)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold">
                {m.first_name} {m.last_name}
              </p>
              <p className="text-[11px] font-medium uppercase tracking-wide text-brand">
                {m.role_title}
              </p>
              <div className="mt-1.5 space-y-0.5">
                {m.phone && (
                  <a href={`tel:${m.phone}`} className="flex items-center gap-1.5 text-[12px] text-muted hover:text-brand">
                    <Phone className="h-3 w-3" /> {m.phone}
                  </a>
                )}
                {m.email && (
                  <a href={`mailto:${m.email}`} className="flex items-center gap-1.5 text-[12px] text-muted hover:text-brand truncate">
                    <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{m.email}</span>
                  </a>
                )}
                {!m.phone && !m.email && (
                  <p className="text-[11px] text-muted/60 italic">Contatti da compilare</p>
                )}
              </div>
            </div>
            {canManage && (
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => openEdit(m)}
                aria-label="Modifica"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? `Modifica ${editing.first_name} ${editing.last_name}` : "Aggiungi membro staff"}
        footer={
          <>
            {editing && (
              <Button variant="danger" onClick={remove} disabled={saving} className="mr-auto">
                <Trash2 className="h-3.5 w-3.5" /> Rimuovi
              </Button>
            )}
            <Button onClick={() => setDialogOpen(false)}>Annulla</Button>
            <Button variant="primary" onClick={save} loading={saving}>
              {editing ? "Salva modifiche" : "Aggiungi"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-line bg-background transition-colors hover:border-brand/40 cursor-pointer"
              aria-label="Carica foto"
            >
              {currentPhoto ? (
                <Image src={currentPhoto} alt="" fill unoptimized className="object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-brand">
                  {initials(`${form.first_name} ${form.last_name}`.trim() || null)}
                </span>
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="h-4 w-4 text-white" />
              </span>
            </button>
            <p className="text-[12px] text-muted">Foto (opzionale)</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setPhotoFile(f);
                  setPhotoPreview(URL.createObjectURL(f));
                }
              }}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" required>
              <Input
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              />
            </Field>
            <Field label="Cognome" required>
              <Input
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Ruolo" required>
            <Input
              list="staff-roles"
              value={form.role_title}
              onChange={(e) => setForm({ ...form, role_title: e.target.value })}
              placeholder="Es. Allenatore"
            />
            <datalist id="staff-roles">
              {COMMON_ROLES.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Telefono">
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Note">
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="min-h-16"
            />
          </Field>

          {error && (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>
          )}
        </div>
      </Dialog>
    </div>
  );
}

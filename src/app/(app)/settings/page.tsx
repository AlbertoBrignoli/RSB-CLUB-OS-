"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Lock, Plus, Shield, Trash2, Upload } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useClub } from "@/lib/club-context";
import { logActivity } from "@/lib/activity";
import { uploadFile } from "@/lib/storage";
import type { Competition, ContentTemplate, Season } from "@/lib/types";
import { fmtDate } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/ui/misc";
import { LookupCard, slugify, type LookupRow } from "@/components/admin/lookup-card";

interface TemplateDraft {
  offset_days: number;
  publish_time: string;
  needs_graphic: boolean;
}

export default function SettingsPage() {
  const { club, userId, profile, can, refresh, loading: ctxLoading } = useClub();

  const [seasons, setSeasons] = useState<Season[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [types, setTypes] = useState<LookupRow[]>([]);
  const [channels, setChannels] = useState<LookupRow[]>([]);
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Card Club
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [primary, setPrimary] = useState("#8B1E2D");
  const [accent, setAccent] = useState("#D4A94E");
  const [savingClub, setSavingClub] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Card Stagioni
  const [newSeason, setNewSeason] = useState({ name: "", start: "", end: "" });
  // Card Competizioni
  const [newCompetition, setNewCompetition] = useState("");
  // Card Template
  const [drafts, setDrafts] = useState<Record<string, TemplateDraft>>({});

  useEffect(() => {
    if (!club) return;
    setName(club.name);
    setShortName(club.short_name ?? "");
    setPrimary(club.colors.primary ?? "#8B1E2D");
    setAccent(club.colors.accent ?? "#D4A94E");
    setLogoUrl(club.logo_url);
  }, [club]);

  const load = useCallback(async () => {
    if (!club || !can("settings.manage")) return;
    const sb = supabase();
    const [seasonsRes, compsRes, typesRes, channelsRes, templatesRes] = await Promise.all([
      sb.from("seasons").select("*").eq("club_id", club.id).order("start_date", { ascending: false }),
      sb.from("competitions").select("*").eq("club_id", club.id).order("name"),
      sb.from("content_types").select("*").eq("club_id", club.id).order("sort"),
      sb.from("social_channels").select("*").eq("club_id", club.id).order("sort"),
      sb.from("content_templates")
        .select("*")
        .eq("club_id", club.id)
        .eq("is_match_pack", true)
        .order("sort"),
    ]);
    setSeasons((seasonsRes.data as Season[]) ?? []);
    setCompetitions((compsRes.data as Competition[]) ?? []);
    setTypes((typesRes.data as LookupRow[]) ?? []);
    setChannels((channelsRes.data as LookupRow[]) ?? []);
    const tpls = (templatesRes.data as ContentTemplate[]) ?? [];
    setTemplates(tpls);
    setDrafts(
      Object.fromEntries(
        tpls.map((t) => [
          t.id,
          {
            offset_days: Number(t.defaults.offset_days ?? 0),
            publish_time: String(t.defaults.publish_time ?? "10:00"),
            needs_graphic: Boolean(t.defaults.needs_graphic ?? false),
          },
        ])
      )
    );
    setLoading(false);
  }, [club, can]);

  useEffect(() => {
    load();
  }, [load]);

  if (ctxLoading) return <PageSkeleton />;

  if (!can("settings.manage")) {
    return (
      <EmptyState
        icon={<Lock />}
        title="Impostazioni non disponibili"
        description="Non hai il permesso per gestire le impostazioni del club. Chiedi al Super Admin AUVI se pensi sia un errore."
      />
    );
  }

  if (loading || !club) return <PageSkeleton />;

  const actor = profile?.full_name ?? "Qualcuno";

  async function saveClub() {
    if (!club || !userId) return;
    setSavingClub(true);
    const { error } = await supabase()
      .from("clubs")
      .update({
        name: name.trim() || club.name,
        short_name: shortName.trim() || null,
        colors: { ...club.colors, primary, accent },
      })
      .eq("id", club.id);
    if (!error) {
      await logActivity({
        clubId: club.id,
        actorId: userId,
        action: "updated",
        summary: `${actor} ha aggiornato le impostazioni del club`,
      });
      await refresh();
    }
    setSavingClub(false);
  }

  async function uploadLogo(file: File) {
    if (!club || !userId) return;
    setUploadingLogo(true);
    try {
      const { url } = await uploadFile(club.id, "brand", file);
      const { error } = await supabase().from("clubs").update({ logo_url: url }).eq("id", club.id);
      if (!error) {
        setLogoUrl(url);
        await logActivity({
          clubId: club.id,
          actorId: userId,
          action: "uploaded",
          summary: `${actor} ha aggiornato il logo del club`,
        });
        await refresh();
      }
    } finally {
      setUploadingLogo(false);
    }
  }

  async function setCurrentSeason(season: Season) {
    if (!club || !userId || season.is_current) return;
    const sb = supabase();
    // Prima tutte a false, poi quella scelta a true.
    await sb.from("seasons").update({ is_current: false }).eq("club_id", club.id);
    const { error } = await sb.from("seasons").update({ is_current: true }).eq("id", season.id);
    if (!error) {
      await logActivity({
        clubId: club.id,
        actorId: userId,
        action: "updated",
        summary: `${actor} ha impostato ${season.name} come stagione corrente`,
      });
      await Promise.all([load(), refresh()]);
    }
  }

  async function addSeason() {
    if (!club || !userId || !newSeason.name.trim()) return;
    const { error } = await supabase().from("seasons").insert({
      club_id: club.id,
      name: newSeason.name.trim(),
      start_date: newSeason.start || null,
      end_date: newSeason.end || null,
      is_current: false,
    });
    if (!error) {
      await logActivity({
        clubId: club.id,
        actorId: userId,
        action: "created",
        summary: `${actor} ha aggiunto la stagione ${newSeason.name.trim()}`,
      });
      setNewSeason({ name: "", start: "", end: "" });
      await load();
    }
  }

  async function addCompetition() {
    if (!club || !userId || !newCompetition.trim()) return;
    const { error } = await supabase()
      .from("competitions")
      .insert({ club_id: club.id, name: newCompetition.trim() });
    if (!error) {
      await logActivity({
        clubId: club.id,
        actorId: userId,
        action: "created",
        summary: `${actor} ha aggiunto la competizione ${newCompetition.trim()}`,
      });
      setNewCompetition("");
      await load();
    }
  }

  async function removeCompetition(c: Competition) {
    if (!club || !userId) return;
    if (!window.confirm(`Rimuovere la competizione "${c.name}"?`)) return;
    const { error } = await supabase().from("competitions").delete().eq("id", c.id);
    if (!error) {
      await logActivity({
        clubId: club.id,
        actorId: userId,
        action: "deleted",
        summary: `${actor} ha rimosso la competizione ${c.name}`,
      });
      await load();
    }
  }

  async function toggleLookup(table: "content_types" | "social_channels", row: LookupRow) {
    if (!club || !userId) return;
    const { error } = await supabase()
      .from(table)
      .update({ is_active: !row.is_active })
      .eq("id", row.id);
    if (!error) {
      await Promise.all([load(), refresh()]);
    }
  }

  async function addLookup(
    table: "content_types" | "social_channels",
    rows: LookupRow[],
    label: string,
    newName: string
  ) {
    if (!club || !userId) return;
    const maxSort = rows.reduce((m, r) => Math.max(m, (r as LookupRow & { sort?: number }).sort ?? 0), 0);
    const { error } = await supabase().from(table).insert({
      club_id: club.id,
      name: newName,
      slug: slugify(newName),
      sort: maxSort + 1,
      is_active: true,
    });
    if (!error) {
      await logActivity({
        clubId: club.id,
        actorId: userId,
        action: "created",
        summary: `${actor} ha aggiunto ${label} "${newName}"`,
      });
      await Promise.all([load(), refresh()]);
    }
  }

  async function saveTemplate(tpl: ContentTemplate) {
    if (!club || !userId) return;
    const draft = drafts[tpl.id];
    if (!draft) return;
    const { error } = await supabase()
      .from("content_templates")
      .update({
        defaults: {
          ...tpl.defaults,
          offset_days: draft.offset_days,
          publish_time: draft.publish_time,
          needs_graphic: draft.needs_graphic,
        },
      })
      .eq("id", tpl.id);
    if (!error) {
      await logActivity({
        clubId: club.id,
        actorId: userId,
        action: "updated",
        summary: `${actor} ha aggiornato il template "${tpl.name}" del match pack`,
      });
      await load();
    }
  }

  function isTemplateDirty(tpl: ContentTemplate): boolean {
    const d = drafts[tpl.id];
    if (!d) return false;
    return (
      d.offset_days !== Number(tpl.defaults.offset_days ?? 0) ||
      d.publish_time !== String(tpl.defaults.publish_time ?? "10:00") ||
      d.needs_graphic !== Boolean(tpl.defaults.needs_graphic ?? false)
    );
  }

  return (
    <div className="animate-fade-up">
      <PageHeader title="Settings" subtitle="Identità del club, stagioni e configurazione dei contenuti." />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* CLUB */}
        <Card className="lg:col-span-2">
          <CardHeader title="Club" />
          <CardBody>
            <div className="flex flex-wrap items-start gap-6">
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-line bg-background">
                  {logoUrl ? (
                    <Image src={logoUrl} alt="Logo club" width={96} height={96} unoptimized className="object-contain" />
                  ) : (
                    <Shield className="h-8 w-8 text-muted/40" />
                  )}
                </div>
                <label className="cursor-pointer">
                  <span className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-xs font-medium shadow-sm transition-colors hover:bg-background">
                    <Upload className="h-3 w-3" /> {uploadingLogo ? "Caricamento…" : "Logo"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingLogo}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadLogo(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>

              <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2">
                <Field label="Nome club" required>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="Nome breve" hint="Usato nelle etichette partita, es. RSB vs Avversario.">
                  <Input value={shortName} onChange={(e) => setShortName(e.target.value)} />
                </Field>
                <Field label="Colore primario">
                  <span className="flex items-center gap-2">
                    <input
                      type="color"
                      value={primary}
                      onChange={(e) => setPrimary(e.target.value)}
                      aria-label="Colore primario"
                      className="h-9 w-10 cursor-pointer rounded-lg border border-line bg-surface p-1"
                    />
                    <Input value={primary} onChange={(e) => setPrimary(e.target.value)} className="font-mono uppercase" />
                  </span>
                </Field>
                <Field label="Colore accent">
                  <span className="flex items-center gap-2">
                    <input
                      type="color"
                      value={accent}
                      onChange={(e) => setAccent(e.target.value)}
                      aria-label="Colore accent"
                      className="h-9 w-10 cursor-pointer rounded-lg border border-line bg-surface p-1"
                    />
                    <Input value={accent} onChange={(e) => setAccent(e.target.value)} className="font-mono uppercase" />
                  </span>
                </Field>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-line/70 pt-3">
              <p className="text-[11px] text-muted">
                I colori del brand si applicano al prossimo caricamento della piattaforma.
              </p>
              <Button variant="primary" loading={savingClub} onClick={saveClub}>
                Salva club
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* STAGIONI */}
        <Card>
          <CardHeader title="Stagioni" />
          <CardBody>
            <ul className="divide-y divide-line/70">
              {seasons.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2">
                  <input
                    type="radio"
                    name="current-season"
                    checked={s.is_current}
                    onChange={() => setCurrentSeason(s)}
                    aria-label={`Imposta ${s.name} come corrente`}
                    className="h-3.5 w-3.5 accent-brand cursor-pointer"
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{s.name}</span>
                  <span className="text-[11px] text-muted">
                    {fmtDate(s.start_date, "MMM yyyy")} — {fmtDate(s.end_date, "MMM yyyy")}
                  </span>
                  {s.is_current && (
                    <span className="rounded-full bg-ok-soft px-2 py-0.5 text-[10px] font-medium text-ok">
                      Corrente
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
              <Input
                value={newSeason.name}
                onChange={(e) => setNewSeason((p) => ({ ...p, name: e.target.value }))}
                placeholder="Es. 2027/28"
                className="h-8 text-[13px]"
              />
              <Input
                type="date"
                value={newSeason.start}
                onChange={(e) => setNewSeason((p) => ({ ...p, start: e.target.value }))}
                className="h-8 text-[13px]"
                aria-label="Inizio stagione"
              />
              <Input
                type="date"
                value={newSeason.end}
                onChange={(e) => setNewSeason((p) => ({ ...p, end: e.target.value }))}
                className="h-8 text-[13px]"
                aria-label="Fine stagione"
              />
              <Button size="sm" disabled={!newSeason.name.trim()} onClick={addSeason}>
                <Plus className="h-3.5 w-3.5" /> Aggiungi
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* COMPETIZIONI */}
        <Card>
          <CardHeader title="Competizioni" />
          <CardBody>
            <ul className="divide-y divide-line/70">
              {competitions.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-[13px]">{c.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCompetition(c)}
                    aria-label={`Rimuovi ${c.name}`}
                    className="text-muted hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
              {competitions.length === 0 && (
                <li className="py-3 text-[12.5px] text-muted">Nessuna competizione.</li>
              )}
            </ul>
            <div className="mt-3 flex items-center gap-2">
              <Input
                value={newCompetition}
                onChange={(e) => setNewCompetition(e.target.value)}
                placeholder="Es. Coppa Italia Promozione"
                className="h-8 text-[13px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") addCompetition();
                }}
              />
              <Button size="sm" disabled={!newCompetition.trim()} onClick={addCompetition}>
                <Plus className="h-3.5 w-3.5" /> Aggiungi
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* CONTENT TYPES + SOCIAL CHANNELS */}
        <LookupCard
          title="Content types"
          rows={types}
          addPlaceholder="Es. Season Recap"
          onToggle={(row) => toggleLookup("content_types", row)}
          onAdd={(n) => addLookup("content_types", types, "il tipo di contenuto", n)}
        />
        <LookupCard
          title="Social channels"
          rows={channels}
          addPlaceholder="Es. YouTube"
          onToggle={(row) => toggleLookup("social_channels", row)}
          onAdd={(n) => addLookup("social_channels", channels, "il canale", n)}
        />

        {/* MATCH PACK TEMPLATES */}
        <Card className="lg:col-span-2">
          <CardHeader title="Match pack templates" />
          <CardBody>
            <p className="mb-3 text-[12px] text-muted">
              Questi template generano il pacchetto editoriale della partita: per ogni template viene
              creato un contenuto (con eventuale richiesta grafica e task) alla data
              partita + offset giorni, all&apos;orario indicato.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
                    <th className="py-2 pr-3 font-semibold">Template</th>
                    <th className="py-2 px-3 font-semibold">Offset giorni</th>
                    <th className="py-2 px-3 font-semibold">Orario pubblicazione</th>
                    <th className="py-2 px-3 font-semibold">Richiede grafica</th>
                    <th className="py-2 pl-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {templates.map((tpl) => {
                    const d = drafts[tpl.id];
                    if (!d) return null;
                    return (
                      <tr key={tpl.id} className="transition-colors hover:bg-background">
                        <td className="py-2.5 pr-3 font-medium">{tpl.name}</td>
                        <td className="py-2.5 px-3">
                          <Input
                            type="number"
                            value={d.offset_days}
                            onChange={(e) =>
                              setDrafts((p) => ({
                                ...p,
                                [tpl.id]: { ...d, offset_days: Number(e.target.value) },
                              }))
                            }
                            className="h-8 w-20 text-[13px]"
                            aria-label={`Offset giorni per ${tpl.name}`}
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <Input
                            type="time"
                            value={d.publish_time}
                            onChange={(e) =>
                              setDrafts((p) => ({
                                ...p,
                                [tpl.id]: { ...d, publish_time: e.target.value },
                              }))
                            }
                            className="h-8 w-28 text-[13px]"
                            aria-label={`Orario per ${tpl.name}`}
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="checkbox"
                            checked={d.needs_graphic}
                            onChange={(e) =>
                              setDrafts((p) => ({
                                ...p,
                                [tpl.id]: { ...d, needs_graphic: e.target.checked },
                              }))
                            }
                            className="h-3.5 w-3.5 cursor-pointer accent-brand"
                            aria-label={`Richiede grafica per ${tpl.name}`}
                          />
                        </td>
                        <td className="py-2.5 pl-3 text-right">
                          {isTemplateDirty(tpl) && (
                            <Button size="sm" variant="primary" onClick={() => saveTemplate(tpl)}>
                              Salva
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {templates.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-[12.5px] text-muted">
                        Nessun template match pack configurato.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

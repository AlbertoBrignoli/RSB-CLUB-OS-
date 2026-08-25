"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Ban, CalendarCheck, CheckCircle2, Palette, Send, SendHorizonal,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useClub } from "@/lib/club-context";
import { logActivity, notify } from "@/lib/activity";
import type {
  ContentItem, ContentStatus, Match, Player, PriorityLevel,
} from "@/lib/types";
import {
  CONTENT_STATUS, PRIORITY, cn, fmtDate, fmtTime, matchLabel, playerName,
} from "@/lib/utils";
import { Drawer } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Avatar, Skeleton } from "@/components/ui/misc";
import { CommentsSection } from "@/components/shared/comments-section";
import { CONTENT_SELECT } from "./use-content-data";

interface FormState {
  title: string;
  content_type_id: string;
  channel_id: string;
  publish_date: string;
  publish_time: string;
  caption: string;
  hashtags: string;
  playerIds: string[];
  match_id: string;
  owner_id: string;
  reviewer_id: string;
  priority: PriorityLevel;
  status: ContentStatus;
  notes: string;
}

const emptyForm = (defaultDate?: string): FormState => ({
  title: "",
  content_type_id: "",
  channel_id: "",
  publish_date: defaultDate ?? "",
  publish_time: "",
  caption: "",
  hashtags: "",
  playerIds: [],
  match_id: "",
  owner_id: "",
  reviewer_id: "",
  priority: "medium",
  status: "idea",
  notes: "",
});

// Stati "pre-produzione" da cui si può richiedere la grafica.
const PRE_PRODUCTION: ContentStatus[] = ["idea", "planned", "copy"];

export function ContentEditor({
  contentId,
  defaultDate,
  open,
  onClose,
  onSaved,
}: {
  contentId: string | null; // null = creazione
  defaultDate?: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { club, userId, profile, can, team } = useClub();
  const isNew = contentId === null;
  const editable = isNew ? can("content.create") : can("content.edit");

  const [form, setForm] = useState<FormState>(emptyForm(defaultDate));
  const [item, setItem] = useState<ContentItem | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clubShort = club?.short_name ?? "RSB";

  const load = useCallback(async () => {
    if (!club) return;
    setLoading(true);
    setError(null);
    const sb = supabase();
    const [playersRes, matchesRes] = await Promise.all([
      sb.from("players").select("*").eq("club_id", club.id).eq("is_active", true).order("last_name"),
      sb.from("matches").select("*").eq("club_id", club.id).order("kickoff_at", { ascending: false }).limit(30),
    ]);
    setPlayers((playersRes.data as Player[]) ?? []);
    setMatches((matchesRes.data as Match[]) ?? []);

    if (contentId) {
      const { data } = await sb
        .from("content")
        .select(CONTENT_SELECT)
        .eq("id", contentId)
        .maybeSingle();
      const c = data as unknown as ContentItem | null;
      setItem(c);
      if (c) {
        setForm({
          title: c.title,
          content_type_id: c.content_type_id ?? "",
          channel_id: c.channel_id ?? "",
          publish_date: c.publish_date ?? "",
          publish_time: c.publish_time ? c.publish_time.slice(0, 5) : "",
          caption: c.caption ?? "",
          hashtags: c.hashtags ?? "",
          playerIds: (c.content_players ?? []).map((p) => p.player_id),
          match_id: c.match_id ?? "",
          owner_id: c.owner_id ?? "",
          reviewer_id: c.reviewer_id ?? "",
          priority: c.priority,
          status: c.status,
          notes: c.notes ?? "",
        });
      }
    } else {
      setItem(null);
      setForm(emptyForm(defaultDate));
    }
    setLoading(false);
  }, [club, contentId, defaultDate]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const togglePlayer = (playerId: string) =>
    setForm((f) => ({
      ...f,
      playerIds: f.playerIds.includes(playerId)
        ? f.playerIds.filter((id) => id !== playerId)
        : [...f.playerIds, playerId],
    }));

  // Persiste il form (insert o update) e sincronizza content_players.
  // Ritorna l'id del contenuto, o null se fallisce.
  async function persist(opts?: {
    status?: ContentStatus;
    action?: string;
    summary?: string;
  }): Promise<string | null> {
    if (!club || !userId) return null;
    if (!form.title.trim()) {
      setError("Il titolo è obbligatorio.");
      return null;
    }
    setError(null);
    const sb = supabase();
    const status = opts?.status ?? form.status;
    const payload = {
      title: form.title.trim(),
      content_type_id: form.content_type_id || null,
      channel_id: form.channel_id || null,
      publish_date: form.publish_date || null,
      publish_time: form.publish_time || null,
      caption: form.caption.trim() || null,
      hashtags: form.hashtags.trim() || null,
      notes: form.notes.trim() || null,
      match_id: form.match_id || null,
      owner_id: form.owner_id || null,
      reviewer_id: form.reviewer_id || null,
      priority: form.priority,
      status,
    };

    let id = contentId;
    if (id) {
      const { error: err } = await sb.from("content").update(payload).eq("id", id);
      if (err) {
        setError(err.message);
        return null;
      }
    } else {
      const { data, error: err } = await sb
        .from("content")
        .insert({ ...payload, club_id: club.id, created_by: userId })
        .select("id")
        .single();
      if (err || !data) {
        setError(err?.message ?? "Errore di salvataggio.");
        return null;
      }
      id = (data as { id: string }).id;
    }

    // Sync giocatori collegati
    await sb.from("content_players").delete().eq("content_id", id);
    if (form.playerIds.length > 0) {
      await sb.from("content_players").insert(
        form.playerIds.map((playerId) => ({ content_id: id, player_id: playerId }))
      );
    }

    const actorName = profile?.full_name ?? "Qualcuno";
    await logActivity({
      clubId: club.id,
      actorId: userId,
      action: opts?.action ?? (isNew ? "created" : "updated"),
      entityType: "content",
      entityId: id,
      summary:
        opts?.summary ??
        (isNew
          ? `${actorName} ha creato il contenuto "${form.title.trim()}"`
          : `${actorName} ha aggiornato il contenuto "${form.title.trim()}"`),
    });
    setForm((f) => ({ ...f, status }));
    setItem((it) => (it ? { ...it, ...payload, status } : it));
    return id;
  }

  async function handleSave() {
    setSaving(true);
    const id = await persist();
    setSaving(false);
    if (id) {
      onSaved();
      onClose();
    }
  }

  // ---------- azioni workflow ----------

  const actorName = profile?.full_name ?? "Qualcuno";
  const title = form.title.trim();

  async function changeStatus(
    key: string,
    status: ContentStatus,
    summary: string,
    after?: (id: string) => Promise<void>
  ) {
    if (!club || !userId) return;
    setWorkflowBusy(key);
    const id = await persist({ status, action: "status_changed", summary });
    if (id && after) await after(id);
    setWorkflowBusy(null);
    if (id) onSaved();
  }

  const requestGraphic = () =>
    changeStatus(
      "graphic",
      "graphic_requested",
      `${actorName} ha richiesto la grafica per "${title}"`,
      async (id) => {
        if (!club || !userId) return;
        const brief =
          [form.notes.trim(), form.caption.trim()].filter(Boolean).join("\n").slice(0, 600) || null;
        const { data } = await supabase()
          .from("graphics")
          .insert({
            club_id: club.id,
            title,
            content_id: id,
            match_id: form.match_id || null,
            player_id: form.playerIds[0] ?? null,
            requested_by: userId,
            deadline: form.publish_date || null,
            priority: form.priority,
            status: "requested",
            brief,
          })
          .select("id")
          .single();
        const graphicId = (data as { id: string } | null)?.id;
        const designers = team
          .filter((m) => m.role?.slug === "graphic_designer")
          .map((m) => m.user_id);
        await notify({
          clubId: club.id,
          userIds: designers,
          excludeUserId: userId,
          type: "graphic_assigned",
          title: `Nuova richiesta grafica: ${title}`,
          body: brief ?? undefined,
          entityType: graphicId ? "graphic" : "content",
          entityId: graphicId ?? id,
        });
      }
    );

  const sendToReview = () =>
    changeStatus(
      "review",
      "review",
      `${actorName} ha mandato in review "${title}"`,
      async (id) => {
        if (!club || !form.reviewer_id) return;
        await notify({
          clubId: club.id,
          userIds: [form.reviewer_id],
          excludeUserId: userId ?? undefined,
          type: "content_review",
          title: `Da revisionare: ${title}`,
          entityType: "content",
          entityId: id,
        });
      }
    );

  const approve = () =>
    changeStatus(
      "approve",
      "approved",
      `${actorName} ha approvato il contenuto "${title}"`,
      async (id) => {
        if (!club || !form.owner_id) return;
        await notify({
          clubId: club.id,
          userIds: [form.owner_id],
          excludeUserId: userId ?? undefined,
          type: "content_approved",
          title: `Contenuto approvato: ${title}`,
          entityType: "content",
          entityId: id,
        });
      }
    );

  const schedule = () =>
    changeStatus("schedule", "scheduled", `${actorName} ha programmato "${title}"`);
  const publish = () =>
    changeStatus("publish", "published", `${actorName} ha segnato come pubblicato "${title}"`);
  const cancel = () =>
    changeStatus("cancel", "cancelled", `${actorName} ha annullato il contenuto "${title}"`);

  // Bottoni contestuali in base a stato + permessi (solo su contenuto esistente).
  const workflowActions: {
    key: string;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    variant?: "primary" | "secondary" | "danger" | "accent";
    show: boolean;
  }[] = [
    {
      key: "graphic",
      label: "Richiedi grafica",
      icon: <Palette className="h-3.5 w-3.5" />,
      onClick: requestGraphic,
      variant: "accent",
      show: can("graphics.request") && PRE_PRODUCTION.includes(form.status),
    },
    {
      key: "review",
      label: "Manda in review",
      icon: <Send className="h-3.5 w-3.5" />,
      onClick: sendToReview,
      show:
        can("content.edit") &&
        ["copy", "graphic_requested", "in_production"].includes(form.status),
    },
    {
      key: "approve",
      label: "Approva",
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      onClick: approve,
      variant: "primary",
      show: can("content.approve") && form.status === "review",
    },
    {
      key: "schedule",
      label: "Programma",
      icon: <CalendarCheck className="h-3.5 w-3.5" />,
      onClick: schedule,
      show: can("content.edit") && form.status === "approved",
    },
    {
      key: "publish",
      label: "Pubblicato",
      icon: <SendHorizonal className="h-3.5 w-3.5" />,
      onClick: publish,
      show: can("content.edit") && form.status === "scheduled",
    },
    {
      key: "cancel",
      label: "Annulla contenuto",
      icon: <Ban className="h-3.5 w-3.5" />,
      onClick: cancel,
      variant: "danger",
      show:
        can("content.edit") && !["published", "cancelled"].includes(form.status),
    },
  ];
  const visibleActions = !isNew ? workflowActions.filter((a) => a.show) : [];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        isNew ? (
          "Nuovo contenuto"
        ) : (
          <span className="flex items-center gap-2">
            <span className="truncate">{item?.title ?? "Contenuto"}</span>
            <Badge className={CONTENT_STATUS[form.status].className}>
              {CONTENT_STATUS[form.status].label}
            </Badge>
          </span>
        )
      }
      footer={
        editable ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Annulla
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {isNew ? "Crea contenuto" : "Salva modifiche"}
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Chiudi
          </Button>
        )
      }
    >
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
          <Skeleton className="h-24" />
          <Skeleton className="h-9" />
        </div>
      ) : (
        <div className="space-y-5">
          {error && (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">{error}</p>
          )}

          {editable ? (
            <EditorForm
              form={form}
              set={set}
              togglePlayer={togglePlayer}
              players={players}
              matches={matches}
              clubShort={clubShort}
              canApprove={can("content.approve")}
            />
          ) : (
            <ReadOnlyView item={item} players={players} clubShort={clubShort} />
          )}

          {/* Azioni workflow, sopra il footer */}
          {visibleActions.length > 0 && (
            <div className="border-t border-line pt-4">
              <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted">
                Workflow
              </h4>
              <div className="flex flex-wrap gap-2">
                {visibleActions.map((a) => (
                  <Button
                    key={a.key}
                    size="sm"
                    variant={a.variant ?? "secondary"}
                    onClick={a.onClick}
                    loading={workflowBusy === a.key}
                    disabled={workflowBusy !== null}
                  >
                    {workflowBusy !== a.key && a.icon}
                    {a.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {!isNew && contentId && (
            <div className="border-t border-line pt-4">
              <CommentsSection
                entityType="content"
                entityId={contentId}
                entityLabel={`"${item?.title ?? title}"`}
              />
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

// ---------- form di modifica ----------

function EditorForm({
  form,
  set,
  togglePlayer,
  players,
  matches,
  clubShort,
  canApprove,
}: {
  form: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  togglePlayer: (playerId: string) => void;
  players: Player[];
  matches: Match[];
  clubShort: string;
  canApprove: boolean;
}) {
  const { team, contentTypes, channels } = useClub();
  return (
    <div className="space-y-4">
      <Field label="Titolo" required>
        <Input
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Es. Match Day vs Atletico Lodigiani"
          autoFocus
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo contenuto">
          <Select
            value={form.content_type_id}
            onChange={(e) => set("content_type_id", e.target.value)}
          >
            <option value="">—</option>
            {contentTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Canale">
          <Select value={form.channel_id} onChange={(e) => set("channel_id", e.target.value)}>
            <option value="">—</option>
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>{ch.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Data pubblicazione">
          <Input
            type="date"
            value={form.publish_date}
            onChange={(e) => set("publish_date", e.target.value)}
          />
        </Field>
        <Field label="Ora">
          <Input
            type="time"
            value={form.publish_time}
            onChange={(e) => set("publish_time", e.target.value)}
          />
        </Field>
      </div>

      <Field label="Caption">
        <Textarea
          value={form.caption}
          onChange={(e) => set("caption", e.target.value)}
          placeholder="Il testo del post…"
          className="min-h-28"
        />
      </Field>

      <Field label="Hashtags">
        <Input
          value={form.hashtags}
          onChange={(e) => set("hashtags", e.target.value)}
          placeholder="#RealSanBasilio #MatchDay"
        />
      </Field>

      <Field label="Giocatori collegati" hint="I giocatori taggati nel contenuto.">
        {players.length === 0 ? (
          <p className="text-[13px] text-muted">Nessun giocatore in rosa.</p>
        ) : (
          <div className="max-h-44 space-y-0.5 overflow-y-auto rounded-lg border border-line p-1.5">
            {players.map((p) => (
              <label
                key={p.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-background"
              >
                <input
                  type="checkbox"
                  checked={form.playerIds.includes(p.id)}
                  onChange={() => togglePlayer(p.id)}
                  className="h-3.5 w-3.5 accent-[var(--brand)]"
                />
                <Avatar name={playerName(p)} src={p.photo_url} size={20} />
                <span className="flex-1 truncate">{playerName(p)}</span>
                {p.shirt_number != null && (
                  <span className="text-[11px] text-muted">#{p.shirt_number}</span>
                )}
              </label>
            ))}
          </div>
        )}
      </Field>

      <Field label="Partita collegata">
        <Select value={form.match_id} onChange={(e) => set("match_id", e.target.value)}>
          <option value="">—</option>
          {matches.map((m) => (
            <option key={m.id} value={m.id}>
              {matchLabel(m, clubShort)} · {fmtDate(m.kickoff_at)}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Owner">
          <Select value={form.owner_id} onChange={(e) => set("owner_id", e.target.value)}>
            <option value="">—</option>
            {team.map((m) => (
              <option key={m.user_id} value={m.user_id}>{m.profile?.full_name ?? "—"}</option>
            ))}
          </Select>
        </Field>
        <Field label="Reviewer">
          <Select value={form.reviewer_id} onChange={(e) => set("reviewer_id", e.target.value)}>
            <option value="">—</option>
            {team.map((m) => (
              <option key={m.user_id} value={m.user_id}>{m.profile?.full_name ?? "—"}</option>
            ))}
          </Select>
        </Field>
        <Field label="Priorità">
          <Select
            value={form.priority}
            onChange={(e) => set("priority", e.target.value as PriorityLevel)}
          >
            {(Object.keys(PRIORITY) as PriorityLevel[]).map((p) => (
              <option key={p} value={p}>{PRIORITY[p].label}</option>
            ))}
          </Select>
        </Field>
        <Field
          label="Status"
          hint={!canApprove ? '"Approved" richiede il permesso di approvazione.' : undefined}
        >
          <Select
            value={form.status}
            onChange={(e) => set("status", e.target.value as ContentStatus)}
          >
            {(Object.keys(CONTENT_STATUS) as ContentStatus[]).map((s) => (
              <option
                key={s}
                value={s}
                disabled={s === "approved" && !canApprove && form.status !== "approved"}
              >
                {CONTENT_STATUS[s].label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Note interne">
        <Textarea
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Brief, indicazioni per il designer, reference…"
        />
      </Field>
    </div>
  );
}

// ---------- vista read-only ----------

function ReadOnlyView({
  item,
  players,
  clubShort,
}: {
  item: ContentItem | null;
  players: Player[];
  clubShort: string;
}) {
  if (!item) {
    return <p className="text-[13px] text-muted">Contenuto non trovato.</p>;
  }
  const linkedPlayers = (item.content_players ?? [])
    .map((cp) => players.find((p) => p.id === cp.player_id))
    .filter((p): p is Player => Boolean(p));

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="w-28 shrink-0 text-xs font-medium text-muted">{label}</span>
      <span className="min-w-0 flex-1 text-right text-[13px]">{value}</span>
    </div>
  );

  return (
    <div>
      <div className="divide-y divide-line/70">
        {row(
          "Status",
          <Badge className={CONTENT_STATUS[item.status].className}>
            {CONTENT_STATUS[item.status].label}
          </Badge>
        )}
        {row("Tipo", item.content_type?.name ?? "—")}
        {row("Canale", item.channel?.name ?? "—")}
        {row(
          "Pubblicazione",
          item.publish_date
            ? `${fmtDate(item.publish_date)}${item.publish_time ? ` · ${fmtTime(item.publish_time)}` : ""}`
            : "—"
        )}
        {row("Partita", item.match ? matchLabel(item.match, clubShort) : "—")}
        {row(
          "Owner",
          item.owner ? (
            <span className="inline-flex items-center gap-1.5">
              <Avatar name={item.owner.full_name} src={item.owner.avatar_url} size={18} />
              {item.owner.full_name}
            </span>
          ) : (
            "—"
          )
        )}
        {row("Reviewer", item.reviewer?.full_name ?? "—")}
        {row(
          "Priorità",
          <Badge className={PRIORITY[item.priority].className}>
            {PRIORITY[item.priority].label}
          </Badge>
        )}
        {row(
          "Giocatori",
          linkedPlayers.length === 0 ? (
            "—"
          ) : (
            <span className="inline-flex flex-wrap justify-end gap-1">
              {linkedPlayers.map((p) => (
                <Badge key={p.id} className="bg-background text-muted border border-line">
                  {playerName(p)}
                </Badge>
              ))}
            </span>
          )
        )}
      </div>

      {item.caption && (
        <div className="mt-4">
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Caption</h4>
          <p className="whitespace-pre-wrap rounded-xl bg-background px-3 py-2.5 text-[13px]">
            {item.caption}
          </p>
        </div>
      )}
      {item.hashtags && (
        <p className={cn("mt-2 text-[13px] text-info break-words")}>{item.hashtags}</p>
      )}
      {item.notes && (
        <div className="mt-4">
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Note</h4>
          <p className="whitespace-pre-wrap text-[13px] text-muted">{item.notes}</p>
        </div>
      )}
    </div>
  );
}

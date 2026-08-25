import { supabase } from "./supabase/client";
import type { EntityKind, NotificationType } from "./types";

// Ogni azione rilevante passa da qui: alimenta il feed Team Activity e l'audit.
export async function logActivity(opts: {
  clubId: string;
  actorId: string;
  action: string; // created | updated | status_changed | uploaded | approved | commented | generated | deleted
  entityType?: EntityKind;
  entityId?: string;
  summary: string;
  meta?: Record<string, unknown>;
}) {
  await supabase().from("activity_log").insert({
    club_id: opts.clubId,
    actor_id: opts.actorId,
    action: opts.action,
    entity_type: opts.entityType ?? null,
    entity_id: opts.entityId ?? null,
    summary: opts.summary,
    meta: opts.meta ?? {},
  });
}

export async function notify(opts: {
  clubId: string;
  userIds: string[]; // destinatari
  excludeUserId?: string; // di norma chi compie l'azione
  type: NotificationType;
  title: string;
  body?: string;
  entityType?: EntityKind;
  entityId?: string;
}) {
  const targets = [...new Set(opts.userIds)].filter(
    (id) => id && id !== opts.excludeUserId
  );
  if (targets.length === 0) return;
  await supabase().from("notifications").insert(
    targets.map((userId) => ({
      club_id: opts.clubId,
      user_id: userId,
      type: opts.type,
      title: opts.title,
      body: opts.body ?? null,
      entity_type: opts.entityType ?? null,
      entity_id: opts.entityId ?? null,
    }))
  );
}

// Estrae le menzioni @Nome Cognome dal testo confrontandole con i membri del team.
export function extractMentions(
  body: string,
  team: { user_id: string; profile?: { full_name: string } | null }[]
): string[] {
  const found: string[] = [];
  for (const m of team) {
    const name = m.profile?.full_name;
    if (!name) continue;
    const first = name.split(/\s+/)[0];
    if (
      body.toLowerCase().includes(`@${name.toLowerCase()}`) ||
      (first && body.toLowerCase().includes(`@${first.toLowerCase()}`))
    ) {
      found.push(m.user_id);
    }
  }
  return [...new Set(found)];
}

// URL del dettaglio di un'entità — usato da notifiche, ricerca e feed.
export function entityUrl(entityType: EntityKind | null, entityId: string | null): string {
  if (!entityType || !entityId) return "/dashboard";
  switch (entityType) {
    case "player": return `/players/${entityId}`;
    case "match": return `/matches/${entityId}`;
    case "content": return `/content?open=${entityId}`;
    case "graphic": return `/graphics?open=${entityId}`;
    case "task": return `/tasks?open=${entityId}`;
    case "media": return `/media?open=${entityId}`;
    default: return "/dashboard";
  }
}

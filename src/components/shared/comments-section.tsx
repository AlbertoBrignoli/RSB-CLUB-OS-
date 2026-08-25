"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useClub } from "@/lib/club-context";
import { extractMentions, logActivity, notify } from "@/lib/activity";
import type { Comment, EntityKind } from "@/lib/types";
import { timeAgo } from "@/lib/utils";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

export function CommentsSection({
  entityType,
  entityId,
  entityLabel,
}: {
  entityType: EntityKind;
  entityId: string;
  entityLabel: string;
}) {
  const { club, userId, profile, team, can } = useClub();
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase()
      .from("comments")
      .select("*, author:profiles(*)")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at");
    setComments((data as Comment[]) ?? []);
    setLoaded(true);
  }, [entityType, entityId]);

  useEffect(() => {
    load();
  }, [load]);

  async function send() {
    if (!body.trim() || !club || !userId) return;
    setSending(true);
    const mentions = extractMentions(body, team);
    const { error } = await supabase().from("comments").insert({
      club_id: club.id,
      entity_type: entityType,
      entity_id: entityId,
      author_id: userId,
      body: body.trim(),
      mentions,
    });
    if (!error) {
      await Promise.all([
        logActivity({
          clubId: club.id,
          actorId: userId,
          action: "commented",
          entityType,
          entityId,
          summary: `${profile?.full_name ?? "Qualcuno"} ha commentato ${entityLabel}`,
        }),
        mentions.length > 0
          ? notify({
              clubId: club.id,
              userIds: mentions,
              excludeUserId: userId,
              type: "mention",
              title: `${profile?.full_name ?? "Qualcuno"} ti ha menzionato`,
              body: body.trim().slice(0, 140),
              entityType,
              entityId,
            })
          : Promise.resolve(),
      ]);
      setBody("");
      await load();
    }
    setSending(false);
  }

  return (
    <div>
      <h4 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        <MessageSquare className="h-3.5 w-3.5" /> Comments
        {comments.length > 0 && <span>({comments.length})</span>}
      </h4>

      {loaded && comments.length === 0 && (
        <EmptyState
          className="py-6"
          title="Nessun commento"
          description="Scrivi il primo commento. Usa @Nome per menzionare un collega."
        />
      )}

      <div className="space-y-3">
        {comments.map((c) => (
          <div key={c.id} className="flex gap-2.5">
            <Avatar name={c.author?.full_name} src={c.author?.avatar_url} size={26} />
            <div className="min-w-0 flex-1 rounded-xl bg-background px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold">{c.author?.full_name ?? "—"}</span>
                <span className="text-[10px] text-muted">{timeAgo(c.created_at)}</span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-[13px]">{c.body}</p>
            </div>
          </div>
        ))}
      </div>

      {can("comments.create") && (
        <div className="mt-3 flex items-end gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Scrivi un commento… (@Nome per menzionare)"
            className="min-h-16"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
            }}
          />
          <Button variant="primary" size="icon" onClick={send} loading={sending} aria-label="Invia">
            {!sending && <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
      )}
    </div>
  );
}

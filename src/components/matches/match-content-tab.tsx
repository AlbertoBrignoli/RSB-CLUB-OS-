"use client";

import { useState } from "react";
import Link from "next/link";
import { Palette, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useClub } from "@/lib/club-context";
import type { ContentItem } from "@/lib/types";
import { CONTENT_STATUS, fmtDate, fmtTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export function MatchContentTab({
  matchId,
  content,
  onReload,
}: {
  matchId: string;
  content: ContentItem[];
  onReload: () => void;
}) {
  const { can } = useClub();
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function generatePack() {
    setGenerating(true);
    setResult(null);
    const { data, error } = await supabase().rpc("generate_match_pack", { p_match: matchId });
    if (error) {
      setResult(`Errore: ${error.message}`);
    } else {
      const n = (data as number) ?? 0;
      setResult(
        n > 0
          ? `Pacchetto generato: ${n} ${n === 1 ? "contenuto creato" : "contenuti creati"}.`
          : "Nessun contenuto creato: il pacchetto era già stato generato."
      );
      onReload();
    }
    setGenerating(false);
  }

  return (
    <div className="space-y-4">
      {can("content.create") && (
        <div className="rounded-xl border border-line/70 bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold">Pacchetto contenuti partita</p>
              <p className="mt-0.5 text-[11.5px] text-muted">
                Genera il pacchetto dai template: Match Announcement, Pre Match, Match Day,
                Starting XI, Half Time, Final Score, Post Match, Photo Gallery.
              </p>
            </div>
            <Button variant="primary" onClick={generatePack} loading={generating}>
              <Sparkles className="h-3.5 w-3.5" /> Generate Match Content
            </Button>
          </div>
          {result && <p className="mt-2 text-[12px] font-medium text-brand">{result}</p>}
        </div>
      )}

      {content.length === 0 ? (
        <EmptyState
          icon={<Palette />}
          title="Nessun contenuto collegato"
          description="Genera il pacchetto partita o collega un contenuto a questa partita dalla sezione Content."
        />
      ) : (
        <div className="space-y-2">
          {content.map((c) => (
            <Link
              key={c.id}
              href={`/content?open=${c.id}`}
              className="flex items-center gap-3 rounded-xl border border-line/70 bg-surface px-4 py-2.5 transition-colors hover:border-brand/30"
            >
              <div className="w-14 shrink-0 text-center">
                <p className="text-[11px] font-semibold uppercase text-brand">
                  {fmtDate(c.publish_date, "d MMM")}
                </p>
                <p className="text-[10px] text-muted">{fmtTime(c.publish_time)}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{c.title}</p>
                <p className="text-[11px] text-muted">
                  {c.content_type?.name ?? "—"} · {c.channel?.name ?? "—"}
                </p>
              </div>
              <Badge className={CONTENT_STATUS[c.status].className}>
                {CONTENT_STATUS[c.status].label}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

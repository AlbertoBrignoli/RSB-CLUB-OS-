"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  Search, User, Trophy, FileText, Palette, CheckSquare, Image as ImageIcon, Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useClub } from "@/lib/club-context";
import { cn, matchLabel } from "@/lib/utils";

interface Result {
  kind: "player" | "match" | "content" | "graphic" | "task" | "media";
  id: string;
  title: string;
  subtitle?: string;
}

const KIND_META = {
  player: { icon: User, label: "Giocatori", url: (id: string) => `/players/${id}` },
  match: { icon: Trophy, label: "Partite", url: (id: string) => `/matches/${id}` },
  content: { icon: FileText, label: "Contenuti", url: (id: string) => `/content?open=${id}` },
  graphic: { icon: Palette, label: "Grafiche", url: (id: string) => `/graphics?open=${id}` },
  task: { icon: CheckSquare, label: "Task", url: (id: string) => `/tasks?open=${id}` },
  media: { icon: ImageIcon, label: "Media", url: (id: string) => `/media?open=${id}` },
} as const;

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { club } = useClub();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [selected, setSelected] = useState(0);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !club) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const sb = supabase();
      const like = `%${q}%`;
      const [players, matches, content, graphics, tasks, media] = await Promise.all([
        sb.from("players").select("id, first_name, last_name, shirt_number")
          .eq("club_id", club.id).or(`first_name.ilike.${like},last_name.ilike.${like}`).limit(5),
        sb.from("matches").select("id, opponent, is_home, kickoff_at")
          .eq("club_id", club.id).ilike("opponent", like).limit(5),
        sb.from("content").select("id, title, status").eq("club_id", club.id).ilike("title", like).limit(5),
        sb.from("graphics").select("id, title, status").eq("club_id", club.id).ilike("title", like).limit(5),
        sb.from("tasks").select("id, title, status").eq("club_id", club.id).ilike("title", like).limit(5),
        sb.from("media").select("id, title, kind").eq("club_id", club.id).ilike("title", like).limit(5),
      ]);
      const out: Result[] = [
        ...(players.data ?? []).map((p) => ({
          kind: "player" as const, id: p.id,
          title: `${p.first_name} ${p.last_name}`,
          subtitle: p.shirt_number ? `#${p.shirt_number}` : undefined,
        })),
        ...(matches.data ?? []).map((m) => ({
          kind: "match" as const, id: m.id,
          title: matchLabel(m, club.short_name ?? "RSB"),
          subtitle: new Date(m.kickoff_at).toLocaleDateString("it-IT"),
        })),
        ...(content.data ?? []).map((c) => ({ kind: "content" as const, id: c.id, title: c.title, subtitle: c.status })),
        ...(graphics.data ?? []).map((g) => ({ kind: "graphic" as const, id: g.id, title: g.title, subtitle: g.status })),
        ...(tasks.data ?? []).map((t) => ({ kind: "task" as const, id: t.id, title: t.title, subtitle: t.status })),
        ...(media.data ?? []).map((m) => ({ kind: "media" as const, id: m.id, title: m.title || "(senza titolo)", subtitle: m.kind })),
      ];
      setResults(out);
      setSelected(0);
      setSearching(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, open, club]);

  function go(r: Result) {
    onClose();
    router.push(KIND_META[r.kind].url(r.id));
  }

  if (!open || typeof document === "undefined") return null;

  const grouped = (Object.keys(KIND_META) as Result["kind"][])
    .map((kind) => ({ kind, items: results.filter((r) => r.kind === kind) }))
    .filter((g) => g.items.length > 0);

  const flat = grouped.flatMap((g) => g.items);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] animate-overlay-in" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl rounded-2xl border border-line bg-surface shadow-2xl animate-fade-up mx-4">
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          {searching ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted" />
          ) : (
            <Search className="h-4 w-4 text-muted" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelected((s) => Math.min(s + 1, flat.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelected((s) => Math.max(s - 1, 0));
              }
              if (e.key === "Enter" && flat[selected]) go(flat[selected]);
            }}
            placeholder="Cerca in tutto il club…"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70"
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {query.trim().length < 2 && (
            <p className="px-3 py-8 text-center text-xs text-muted">
              Digita almeno 2 caratteri per cercare giocatori, partite, contenuti, grafiche, task e media.
            </p>
          )}
          {query.trim().length >= 2 && !searching && flat.length === 0 && (
            <p className="px-3 py-8 text-center text-xs text-muted">Nessun risultato per “{query}”.</p>
          )}
          {grouped.map((g) => {
            const Meta = KIND_META[g.kind];
            return (
              <div key={g.kind} className="mb-1">
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted/70">
                  {Meta.label}
                </p>
                {g.items.map((r) => {
                  const idx = flat.indexOf(r);
                  return (
                    <button
                      key={`${r.kind}-${r.id}`}
                      onClick={() => go(r)}
                      onMouseEnter={() => setSelected(idx)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left cursor-pointer",
                        idx === selected ? "bg-brand-soft text-brand" : "hover:bg-background"
                      )}
                    >
                      <Meta.icon className="h-4 w-4 shrink-0 opacity-60" />
                      <span className="flex-1 truncate text-[13px] font-medium">{r.title}</span>
                      {r.subtitle && <span className="text-[11px] text-muted">{r.subtitle}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}

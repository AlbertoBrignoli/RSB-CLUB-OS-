"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileText, Plus, Search } from "lucide-react";
import { useClub } from "@/lib/club-context";
import type { ContentStatus, Player } from "@/lib/types";
import { CONTENT_STATUS, PRIORITY, fmtDate, fmtTime, matchLabel, playerName } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, EmptyState, PageHeader, PageSkeleton, Tabs } from "@/components/ui/misc";
import { ContentEditor } from "@/components/content/content-editor";
import {
  ContentFiltersRow, EMPTY_FILTERS, matchesFilters, type ContentFilterState,
} from "@/components/content/content-filters";
import { useContentData } from "@/components/content/use-content-data";

export default function ContentPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ContentInner />
    </Suspense>
  );
}

// Tab veloci per gruppo di stato.
const STATUS_TABS: { key: string; label: string; statuses: ContentStatus[] | null }[] = [
  { key: "all", label: "All", statuses: null },
  { key: "ideas", label: "Ideas", statuses: ["idea", "planned"] },
  { key: "production", label: "In produzione", statuses: ["copy", "graphic_requested", "in_production"] },
  { key: "review", label: "Review", statuses: ["review"] },
  { key: "approved", label: "Approved", statuses: ["approved"] },
  { key: "scheduled", label: "Scheduled", statuses: ["scheduled"] },
  { key: "published", label: "Published", statuses: ["published"] },
];

function ContentInner() {
  const { club, can, loading: ctxLoading } = useClub();
  const { contents, players, matches, loading, refresh } = useContentData();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [filters, setFilters] = useState<ContentFilterState>(EMPTY_FILTERS);
  const [editor, setEditor] = useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  });

  const canCreate = can("content.create");
  const clubShort = club?.short_name ?? "RSB";

  // ?new=1 / ?open=<id>
  useEffect(() => {
    const openId = searchParams.get("open");
    if (openId) {
      setEditor({ open: true, id: openId });
    } else if (searchParams.get("new") === "1" && can("content.create")) {
      setEditor({ open: true, id: null });
    }
  }, [searchParams, can]);

  const closeEditor = () => {
    setEditor((e) => ({ ...e, open: false }));
    if (searchParams.get("open") || searchParams.get("new")) {
      router.replace(pathname, { scroll: false });
    }
  };

  const playerById = useMemo(() => {
    const map = new Map<string, Player>();
    for (const p of players) map.set(p.id, p);
    return map;
  }, [players]);

  // Filtri + ricerca (i tab si applicano dopo, così i conteggi restano coerenti).
  const base = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contents.filter((c) => {
      if (!matchesFilters(c, filters)) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        (c.caption ?? "").toLowerCase().includes(q)
      );
    });
  }, [contents, filters, search]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of STATUS_TABS) {
      map[t.key] = t.statuses
        ? base.filter((c) => t.statuses!.includes(c.status)).length
        : base.length;
    }
    return map;
  }, [base]);

  const rows = useMemo(() => {
    const t = STATUS_TABS.find((x) => x.key === tab);
    const list = t?.statuses ? base.filter((c) => t.statuses!.includes(c.status)) : base;
    return [...list].sort((a, b) =>
      (b.publish_date ?? "9999") < (a.publish_date ?? "9999") ? -1 : 1
    );
  }, [base, tab]);

  if (ctxLoading || loading) return <PageSkeleton />;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Contenuti"
        subtitle="Il database di tutti i contenuti del club."
        action={
          canCreate && (
            <Button variant="primary" onClick={() => setEditor({ open: true, id: null })}>
              <Plus className="h-3.5 w-3.5" /> New Content
            </Button>
          )
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per titolo o caption…"
            className="pl-8"
          />
        </div>
        <ContentFiltersRow
          filters={filters}
          onChange={setFilters}
          players={players}
          matches={matches}
        />
      </div>

      <Tabs
        className="mb-4"
        active={tab}
        onChange={setTab}
        tabs={STATUS_TABS.map((t) => ({ key: t.key, label: t.label, count: counts[t.key] }))}
      />

      <p className="mb-2 text-[12px] text-muted">
        {rows.length} {rows.length === 1 ? "contenuto" : "contenuti"}
      </p>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText />}
            title="Nessun contenuto trovato"
            description={
              search || tab !== "all"
                ? "Prova a cambiare filtri, tab o ricerca."
                : "Crea il primo contenuto per iniziare a pianificare."
            }
            action={
              canCreate &&
              !search &&
              tab === "all" && (
                <Button variant="primary" onClick={() => setEditor({ open: true, id: null })}>
                  <Plus className="h-3.5 w-3.5" /> New Content
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-4xl text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5 font-semibold">Titolo</th>
                <th className="px-3 py-2.5 font-semibold">Tipo</th>
                <th className="px-3 py-2.5 font-semibold">Canale</th>
                <th className="px-3 py-2.5 font-semibold">Data</th>
                <th className="px-3 py-2.5 font-semibold">Players</th>
                <th className="px-3 py-2.5 font-semibold">Match</th>
                <th className="px-3 py-2.5 font-semibold">Owner</th>
                <th className="px-3 py-2.5 font-semibold">Priority</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {rows.map((c) => {
                const linked = (c.content_players ?? [])
                  .map((cp) => playerById.get(cp.player_id))
                  .filter((p): p is Player => Boolean(p));
                return (
                  <tr
                    key={c.id}
                    onClick={() => setEditor({ open: true, id: c.id })}
                    className="cursor-pointer transition-colors hover:bg-background"
                  >
                    <td className="max-w-64 px-4 py-2.5">
                      <p className="truncate font-medium">{c.title}</p>
                      {c.caption && (
                        <p className="truncate text-[11px] text-muted">{c.caption}</p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted">
                      {c.content_type?.name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted">
                      {c.channel?.name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {c.publish_date ? (
                        <>
                          <span className="font-medium">{fmtDate(c.publish_date, "d MMM")}</span>
                          {c.publish_time && (
                            <span className="ml-1 text-[11px] text-muted">
                              {fmtTime(c.publish_time)}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {linked.length === 0 ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <span className="flex items-center">
                          <span className="flex -space-x-1.5">
                            {linked.slice(0, 3).map((p) => (
                              <Avatar
                                key={p.id}
                                name={playerName(p)}
                                src={p.photo_url}
                                size={20}
                                className="ring-2 ring-surface"
                              />
                            ))}
                          </span>
                          {linked.length > 3 && (
                            <span className="ml-1.5 text-[11px] text-muted">
                              +{linked.length - 3}
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="max-w-40 truncate whitespace-nowrap px-3 py-2.5 text-muted">
                      {c.match ? matchLabel(c.match, clubShort) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {c.owner ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Avatar name={c.owner.full_name} src={c.owner.avatar_url} size={20} />
                          <span className="max-w-28 truncate">{c.owner.full_name}</span>
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <Badge className={PRIORITY[c.priority].className}>
                        {PRIORITY[c.priority].label}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <Badge className={CONTENT_STATUS[c.status].className}>
                        {CONTENT_STATUS[c.status].label}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <ContentEditor
        contentId={editor.id}
        open={editor.open}
        onClose={closeEditor}
        onSaved={refresh}
      />
    </div>
  );
}

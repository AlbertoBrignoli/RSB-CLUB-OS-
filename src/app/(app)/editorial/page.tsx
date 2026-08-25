"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek,
  format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek,
} from "date-fns";
import { it } from "date-fns/locale";
import { supabase } from "@/lib/supabase/client";
import { useClub } from "@/lib/club-context";
import { logActivity } from "@/lib/activity";
import type { ContentItem } from "@/lib/types";
import { CONTENT_STATUS, PRIORITY, cn, fmtDate, fmtTime, matchLabel } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, EmptyState, PageHeader, PageSkeleton, Tabs } from "@/components/ui/misc";
import { ContentEditor } from "@/components/content/content-editor";
import {
  ContentFiltersRow, EMPTY_FILTERS, STATUS_DOT, matchesFilters,
  type ContentFilterState,
} from "@/components/content/content-filters";
import { useContentData } from "@/components/content/use-content-data";

export default function EditorialPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EditorialInner />
    </Suspense>
  );
}

type View = "month" | "week" | "list";

function EditorialInner() {
  const { club, userId, profile, can, loading: ctxLoading } = useClub();
  const { contents, players, matches, loading, refresh } = useContentData();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [filters, setFilters] = useState<ContentFilterState>(EMPTY_FILTERS);
  const [editor, setEditor] = useState<{ open: boolean; id: string | null; defaultDate?: string }>({
    open: false,
    id: null,
  });
  const [dragId, setDragId] = useState<string | null>(null);

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

  const filtered = useMemo(
    () => contents.filter((c) => matchesFilters(c, filters)),
    [contents, filters]
  );

  const byDate = useMemo(() => {
    const map = new Map<string, ContentItem[]>();
    for (const c of filtered) {
      if (!c.publish_date) continue;
      const list = map.get(c.publish_date) ?? [];
      list.push(c);
      map.set(c.publish_date, list);
    }
    return map;
  }, [filtered]);

  const canEdit = can("content.edit");
  const canCreate = can("content.create");

  function openNew(defaultDate?: string) {
    if (!canCreate) return;
    setEditor({ open: true, id: null, defaultDate });
  }
  function openItem(id: string) {
    setEditor({ open: true, id });
  }

  // Drag & drop: sposta un contenuto su un altro giorno.
  async function moveContent(id: string, dateStr: string) {
    if (!club || !userId || !canEdit) return;
    const c = contents.find((x) => x.id === id);
    if (!c || c.publish_date === dateStr) return;
    const { error } = await supabase().from("content").update({ publish_date: dateStr }).eq("id", id);
    if (!error) {
      await logActivity({
        clubId: club.id,
        actorId: userId,
        action: "updated",
        entityType: "content",
        entityId: id,
        summary: `${profile?.full_name ?? "Qualcuno"} ha spostato "${c.title}" al ${fmtDate(dateStr)}`,
      });
      refresh();
    }
  }

  function dropProps(dateStr: string) {
    if (!canEdit) return {};
    return {
      onDragOver: (e: React.DragEvent) => e.preventDefault(),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain") || dragId;
        if (id) moveContent(id, dateStr);
        setDragId(null);
      },
    };
  }

  function navigate(dir: -1 | 1) {
    setCursor((d) => (view === "week" ? addWeeks(d, dir) : addMonths(d, dir)));
  }

  if (ctxLoading || loading) return <PageSkeleton />;

  const periodLabel =
    view === "week"
      ? `${fmtDate(startOfWeek(cursor, { weekStartsOn: 1 }), "d MMM")} – ${fmtDate(
          endOfWeek(cursor, { weekStartsOn: 1 }),
          "d MMM yyyy"
        )}`
      : format(cursor, "MMMM yyyy", { locale: it });

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Calendario editoriale"
        subtitle="Pianificazione dei contenuti su tutti i canali."
        action={
          canCreate && (
            <Button variant="primary" onClick={() => openNew()}>
              <Plus className="h-3.5 w-3.5" /> New Content
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          className="border-b-0"
          active={view}
          onChange={(k) => setView(k as View)}
          tabs={[
            { key: "month", label: "Month" },
            { key: "week", label: "Week" },
            { key: "list", label: "List" },
          ]}
        />
        {view !== "list" && (
          <div className="flex items-center gap-1.5">
            <Button size="icon" variant="ghost" onClick={() => navigate(-1)} aria-label="Precedente">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-36 text-center text-[13px] font-semibold capitalize">
              {periodLabel}
            </span>
            <Button size="icon" variant="ghost" onClick={() => navigate(1)} aria-label="Successivo">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setCursor(new Date())}>
              Oggi
            </Button>
          </div>
        )}
      </div>

      <ContentFiltersRow
        className="mb-4"
        filters={filters}
        onChange={setFilters}
        players={players}
        matches={matches}
      />

      {view === "month" && (
        <MonthGrid
          cursor={cursor}
          byDate={byDate}
          canEdit={canEdit}
          canCreate={canCreate}
          onOpen={openItem}
          onNew={openNew}
          onDragStart={setDragId}
          dropProps={dropProps}
        />
      )}
      {view === "week" && (
        <WeekGrid
          cursor={cursor}
          byDate={byDate}
          canEdit={canEdit}
          canCreate={canCreate}
          onOpen={openItem}
          onNew={openNew}
          onDragStart={setDragId}
          dropProps={dropProps}
        />
      )}
      {view === "list" && (
        <ListView
          contents={filtered}
          clubShort={club?.short_name ?? "RSB"}
          canCreate={canCreate}
          onOpen={openItem}
          onNew={() => openNew()}
        />
      )}

      <ContentEditor
        contentId={editor.id}
        defaultDate={editor.defaultDate}
        open={editor.open}
        onClose={closeEditor}
        onSaved={refresh}
      />
    </div>
  );
}

// ---------- card compatta (Month) ----------

function CompactCard({
  c,
  canEdit,
  onOpen,
  onDragStart,
}: {
  c: ContentItem;
  canEdit: boolean;
  onOpen: (id: string) => void;
  onDragStart: (id: string) => void;
}) {
  return (
    <button
      draggable={canEdit}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", c.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(c.id);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(c.id);
      }}
      title={`${c.title} · ${CONTENT_STATUS[c.status].label}`}
      className={cn(
        "block w-full rounded-md border border-line/70 bg-surface px-1.5 py-1 text-left",
        "transition-colors hover:border-brand/40 cursor-pointer",
        canEdit && "active:cursor-grabbing"
      )}
    >
      <span className="flex items-center gap-1">
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[c.status])} />
        <span className="truncate text-[11px] font-medium leading-tight">{c.title}</span>
      </span>
      <span className="mt-0.5 block truncate text-[10px] text-muted">
        {[c.channel?.name, fmtTime(c.publish_time)].filter(Boolean).join(" · ") || "—"}
      </span>
    </button>
  );
}

function MonthGrid({
  cursor,
  byDate,
  canEdit,
  canCreate,
  onOpen,
  onNew,
  onDragStart,
  dropProps,
}: {
  cursor: Date;
  byDate: Map<string, ContentItem[]>;
  canEdit: boolean;
  canCreate: boolean;
  onOpen: (id: string) => void;
  onNew: (defaultDate: string) => void;
  onDragStart: (id: string) => void;
  dropProps: (dateStr: string) => React.HTMLAttributes<HTMLDivElement>;
}) {
  const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const weekdays = eachDayOfInterval({ start: gridStart, end: addDays(gridStart, 6) });

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b border-line bg-background/60">
        {weekdays.map((d) => (
          <div
            key={d.toISOString()}
            className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted"
          >
            {format(d, "EEE", { locale: it })}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const items = byDate.get(dateStr) ?? [];
          const inMonth = isSameMonth(day, cursor);
          return (
            <div
              key={dateStr}
              {...dropProps(dateStr)}
              onClick={() => canCreate && onNew(dateStr)}
              className={cn(
                "min-h-28 border-b border-r border-line/60 p-1.5 transition-colors",
                !inMonth && "bg-background/50",
                canCreate && "cursor-pointer hover:bg-brand-soft/30"
              )}
            >
              <span
                className={cn(
                  "mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium",
                  isToday(day) ? "bg-brand text-white" : inMonth ? "text-foreground" : "text-muted/60"
                )}
              >
                {format(day, "d")}
              </span>
              <div className="space-y-1">
                {items.slice(0, 3).map((c) => (
                  <CompactCard key={c.id} c={c} canEdit={canEdit} onOpen={onOpen} onDragStart={onDragStart} />
                ))}
                {items.length > 3 && (
                  <p className="px-1 text-[10px] font-medium text-muted">+{items.length - 3} altri</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ---------- Week ----------

function WeekGrid({
  cursor,
  byDate,
  canEdit,
  canCreate,
  onOpen,
  onNew,
  onDragStart,
  dropProps,
}: {
  cursor: Date;
  byDate: Map<string, ContentItem[]>;
  canEdit: boolean;
  canCreate: boolean;
  onOpen: (id: string) => void;
  onNew: (defaultDate: string) => void;
  onDragStart: (id: string) => void;
  dropProps: (dateStr: string) => React.HTMLAttributes<HTMLDivElement>;
}) {
  const weekStart = startOfWeek(cursor, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });

  return (
    <div className="grid gap-3 md:grid-cols-7">
      {days.map((day) => {
        const dateStr = format(day, "yyyy-MM-dd");
        const items = byDate.get(dateStr) ?? [];
        return (
          <Card
            key={dateStr}
            {...dropProps(dateStr)}
            onClick={() => canCreate && onNew(dateStr)}
            className={cn(
              "min-h-48 p-2",
              isSameDay(day, new Date()) && "border-brand/40",
              canCreate && "cursor-pointer hover:border-brand/30 transition-colors"
            )}
          >
            <p
              className={cn(
                "mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide",
                isToday(day) ? "text-brand" : "text-muted"
              )}
            >
              {format(day, "EEE d", { locale: it })}
            </p>
            <div className="space-y-1.5">
              {items.map((c) => (
                <button
                  key={c.id}
                  draggable={canEdit}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", c.id);
                    e.dataTransfer.effectAllowed = "move";
                    onDragStart(c.id);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(c.id);
                  }}
                  className="block w-full rounded-lg border border-line/70 bg-surface px-2 py-1.5 text-left transition-colors hover:border-brand/40 cursor-pointer"
                >
                  <p className="truncate text-[12px] font-medium leading-snug">{c.title}</p>
                  <p className="mt-0.5 truncate text-[10.5px] text-muted">
                    {[c.content_type?.name, c.channel?.name, fmtTime(c.publish_time)]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                  <span className="mt-1.5 flex items-center gap-1.5">
                    <Avatar name={c.owner?.full_name} src={c.owner?.avatar_url} size={16} />
                    <Badge className={cn(CONTENT_STATUS[c.status].className, "ml-auto")}>
                      {CONTENT_STATUS[c.status].label}
                    </Badge>
                  </span>
                </button>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ---------- List ----------

function ListView({
  contents,
  clubShort,
  canCreate,
  onOpen,
  onNew,
}: {
  contents: ContentItem[];
  clubShort: string;
  canCreate: boolean;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  if (contents.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<CalendarDays />}
          title="Nessun contenuto pianificato"
          description="Crea il primo contenuto per popolare il calendario editoriale."
          action={
            canCreate && (
              <Button variant="primary" onClick={onNew}>
                <Plus className="h-3.5 w-3.5" /> New Content
              </Button>
            )
          }
        />
      </Card>
    );
  }
  const dated = contents.filter((c) => c.publish_date);
  const undated = contents.filter((c) => !c.publish_date);

  const rowFor = (c: ContentItem) => (
    <li key={c.id}>
      <button
        onClick={() => onOpen(c.id)}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-background cursor-pointer"
      >
        <div className="w-16 shrink-0 text-center">
          <p className="text-[11px] font-semibold uppercase text-brand">
            {c.publish_date ? fmtDate(c.publish_date, "d MMM") : "—"}
          </p>
          <p className="text-[10px] text-muted">{fmtTime(c.publish_time)}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">{c.title}</p>
          <p className="truncate text-[11px] text-muted">
            {[
              c.content_type?.name,
              c.channel?.name,
              c.match ? matchLabel(c.match, clubShort) : null,
              c.content_players && c.content_players.length > 0
                ? `${c.content_players.length} player`
                : null,
            ]
              .filter(Boolean)
              .join(" · ") || "—"}
          </p>
        </div>
        <Avatar name={c.owner?.full_name} src={c.owner?.avatar_url} size={22} />
        <Badge className={PRIORITY[c.priority].className}>{PRIORITY[c.priority].label}</Badge>
        <Badge className={CONTENT_STATUS[c.status].className}>{CONTENT_STATUS[c.status].label}</Badge>
      </button>
    </li>
  );

  return (
    <Card>
      <ul className="divide-y divide-line/70 py-1">{dated.map(rowFor)}</ul>
      {undated.length > 0 && (
        <>
          <p className="border-t border-line px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Senza data
          </p>
          <ul className="divide-y divide-line/70 py-1">{undated.map(rowFor)}</ul>
        </>
      )}
    </Card>
  );
}

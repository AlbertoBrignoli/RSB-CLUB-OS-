"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckSquare, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useClub } from "@/lib/club-context";
import { logActivity } from "@/lib/activity";
import type { Match, Player, PriorityLevel, Task, TaskStatus } from "@/lib/types";
import { TASK_STATUS, cn } from "@/lib/utils";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, EmptyState, PageHeader, PageSkeleton, Tabs } from "@/components/ui/misc";
import { TaskCard, isTaskLate } from "@/components/tasks/task-card";
import { TaskForm, type ContentOption } from "@/components/tasks/task-form";
import { TaskDrawer } from "@/components/tasks/task-drawer";

const BOARD_COLUMNS: TaskStatus[] = ["todo", "in_progress", "review", "done", "blocked"];

export default function TasksPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TasksInner />
    </Suspense>
  );
}

function TasksInner() {
  const { club, userId, profile, can, loading: ctxLoading } = useClub();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [contents, setContents] = useState<ContentOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState("my");
  const [fStatus, setFStatus] = useState("");
  const [fPriority, setFPriority] = useState("");
  const [fMatch, setFMatch] = useState("");
  const [fLate, setFLate] = useState(false);

  const openId = searchParams.get("open");
  const showNew = searchParams.get("new") === "1" && can("tasks.create");

  const load = useCallback(async () => {
    if (!club) return;
    const sb = supabase();
    const [tasksRes, playersRes, matchesRes, contentsRes] = await Promise.all([
      sb.from("tasks")
        .select(
          "*, owner:profiles!tasks_owner_id_fkey(*), match:matches(*), player:players(*), task_assignees(user_id, profile:profiles(*))"
        )
        .eq("club_id", club.id)
        .order("created_at", { ascending: false }),
      sb.from("players").select("*").eq("club_id", club.id).eq("is_active", true).order("last_name"),
      sb.from("matches").select("*").eq("club_id", club.id).order("kickoff_at", { ascending: false }),
      sb.from("content")
        .select("id, title")
        .eq("club_id", club.id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    setTasks((tasksRes.data as Task[]) ?? []);
    setPlayers((playersRes.data as Player[]) ?? []);
    setMatches((matchesRes.data as Match[]) ?? []);
    setContents((contentsRes.data as ContentOption[]) ?? []);
    setLoading(false);
  }, [club]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    let list = tasks;
    if (fStatus) list = list.filter((t) => t.status === fStatus);
    if (fPriority) list = list.filter((t) => t.priority === fPriority);
    if (fMatch) list = list.filter((t) => t.match_id === fMatch);
    if (fLate) list = list.filter(isTaskLate);
    return list;
  }, [tasks, fStatus, fPriority, fMatch, fLate]);

  const myTasks = useMemo(
    () =>
      filtered.filter(
        (t) =>
          t.owner_id === userId ||
          (t.task_assignees ?? []).some((a) => a.user_id === userId)
      ),
    [filtered, userId]
  );

  // Ordina per deadline crescente (senza deadline in fondo).
  const byDeadline = useCallback((list: Task[]) => {
    return [...list].sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return a.deadline.localeCompare(b.deadline);
    });
  }, []);

  const openTask = useMemo(
    () => (openId ? tasks.find((t) => t.id === openId) ?? null : null),
    [openId, tasks]
  );

  const openDetail = useCallback(
    (id: string) => router.replace(`/tasks?open=${id}`, { scroll: false }),
    [router]
  );
  const closeOverlays = useCallback(
    () => router.replace("/tasks", { scroll: false }),
    [router]
  );

  const canEditTask = useCallback(
    (t: Task) =>
      can("tasks.manage") ||
      t.owner_id === userId ||
      (t.task_assignees ?? []).some((a) => a.user_id === userId),
    [can, userId]
  );

  async function moveTask(id: string, status: TaskStatus) {
    const task = tasks.find((t) => t.id === id);
    if (!task || !club || !userId || task.status === status || !canEditTask(task)) return;
    // Aggiornamento ottimistico della board.
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    const { error } = await supabase().from("tasks").update({ status }).eq("id", id);
    if (error) {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: task.status } : t)));
      return;
    }
    await logActivity({
      clubId: club.id,
      actorId: userId,
      action: "status_changed",
      entityType: "task",
      entityId: id,
      summary: `${profile?.full_name ?? "Qualcuno"} ha spostato "${task.title}" in ${TASK_STATUS[status].label}`,
    });
  }

  if (ctxLoading || loading) return <PageSkeleton />;

  const clubShort = club?.short_name ?? "RSB";

  // Raggruppa per owner per la vista "By User".
  const byOwner = new Map<string, Task[]>();
  for (const t of byDeadline(filtered)) {
    const key = t.owner_id ?? "";
    byOwner.set(key, [...(byOwner.get(key) ?? []), t]);
  }

  const renderList = (list: Task[]) =>
    list.length === 0 ? (
      <EmptyState
        icon={<CheckSquare />}
        title="Nessun task"
        description="Nessun task corrisponde ai filtri selezionati."
        action={
          can("tasks.create") ? (
            <Button variant="primary" onClick={() => router.replace("/tasks?new=1", { scroll: false })}>
              <Plus className="h-3.5 w-3.5" /> Nuovo task
            </Button>
          ) : undefined
        }
      />
    ) : (
      <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {list.map((t) => (
          <TaskCard key={t.id} task={t} onOpen={openDetail} clubShort={clubShort} />
        ))}
      </div>
    );

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Tasks"
        subtitle="Attività operative del team, collegate a contenuti, grafiche e partite."
        action={
          can("tasks.create") ? (
            <Button variant="primary" onClick={() => router.replace("/tasks?new=1", { scroll: false })}>
              <Plus className="h-3.5 w-3.5" /> New Task
            </Button>
          ) : undefined
        }
      />

      <Tabs
        className="mb-4"
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "my", label: "My Tasks", count: myTasks.length },
          { key: "all", label: "All Tasks", count: filtered.length },
          { key: "board", label: "Board" },
          { key: "byuser", label: "By User" },
        ]}
      />

      {/* Filtri */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="h-8 w-auto text-[13px]">
          <option value="">Tutti gli stati</option>
          {BOARD_COLUMNS.map((s) => (
            <option key={s} value={s}>
              {TASK_STATUS[s].label}
            </option>
          ))}
        </Select>
        <Select value={fPriority} onChange={(e) => setFPriority(e.target.value)} className="h-8 w-auto text-[13px]">
          <option value="">Tutte le priorità</option>
          {(["low", "medium", "high", "urgent"] as PriorityLevel[]).map((p) => (
            <option key={p} value={p}>
              {p === "low" ? "Low" : p === "medium" ? "Medium" : p === "high" ? "High" : "Urgent"}
            </option>
          ))}
        </Select>
        <Select value={fMatch} onChange={(e) => setFMatch(e.target.value)} className="h-8 w-auto max-w-52 text-[13px]">
          <option value="">Tutte le partite</option>
          {matches.map((m) => (
            <option key={m.id} value={m.id}>
              {m.is_home ? `${clubShort} vs ${m.opponent}` : `${m.opponent} vs ${clubShort}`}
            </option>
          ))}
        </Select>
        <button
          type="button"
          onClick={() => setFLate((v) => !v)}
          className={cn(
            "h-8 rounded-lg border px-3 text-[13px] font-medium transition-colors cursor-pointer",
            fLate
              ? "border-danger/40 bg-danger-soft text-danger"
              : "border-line text-muted hover:text-foreground"
          )}
        >
          In ritardo
        </button>
      </div>

      {tab === "my" && renderList(byDeadline(myTasks))}
      {tab === "all" && renderList(byDeadline(filtered))}

      {tab === "board" && (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          {BOARD_COLUMNS.map((status) => {
            const col = byDeadline(filtered.filter((t) => t.status === status));
            return (
              <div
                key={status}
                className="rounded-2xl bg-background/60 border border-line/60 p-2.5"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/task-id");
                  if (id) moveTask(id, status);
                }}
              >
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    {TASK_STATUS[status].label}
                  </span>
                  <span className="text-[11px] text-muted">{col.length}</span>
                </div>
                <div className="space-y-2">
                  {col.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      onOpen={openDetail}
                      clubShort={clubShort}
                      compact
                      draggable={canEditTask(t)}
                      onDragStart={(e, id) => e.dataTransfer.setData("text/task-id", id)}
                    />
                  ))}
                  {col.length === 0 && (
                    <p className="px-1 py-4 text-center text-[11px] text-muted/60">Trascina qui un task</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "byuser" && (
        <div className="space-y-6">
          {byOwner.size === 0 && (
            <EmptyState icon={<CheckSquare />} title="Nessun task" description="Nessun task corrisponde ai filtri selezionati." />
          )}
          {[...byOwner.entries()].map(([ownerId, list]) => {
            const owner = list[0]?.owner;
            return (
              <div key={ownerId || "none"}>
                <div className="mb-2 flex items-center gap-2">
                  <Avatar name={owner?.full_name} src={owner?.avatar_url} size={24} />
                  <span className="text-[13px] font-semibold">
                    {owner?.full_name ?? "Senza owner"}
                  </span>
                  <span className="text-[11px] text-muted">{list.length} task</span>
                </div>
                <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                  {list.map((t) => (
                    <TaskCard key={t.id} task={t} onOpen={openDetail} clubShort={clubShort} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TaskForm
        open={!!showNew}
        onClose={closeOverlays}
        onSaved={() => {
          closeOverlays();
          load();
        }}
        players={players}
        matches={matches}
        contents={contents}
      />

      {openTask && (
        <TaskDrawer
          task={openTask}
          onClose={closeOverlays}
          onChanged={load}
          players={players}
          matches={matches}
          contents={contents}
        />
      )}
    </div>
  );
}

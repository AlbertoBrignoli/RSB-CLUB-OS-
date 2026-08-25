"use client";

import Link from "next/link";
import { FileText, Palette, Trophy, User } from "lucide-react";
import type { Task } from "@/lib/types";
import { PRIORITY, TASK_STATUS, cn, fmtDate, matchLabel, playerName } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/misc";

// Un task è "in ritardo" se ha una deadline passata e non è concluso.
export function isTaskLate(t: Task): boolean {
  if (!t.deadline || t.status === "done") return false;
  return new Date(t.deadline) < new Date(new Date().toDateString());
}

export function TaskCard({
  task,
  onOpen,
  clubShort,
  draggable,
  onDragStart,
  compact,
}: {
  task: Task;
  onOpen: (id: string) => void;
  clubShort?: string;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, id: string) => void;
  compact?: boolean;
}) {
  const late = isTaskLate(task);

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={(e) => onDragStart?.(e, task.id)}
      onClick={() => onOpen(task.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(task.id);
      }}
      className={cn(
        "w-full rounded-xl border border-line/70 bg-surface px-3 py-2.5 text-left transition-colors hover:border-brand/30 cursor-pointer",
        draggable && "active:cursor-grabbing"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-[13px] font-medium">{task.title}</p>
        {!compact && (
          <Badge className={PRIORITY[task.priority].className}>{PRIORITY[task.priority].label}</Badge>
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <Avatar name={task.owner?.full_name} src={task.owner?.avatar_url} size={18} />
        <span className={cn("text-[11px]", late ? "font-semibold text-danger" : "text-muted")}>
          {fmtDate(task.deadline)}
          {late && " · in ritardo"}
        </span>
        <span className="ml-auto flex items-center gap-1">
          {compact && (
            <Badge className={PRIORITY[task.priority].className}>{PRIORITY[task.priority].label}</Badge>
          )}
          <Badge className={TASK_STATUS[task.status].className}>{TASK_STATUS[task.status].label}</Badge>
        </span>
      </div>

      {(task.player_id || task.match_id || task.content_id || task.graphic_id) && (
        <div
          className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line/60 pt-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {task.player_id && (
            <Link
              href={`/players/${task.player_id}`}
              className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-brand transition-colors"
            >
              <User className="h-3 w-3" /> {task.player ? playerName(task.player) : "Giocatore"}
            </Link>
          )}
          {task.match_id && (
            <Link
              href={`/matches/${task.match_id}`}
              className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-brand transition-colors"
            >
              <Trophy className="h-3 w-3" /> {task.match ? matchLabel(task.match, clubShort) : "Partita"}
            </Link>
          )}
          {task.content_id && (
            <Link
              href={`/content?open=${task.content_id}`}
              className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-brand transition-colors"
            >
              <FileText className="h-3 w-3" /> Contenuto
            </Link>
          )}
          {task.graphic_id && (
            <Link
              href={`/graphics?open=${task.graphic_id}`}
              className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-brand transition-colors"
            >
              <Palette className="h-3 w-3" /> Grafica
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

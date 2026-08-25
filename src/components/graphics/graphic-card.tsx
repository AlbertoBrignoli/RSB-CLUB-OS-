"use client";

import { CalendarDays, FileText, Trophy, User } from "lucide-react";
import type { Graphic } from "@/lib/types";
import { PRIORITY, cn, daysUntil, fmtDate, matchLabel, playerName } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/misc";

// Card compatta della board Kanban. Il drag è HTML5 nativo.
export function GraphicCard({
  graphic,
  clubShort,
  draggable,
  onOpen,
}: {
  graphic: Graphic;
  clubShort: string;
  draggable: boolean;
  onOpen: () => void;
}) {
  const overdue =
    !!graphic.deadline &&
    daysUntil(graphic.deadline) < 0 &&
    !["approved", "published"].includes(graphic.status);

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", graphic.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen();
      }}
      className={cn(
        "rounded-xl border border-line/80 bg-surface p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        "cursor-pointer transition-colors hover:border-brand/40",
        draggable && "active:cursor-grabbing"
      )}
    >
      <p className="text-[13px] font-medium leading-snug">{graphic.title}</p>

      {(graphic.content || graphic.match || graphic.player) && (
        <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] text-muted">
          {graphic.content && (
            <span className="inline-flex max-w-full items-center gap-1">
              <FileText className="h-3 w-3 shrink-0" />
              <span className="truncate">{graphic.content.title}</span>
            </span>
          )}
          {graphic.match && (
            <span className="inline-flex items-center gap-1">
              <Trophy className="h-3 w-3 shrink-0" />
              {matchLabel(graphic.match, clubShort)}
            </span>
          )}
          {graphic.player && (
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3 shrink-0" />
              {playerName(graphic.player)}
            </span>
          )}
        </div>
      )}

      <div className="mt-2.5 flex items-center gap-2">
        {graphic.deadline && (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[11px]",
              overdue ? "font-semibold text-danger" : "text-muted"
            )}
          >
            <CalendarDays className="h-3 w-3" />
            {fmtDate(graphic.deadline)}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          <Badge className={PRIORITY[graphic.priority].className}>
            {PRIORITY[graphic.priority].label}
          </Badge>
          {graphic.designer && (
            <Avatar
              name={graphic.designer.full_name}
              src={graphic.designer.avatar_url}
              size={20}
            />
          )}
        </span>
      </div>
    </div>
  );
}

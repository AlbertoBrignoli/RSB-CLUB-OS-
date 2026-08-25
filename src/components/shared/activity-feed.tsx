"use client";

import Link from "next/link";
import type { ActivityEntry } from "@/lib/types";
import { entityUrl } from "@/lib/activity";
import { timeAgo } from "@/lib/utils";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { History } from "lucide-react";

export function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return (
      <EmptyState
        className="py-8"
        icon={<History />}
        title="Nessuna attività"
        description="Le azioni del team compariranno qui."
      />
    );
  }
  return (
    <ul className="space-y-3">
      {entries.map((a) => (
        <li key={a.id} className="flex items-start gap-2.5">
          <Avatar name={a.actor?.full_name} src={a.actor?.avatar_url} size={24} />
          <div className="min-w-0 flex-1">
            <Link
              href={entityUrl(a.entity_type, a.entity_id)}
              className="block text-[13px] leading-snug hover:text-brand transition-colors"
            >
              {a.summary}
            </Link>
            <span className="text-[11px] text-muted">{timeAgo(a.created_at)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

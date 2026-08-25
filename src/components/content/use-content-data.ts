"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useClub } from "@/lib/club-context";
import type { ContentItem, Match, Player } from "@/lib/types";

// Select condiviso per il contenuto, con gli hint FK espliciti verso profiles.
export const CONTENT_SELECT =
  "*, content_type:content_types(*), channel:social_channels(*), match:matches(*), " +
  "owner:profiles!content_owner_id_fkey(*), reviewer:profiles!content_reviewer_id_fkey(*), " +
  "content_players(player_id)";

// Carica contenuti + giocatori + partite del club (dati comuni a /editorial e /content).
export function useContentData() {
  const { club } = useClub();
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!club) return;
    const sb = supabase();
    const [contentRes, playersRes, matchesRes] = await Promise.all([
      sb.from("content")
        .select(CONTENT_SELECT)
        .eq("club_id", club.id)
        .order("publish_date", { ascending: true, nullsFirst: false })
        .order("publish_time", { ascending: true, nullsFirst: false }),
      sb.from("players")
        .select("*")
        .eq("club_id", club.id)
        .eq("is_active", true)
        .order("last_name"),
      sb.from("matches")
        .select("*")
        .eq("club_id", club.id)
        .order("kickoff_at", { ascending: false })
        .limit(30),
    ]);
    setContents((contentRes.data as unknown as ContentItem[]) ?? []);
    setPlayers((playersRes.data as Player[]) ?? []);
    setMatches((matchesRes.data as Match[]) ?? []);
    setLoading(false);
  }, [club]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { contents, players, matches, loading, refresh };
}

"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./supabase/client";
import type {
  Club, Season, Profile, Role, Membership, ContentType, SocialChannel,
} from "./types";

interface ClubContextValue {
  loading: boolean;
  error: string | null;
  userId: string | null;
  profile: Profile | null;
  club: Club | null;
  season: Season | null;
  role: Role | null;
  permissions: Set<string>;
  can: (perm: string) => boolean;
  team: Membership[]; // tutti i membri del club, con profilo e ruolo
  contentTypes: ContentType[];
  channels: SocialChannel[];
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const ClubContext = createContext<ClubContextValue | null>(null);

export function ClubProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [club, setClub] = useState<Club | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [team, setTeam] = useState<Membership[]>([]);
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [channels, setChannels] = useState<SocialChannel[]>([]);

  const load = useCallback(async () => {
    const sb = supabase();
    setError(null);
    try {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      setUserId(user.id);

      let { data: membership } = await sb
        .from("memberships")
        .select("*, role:roles(*)")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      // Primo accesso in assoluto: il primo utente diventa Super Admin del club seed.
      if (!membership) {
        // La rpc torna null se il bootstrap è già avvenuto (anche in un doppio
        // mount di StrictMode): in ogni caso ricontrolliamo la membership.
        await sb.rpc("bootstrap_first_admin");
        const retry = await sb
          .from("memberships")
          .select("*, role:roles(*)")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();
        membership = retry.data;
      }

      if (!membership) {
        setError(
          "Il tuo account non è ancora stato aggiunto al progetto. Chiedi al Super Admin AUVI di invitarti."
        );
        setLoading(false);
        return;
      }

      const clubId = membership.club_id as string;
      setRole((membership as { role?: Role }).role ?? null);

      const [profileRes, clubRes, seasonRes, permsRes, teamRes, typesRes, channelsRes] =
        await Promise.all([
          sb.from("profiles").select("*").eq("id", user.id).single(),
          sb.from("clubs").select("*").eq("id", clubId).single(),
          sb.from("seasons").select("*").eq("club_id", clubId).eq("is_current", true).maybeSingle(),
          sb.rpc("my_permissions", { p_club: clubId }),
          sb.from("memberships").select("*, profile:profiles(*), role:roles(*)").eq("club_id", clubId),
          sb.from("content_types").select("*").eq("club_id", clubId).eq("is_active", true).order("sort"),
          sb.from("social_channels").select("*").eq("club_id", clubId).eq("is_active", true).order("sort"),
        ]);

      setProfile(profileRes.data);
      setClub(clubRes.data);
      setSeason(seasonRes.data);
      setPermissions(new Set(((permsRes.data as string[] | null) ?? [])));
      setTeam((teamRes.data as Membership[]) ?? []);
      setContentTypes(typesRes.data ?? []);
      setChannels(channelsRes.data ?? []);
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore di caricamento");
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const can = useCallback((perm: string) => permissions.has(perm), [permissions]);

  const signOut = useCallback(async () => {
    await supabase().auth.signOut();
    router.replace("/login");
  }, [router]);

  const value = useMemo<ClubContextValue>(
    () => ({
      loading, error, userId, profile, club, season, role, permissions, can,
      team, contentTypes, channels, refresh: load, signOut,
    }),
    [loading, error, userId, profile, club, season, role, permissions, can, team, contentTypes, channels, load, signOut]
  );

  return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>;
}

export function useClub() {
  const ctx = useContext(ClubContext);
  if (!ctx) throw new Error("useClub deve essere usato dentro ClubProvider");
  return ctx;
}

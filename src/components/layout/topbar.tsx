"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell, ChevronDown, LogOut, Plus, Search, FileText, Palette,
  CheckSquare, Upload, Trophy, UserPlus,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useClub } from "@/lib/club-context";
import { entityUrl } from "@/lib/activity";
import type { Notification } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";
import { Avatar, Kbd } from "@/components/ui/misc";
import { CommandPalette } from "./command-palette";

function useClickOutside(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);
  return ref;
}

const CREATE_ITEMS = [
  { label: "New Content", href: "/content?new=1", icon: FileText, perm: "content.create" },
  { label: "New Graphic Request", href: "/graphics?new=1", icon: Palette, perm: "graphics.request" },
  { label: "New Task", href: "/tasks?new=1", icon: CheckSquare, perm: "tasks.create" },
  { label: "Upload Media", href: "/media?new=1", icon: Upload, perm: "media.upload" },
  { label: "Add Match", href: "/matches?new=1", icon: Trophy, perm: "matches.manage" },
  { label: "Add Player", href: "/team?new=1", icon: UserPlus, perm: "players.manage" },
];

export function Topbar() {
  const router = useRouter();
  const { profile, role, userId, can, signOut } = useClub();
  const [createOpen, setCreateOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const createRef = useClickOutside(() => setCreateOpen(false));
  const userRef = useClickOutside(() => setUserOpen(false));
  const bellRef = useClickOutside(() => setBellOpen(false));

  const unread = notifications.filter((n) => !n.read_at).length;

  async function loadNotifications() {
    if (!userId) return;
    const { data } = await supabase()
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(25);
    setNotifications((data as Notification[]) ?? []);
  }

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  async function openNotification(n: Notification) {
    if (!n.read_at) {
      await supabase()
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", n.id);
    }
    setBellOpen(false);
    loadNotifications();
    router.push(entityUrl(n.entity_type, n.entity_id));
  }

  async function markAllRead() {
    if (!userId) return;
    await supabase()
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    loadNotifications();
  }

  const visibleCreate = CREATE_ITEMS.filter((i) => can(i.perm));

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur lg:px-6">
        <button
          onClick={() => setPaletteOpen(true)}
          className="flex h-8.5 w-full max-w-sm items-center gap-2 rounded-lg border border-line bg-background px-3 text-[13px] text-muted transition-colors hover:border-brand/30 cursor-pointer"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Cerca giocatori, partite, contenuti…</span>
          <Kbd>⌘K</Kbd>
        </button>

        <div className="ml-auto flex items-center gap-1.5">
          {visibleCreate.length > 0 && (
            <div className="relative" ref={createRef}>
              <button
                onClick={() => setCreateOpen((v) => !v)}
                className="flex h-8.5 items-center gap-1.5 rounded-lg bg-brand px-3 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-brand-strong cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> Create
                <ChevronDown className="h-3 w-3 opacity-70" />
              </button>
              {createOpen && (
                <div className="absolute right-0 top-10 w-56 rounded-xl border border-line bg-surface p-1 shadow-lg animate-fade-up">
                  {visibleCreate.map((item) => (
                    <button
                      key={item.href}
                      onClick={() => {
                        setCreateOpen(false);
                        router.push(item.href);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-background cursor-pointer"
                    >
                      <item.icon className="h-4 w-4 text-muted" />
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="relative" ref={bellRef}>
            <button
              onClick={() => {
                setBellOpen((v) => !v);
                loadNotifications();
              }}
              className="relative flex h-8.5 w-8.5 items-center justify-center rounded-lg text-muted transition-colors hover:bg-black/[0.04] hover:text-foreground cursor-pointer"
              aria-label="Notifiche"
            >
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-white">
                  {unread}
                </span>
              )}
            </button>
            {bellOpen && (
              <div className="absolute right-0 top-10 w-80 rounded-xl border border-line bg-surface shadow-lg animate-fade-up">
                <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
                  <span className="text-xs font-semibold">Notifiche</span>
                  {unread > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-[11px] text-brand hover:underline cursor-pointer"
                    >
                      Segna tutte lette
                    </button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto p-1">
                  {notifications.length === 0 && (
                    <p className="px-3 py-6 text-center text-xs text-muted">Nessuna notifica</p>
                  )}
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => openNotification(n)}
                      className={cn(
                        "block w-full rounded-lg px-3 py-2 text-left hover:bg-background cursor-pointer",
                        !n.read_at && "bg-brand-soft/50"
                      )}
                    >
                      <p className="text-[12.5px] font-medium leading-snug">{n.title}</p>
                      {n.body && (
                        <p className="mt-0.5 line-clamp-2 text-[11.5px] text-muted">{n.body}</p>
                      )}
                      <p className="mt-0.5 text-[10px] text-muted/80">{timeAgo(n.created_at)}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={userRef}>
            <button
              onClick={() => setUserOpen((v) => !v)}
              className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-black/[0.04] cursor-pointer"
            >
              <Avatar name={profile?.full_name} src={profile?.avatar_url} size={28} />
            </button>
            {userOpen && (
              <div className="absolute right-0 top-10 w-52 rounded-xl border border-line bg-surface p-1 shadow-lg animate-fade-up">
                <div className="border-b border-line px-2.5 py-2">
                  <p className="truncate text-[13px] font-semibold">{profile?.full_name}</p>
                  <p className="text-[11px] text-muted">{role?.name}</p>
                </div>
                <button
                  onClick={signOut}
                  className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-danger hover:bg-danger-soft cursor-pointer"
                >
                  <LogOut className="h-4 w-4" /> Esci
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}

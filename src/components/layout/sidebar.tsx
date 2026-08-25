"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Trophy, CalendarDays, FileText, Palette,
  Image as ImageIcon, CheckSquare, BarChart3, UserCog, Settings, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClub } from "@/lib/club-context";

const NAV = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/team", label: "Team", icon: Users },
  { href: "/matches", label: "Matches", icon: Trophy },
  { href: "/editorial", label: "Editorial", icon: CalendarDays },
  { href: "/content", label: "Content", icon: FileText },
  { href: "/graphics", label: "Graphics", icon: Palette },
  { href: "/media", label: "Media", icon: ImageIcon },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/reports", label: "Reports", icon: BarChart3, perm: "reports.view" },
  { href: "/users", label: "Users", icon: UserCog, perm: "users.manage" },
  { href: "/settings", label: "Settings", icon: Settings, perm: "settings.manage" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { club, season, can } = useClub();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-line bg-surface lg:flex">
      <div className="flex items-center gap-2.5 px-4 py-4">
        {club?.logo_url ? (
          <Image
            src={club.logo_url}
            alt={club.name}
            width={40}
            height={40}
            unoptimized
            className="h-10 w-10 shrink-0 rounded-xl object-contain"
          />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white">
            <Shield className="h-4.5 w-4.5" />
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-tight">
            {club?.name ?? "Club OS"}
          </p>
          <p className="text-[10px] uppercase tracking-widest text-muted">
            Club OS · {season?.name ?? ""}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
        {NAV.filter((item) => !item.perm || can(item.perm)).map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href)) ||
            (item.href === "/team" && pathname.startsWith("/players"));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                active
                  ? "bg-brand-soft text-brand"
                  : "text-muted hover:bg-black/[0.04] hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line px-4 py-3">
        <p className="text-[10px] font-medium uppercase tracking-widest text-muted/70">
          Powered by <span className="text-brand font-semibold">AUVI</span>
        </p>
      </div>
    </aside>
  );
}

// Barra di navigazione mobile (bottom bar) — sezioni principali
export function MobileNav() {
  const pathname = usePathname();
  const items = NAV.slice(0, 5);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 backdrop-blur lg:hidden">
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium",
              active ? "text-brand" : "text-muted"
            )}
          >
            <item.icon className="h-4.5 w-4.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

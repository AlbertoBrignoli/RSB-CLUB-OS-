"use client";

import { useEffect } from "react";
import { ClubProvider, useClub } from "@/lib/club-context";
import { Sidebar, MobileNav } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { PageSkeleton } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

function Shell({ children }: { children: React.ReactNode }) {
  const { loading, error, signOut } = useClub();

  // Service worker per le Web Push (registrazione idempotente)
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <ShieldAlert className="h-10 w-10 text-muted/50" />
        <p className="max-w-md text-sm text-muted">{error}</p>
        <Button onClick={signOut}>Torna al login</Button>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="lg:pl-56">
        {!loading && <Topbar />}
        <main className="mx-auto max-w-7xl px-4 py-6 pb-24 lg:px-8 lg:pb-10">
          {loading ? <PageSkeleton /> : children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClubProvider>
      <Shell>{children}</Shell>
    </ClubProvider>
  );
}
